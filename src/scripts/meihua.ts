/**
 * 梅花页 —— 驱动 Meihua.astro：首屏 → 写下所问 →（拦截 | 择类）→ 选起法 →［报数］→ 成卦 → 解读；
 * 从往卦点开（/meihua/?at=…）直接是这一卦的解读和回访卡。
 *
 * 只 import 零依赖的 lib/meihua-page.ts 和类型，不用动态 import()：首页入口包不能因为这一页变（见那个文件的文件头）。
 * 起卦、卦辞、白话、断语在 Worker 里（scripts/meihua-worker.ts）。每一步都对照 NEXT，成卦之后回不到起卦前。
 */
import type { Judgement } from "../lib/flow.js";
import type { Topic } from "../lib/liuyao/duan.js";
import type { MeihuaView, Request } from "../lib/meihua-reading.js";
import {
	ago,
	askOf,
	asked,
	type By,
	dayLabel,
	entries,
	FALLBACK,
	find,
	hourOf,
	localNote,
	meihuaOf,
	NEXT,
	type NumError,
	nowText,
	type Outcome,
	parseNums,
	type Past,
	qingSound,
	record,
	type Review,
	route,
	save,
	type Screen,
	setSound,
	showCard,
	soundOn,
	unlock,
	untilNext,
} from "../lib/meihua-page.js";

const MAX_LENGTH = 200;
/** judge.ts gives Jev 3s; leave room for the round trip. */
const JUDGE_TIMEOUT_MS = 5000;

const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector(sel) as T;
const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => [...root.querySelectorAll<T>(sel)];

const root = $("[data-meihua]");
const TABLE = root.dataset.lunar ?? "";
const COPY: {
	empty: string;
	tooLong: string;
	asked: string;
	rateLimited: string;
	network: string;
	lost: string;
	num: Record<NumError, string>;
} = JSON.parse(root.dataset.copy ?? "{}");

/** localStorage, or `null` where the browser blocks it. */
const store = (() => {
	try {
		return localStorage;
	} catch {
		return null;
	}
})();

const session = {
	question: "",
	judgement: FALLBACK,
	topic: null as Topic | null,
};

/** Resolves when el's finite animations end. */
function settle(el: Element) {
	const finite = el
		.getAnimations({ subtree: true })
		.filter((a) => a.effect?.getComputedTiming().endTime !== Number.POSITIVE_INFINITY);
	return Promise.allSettled(finite.map((a) => a.finished));
}

// ---------------------------------------------------------------- screens

let current: Screen = "home";
const screen = (s: Screen) => $(`[data-screen="${s}"]`);
/** 首屏上「找不到这一卦」那一句（openPast），一换屏就收起 */
const lost = $("[data-lost]");

function go(next: Screen) {
	if (!NEXT[current].includes(next)) throw new Error(`no way from ${current} to ${next}`);
	show(next);
}

function show(next: Screen) {
	if (next === "reading") {
		const paper = getComputedStyle(document.documentElement).getPropertyValue("--paper").trim();
		$('meta[name="theme-color"]').setAttribute("content", paper);
	}
	screen(current).hidden = true;
	lost.hidden = true;
	current = next;
	const el = screen(next);
	el.hidden = false;
	window.scrollTo(0, 0);
	(el.querySelector<HTMLElement>("[data-autofocus]") ?? el).focus({ preventScroll: true });
	if (next === "method" || next === "num") tick();
}

document.addEventListener("click", (e) => {
	const b = (e.target as Element).closest<HTMLElement>("[data-go], [data-proceed]");
	if (!b) return;
	if (b.hasAttribute("data-proceed")) return proceed(true);
	if (b.hasAttribute("data-clear")) setQuestion("");
	go(b.dataset.go as Screen);
});

// ---------------------------------------------------------------- Worker

let worker: Worker | undefined;
let seq = 0;
const pending = new Map<number, { resolve: (v: MeihuaView | undefined) => void; reject: (e: unknown) => void }>();

function warm(): Worker {
	if (worker) return worker;
	const w = new Worker(new URL("./meihua-worker.ts", import.meta.url), { type: "module" });
	w.onmessage = (e: MessageEvent<{ id: number; view?: MeihuaView }>) => {
		pending.get(e.data.id)?.resolve(e.data.view);
		pending.delete(e.data.id);
	};
	// 没载入（断网）：等着的都算失败，下次再起一个
	w.onerror = () => {
		for (const p of pending.values()) p.reject(new Error("worker"));
		pending.clear();
		worker = undefined;
	};
	worker = w;
	return w;
}

