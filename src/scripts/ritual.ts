/**
 * 起卦仪式 —— drives index.astro: 写下所问 →（拦截 | 择类）→ 静心 → 摇卦 ×6 → 成卦 → 解读,
 * or 手动排盘 → 择类 → 解读; and 往卦, 分享卡, 音效.
 *
 * One screen is shown at a time and every move is checked against
 * {@link NEXT}, so nothing leads back once 静心 starts. Durations live in
 * tokens.css; the script waits on the CSS animations instead of repeating them.
 */
import { ERRORS } from "../data/copy.js";
import {
	afterJudge,
	benLines,
	FALLBACK,
	fromBeijingInput,
	isMoving,
	isYang,
	type Judgement,
	NEXT,
	nthThrow,
	parseYao,
	posName,
	type Screen,
	settled,
	stack,
	toBeijingInput,
	tossCaption,
	YAO_NAME,
	yaoHtml,
	yaoTitle,
} from "../lib/flow.js";
import { asked, entries, forget, record } from "../lib/history.js";
import type { LateZiSect } from "../lib/liuyao/calendar.js";
import type { Gender, Question, Topic } from "../lib/liuyao/duan.js";
import type { CastResult, Yao } from "../lib/liuyao/najia.js";
import type { Reading } from "../lib/reading.js";
import { coinsSound, qingSound, setSound, soundOn, unlock } from "./sound.js";

const MAX_LENGTH = 200;
/** judge.ts gives Jev 3s; leave room for the round trip. */
const JUDGE_TIMEOUT_MS = 5000;
// 震动 (Android only: Safari has no Vibration API). Initial values, adjust by feel.
/** One tick per full swing of the coins (2 × --t-shake) while shaking. */
const SHAKE_BUZZ_MS = 15;
/** Three coins landing, in step with coinsSound. */
const LAND_BUZZ = [20, 50, 20, 50, 20];

/** A dynamic import that can be retried after a failed load. */
function lazy<T>(load: () => Promise<T>): () => Promise<T> {
	let p: Promise<T> | undefined;
	return () =>
		(p ??= load().catch((err: unknown) => {
			p = undefined;
			throw err;
		}));
}

// The engine pulls in tyme4ts (~80KB gzip) and the reading all 64 卦's text:
// keep both out of the first screen.
const loadEngine = lazy(() => import("../lib/liuyao/najia.js"));
const loadReading = lazy(() => import("../lib/reading.js"));
// 解读页的渲染和卦名字体规则也按需加载，不进首屏包；页面 load、首屏入场动画播完之后预热（见文件末尾）。
const loadView = lazy(() => import("./view.js"));
type View = Awaited<ReturnType<typeof loadView>>;
const loadCard = lazy(() => import("./card.js"));

/** localStorage, or `null` where the browser blocks it. */
const store = (() => {
	try {
		return localStorage;
	} catch {
		return null;
	}
})();

/** The cast so far, and what the reading needs. */
const session = {
	question: "",
	judgement: FALLBACK,
	ask: null as Question | null,
	params: [] as Yao[],
	/** 起卦时刻: the first throw, or entered by hand. */
	date: undefined as Date | undefined,
	lateZi: "day-stays" as LateZiSect,
	result: undefined as CastResult | undefined,
};

const castOptions = () => ({ date: session.date ?? new Date(), lateZi: session.lateZi });

const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) =>
	root.querySelector(sel) as T;
const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => [
	...root.querySelectorAll<T>(sel),
];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** A duration from tokens.css, in ms. */
function token(name: string): number {
	const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
	return v.endsWith("ms") ? Number.parseFloat(v) : Number.parseFloat(v) * 1000;
}

/** Resolves when el's finite animations end, or are cancelled because their screen was hidden. */
function settle(el: Element) {
	const finite = el
		.getAnimations({ subtree: true })
		.filter((a) => a.effect?.getComputedTiming().endTime !== Number.POSITIVE_INFINITY);
	return Promise.allSettled(finite.map((a) => a.finished));
}

// ---------------------------------------------------------------- screens

let current: Screen = "home";
const screen = (s: Screen) => $(`[data-screen="${s}"]`);

