/**
 * 择日（M18）的构建时部分：事项月页按月列吉日。宜忌取 huangli.ts（与逐日页同一份），
 * 命中规则在零依赖的 zeri-rule.ts，择日首页的浏览器脚本用的是同一个函数。
 */
import huangliHant from "../data/huangli-hant.json" with { type: "json" };
import huangliData from "../data/huangli.json" with { type: "json" };
import { type Data, huangliOf, show, type Words } from "./huangli.js";
import { inWindow, ymd } from "./huangli-days.js";
import { clash, hits, ITEMS, type Slug } from "./zeri-rule.js";

export interface GoodDay {
	date: string;
	/** 命中的宜词，按事项表的词序 */
	hits: string[];
}

/** 某月对某事的吉日，按日期排。给了生肖（0 鼠……11 猪）就去掉冲这个生肖的日子。 */
export function goodDays(year: number, month: number, slug: Slug, zodiac?: number): GoodDay[] {
	const n = new Date(Date.UTC(year, month, 0)).getUTCDate();
	const out: GoodDay[] = [];
	for (let d = 1; d <= n; d++) {
		const h = huangliOf(ymd(year, month, d));
		const w = hits(slug, h.yi, h.ji);
		if (w.length && clash(h.ganzhi.day) !== zodiac) out.push({ date: h.date, hits: w });
	}
	return out;
}

/** 「2026-11」→ [2026, 11] */
export const ym = (month: string) => month.split("-").map(Number) as [number, number];
/** 前后第 n 个月「2026-12」 */
export function shiftMonth(month: string, n: number): string {
	const [y, m] = ym(month);
	const d = new Date(Date.UTC(y, m - 1 + n, 1));
	return ymd(d.getUTCFullYear(), d.getUTCMonth() + 1, 1).slice(0, 7);
}
/** 月份在黄历的时间窗里（YEARS，与逐日页同窗，M18-3） */
export const monthInWindow = (month: string) => inWindow(`${month}-01`);
export const count = (slug: Slug, month: string) => goodDays(...ym(month), slug).length;

const dataOf = (hant: boolean) => (hant ? huangliHant : huangliData) as unknown as Data;

/** 月页逐日一行：文字取逐日页的 show()（已按简繁写好），命中的词取当天宜里的同一个词。 */
export interface Row {
	date: string;
	md: string;
	week: string;
	lunar: string;
	/** 日干支「己卯日」 */
	gz: string;
	chong: string;
	duty: string;
	star: string;
	hits: Words["list"];
}

export function monthRows(slug: Slug, month: string, hant: boolean): Row[] {
	return goodDays(...ym(month), slug).map(({ date, hits }) => {
		const s = show(huangliOf(date), dataOf(hant));
		const list = hits.map((k) => s.yi.list.find((w) => w.key === k));
		if (list.some((w) => !w)) throw new Error(`${date} 的宜里没有 ${hits.join("、")}`);
		return { date, md: s.md, week: s.week, lunar: s.lunar, gz: s.ganzhi.split(" ")[2]!, chong: s.chong, duty: s.duty, star: s.star, hits: list as Row["hits"] };
	});
}

/**
 * 月页说明里按当月数据写的一句。两个词的事项写几天两词都宜、哪几天只宜一个（「11月的 11 天里，10 天两个词都宜；25日只宜移徙。」）；
 * 一个词的事项（或这个月没有吉日）写本月与前后月的天数（「12月合用的有 4 天；11月有 12 天，明年1月有 11 天。」）。
 */
export function monthNote(slug: Slug, month: string, hant: boolean): string {
	const t = (hans: string, tw: string) => (hant ? tw : hans);
	const name = (w: string) => dataOf(hant).names?.[w] ?? w;
	const days = goodDays(...ym(month), slug);
	const words = ITEMS.find((i) => i.slug === slug)!.words;
	const [year, m] = ym(month);
	const n = days.length;
	if (words.length > 1 && n) {
		const both = days.filter((d) => d.hits.length === words.length).length;
		if (both === n) return t(`${m}月的 ${n} 天，两个词都宜。`, `${m}月的 ${n} 天，兩個詞都宜。`);
		const only = words
			.map((w) => [w, days.filter((d) => d.hits.length === 1 && d.hits[0] === w).map((d) => `${Number(d.date.slice(8))}日`)] as const)
			.filter(([, ds]) => ds.length)
			.map(([w, ds]) => `${ds.join("、")}只宜${name(w)}`);
		const head = both ? t(`${both} 天两个词都宜`, `${both} 天兩個詞都宜`) : t("没有两个词都宜的日子", "沒有兩個詞都宜的日子");
		return `${m}月的 ${n} ${t("天里", "天裡")}，${head}；${only.join("；")}。`;
	}
	const near = [-1, 1]
		.map((k) => shiftMonth(month, k))
		.filter(monthInWindow)
		.map((x) => {
			const [y, mm] = ym(x);
			return `${y === year ? "" : y < year ? "去年" : "明年"}${mm}月有 ${count(slug, x)} 天`;
		});
	const head = n ? `${m}月合用的有 ${n} 天` : `${m}月${t("没有合用的日子", "沒有合用的日子")}`;
	return near.length ? `${head}；${near.join("，")}。` : `${head}。`;
}