/** 让 Worker 起一卦；不带参数就只是问一声它载入了没有。 */
function request(req?: Request): Promise<MeihuaView | undefined> {
	const w = warm();
	const id = ++seq;
	return new Promise((resolve, reject) => {
		pending.set(id, { resolve, reject });
		w.postMessage({ id, ...req });
	});
}

// ---------------------------------------------------------------- 首屏、此刻

const nowLine = $("[data-now-line]");

let ticker: ReturnType<typeof setTimeout> | undefined;

/** 首屏页脚、选起法卡片、报数提示里的「此刻」，与海外访客的那一句；在下一个时辰交界（untilNext）再写一次。 */
function tick(now = new Date()) {
	nowLine.textContent = `此刻　${nowText(TABLE, now, "　")}（北京时间）`;
	for (const el of $$("[data-now-card]")) el.textContent = nowText(TABLE, now);
	const h = hourOf(now);
	for (const el of $$("[data-hour-name]")) el.textContent = h.name;
	for (const el of $$("[data-hour-num]")) el.textContent = String(h.num);
	const note = localNote(now);
	const local = $("[data-local]");
	local.hidden = !note;
	if (note) fill(local, note);
	clearTimeout(ticker);
	ticker = setTimeout(() => tick(), untilNext(now, note !== null));
}
tick();

/** Fills the {name} holes that Slots.astro left. */
function fill(el: ParentNode, values: Record<string, string>) {
	for (const s of el.querySelectorAll<HTMLElement>("[data-slot]")) {
		const v = values[s.dataset.slot as string];
		if (v !== undefined) s.textContent = v;
	}
}

// ---------------------------------------------------------------- 写下所问（照 ritual.ts）

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

q.addEventListener("input", typed);
// 要起卦了：Worker（tyme4ts 与卦爻辞）趁写所问时载入，不在首屏和首屏的 LCP 抢网络
q.addEventListener("focus", () => warm());
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
	if (!text) return fail(COPY.empty);
	if (length(text) > MAX_LENGTH) return fail(COPY.tooLong);
	// 一事一占：六爻、梅花问过的都在同一份往卦里（M21-6）
	if (store && asked(entries(store), text)) return fail(COPY.asked);
	if (sealing) return;
	sealing = true;
	askEl.classList.add("sealing");
	try {
		// 落笔的印章动画与 Jev、Worker 的载入并行，都好了再走：之后起卦全在本地
		const [j] = await Promise.all([judge(text), request(), settle($(".stamp", askEl))]);
		if (j === "rate-limited") return fail(COPY.rateLimited);
		session.question = text;
		session.judgement = j;
		for (const el of $$("[data-question]")) el.textContent = text;
		proceed(false);
	} catch {
		fail(COPY.network); // the Worker did not load
	} finally {
		askEl.classList.remove("sealing");
		sealing = false;
	}
}

function proceed(emergencySeen: boolean) {
	const next = route(session.judgement, emergencySeen);
	session.topic = session.judgement.topic;
	go(next);
	if (next === "topic") pickTopic(null);
}

// ---------------------------------------------------------------- 择类（Jev 拿不准时）

const topicEl = screen("topic");
const topicDone = $<HTMLButtonElement>("[data-topic-done]", topicEl);
let picked: Topic | null = null;

function pickTopic(t: Topic | null) {
	picked = t;
	for (const b of $$("[data-topic]", topicEl)) b.setAttribute("aria-pressed", String(b.dataset.topic === t));
	topicDone.disabled = t === null;
}
topicEl.addEventListener("click", (e) => {
	const b = (e.target as Element).closest<HTMLElement>("[data-topic]");
	if (b) pickTopic(b.dataset.topic as Topic);
});
topicDone.addEventListener("click", () => {
	if (!picked) return;
	session.topic = picked;
	go("method");
});

// ---------------------------------------------------------------- 选起法、报数、成卦

const readingEl = screen("reading");
let casting = false;

