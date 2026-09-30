/**
 * 黄历栏目的日子与网址（M17）。零依赖：今日页的小脚本也用它（tyme4ts gzip 约 70 KB，今日页不加载）。
 * 不 import 别的模块：今日页脚本引了这个文件，它再引谁，打包时谁就被拆成首页与今日页共用的分包，
 * 首页入口包里的分包表跟着变（首页首屏 JS 不能增加）。
 */

/** 繁体页的网址前缀，同 gua-slugs.ts 的 HANT（huangli.test.ts 核对两处一致） */
export const HANT = "/zh-hant";

/**
 * 逐日页按整年生成（M17-3）。每年第四季度开一个 PR 往后加一年；旧年份不删，删了就是 404。
 * 时间窗只在这里定义：逐日页、按月数据、sitemap、「查另一天」的 min 和 max 都从这里取。
 */
export const YEARS = [2026, 2027];
export const FIRST = `${YEARS[0]}-01-01`;
export const LAST = `${YEARS[YEARS.length - 1]}-12-31`;

const pad = (n: number) => String(n).padStart(2, "0");
export const ymd = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
export const inWindow = (date: string) => date >= FIRST && date <= LAST;

/** 北京时间的今天 [年, 月, 日]：黄历按北京日期，与用户所在时区无关（同起卦，AGENTS.md §4.4）。 */
export function beijingYmd(now = new Date()): [number, number, number] {
	const t = new Date(now.getTime() + 8 * 3_600_000);
	return [t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()];
}

/** 时间窗里的每一天「2026-01-01」…「2027-12-31」 */
export function days(): string[] {
	const out: string[] = [];
	for (let t = Date.UTC(YEARS[0]!, 0, 1); ; t += 86_400_000) {
		const d = new Date(t);
		const s = ymd(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
		if (s > LAST) return out;
		out.push(s);
	}
}

/** 逐日页网址，带尾斜杠：/huangli/2026-10-01/，繁体 /zh-hant/huangli/2026-10-01/ */
export const dayPath = (date: string, hant = false) => `${hant ? HANT : ""}/huangli/${date}/`;

/** 二十四节气，从立春起（一行一季），与网址 slug：无调全拼（M17-4），上线后不改。 */
export const JIEQI: readonly (readonly [name: string, slug: string])[] = [
	["立春", "lichun"],
	["雨水", "yushui"],
	["惊蛰", "jingzhe"],
	["春分", "chunfen"],
	["清明", "qingming"],
	["谷雨", "guyu"],
	["立夏", "lixia"],
	["小满", "xiaoman"],
	["芒种", "mangzhong"],
	["夏至", "xiazhi"],
	["小暑", "xiaoshu"],
	["大暑", "dashu"],
	["立秋", "liqiu"],
	["处暑", "chushu"],
	["白露", "bailu"],
	["秋分", "qiufen"],
	["寒露", "hanlu"],
	["霜降", "shuangjiang"],
	["立冬", "lidong"],
	["小雪", "xiaoxue"],
	["大雪", "daxue"],
	["冬至", "dongzhi"],
	["小寒", "xiaohan"],
	["大寒", "dahan"],
];

export function jieqiPath(name: string, hant = false): string {
	const slug = JIEQI.find(([n]) => n === name)?.[1];
	if (!slug) throw new Error(`不认识的节气：${name}`);
	return `${hant ? HANT : ""}/jieqi/${slug}/`;
}
