/**
 * 解读 —— everything the reading page shows for one cast and one question:
 * 断语、依据、建议、卦爻辞与白话、完整盘面. Zero DOM; ritual.ts renders it.
 */
import baihua from "../data/baihua.json" with { type: "json" };
import { guaPath } from "../data/gua-slugs.js";
import guaci from "../data/guaci.json" with { type: "json" };
import { SPECIAL, TEMPLATES } from "../data/templates.js";
import { posName, yaoTitle } from "./flow.js";
import { fontOf, shortName } from "./gua.js";
import { GUAS, type Qing6, type Shen6 } from "./liuyao/const.js";
import { duan, hua, type Question, type Topic, type Verdict } from "./liuyao/duan.js";
import type { CastResult, Hexagram } from "./liuyao/najia.js";
import { getType, gongXing, setShiYao, yaoXing } from "./liuyao/utils.js";

export interface GuaText {
	/** 兑为泽 */
	name: string;
	/** 兑、同人 */
	short: string;
	/** 卦页：/gua/dui-wei-ze/ */
	href: string;
	/** 卦名、卦辞各用哪种字体（fontOf）：tokens.css 的变量名 */
	font: string;
	ciFont: string;
	/** 卦辞原文 */
	ci: string;
	baihua: string;
}

export interface YaoText {
	/** 上六 … 初九, or 用九 / 用六 */
	title: string;
	text: string;
	main: boolean;
}

/** 完整盘面 one row. */
export interface Row {
	title: string;
	god: Shen6;
	qin: Qing6;
	/** 纳甲 with 五行: 丁未土 */
	gz: string;
	yang: boolean;
	moving: boolean;
	shiYing: "世" | "应" | "";
	yong: boolean;
	/** 动爻 only: what it turns into. */
	bian: { qin: Qing6; gz: string; hua: string } | null;
}

export interface Reading {
	verdict: Verdict;
	conclusion: string;
	/** 所问属「事业」，以官鬼为用神。 */
	basis: string;
	/** Set when the 用神 is a 伏神. */
	note: string;
	reasons: string[];
	advice: string[];
	ben: GuaText;
	bian: GuaText | null;
	/** `font`: 这几条爻辞算一块，用哪种字体 */
	dong: { heading: string; lines: YaoText[]; note: string; font: string };
	panel: {
		/** 四柱 */
		pillars: string;
		kong: string;
		/** 月建 */
		yue: string;
		/** 日辰 */
		ri: string;
		ben: string;
		bian: string | null;
		/** 上爻 first, as drawn. */
		rows: Row[];
		fu: string;
	};
}

const GUACI: Record<string, string> = guaci;
const BAIHUA: Record<string, string> = baihua;

/** Button names from 择类. */
const LABEL: Partial<Record<Topic, string>> = { 子孙: "子女", 兄弟: "朋友" };

const lines = (name: string) => (GUACI[name] as string).split("\n");

/** Line 1 of a 卦 is the whole 卦辞. */
function guaText(name: string): GuaText {
	const [, ci = ""] = lines(name);
	return {
		name,
		short: shortName(name),
		href: guaPath(name),
		font: fontOf(name),
		ciFont: fontOf(ci),
		ci,
		baihua: BAIHUA[name] as string,
	};
}

/** 爻辞 for 爻题, without its 小象. */
function yaoCi(name: string, title: string): YaoText {
	const line = lines(name).find((l) => l.startsWith(`${title}：`)) as string;
	return { title, text: line.slice(title.length + 1), main: false };
}

const NUM = "一二三四五六";