/** 起卦：按下那一刻就是起卦时刻。Worker 算好后先写进往卦，再放成卦动画（刷新页面也换不了数重起）。 */
async function cast(by: By) {
	if (casting || !session.topic) return;
	casting = true;
	const here = screen(current);
	const err = $("[data-cast-error]", here);
	err.textContent = "";
	const busy = [...$$<HTMLButtonElement>("[data-cast-time]"), ...$$<HTMLButtonElement>("[data-num-form] [type=submit]")];
	for (const b of busy) b.disabled = true;
	// 卡片与起卦用同一个时刻：计时器晚了（休眠、后台标签页）也不会卡片写申时、起出酉时卦
	const now = new Date();
	tick(now);
	const at = now.toISOString();
	try {
		const view = await request({ by, at, topic: session.topic, lateZi: "day-stays" });
		if (!view) throw new Error("no view");
		// 另一个标签页可能刚用六爻问过同一件事：写之前再判一次
		if (store && asked(entries(store), session.question)) {
			err.textContent = COPY.asked;
			return;
		}
		try {
			if (!store) throw new Error("storage blocked");
			record(store, { question: session.question, ask: askOf(session.topic), params: view.params, at, lateZi: "day-stays", meihua: by });
		} catch {
			$("[data-storage]", readingEl).hidden = false;
		}
		reveal(view, at);
	} catch {
		err.textContent = COPY.network;
	} finally {
		casting = false;
		for (const b of busy) b.disabled = false;
	}
}

for (const b of $$("[data-cast-time]")) b.addEventListener("click", () => void cast({ by: "time" }));

for (const form of $$<HTMLFormElement>("[data-num-form]"))
	form.addEventListener("submit", (e) => {
		e.preventDefault();
		const inputs = $$<HTMLInputElement>("[data-n]", form);
		const errs = $$("[data-err]", form);
		const r = parseNums(inputs[0]?.value ?? "", inputs[1]?.value ?? "");
		const bad = "errors" in r ? r.errors : [null, null];
		bad.forEach((k, i) => {
			(errs[i] as HTMLElement).textContent = k ? COPY.num[k] : "";
			inputs[i]?.setAttribute("aria-invalid", String(k !== null));
		});
		if ("errors" in r) {
			inputs[bad.findIndex((k) => k !== null)]?.focus();
			return;
		}
		void cast({ by: "num", nums: r.nums });
	});

// ---------------------------------------------------------------- 成卦

const revealEl = screen("reveal");
let shown: { view: MeihuaView; at: string } | undefined;

/** 卦名、卦辞、爻辞的字体：fontOf 在 Worker 里算好，夬、姤这类站酷小薇缺字的整块用宋体。 */
function setText(el: HTMLElement, text: string, font: string) {
	el.textContent = text;
	el.style.fontFamily = `var(${font})`;
}

const byLine = (v: MeihuaView, full = false) =>
	v.by === "time" ? `时间起卦 · ${v.when}` : `数字起卦 · ${full ? "报数 " : ""}${v.nums} · ${v.hour}时`;
const formula = (v: MeihuaView) => v.formula.map((p) => `<p>${p}</p>`).join("");
/** 「乾坤无互，取变卦之互」短注：乾、坤动在初爻、上爻时变卦之互仍是自身，看着像没取，不出（解读页互卦一段另有整句） */
const huNote = (v: MeihuaView) => v.hu.fromBian && v.hu.name !== v.ben.name;

function reveal(view: MeihuaView, at: string) {
	shown = { view, at };
	// 只有我们自己拼的字（卦象、算式），没有所问：innerHTML 可以
	$("[data-ben-lines]", revealEl).innerHTML = view.ben.lines;
	setText($("[data-ben-name]", revealEl), view.ben.name, view.ben.font);
	$("[data-bian-lines]", revealEl).innerHTML = view.bian.lines;
	setText($("[data-bian-name]", revealEl), view.bian.name, view.bian.font);
	setText($("[data-hu-name]", revealEl), view.hu.name, view.hu.font);
	$("[data-hu-el]", revealEl).textContent = `${view.hu.lower} · ${view.hu.upper}`;
	$("[data-hu-note]", revealEl).hidden = !huNote(view);
	$("[data-formula]", revealEl).innerHTML = formula(view);
	$("[data-reveal-when]", revealEl).textContent =
		view.by === "time" ? `${view.when} · 时间起卦` : `报数 ${view.nums} · ${view.hour}时 · 数字起卦`;
	go("reveal");
}

// 卦名墨晕浮现那一刻出磬声（M21-23）
$("[data-ben-name]", revealEl).addEventListener("animationstart", () => qingSound());

$("[data-read]", revealEl).addEventListener("click", () => {
	if (!shown) return;
	read(shown.view, session.question, shown.at, undefined);
	go("reading");
});

// ---------------------------------------------------------------- 解读

const CN = "一二三四五六七八九十";
const item = (mark: string, text: string) =>
	`<li><span class="n" aria-hidden="true">${mark}</span><span>${text}</span></li>`;

