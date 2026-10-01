/**
 * 择日（M18）的构建时部分：事项月页按月列吉日。宜忌取 huangli.ts（与逐日页同一份），
 * 命中规则在零依赖的 zeri-rule.ts，择日首页的浏览器脚本用的是同一个函数。
 */
import { huangliOf } from "./huangli.js";
import { ymd } from "./huangli-days.js";
import { clash, hits, type Slug } from "./zeri-rule.js";

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