function go(next: Screen) {
	if (!NEXT[current].includes(next)) throw new Error(`no way from ${current} to ${next}`);
	if (next === "reading" || next === "history") {
		const paper = getComputedStyle(document.documentElement).getPropertyValue("--paper").trim();
		$('meta[name="theme-color"]').setAttribute("content", paper);
	}
	screen(current).hidden = true;
	current = next;
	const el = screen(next);
	el.hidden = false;
	window.scrollTo(0, 0);
	(el.querySelector<HTMLElement>("[data-autofocus]") ?? el).focus({ preventScroll: true });
	if (next === "manual") when.value ||= toBeijingInput(new Date());
	if (next === "calm") void calm();
	if (next === "cast") showThrow(0);
	if (next === "history") void showHistory();
}

document.addEventListener("click", (e) => {
	const b = (e.target as Element).closest<HTMLElement>("[data-go], [data-proceed]");
	if (!b) return;
	if (b.hasAttribute("data-proceed")) return proceed(true);
	if (b.hasAttribute("data-clear")) setQuestion("");
	go(b.dataset.go as Screen);
});

// ---------------------------------------------------------------- 写下所问

const askEl = screen("ask");
const q = $<HTMLTextAreaElement>("#q", askEl);
const count = $("[data-count]", askEl);
const askError = $("[data-error]", askEl);
const length = (s: string) => [...s].length;

function typed() {
	count.textContent = `${length(q.value)} / ${MAX_LENGTH}`;
	askError.textContent = "";
}

function setQuestion(text: string) {
	q.value = text;
	typed();
}

// Never write q.value while typing: it can break an IME mid-composition.
q.addEventListener("input", typed);
q.addEventListener("keydown", (e) => {
	// isComposing / 229: this Enter picks an IME candidate, it does not submit.
	if (e.key === "Enter" && !e.shiftKey && !e.isComposing && e.keyCode !== 229) {
		e.preventDefault();
		void submit();
	}
});
for (const chip of $$("[data-chip]", askEl))
	chip.addEventListener("click", () => {
		setQuestion(chip.textContent ?? "");
		q.focus();
	});
$("[data-submit]", askEl).addEventListener("click", () => void submit());

async function judge(question: string): Promise<Judgement | "rate-limited"> {
	try {
		const res = await fetch("/api/judge", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ question }),
			signal: AbortSignal.timeout?.(JUDGE_TIMEOUT_MS),
		});
		if (res.status === 429) return "rate-limited";
		return res.ok ? ((await res.json()) as Judgement) : FALLBACK;
	} catch {
		// Offline, timed out, bad JSON: carry on without Jev.
		return FALLBACK;
	}
}

function fail(message: string) {
	askError.textContent = message;
	q.focus();
}

let sealing = false;
async function submit() {
	const text = q.value.trim();
	if (!text) return fail(ERRORS.empty);
	if (length(text) > MAX_LENGTH) return fail(ERRORS.tooLong);
	if (store && asked(entries(store), text)) return fail(ERRORS.asked);
	if (sealing) return;
	sealing = true;
	askEl.classList.add("sealing");
	try {
		// 落笔的印章动画与 Jev、引擎和解读各包的加载并行，都好了再走：开摇之后的路全在本地。
		const [j] = await Promise.all([judge(text), loadEngine(), loadReading(), loadView(), settle($(".stamp", askEl))]);
		if (j === "rate-limited") return fail(ERRORS.rateLimited);
		session.question = text;
		session.judgement = j;
		for (const el of $$("[data-question]")) el.textContent = text;
		proceed(false);
	} catch {
		fail(ERRORS.network); // a lazy chunk did not load
	} finally {
		askEl.classList.remove("sealing");
		sealing = false;
	}
}

function proceed(emergencySeen: boolean) {
	const next = afterJudge(session.judgement, emergencySeen);
	session.ask = settled(session.judgement);
	go(next);
	if (next === "topic") pickTopic(session.judgement.topic, null);
}

// ---------------------------------------------------------------- 择类

const topicEl = screen("topic");
const who = $("[data-who]", topicEl);
const topicDone = $<HTMLButtonElement>("[data-topic-done]", topicEl);
let topic: Topic | null = null;
let gender: Gender | null = null;

/** Jev's 婚恋 arrives preselected: only the gender is left to choose. */
function pickTopic(t: Topic | null, g: Gender | null) {
	topic = t;
	gender = g;
	for (const b of $$("[data-topic]", topicEl)) b.setAttribute("aria-pressed", String(b.dataset.topic === t));
	for (const b of $$("[data-gender]", topicEl)) b.setAttribute("aria-pressed", String(b.dataset.gender === g));
	const showWho = who.hidden && t === "婚恋";
	who.hidden = t !== "婚恋";
	topicDone.disabled = t === null || (t === "婚恋" && g === null);
	// On short screens the gender buttons appear below the fold.
	if (showWho) who.scrollIntoView({ block: "nearest" });
}