/** `past`: opened from 往卦 (its record), so the 回访卡 may show; undefined for the cast just made. */
function read(v: MeihuaView, question: string, at: string, past: Past | undefined) {
	const r = readingEl;
	const set = (sel: string, text: string, el: ParentNode = r) => {
		$(sel, el).textContent = text;
	};
	r.classList.toggle("old", past !== undefined);
	set("[data-question]", question);
	$<HTMLDetailsElement>("[data-panel]", r).open = matchMedia("(min-width: 1024px)").matches;
	$("[data-lines]", r).innerHTML = v.ben.lines;
	const name = $<HTMLAnchorElement>("[data-name]", r);
	setText(name, v.ben.name, v.ben.font);
	name.href = v.ben.href;
	const zhi = $<HTMLAnchorElement>("[data-zhi-name]", r);
	setText(zhi, v.bian.name, v.bian.font);
	zhi.href = v.bian.href;
	set("[data-by]", byLine(v));
	setText($("[data-hu-n]", r), v.hu.name, v.hu.font);
	$("[data-hu-qk]", r).hidden = !huNote(v);

	const duan = $("[data-duan]", r);
	duan.textContent = v.verdict;
	duan.dataset.verdict = v.verdict;
	duan.setAttribute("aria-label", `断：${v.verdict}`);
	set("[data-conclusion]", v.conclusion);
	for (const el of $$("[data-basis]", r)) el.hidden = el.dataset.basis !== v.by;
	set("[data-topic-label]", v.topic);

	$$("[data-row]", r).forEach((td, i) => {
		td.textContent = v.rows[i]?.[0] ?? "";
	});
	$$("[data-rel]", r).forEach((td, i) => {
		td.textContent = v.rows[i]?.[1] ?? "";
	});
	$("[data-reasons]", r).innerHTML = v.reasons.map((s, i) => item(CN[i] ?? String(i + 1), s)).join("");
	$("[data-advice]", r).innerHTML = v.advice.map((s) => item("·", s)).join("");

	for (const [key, g] of [
		["ben", v.ben],
		["bian", v.bian],
	] as const) {
		const s = $(`[data-text="${key}"]`, r);
		set("[data-short]", g.short, s);
		setText($("[data-ci]", s), g.ci, g.ciFont);
		set("[data-bh]", g.baihua, s);
		$<HTMLAnchorElement>("[data-page]", s).href = g.href;
		set("[data-pn]", g.name, s);
	}
	set("[data-dong-title]", v.dong.title);
	set("[data-dong-t]", v.dong.title);
	setText($("[data-dong-text]", r), v.dong.text, v.dong.font);
	set("[data-dong-bh]", v.dong.baihua);
	set("[data-hu-short]", v.hu.short);
	setText($("[data-hu-name]", r), v.hu.name, v.hu.font);
	$("[data-hu-lines]", r).innerHTML = v.hu.lines;
	set("[data-hu-say]", v.hu.say);
	set("[data-origin]", byLine(v, true));
	$("[data-formula]", r).innerHTML = formula(v);

	const back = $<HTMLAnchorElement>("[data-back]", r);
	back.href = past ? "/?history" : "/meihua/";
	back.setAttribute("aria-label", past ? "回到往卦" : "回到梅花首屏");
	shownAt = at;
	visit(past, v.verdict === "凶");
}

// ---------------------------------------------------------------- 回访卡（照 view.ts，M21-22）

/** The 往卦 record the reading on show belongs to. */
let shownAt = "";

/** Longer questions are cut short on the 回访卡; screen readers still hear all of it. */
const CLIP = 32;

function quote(el: Element, text: string) {
	const chars = [...text];
	if (chars.length <= CLIP) {
		el.textContent = text;
		return;
	}
	const cut = document.createElement("span");
	cut.setAttribute("aria-hidden", "true");
	cut.textContent = `${chars.slice(0, CLIP - 1).join("")}…`;
	const all = document.createElement("span");
	all.className = "sr-inline";
	all.textContent = text;
	el.replaceChildren(cut, all);
}

const card = $("[data-visit]", readingEl);
const form = $<HTMLFormElement>("[data-visit-form]", card);
const noteInput = $<HTMLInputElement>("input[name=note]", form);
const alertEl = $("[data-visit-alert]", card);
const said = $("[data-visit-status]", card);
const told = $("[data-visit-done]", card);
const skipped = $("[data-visit-skip]", card);
const labels: Record<Outcome, string> = JSON.parse(card.dataset.outcomes ?? "{}");

