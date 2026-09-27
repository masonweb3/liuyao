/**
 * 解读页的渲染和卦名字体 —— 按需加载，不在首屏的起卦脚本里（首页首屏 JS 不增加）。
 * ritual.ts 在页面 load 之后预热它，成卦、展卷时不用临时等网络；分享卡、往卦的状态仍归 ritual.ts。
 */
import { benLines, yaoHtml } from "../lib/flow.js";
import { fontOf } from "../lib/gua.js";
import type { CastResult } from "../lib/liuyao/najia.js";
import type { GuaText, Reading, Row } from "../lib/reading.js";

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

/** Fills the reading screen. Everything but the question is our own text, so innerHTML is safe here. */
export function render(root: HTMLElement, r: CastResult, x: Reading, question: string) {
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
	$("[data-dong-lines]", root).innerHTML = x.dong.lines
		.map((l) => `<div class="yc"><span class="t${l.main ? " main" : ""}">${l.title}${l.main ? " · 主" : ""}</span><p style="font-family: var(${x.dong.font})">${l.text}</p></div>`)
		.join("");
	set("[data-dong-note]", x.dong.note);

	const p = x.panel;
	for (const d of root.querySelectorAll<HTMLElement>("[data-p]")) d.textContent = p[d.dataset.p as "pillars"] ?? "";
	$('[data-fact="bian"]', root).hidden = !p.bian;
	$("[data-rows]", root).innerHTML = p.rows.map(rowHtml).join("");
}