topicEl.addEventListener("click", (e) => {
	const b = (e.target as Element).closest<HTMLElement>("[data-topic], [data-gender]");
	if (b?.dataset.topic) pickTopic(b.dataset.topic as Topic, gender);
	if (b?.dataset.gender) pickTopic(topic, b.dataset.gender as Gender);
});
topicDone.addEventListener("click", () => {
	const t = topic;
	if (t === null) return;
	if (t !== "婚恋") session.ask = { topic: t };
	else if (gender) session.ask = { topic: t, gender };
	else return;
	if (session.params.length === 6) void read();
	else go("calm");
});

// ---------------------------------------------------------------- 静心

const calmEl = screen("calm");
const dots = $("[data-dots]", calmEl);
const ring = $("[data-ring]", calmEl);

function breath(n: number) {
	$$("span", dots).forEach((d, i) => d.classList.toggle("on", i <= n));
	dots.setAttribute("aria-label", `第${"一二三"[n]}息，共三息`);
}

async function calm() {
	let n = 0;
	breath(n);
	ring.onanimationiteration = () => breath(++n);
	await settle(ring);
	if (current === "calm") go("cast");
}
$("[data-skip]", calmEl).addEventListener("click", () => go("cast"));

// ---------------------------------------------------------------- 摇卦

const castEl = screen("cast");
const coinsEl = $("[data-coins]", castEl);
const coins = $$(".coin", coinsEl);
const caption = $("[data-caption]", castEl);
const shake = $<HTMLButtonElement>("[data-shake]", castEl);
/** The button plus the invisible switch over it (see Cast.astro); taps land on the switch. */
const pressEl = $("[data-press]", castEl);

let phase: "idle" | "holding" | "busy" = "idle";
let heldAt = 0;
let buzz = 0;
// The last yao's brush stroke and pause. The coins are free as soon as they
// land, so the next shake can start at once; only the throw waits for this.
let written: Promise<void> = Promise.resolve();

function showThrow(i: number) {
	$("[data-nth]", castEl).textContent = nthThrow(i);
	for (const li of $$("li", castEl)) li.classList.toggle("now", li.dataset.pos === String(i));
}

function press() {
	if (current !== "cast" || phase !== "idle") return;
	phase = "holding";
	heldAt = performance.now();
	coinsEl.classList.add("shaking");
	shake.classList.add("held");
	if (navigator.vibrate) {
		navigator.vibrate(SHAKE_BUZZ_MS);
		buzz = window.setInterval(() => navigator.vibrate(SHAKE_BUZZ_MS), token("--t-shake") * 2);
	}
}

/** A short tap still shakes for --t-hold before the coins leave the hand. */
async function release() {
	if (phase !== "holding") return;
	phase = "busy";
	await Promise.all([sleep(token("--t-hold") - (performance.now() - heldAt)), written]);
	stopShaking();
	await throwCoins();
	if (session.params.length < 6) phase = "idle";
}

function stopShaking() {
	coinsEl.classList.remove("shaking");
	shake.classList.remove("held");
	clearInterval(buzz);
}

/** Shaking that stopped too soon: back to idle, nothing thrown. */
function cancel() {
	if (phase !== "holding") return;
	phase = "idle";
	stopShaking();
}

pressEl.addEventListener("pointerdown", (e) => {
	if (e.button !== 0) return;
	// Touch is captured to the switch already. Capturing it here would send the
	// click to this div, and the switch would never toggle or tick.
	if (e.pointerType === "mouse") pressEl.setPointerCapture(e.pointerId);
	press();
});
pressEl.addEventListener("pointerup", () => void release());
pressEl.addEventListener("pointercancel", () => void release());
pressEl.addEventListener("contextmenu", (e) => e.preventDefault());
// Enter and screen-reader activation arrive as a bare click. The click that
// trails a pointer or Space throw finds phase "busy" and does nothing.
pressEl.addEventListener("click", () => {
	press();
	void release();
});
document.addEventListener("keydown", (e) => {
	if (current !== "cast" || e.code !== "Space") return;
	e.preventDefault();
	if (!e.repeat) press();
});
document.addEventListener("keyup", (e) => {
	if (current !== "cast" || e.code !== "Space") return;
	e.preventDefault();
	void release();
});

