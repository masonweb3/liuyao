/**
 * 解读页与往卦的渲染 —— 按需加载，不在首屏的起卦脚本里（首页首屏 JS 不增加）。
 * ritual.ts 在页面 load 之后预热它，成卦、展卷时不用临时等网络；屏幕跳转和分享卡仍归 ritual.ts。
 * 往卦复盘（M14）的回访卡、到时提醒、自记与复盘一行也在这里，规则在 src/lib/revisit.ts；
 * 界面的字由 Reading.astro、History.astro 从 copy.ts 写进页面，这里只填数字、日期、所问和附言。
 */
import { benLines, dayLabel, yaoHtml } from "../lib/flow.js";
import { fontOf } from "../lib/gua.js";
import type { CastResult } from "../lib/liuyao/najia.js";
import type { GuaText, Reading, Row } from "../lib/reading.js";
import {
	ago,
	canRemind,
	type Days,
	find,
	monthDay,
	newUid,
	type Outcome,
	type Past,
	pasts,
	type Remind,
	remindAt,
	reminder,
	type Review,
	save,
	showCard,
	tally,
} from "../lib/revisit.js";

const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode) => root.querySelector(sel) as T;

const CN = "一二三四五六七八九十";

/** 卦名、卦辞、爻辞的字体：`font` 是 fontOf 给的变量名，含站酷小薇缺字的整块用宋体。 */
function setText(el: HTMLElement, text: string, font: string) {
	el.textContent = text;
	el.style.fontFamily = `var(${font})`;
}

/** 成卦页的卦名。 */
export const setName = (el: HTMLElement, name: string) => setText(el, name, fontOf(name));

const item = (mark: string, text: string) =>
	`<li><span class="n" aria-hidden="true">${mark}</span><span>${text}</span></li>`;

const rowHtml = (w: Row) =>
	`<tr${w.yong ? ' class="yong"' : ""}>` +
	`<td class="pos">${w.title}</td>` +
	`<td class="god">${w.god}</td>` +
	`<td class="ben">${w.qin} ${w.gz}${w.yong ? ' <span class="tag">用神</span>' : ""}</td>` +
	`<td>${yaoHtml(w.yang, w.moving, `${w.yang ? "阳" : "阴"}${w.moving ? " 动" : ""}`)}</td>` +
	`<td class="sy${w.shiYing === "世" ? " shi" : ""}">${w.shiYing}</td>` +
	`<td>${w.bian ? `${w.bian.qin} ${w.bian.gz}${w.bian.hua ? ` <span class="hua">${w.bian.hua}</span>` : ""}` : ""}</td>` +
	"</tr>";

/**
 * Fills the reading screen. Everything but the question is our own text, so innerHTML is safe here.
 * `at` is the moment of the cast, which finds its 往卦 record; `old`: opened from 往卦, not just cast.
 */
export function render(root: HTMLElement, r: CastResult, x: Reading, question: string, at: string, old: boolean) {
	const set = (sel: string, text: string, el: ParentNode = root) => {
		$(sel, el).textContent = text;
	};
	set("[data-question]", question);
	$<HTMLDetailsElement>("[data-panel]", root).open = matchMedia("(min-width: 1024px)").matches;
	const g = r.ganzhi;
	$("[data-lines]", root).innerHTML = benLines(r.params);
	// 本卦、变卦的卦名链到卦页
	const name = $<HTMLAnchorElement>("[data-name]", root);
	const zhi = $<HTMLAnchorElement>("[data-zhi-name]", root);
	setText(name, x.ben.name, x.ben.font);
	name.href = x.ben.href;
	$("[data-zhi]", root).hidden = !x.bian;
	zhi.textContent = x.bian?.name ?? "";
	zhi.href = x.bian?.href ?? "";
	set("[data-gz]", `${g.year}年 ${g.month}月 ${g.day}日 ${g.hour}时 · 旬空 ${g.xkong}`);

	const duan = $("[data-duan]", root);
	duan.textContent = x.verdict;
	duan.dataset.verdict = x.verdict;
	duan.setAttribute("aria-label", `断：${x.verdict}`);
	set("[data-conclusion]", x.conclusion);
	set("[data-basis]", x.basis);
	set("[data-note]", x.note);
	$("[data-note]", root).hidden = !x.note;

	$("[data-reasons]", root).innerHTML = x.reasons.map((s, i) => item(CN[i] ?? String(i + 1), s)).join("");
	$("[data-advice]", root).innerHTML = x.advice.map((s) => item("·", s)).join("");

	const text = (key: string, label: string, t: GuaText | null) => {
		const s = $(`[data-text="${key}"]`, root);
		s.hidden = !t;
		if (!t) return;
		set("[data-kicker]", `${label} · ${t.short}`, s);
		setText($("[data-ci]", s), t.ci, t.ciFont);
		set("[data-bh]", t.baihua, s);
	};
	text("ben", "卦辞", x.ben);
	text("bian", "变卦", x.bian);

	set("[data-dong-heading]", x.dong.heading);
	// 爻辞白话另起一行写在爻辞下面；没写白话的卦不出这一行。
	$("[data-dong-lines]", root).innerHTML = x.dong.lines
		.map(
			(l) =>
				`<div class="yc"><span class="t${l.main ? " main" : ""}">${l.title}${l.main ? " · 主" : ""}</span>` +
				`<p style="font-family: var(${x.dong.font})">${l.text}</p>${l.baihua ? `<p class="ybh">${l.baihua}</p>` : ""}</div>`,
		)
		.join("");
	set("[data-dong-note]", x.dong.note);

	const p = x.panel;
	for (const d of root.querySelectorAll<HTMLElement>("[data-p]")) d.textContent = p[d.dataset.p as "pillars"] ?? "";
	$('[data-fact="bian"]', root).hidden = !p.bian;
	$("[data-rows]", root).innerHTML = p.rows.map(rowHtml).join("");

	shown = { at, old, question, gua: x.bian ? `${x.ben.name}之${x.bian.name}` : x.ben.name };
	const past = store ? find(store, at) : undefined;
	visit(root, past, x.verdict === "凶");
	drawRemind(past);
}