function dong(r: CastResult): Omit<Reading["dong"], "font"> {
	const name = r.gua.name;
	const n = r.dong.length;
	if (n === 0) return { heading: "静卦", lines: [], note: SPECIAL.jingGua };
	if (n === 6) {
		const heading = "动爻 · 六爻皆动";
		if (name === "乾为天") return { heading, lines: [{ ...yaoCi(name, "用九"), main: true }], note: SPECIAL.yongJiu };
		if (name === "坤为地") return { heading, lines: [{ ...yaoCi(name, "用六"), main: true }], note: SPECIAL.yongLiu };
		return { heading, lines: [], note: SPECIAL.quanDong };
	}
	// ponytail: 主 only for two 动爻 (以上爻为主). 朱熹 reads three or more
	// through 卦辞 or 之卦's static lines; add those rules if pros ask.
	const top = r.dong[n - 1];
	return {
		heading: n === 1 ? "动爻" : n === 2 ? "动爻 · 两爻齐动，以上爻为主" : `动爻 · ${NUM[n - 1]}爻齐动`,
		lines: r.dong
			.map((i) => ({ ...yaoCi(name, yaoTitle(i, (r.params[i] as number) % 2 === 1)), main: n === 2 && i === top }))
			.reverse(),
		note: "",
	};
}

const withFont = (d: Omit<Reading["dong"], "font">): Reading["dong"] => ({
	...d,
	font: fontOf(d.lines.map((l) => l.text).join("")),
});

function basis(q: Question, qin: Qing6): string {
	const head = `所问属「${LABEL[q.topic] ?? q.topic}」，`;
	if (q.topic === "自身") return `${head}以世爻为用神。`;
	if (q.topic === "婚恋") return `${head}${q.gender}问以${qin}为用神。`;
	return `${head}以${qin}为用神。`;
}

/** 兑宫金 · 八纯 · 六冲 */
function gong(h: Hexagram): string {
	const pure = setShiYao(h.mark).shi === 6 ? "八纯" : "";
	return [`${h.gong}宫${gongXing(GUAS.indexOf(h.gong))}`, pure, getType(h.mark)].filter(Boolean).join(" · ");
}

export function compose(r: CastResult, q: Question): Reading {
	const d = duan(r, q);
	const t = TEMPLATES[q.topic][d.verdict];
	const { ganzhi: g, gua, bian, hide } = r;
	const shi = r.shiy.shi - 1;
	const ying = r.shiy.ying - 1;
	const y = d.yongShen;
	const zhi = (gz: string) => gz[1] as string;

	const rows = r.params
		.map((p, i): Row => {
			const gz = gua.qinx[i] as string;
			const moving = r.dong.includes(i);
			const to = bian?.qinx[i] as string;
			return {
				title: yaoTitle(i, p % 2 === 1),
				god: r.god6[i] as Shen6,
				qin: gua.qin6[i] as Qing6,
				gz,
				yang: p % 2 === 1,
				moving,
				shiYing: i === shi ? "世" : i === ying ? "应" : "",
				yong: !y.fu && y.pos === i,
				bian: moving && bian ? { qin: bian.qin6[i] as Qing6, gz: to, hua: hua(zhi(gz), zhi(to)) } : null,
			};
		})
		.reverse();

	const fu = hide
		? hide.seat
				.map((p) => {
					const mark = y.fu && y.pos === p ? " · 用神" : "";
					return `${hide.qin6[p]} ${hide.qinx[p]}，伏于${posName(p)} ${gua.qinx[p]}下${mark}`;
				})
				.join("；")
		: "无（六亲俱全）";

	return {
		verdict: d.verdict,
		conclusion: t.conclusion,
		basis: basis(q, y.qin),
		note: y.fu ? SPECIAL.fuCang : "",
		reasons: d.reasons,
		advice: t.advice,
		ben: guaText(gua.name),
		bian: bian && guaText(bian.name),
		dong: withFont(dong(r)),
		panel: {
			pillars: [g.year, g.month, g.day, g.hour].join(" "),
			kong: g.xkong,
			yue: zhi(g.month) + yaoXing(g.month),
			ri: zhi(g.day) + yaoXing(g.day),
			ben: gong(gua),
			bian: bian && gong(bian),
			rows,
			fu,
		},
	};
}