// 摇一摇: shaking the phone stands in for holding the button. The coins shake
// while the phone does and leave the hand once it stops. A throw can't be taken
// back, so shaking shorter than --t-hold (lifting the phone to look, a bump)
// is dropped instead of thrown.
// Initial values, tune on a real phone.
/** m/s² of the phone's own acceleration, gravity left out. */
const MOTION_SHAKE = 4;
/** No shaking this long means the hand has stopped. */
const MOTION_QUIET_MS = 400;

const motionBtn = $<HTMLButtonElement>("[data-motion]", castEl);
let byMotion = false;
let shookAt = 0;
let quiet = 0;

// Sensors only report on https, and only phones have them.
if (isSecureContext && "DeviceMotionEvent" in window && matchMedia("(pointer: coarse)").matches) motionBtn.hidden = false;

motionBtn.addEventListener("click", async () => {
	motionBtn.hidden = true;
	// iOS asks first, and only from a tap; Android just reports.
	const dme = DeviceMotionEvent as typeof DeviceMotionEvent & { requestPermission?: () => Promise<PermissionState> };
	try {
		if (dme.requestPermission && (await dme.requestPermission()) !== "granted") return;
	} catch {
		return;
	}
	addEventListener("devicemotion", onMotion);
	$(".touch", castEl).textContent = "摇动手机 · 停下掷出";
});

/** How hard the phone is moving, in m/s², gravity left out. */
function motionForce(e: DeviceMotionEvent): number {
	const a = e.acceleration;
	if (a?.x != null && a.y != null && a.z != null) return Math.hypot(a.x, a.y, a.z);
	// Phones without a gyroscope report only this. How far its length strays from
	// gravity misses most sideways shaking, but it is all there is.
	const g = e.accelerationIncludingGravity;
	if (g?.x != null && g.y != null && g.z != null) return Math.abs(Math.hypot(g.x, g.y, g.z) - 9.81);
	return 0;
}

function onMotion(e: DeviceMotionEvent) {
	if (current !== "cast" || motionForce(e) < MOTION_SHAKE) return;
	if (phase === "idle") {
		press();
		byMotion = true;
	}
	// A button or Space hold already under way keeps control.
	if (!byMotion) return;
	shookAt = performance.now();
	clearTimeout(quiet);
	quiet = window.setTimeout(() => {
		byMotion = false;
		if (shookAt - heldAt < token("--t-hold")) cancel();
		else void release();
	}, MOTION_QUIET_MS);
}

const yaoLabel = (i: number, y: Yao) => `${posName(i)} ${YAO_NAME[y]}${isMoving(y) ? " 动" : ""}`;

/** Resolves once the coins land; the yao is written in the background (`written`). */
async function throwCoins() {
	const { toss } = await loadEngine();
	const i = session.params.length;
	session.date ??= new Date();
	const { coins: faces, yao } = toss();
	session.params.push(yao);

	// The result is fixed above; the flip only turns each coin to its face.
	coins.forEach((coin, k) => {
		const face = faces[k] === 3 ? 180 : 0;
		const turns = 2 + Math.floor(Math.random() * 3);
		coin.style.setProperty("--from", coin.style.getPropertyValue("--face") || "0deg");
		coin.style.setProperty("--face", `${face}deg`);
		coin.style.setProperty("--to", `${turns * 360 + face}deg`);
		coin.style.setProperty("--tilt", `${Math.round(Math.random() * 30 - 15)}deg`);
	});
	coinsEl.classList.add("flipping");
	await settle(coinsEl);
	coinsEl.classList.remove("flipping");
	coinsSound();
	navigator.vibrate?.(LAND_BUZZ);
	caption.textContent = tossCaption(yao);
	written = writeYao(i, yao);
}

async function writeYao(i: number, yao: Yao) {
	const slot = $(`[data-pos="${i}"] .slot`, castEl);
	slot.innerHTML = yaoHtml(isYang(yao), isMoving(yao), yaoLabel(i, yao));
	await settle(slot);

	if (i < 5) {
		await sleep(token("--t-pause"));
		showThrow(i + 1);
	} else {
		await sleep(token("--t-hush"));
		await reveal();
	}
}

// ---------------------------------------------------------------- 成卦