// ---------------------------------------------------------------- 往卦复盘（M14）

/** localStorage, or null where the browser blocks it: then nothing is kept, and nothing breaks. */
const store = (() => {
	try {
		return localStorage;
	} catch {
		return null;
	}
})();

/** The reading on show. */
let shown = { at: "", old: false, question: "", gua: "" };

/** Writes one M14 field of the reading on show; false when it could not be kept (no record, storage full or blocked). */
function keep(field: { review: Review } | { remind: Remind }): boolean {
	try {
		return store !== null && save(store, shown.at, field);
	} catch {
		return false;
	}
}

/** Fills the {name} holes that Slots.astro left in a line of copy.ts. */
function fill(root: ParentNode, values: Record<string, string>) {
	for (const el of root.querySelectorAll<HTMLElement>("[data-slot]")) {
		const v = values[el.dataset.slot as string];
		if (v !== undefined) el.textContent = v;
	}
}

/** Longer questions are cut short on the 回访卡 (about two lines on a phone); screen readers still hear all of it. */
const CLIP = 32;

function quote(el: Element, q: string) {
	const chars = [...q];
	if (chars.length <= CLIP) {
		el.textContent = q;
		return;
	}
	const cut = document.createElement("span");
	cut.setAttribute("aria-hidden", "true");
	cut.textContent = `${chars.slice(0, CLIP - 1).join("")}…`;
	// 不用 .sr-only：它是绝对定位的块，读屏名称里引号内侧会多出空格
	const all = document.createElement("span");
	all.className = "sr-inline";
	all.textContent = q;
	el.replaceChildren(cut, all);
}

const card = $("[data-visit]", document);
const form = $<HTMLFormElement>("[data-visit-form]", card);
const noteInput = $<HTMLInputElement>("input[name=note]", form);
const alertEl = $("[data-visit-alert]", card);
const said = $("[data-visit-status]", card);
const told = $("[data-visit-done]", card);
const skipped = $("[data-visit-skip]", card);
const labels: Record<Outcome, string> = JSON.parse(card.dataset.outcomes ?? "{}");

/** 回访卡: only on a reading opened from 往卦, once its day has come. It hides 再问一事 and takes the focus. */
function visit(root: HTMLElement, p: Past | undefined, bad: boolean) {
	const on = shown.old && p !== undefined && showCard(p, new Date());
	card.hidden = !on;
	$("[data-again]", root).hidden = on;
	$("h1", root).toggleAttribute("data-autofocus", !on);
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

/** Shows the form (nothing recorded, or 修改), what was recorded, or the one line for 不想记; returns its title. */
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
	if (!keep({ review })) {
		// 存满或被禁用：停在表单，不假装已经记下
		alertEl.textContent = card.dataset.unsaved ?? "";
		return;
	}
	state(review).focus();
	said.textContent = card.dataset.saved ?? "";
	// 记下了结果的旧卦不再补设提醒
	remind.hidden = !canRemind(shown.question, store ? find(store, shown.at) : undefined, shown.old);
});

