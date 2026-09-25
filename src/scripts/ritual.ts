/**
 * 起卦仪式 —— drives index.astro: 写下所问 →（拦截 | 择类）→ 静心 → 摇卦 ×6 → 成卦.
 *
 * One screen is shown at a time and every move is checked against
 * {@link NEXT}, so nothing leads back once 静心 starts. Durations live in
 * tokens.css; the script waits on the CSS animations instead of repeating them.
 */
import { ERRORS } from "../data/copy.js";
import {
	afterJudge,
	FALLBACK,
	isMoving,
	isYang,
	type Judgement,
	NEXT,
	nthThrow,
	posName,
	type Screen,
	settled,
	tossCaption,
	YAO_NAME,
	yaoTitle,
} from "../lib/flow.js";
import type { Gender, Question, Topic } from "../lib/liuyao/duan.js";
import type { CastResult, Yao } from "../lib/liuyao/najia.js";

const MAX_LENGTH = 200;
/** judge.ts gives Jev 3s; leave room for the round trip. */
const JUDGE_TIMEOUT_MS = 5000;
const VIBRATE_MS = 20;

// The engine pulls in tyme4ts (~80KB gzip): keep it out of the first screen.
let engine: Promise<typeof import("../lib/liuyao/najia.js")> | undefined;
function loadEngine() {
	engine ??= import("../lib/liuyao/najia.js").catch((err: unknown) => {
		engine = undefined;
		throw err;
	});
	return engine;
}

/** What M8 needs to read the cast. */
const session = {
	question: "",
	judgement: FALLBACK,
	ask: null as Question | null,
	params: [] as Yao[],
	/** 起卦时刻: the first throw. */
	date: undefined as Date | undefined,
	result: undefined as CastResult | undefined,
};

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
	screen(current).hidden = true;
	current = next;
	const el = screen(next);
	el.hidden = false;
	window.scrollTo(0, 0);
	(el.querySelector<HTMLElement>("[data-autofocus]") ?? el).focus({ preventScroll: true });
	if (next === "calm") void calm();
	if (next === "cast") showThrow(0);
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
	if (sealing) return;
	sealing = true;
	askEl.classList.add("sealing");
	try {
		// 落笔的印章动画与 Jev、引擎加载并行，三者都好了再走。
		const [j] = await Promise.all([judge(text), loadEngine(), settle($(".stamp", askEl))]);
		if (j === "rate-limited") return fail(ERRORS.rateLimited);
		session.question = text;
		session.judgement = j;
		for (const el of $$("[data-question]")) el.textContent = text;
		proceed(false);
	} catch {
		fail(ERRORS.network); // the engine chunk did not load
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
	go("calm");
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

let phase: "idle" | "holding" | "busy" = "idle";
let heldAt = 0;

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
}

/** A short tap still shakes for --t-hold before the coins leave the hand. */
async function release() {
	if (phase !== "holding") return;
	phase = "busy";
	await sleep(token("--t-hold") - (performance.now() - heldAt));
	coinsEl.classList.remove("shaking");
	shake.classList.remove("held");
	await throwCoins();
	if (session.params.length < 6) phase = "idle";
}

shake.addEventListener("pointerdown", (e) => {
	if (e.button !== 0) return;
	shake.setPointerCapture(e.pointerId);
	press();
});
shake.addEventListener("pointerup", () => void release());
shake.addEventListener("pointercancel", () => void release());
shake.addEventListener("contextmenu", (e) => e.preventDefault());
// Enter and screen-reader activation arrive as a bare click. The click that
// trails a pointer or Space throw finds phase "busy" and does nothing.
shake.addEventListener("click", () => {
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

const YANG =
	'<path d="M5 12.5C3 7.5 8 4.5 17 5L122 6.5L229 8.5C236 8.8 239 11.5 236.5 14.5C233 17.8 225 16.8 215 16.8L120 17.6L19 19.5C9 20.2 6.5 16.5 5 12.5Z"/>';
const YIN =
	'<path d="M5 12.5C3 7.5 8 4.5 17 5L100 6.8C106 7 108.5 10 106.5 13.5C104.5 17 99 17.3 94 17.3L19 19.5C9 20.2 6.5 16.5 5 12.5Z"/>' +
	'<path d="M137 12.5C135.5 8 140 5.5 148 5.8L229 8.5C236 8.8 239 11.5 236.5 14.5C233 17.8 225 16.8 215 16.8L150 18.2C141 18.8 138.3 16.3 137 12.5Z"/>';

/** 一爻的毛笔笔触：阳一笔，阴两笔；动爻加 ○ ×. */
function yaoHtml(yang: boolean, moving: boolean, label: string): string {
	const mark = moving ? `<span class="mark" aria-hidden="true">${yang ? "○" : "×"}</span>` : "";
	return `<div class="yao${moving ? " moving" : ""}"><svg viewBox="0 0 240 24" role="img" aria-label="${label}"><g filter="url(#ink)">${yang ? YANG : YIN}</g></svg>${mark}</div>`;
}

const yaoLabel = (i: number, y: Yao) => `${posName(i)} ${YAO_NAME[y]}${isMoving(y) ? " 动" : ""}`;

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
	navigator.vibrate?.(VIBRATE_MS);
	caption.textContent = tossCaption(yao);

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

/** 上爻 on top. */
const stack = (html: string[]) => html.reverse().join("");

async function reveal() {
	const { cast } = await loadEngine();
	const r = cast(session.params, { date: session.date ?? new Date() });
	session.result = r;

	$("[data-ben-lines]", revealEl).innerHTML = stack(
		r.params.map((y, i) => {
			const title = yaoTitle(i, isYang(y));
			return yaoHtml(isYang(y), isMoving(y), isMoving(y) ? `${title} ${YAO_NAME[y]} 动` : title);
		}),
	);
	$("[data-ben-name]", revealEl).textContent = r.gua.name;

	for (const el of $$("[data-bian]", revealEl)) el.hidden = r.bian === null;
	if (r.bian) {
		$("[data-bian-lines]", revealEl).innerHTML = stack(
			[...r.bian.mark].map((bit, i) => yaoHtml(bit === "1", false, yaoTitle(i, bit === "1"))),
		);
		$("[data-bian-name]", revealEl).textContent = r.bian.name;
	}

	const g = r.ganzhi;
	$("[data-ganzhi]", revealEl).innerHTML =
		`${g.year}年 ${g.month}月 ${g.day}日<span class="hour"> ${g.hour}时</span> · 旬空 ${g.xkong}`;
	go("reveal");
}

// ---------------------------------------------------------------- 首屏日期

// After load, so tyme4ts never weighs on the first screen; this also warms the engine.
addEventListener("load", () =>
	setTimeout(async () => {
		try {
			const [{ ganzhiFromDate }] = await Promise.all([import("../lib/liuyao/calendar.js"), loadEngine()]);
			const g = ganzhiFromDate(new Date());
			$("[data-today]").textContent = `${g.year}年 ${g.month}月 ${g.day}日`;
		} catch {
			// Offline: the date simply stays blank.
		}
	}),
);