/** 回访卡：只在从往卦点开、到了日子的卦上。出卡时藏起「再问一事」，焦点落在卡的标题上。 */
function visit(p: Past | undefined, bad: boolean) {
	const on = p !== undefined && showCard(p, new Date());
	card.hidden = !on;
	$("[data-again]", readingEl).hidden = on;
	$("h1", readingEl).toggleAttribute("data-autofocus", !on);
	said.textContent = "";
	if (!on || !p) {
		for (const t of card.querySelectorAll("[data-autofocus]")) t.removeAttribute("data-autofocus");
		return;
	}
	// 凶卦的回访以一句「愿你安好」收尾
	$("[data-visit-bless]", card).hidden = !bad;
	fill(card, { ago: ago(new Date(p.at), new Date()) });
	for (const el of card.querySelectorAll("[data-slot=q]")) quote(el, p.question);
	state(p.review);
}

function state(review: Review | undefined, editing = false): HTMLElement {
	const part = editing || !review ? form : review.outcome === "skip" ? skipped : told;
	for (const el of [form, told, skipped]) el.hidden = el !== part;
	const title = $("legend, h2", part);
	card.setAttribute("aria-labelledby", title.id);
	for (const t of card.querySelectorAll("legend, h2")) t.toggleAttribute("data-autofocus", t === title);
	alertEl.textContent = "";
	if (part === form) {
		for (const r of form.querySelectorAll<HTMLInputElement>("input[type=radio]")) r.checked = r.value === review?.outcome;
		noteInput.value = review?.note ?? "";
	} else if (review && part === told) {
		fill(told, { at: dayLabel(new Date(review.at)), outcome: labels[review.outcome], note: review.note });
		$("[data-visit-note]", told).hidden = !review.note;
	}
	return title;
}

form.addEventListener("submit", (e) => {
	e.preventDefault();
	const outcome = (form.elements.namedItem("outcome") as RadioNodeList).value as Outcome | "";
	if (!outcome) {
		alertEl.textContent = card.dataset.pick ?? "";
		return;
	}
	const review = { outcome, note: noteInput.value.trim(), at: new Date().toISOString() };
	let kept = false;
	try {
		kept = store !== null && save(store, shownAt, { review });
	} catch {
		kept = false;
	}
	if (!kept) {
		alertEl.textContent = card.dataset.unsaved ?? "";
		return;
	}
	state(review).focus();
	said.textContent = card.dataset.saved ?? "";
});

for (const b of card.querySelectorAll("[data-visit-edit]"))
	b.addEventListener("click", () => {
		const p = store ? find(store, shownAt) : undefined;
		said.textContent = "";
		state(p?.review, true).focus();
	});

// ---------------------------------------------------------------- 音效（与六爻共用开关）

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
addEventListener("pointerup", unlock);
addEventListener("keydown", unlock);

// ---------------------------------------------------------------- 进页

/** 从往卦点开：按起卦时刻找到这一条梅花记录，重排出同一卦（只有往卦里有的卦，网址里只带时刻）。 */
async function openPast(at: string) {
	const home = screen("home");
	home.hidden = true;
	const p = store ? find(store, at) : undefined;
	const by = p ? meihuaOf(p) : null;
	let say = COPY.lost;
	try {
		if (!p || !by) throw new Error("no such record");
		const view = await request({ by, at: p.at, topic: p.ask.topic, lateZi: p.lateZi }).catch((e: unknown) => {
			say = COPY.network; // Worker 没载入（断网）：记录也许还在，不说找不到
			throw e;
		});
		// 手改过的记录排不出原来的卦：不信它
		if (!view || view.params.join() !== p.params.join()) throw new Error("does not match");
		for (const el of $$("[data-question]")) el.textContent = p.question;
		read(view, p.question, p.at, p);
		show("reading");
	} catch {
		window.history.replaceState(null, "", "/meihua/");
		home.hidden = false;
		// 回到首屏时说一声为什么；焦点落在这一句上，读屏会念出来
		lost.textContent = say;
		lost.hidden = false;
		lost.focus();
	}
}

// 首屏下面的说明区先用系统衬线字，等首屏入场动画播完（约 2 秒）或一滚动才换网页字体、下字体，不和首屏的 LCP 抢网络（见 MeihuaHome.astro 的样式）
const later = () => $("#how").removeAttribute("data-later");
addEventListener("load", () => void settle(screen("home")).then(later));
addEventListener("scroll", later, { once: true, passive: true });

const entry = new URLSearchParams(location.search);
const pastAt = entry.get("at");
if (pastAt !== null) void openPast(pastAt);
else if (entry.has("ask")) {
	// 「再问一事」：进页就是写下所问，前一卦的什么都不带
	window.history.replaceState(null, "", "/meihua/");
	go("ask");
}