for (const b of card.querySelectorAll("[data-visit-edit]"))
	b.addEventListener("click", () => {
		const p = store ? find(store, shown.at) : undefined;
		said.textContent = "";
		state(p?.review, true).focus();
	});

const remind = $("[data-remind]", document);
const toggle = $("[data-remind-toggle]", remind);
const panel = $("#remind-panel", remind);
const got = $("[data-remind-status]", remind);

/** 到时提醒我, collapsed; the day chips show when each reminder would go off. */
function drawRemind(p: Past | undefined) {
	remind.hidden = !canRemind(shown.question, p, shown.old);
	toggle.setAttribute("aria-expanded", "false");
	panel.hidden = true;
	got.replaceChildren();
	const today = new Date();
	for (const r of remind.querySelectorAll<HTMLInputElement>("input[type=radio]")) r.checked = r.defaultChecked;
	for (const el of remind.querySelectorAll<HTMLElement>("[data-due]"))
		el.textContent = monthDay(remindAt(today, Number(el.dataset.due)));
}

toggle.addEventListener("click", () => {
	const open = toggle.getAttribute("aria-expanded") !== "true";
	toggle.setAttribute("aria-expanded", String(open));
	panel.hidden = !open;
});

// 点了直接生成并下载，不经过服务器；可以换天数再下一次，最后一次为准。
$("[data-remind-get]", remind).addEventListener("click", () => {
	const days = Number($<HTMLInputElement>("input[name=remind-days]:checked", remind).value) as Days;
	const now = new Date();
	const { summary = "", body = "", url = "" } = remind.dataset;
	const ics = reminder({ at: shown.at }, shown.gua, days, now, newUid(), { summary, body, url });
	const a = document.createElement("a");
	a.href = URL.createObjectURL(new Blob([ics.text], { type: "text/calendar;charset=utf-8" }));
	a.download = ics.name;
	a.click();
	setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
	const kept = keep({ remind: { days, at: now.toISOString() } });
	const msg = $<HTMLTemplateElement>("[data-remind-done]", remind).content.cloneNode(true) as DocumentFragment;
	fill(msg, { due: monthDay(ics.start) });
	// 文件照样下了，但往卦里没记上：回访卡不会按提醒那天出，要说清楚
	if (!kept) msg.lastElementChild?.append(` ${card.dataset.unsaved ?? ""}`);
	got.replaceChildren(msg);
});

// ---------------------------------------------------------------- 往卦列表

type Load = () => Promise<[typeof import("../lib/liuyao/najia.js"), typeof import("../lib/reading.js")]>;

/**
 * 往卦: every record cast again, so the list shows exactly what its reading will.
 * ritual.ts calls this only when there is something to list, and tells the user when it fails.
 */
export async function list(root: HTMLElement, load: Load, open: (p: Past, r: CastResult, x: Reading) => void) {
	const [{ cast }, { compose }] = await load();
	const past = store ? pasts(store) : [];
	const { n, x: yes } = tally(past);
	const line = $("[data-tally]", root);
	line.hidden = n === 0;
	fill(line, { n: String(n), x: String(yes) });
	const ol = $("[data-list]", root);
	const names: Record<Outcome, string> = JSON.parse(ol.dataset.outcomes ?? "{}");
	const tpl = $<HTMLTemplateElement>("[data-item]", root);
	ol.replaceChildren(
		...past.flatMap((p) => {
			try {
				const r = cast(p.params, { date: new Date(p.at), lateZi: p.lateZi });
				const x = compose(r, p.ask);
				const li = $("li", tpl.content).cloneNode(true) as HTMLElement;
				$(".date", li).textContent = `${dayLabel(new Date(p.at))} · ${r.ganzhi.day}日`;
				$(".gua", li).innerHTML = r.bian ? `${r.gua.name} <small>之</small> ${r.bian.name}` : r.gua.name;
				$(".q", li).textContent = p.question;
				// 自记：没记、不想记的留空
				const o = p.review?.outcome;
				$(".v", li).textContent = o && o !== "skip" ? names[o] : "";
				const d = $(".duan", li);
				d.textContent = x.verdict;
				d.dataset.verdict = x.verdict;
				$("button", li).addEventListener("click", () => open(p, r, x));
				return [li];
			} catch {
				return []; // a date the calendar cannot place
			}
		}),
	);
}
