/**
 * 梅花易数 —— 时间起卦、数字起卦，取体用，列出用卦、互卦、变卦对体卦的生克。零 DOM。
 *
 * 起例照《梅花易数》卷一（维基文库本）。只出卦和关系，不断吉凶：给不给、怎么给待定（M21）。
 * 两种起法都是确定的，不用随机数：同一时辰、同一组数得同一卦，这正是梅花的本意。
 */
import { SolarDay } from "tyme4ts";
import { GUA } from "../data/gua-slugs.js";
import type { LateZiSect } from "./liuyao/calendar.js";
import { GUA5, GUA64, GUAS, type Gua, XING5, type Xing5, YAOS, ZHIS, type Zhi } from "./liuyao/const.js";
import type { Yao } from "./liuyao/najia.js";

/** 经卦。`num` 是先天数：乾1 兑2 离3 震4 巽5 坎6 艮7 坤8，正好是 const.ts 里 GUAS、YAOS、GUA5 的下标加一。 */
export interface Trigram {
	num: number;
	name: Gua;
	element: Xing5;
}

export interface Hexagram {
	/** 卦全名，与 gua-slugs.ts 同：泽火革 */
	name: string;
	/** 卦页 slug：guaPath(name) 得网址 */
	slug: string;
	/** 六位卦码，初爻在前，1 阳 0 阴 */
	mark: string;
	upper: Trigram;
	lower: Trigram;
}

/** 某一卦对体卦：比和、生体、克体、体生（泄）、体克（耗）。用卦的「生体」就是用生体，依此类推。 */
export type Rel = "比和" | "生体" | "克体" | "体生" | "体克";

export interface Meihua {
	ben: Hexagram;
	hu: Hexagram;
	bian: Hexagram;
	/** 动爻：1 初爻 … 6 上爻。梅花只有一个动爻，所以总有变卦。 */
	dong: number;
	/** 本卦六爻写成铜钱和，初爻在前，动爻是 9 或 6：和六爻往卦同一种存法，najia 的 cast() 排出同样的本卦、变卦。 */
	params: Yao[];
	/** 体卦：不动的那一经卦；动爻所在为用卦 */
	ti: Trigram;
	yong: Trigram;
	/** 各卦对体卦：用卦；互卦的下、上两经卦；变卦里用卦变成的那一经卦（体卦不变，不必比） */
	rel: { yong: Rel; hu: [lower: Rel, upper: Rel]; bian: Rel };
	/** 起卦的三个数（除之前）：上卦数、下卦数、动爻数 */
	sums: [up: number, down: number, moving: number];
}

/** 农历时刻，时间起卦用。 */
export interface Moment {
	/** 年支，按农历年（正月初一换年），不按立春：观梅占「辰年十二月」即农历年。 */
	year: Zhi;
	/** 农历月数，闰月按本月：闰六月记 6。 */
	month: number;
	leap: boolean;
	/** 农历日数，1–30 */
	day: number;
	hour: Zhi;
}

const trigram = (num: number): Trigram => ({
	num,
	name: GUAS[num - 1] as Gua,
	element: XING5[GUA5[num - 1] as number] as Xing5,
});

const numOf = (bits: string) => YAOS.indexOf(bits as (typeof YAOS)[number]) + 1;

function hexagram(mark: string): Hexagram {
	const name = GUA64[mark] as string;
	return {
		name,
		slug: (GUA.find(([n]) => n === name) as readonly [string, string])[1],
		mark,
		upper: trigram(numOf(mark.slice(3))),
		lower: trigram(numOf(mark.slice(0, 3))),
	};
}

/** XING5 正是相生的次序（木火土金水），隔一位相克。 */
function rel(ti: Xing5, other: Xing5): Rel {
	const d = (XING5.indexOf(other) - XING5.indexOf(ti) + 5) % 5;
	return (["比和", "体生", "体克", "克体", "生体"] as const)[d] as Rel;
}

/** 「以八除之，以余数作卦」「以六除，余数作动爻」：整除时余数作八、作六（坤、上爻）。 */
const rest = (n: number, by: number) => ((n - 1) % by) + 1;

function count(n: number): number {
	if (!Number.isSafeInteger(n) || n < 1) throw new Error(`起卦的数要是正整数，得到 ${n}`);
	return n;
}

/** 卷一「互卦起例」：去初爻、上爻，二三四爻作下卦，三四五爻作上卦。 */
const huMark = (mark: string) => mark.slice(1, 4) + mark.slice(2, 5);