const revealEl = screen("reveal");

/** 成卦: from here the cast counts (一事一占), so it goes into 往卦 at once, before it is read. */
function formed(r: CastResult): CastResult {
	session.result = r;
	try {
		if (!store) throw new Error("storage blocked");
		record(store, {
			question: session.question,
			ask: session.ask as Question,
			params: session.params,
			at: (session.date as Date).toISOString(),
			lateZi: session.lateZi,
		});
	} catch {
		$("[data-storage]", readingEl).hidden = false;
	}
	return r;
}

async function reveal() {
	const [{ cast }, { setName }] = await Promise.all([loadEngine(), loadView()]);
	const r = formed(cast(session.params, castOptions()));

	$("[data-ben-lines]", revealEl).innerHTML = benLines(r.params);
	setName($("[data-ben-name]", revealEl), r.gua.name);

	for (const el of $$("[data-bian]", revealEl)) el.hidden = r.bian === null;
	if (r.bian) {
		$("[data-bian-lines]", revealEl).innerHTML = stack(
			[...r.bian.mark].map((bit, i) => yaoHtml(bit === "1", false, yaoTitle(i, bit === "1"))),
		);
		setName($("[data-bian-name]", revealEl), r.bian.name);
	}

	const g = r.ganzhi;
	$("[data-ganzhi]", revealEl).innerHTML =
		`${g.year}年 ${g.month}月 ${g.day}日<span class="hour"> ${g.hour}时</span> · 旬空 ${g.xkong}`;
	go("reveal");
	qingSound();
}

$("[data-read]", revealEl).addEventListener("click", () => void read());

// ---------------------------------------------------------------- 解读

const readingEl = screen("reading");

/** 展卷 from 成卦, or straight from 择类 after 手动排盘. */
async function read() {
	const [{ cast }, { compose }, view] = await Promise.all([loadEngine(), loadReading(), loadView()]);
	const { ask } = session;
	if (!NEXT[current].includes("reading") || !ask) return;
	const r = session.result ?? formed(cast(session.params, castOptions()));
	show(view, r, compose(r, ask), session.question, (session.date as Date).toISOString());
	go("reading");
}

/** What the reading page shows now; the 分享卡 is drawn from it. */
let shown: { question: string; r: CastResult; x: Reading } | undefined;

/** `at`: the moment of the cast, which finds its 往卦 record (回访卡、到时提醒). */
function show(view: View, r: CastResult, x: Reading, question: string, at: string) {
	shown = { question, r, x };
	// 所问默认不上卡
	withQ.checked = false;
	$("[data-with-q-label]", shareEl).hidden = !question;
	cardImg.removeAttribute("src");
	view.render(readingEl, r, x, question, at, fromHistory);
}

// ---------------------------------------------------------------- 分享卡

const shareEl = $<HTMLDialogElement>("[data-share-dialog]", readingEl);
const cardImg = $<HTMLImageElement>("[data-card]", shareEl);
const withQ = $<HTMLInputElement>("[data-with-q]", shareEl);
const save = $<HTMLAnchorElement>("[data-save]", shareEl);
const cardError = $("[data-card-error]", shareEl);

/** Only the latest draw may land: ticking 所问上卡 twice quickly starts two. */
let draws = 0;

async function drawCard() {
	if (!shown) return;
	const { question, r, x } = shown;
	const n = ++draws;
	cardError.textContent = "";
	try {
		const { card } = await loadCard();
		const url = await card(r, x.ben, withQ.checked ? question : "");
		if (n !== draws) return;
		cardImg.src = url;
		cardImg.alt = `分享卡：${r.gua.name}${r.bian ? `之${r.bian.name}` : ""}`;
		save.href = url;
		save.download = `六爻-${r.gua.name}.png`;
	} catch {
		cardError.textContent = ERRORS.share;
	}
}

$("[data-share]", readingEl).addEventListener("click", () => {
	shareEl.showModal();
	void drawCard();
});
withQ.addEventListener("change", () => void drawCard());

// ---------------------------------------------------------------- 往卦

const historyEl = screen("history");
const pastList = $("[data-list]", historyEl);
const pastFail = $("[data-fail]", historyEl);
const forgetBtn = $<HTMLButtonElement>("[data-forget]", historyEl);
const back = $("[data-back]", readingEl);
/** The reading on show was opened from 往卦, so its back arrow returns there. */
let fromHistory = false;

