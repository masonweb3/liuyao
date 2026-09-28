/**
 * 首屏的今日干支。它是首页的 LCP，不能等 tyme4ts（calendar 分包 71KB gzip）。
 *
 * 结果与 `ganzhiFromDate(now)` 相同（UTC+8、晚子时不换日）：日柱按北京日期推；年柱、月柱看太阳视黄经
 * 过了哪一个「节」，用 Meeus《天文算法》第 25 章的低精度公式。
 */
import type { Ganzhi } from "./liuyao/calendar.js";

const STEMS = "甲乙丙丁戊己庚辛壬癸";
const BRANCHES = "子丑寅卯辰巳午未申酉戌亥";
const RAD = Math.PI / 180;
/**
 * ponytail: 离「节」不到这么多度（约 70 分钟），或不在 2000–2100 年，就交给 tyme4ts 算精确时刻。
 * 公式在「节」上的误差见 today.test.ts（远小于这个值）。
 */
export const MARGIN = 0.05;

const cycle = (n: number, m = n) => STEMS[n % 10] + BRANCHES[m % 12];

/** 太阳视黄经从立春（315°）起算的度数，0–360：每 30° 一个月，寅月从 0 开始。 */
export function sinceLichun(date: Date): number {
	const t = (date.getTime() / 86_400_000 - 10_957.5) / 36_525; // J2000.0 起的儒略世纪（不计 ΔT，差约 70 秒）
	const m = (357.52911 + 35999.05029 * t) * RAD;
	const lon =
		280.46646 +
		36000.76983 * t +
		(1.914602 - 0.004817 * t) * Math.sin(m) +
		0.019993 * Math.sin(2 * m) +
		0.000289 * Math.sin(3 * m) -
		0.00569 -
		0.00478 * Math.sin((125.04 - 1934.136 * t) * RAD);
	return (lon + 45) % 360;
}

/** 不用 tyme4ts 的年、月、日柱；临近交节时返回 null。 */
export function quickGanzhi(date: Date): Pick<Ganzhi, "year" | "month" | "day"> | null {
	const bj = new Date(date.getTime() + 8 * 3_600_000);
	const y = bj.getUTCFullYear();
	const deg = sinceLichun(date);
	if (y < 2000 || y > 2100 || deg % 30 < MARGIN || deg % 30 > 30 - MARGIN) return null;
	const month = Math.floor(deg / 30);
	// 一二月里还没到立春（子月、丑月），算上一年。
	const year = y - 4 - (bj.getUTCMonth() < 2 && month >= 10 ? 1 : 0);
	return {
		year: cycle(year),
		// 五虎遁：甲己之年丙作首
		month: cycle((year % 5) * 2 + 2 + month, month + 2),
		// 1970-01-01 是辛巳日（第 17）
		day: cycle(Math.floor(bj.getTime() / 86_400_000) + 17),
	};
}

/** 「乙巳年 乙酉月 甲子日」 */
export async function todayText(now = new Date()): Promise<string> {
	const g = quickGanzhi(now) ?? (await import("./liuyao/calendar.js")).ganzhiFromDate(now);
	return `${g.year}年 ${g.month}月 ${g.day}日`;
}