/**
 * 由三个数起卦：上卦数、下卦数各除八，动爻数除六。时间起卦、数字起卦都走这里；
 * 字画占这类动爻不加时的起法（西林寺牌额占）也能直接用，只是界面不开放（M21 待定）。
 */
export function fromSums(up: number, down: number, moving: number): Meihua {
	const u = rest(count(up), 8);
	const l = rest(count(down), 8);
	const dong = rest(count(moving), 6);
	const mark = (YAOS[l - 1] as string) + (YAOS[u - 1] as string);
	const flip = (b: string, i: number) => (i === dong - 1 ? (b === "1" ? "0" : "1") : b);
	const changed = [...mark].map(flip).join("");
	const ben = hexagram(mark);
	const bian = hexagram(changed);
	// 卷一：「乾坤无互，互其变卦。」乾、坤的互卦是自己，改取变卦的互卦（M21 待定：卦页的互卦是照常取的）。
	const hu = hexagram(huMark(mark === "111111" || mark === "000000" ? changed : mark));
	const inner = dong <= 3;
	const ti = inner ? ben.upper : ben.lower;
	const yong = inner ? ben.lower : ben.upper;
	const to = (t: Trigram) => rel(ti.element, t.element);
	return {
		ben,
		hu,
		bian,
		dong,
		params: [...mark].map((b, i) => (b === "1" ? (i === dong - 1 ? 9 : 7) : i === dong - 1 ? 6 : 8)),
		ti,
		yong,
		rel: { yong: to(yong), hu: [to(hu.lower), to(hu.upper)], bian: to(inner ? bian.lower : bian.upper) },
		sums: [up, down, moving],
	};
}

const BEIJING = 8 * 3_600_000;

/** 时支：23–1 点子，1–3 点丑……按北京时间（AGENTS.md §4.4）。 */
const hourOf = (date: Date) => ZHIS[Math.floor((new Date(date.getTime() + BEIJING).getUTCHours() + 1) / 2) % 12] as Zhi;

const zhiNum = (z: Zhi) => ZHIS.indexOf(z) + 1;

/**
 * 起卦时刻的农历年支、月、日与时支，按北京时间。
 *
 * 晚子时（23 点后）：`day-stays`（默认，同六爻）日子不换；`day-advances` 算次日，月、年可能跟着换
 * （除夕 23:30 就成了新年正月初一）。时支两种都是子。
 */
export function moment(date: Date, lateZi: LateZiSect = "day-stays"): Moment {
	const t = new Date(date.getTime() + BEIJING);
	let solar = SolarDay.fromYmd(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
	if (t.getUTCHours() === 23 && lateZi === "day-advances") solar = solar.next(1);
	const lunar = solar.getLunarDay();
	const month = lunar.getLunarMonth();
	return {
		// 不用 LunarDay.getYearSixtyCycle()：它按立春换年，且只精确到日。
		year: month.getLunarYear().getSixtyCycle().getEarthBranch().getName() as Zhi,
		month: month.getMonth(),
		leap: month.isLeap(),
		day: lunar.getDay(),
		hour: hourOf(date),
	};
}

/** 时间起卦：年支数＋月数＋日数为上卦；再加时支数为下卦，也定动爻（卷一「年月日时起例」）。 */
export function byTime(date: Date, lateZi: LateZiSect = "day-stays"): Meihua & { moment: Moment } {
	const m = moment(date, lateZi);
	const ymd = zhiNum(m.year) + m.month + m.day;
	const all = ymd + zhiNum(m.hour);
	return { ...fromSums(ymd, all, all), moment: m };
}

/**
 * 数字起卦，动爻都加时支数（卷一「取爻当以时加之」）：
 * - 两个数：前一个为上卦，后一个为下卦，两数加时为动爻（邻夜扣门借物占：一声、五声，加酉时）。
 * - 一个数：此数为上卦，加时为下卦，也定动爻（卷一「声音占例」：「起作上卦，加时数配作下卦」）。
 */
export function byNumbers(nums: readonly number[], date: Date): Meihua {
	const h = zhiNum(hourOf(date));
	if (nums.length === 1) {
		const n = count(nums[0] as number);
		return fromSums(n, n + h, n + h);
	}
	if (nums.length === 2) {
		const [a, b] = nums.map(count) as [number, number];
		return fromSums(a, b, a + b + h);
	}
	throw new Error(`数字起卦要一个或两个数，得到 ${nums.length} 个`);
}