/**
 * The list is drawn by view.ts (自记、个人复盘); opening a record comes back here.
 * Whether there is anything to list is known here, so 还没有往卦 shows without the lazy chunks.
 */
async function showHistory() {
	disarm();
	const empty = !store || !entries(store).length;
	historyEl.classList.toggle("empty", empty);
	pastFail.textContent = "";
	if (empty) return;
	pastList.setAttribute("aria-busy", "true");
	try {
		const view = await loadView();
		await view.list(historyEl, () => Promise.all([loadEngine(), loadReading()]), (e, r, x) => {
			fromHistory = true;
			back.setAttribute("aria-label", "回到往卦");
			show(view, r, x, e.question, e.at);
			go("reading");
		});
	} catch {
		// Chromium 记住了失败的动态 import，在页内重试不会再发请求：提示里请人重新打开页面。
		pastFail.textContent = pastFail.dataset.fail ?? "";
	}
	pastList.removeAttribute("aria-busy");
}

back.addEventListener("click", (e) => {
	if (!fromHistory) return;
	e.preventDefault();
	go("history");
});

// 清除全部记录要点两次。
const FORGET = forgetBtn.textContent ?? "";
function disarm() {
	delete forgetBtn.dataset.armed;
	forgetBtn.textContent = FORGET;
}
forgetBtn.addEventListener("click", () => {
	if (!("armed" in forgetBtn.dataset)) {
		forgetBtn.dataset.armed = "";
		forgetBtn.textContent = forgetBtn.dataset.confirm ?? FORGET;
		return;
	}
	try {
		if (store) forget(store);
	} catch {
		// Blocked storage has nothing to clear.
	}
	void showHistory();
});

// ---------------------------------------------------------------- 手动排盘

const manualEl = screen("manual");
const when = $<HTMLInputElement>("#when", manualEl);
const manualError = $("[data-error]", manualEl);

$("[data-manual]", manualEl).addEventListener("submit", async (e) => {
	e.preventDefault();
	const yao = parseYao($<HTMLInputElement>("#yao", manualEl).value);
	const date = fromBeijingInput(when.value);
	manualError.textContent = !yao ? ERRORS.yao : !date ? ERRORS.when : "";
	if (!yao || !date) return;
	try {
		await Promise.all([loadEngine(), loadReading(), loadView()]);
	} catch {
		manualError.textContent = ERRORS.network;
		return;
	}
	if (current !== "manual") return;
	session.params = yao;
	session.date = date;
	session.lateZi = $<HTMLInputElement>("[data-late-zi]", manualEl).checked ? "day-advances" : "day-stays";
	session.question = "";
	for (const el of $$("[data-question]")) el.textContent = "";
	go("topic");
	pickTopic(null, null);
});

// ---------------------------------------------------------------- 音效

const soundBtn = $<HTMLButtonElement>("[data-sound]");
function showSound() {
	soundBtn.setAttribute("aria-pressed", String(soundOn()));
	soundBtn.setAttribute("aria-label", `音效：${soundOn() ? "已开启" : "已关闭"}`);
}
soundBtn.addEventListener("click", () => {
	setSound(!soundOn());
	showSound();
});
showSound();
// Any tap or key will do to let audio start later, when the coins land.
addEventListener("pointerup", unlock);
addEventListener("keydown", unlock);

// ---------------------------------------------------------------- 首屏日期

// The date is the page's LCP: today.ts is tiny and pulls in tyme4ts only near a 节, so it
// starts now. Offline, the date simply stays blank.
import("../lib/today.js")
	.then((m) => m.todayText())
	.then((text) => {
		$("[data-today]").textContent = text;
	}, () => {});
// Warm the engine and the reading view after load, once the first screen has played its entrance
// (about 2s): tyme4ts then neither janks it nor counts toward the LCP, which a request finished
// before the date is presented would. If either fails here, submitting the question retries it
// and reports the network.
addEventListener("load", () =>
	settle(screen("home")).then(() => {
		loadView().catch(() => {});
		loadEngine().catch(() => {});
	}),
);

// 「再问一事」「起卦」 reload the page into 写下所问, so nothing of an earlier cast carries over.
// 卦页上的「起卦」「往卦」也是这样进来。
const entry = new URLSearchParams(location.search);
if (entry.has("ask") || entry.has("history")) {
	window.history.replaceState(null, "", "/");
	go(entry.has("ask") ? "ask" : "history");
}
