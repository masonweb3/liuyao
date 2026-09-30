/**
 * 黄历的一天（M17）。零 DOM：逐日页预渲染和今日页在浏览器里算，用的是同一个函数。
 *
 * 以日为单位，不看时刻：交节那天整天算新的月建（tyme4ts 的 SixtyCycleDay 就这样取），建除因此在交节日与前一天重复，
 * 正是黄历「逢节重建」的排法。起卦的 calendar.ts 按精确时刻，所以交节当天交节之前，两边的月柱不同。
 *
 * 宜忌、神煞全部查 tyme4ts 的表，这里不改一个字：6tail 说宜忌表是从通行万年历十几年的数据里整理出规律做成的，
 * 神煞名用《协纪辨方书》的写法（元武、鸣吠对、厌对）。与通行黄历的对照见 huangli.test.ts 开头。
 */
import { HeavenStem, SolarDay } from "tyme4ts";
import { GUA } from "../data/gua-slugs.js";

export interface Huangli {
	/** 公历「2026-10-01」 */
	date: string;
	/** 星期「四」 */
	week: string;
	lunar: {
		/** 农历年（春节起算）的干支「丙午」和生肖「马」；年柱按立春，见 ganzhi.year */
		year: string;
		zodiac: string;
		/** 「八月」「闰六月」 */
		month: string;
		leap: boolean;
		/** 「初一」「廿一」 */
		day: string;
	};
	/** 年柱（立春起）、月柱（交节日起）、日柱 */
	ganzhi: { year: string; month: string; day: string };
	/** 日柱纳音「海中金」 */
	nayin: string;
	yi: string[];
	ji: string[];
	/** 冲「猴」、所冲之日「甲申」、煞「北」 */
	chong: { zodiac: string; ganzhi: string; sha: string };
	/** 建除十二值星「建」…「闭」 */
	duty: string;
	/** 十二天神「青龙」，及其黄道、黑道 */
	star: { name: string; ecliptic: string };
	/** 吉神宜趋、凶神宜忌 */
	gods: { ji: string[]; xiong: string[] };
	/** 彭祖百忌：天干一句、地支一句 */
	pengzu: [string, string];
	/** 日家九星「一白水」 */
	nineStar: string;
	/** 所在节气与第几天（交节日为 0）；交节日另给交节时刻「14:41」（北京时间） */
	term: { name: string; day: number; time?: string };
	/** 下一个节气（不含今天） */
	nextTerm: { name: string; date: string };
}

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: SolarDay) => `${d.getYear()}-${pad(d.getMonth())}-${pad(d.getDay())}`;

/** 北京时间的今天 [年, 月, 日]：黄历按北京日期，与用户所在时区无关（同起卦，AGENTS.md §4.4）。 */
export function beijingYmd(now = new Date()): [number, number, number] {
	const t = new Date(now.getTime() + 8 * 3_600_000);
	return [t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()];
}

export function huangli(year: number, month: number, day: number): Huangli {
	const solar = SolarDay.fromYmd(year, month, day);
	const lunar = solar.getLunarDay();
	const lunarMonth = lunar.getLunarMonth();
	const lunarYear = lunarMonth.getLunarYear().getSixtyCycle();
	const cycle = solar.getSixtyCycleDay();
	const today = cycle.getSixtyCycle();
	const branch = today.getEarthBranch();
	const gods = cycle.getGods();
	const star = cycle.getTwelveStar();
	const pengzu = today.getPengZu();
	const termDay = solar.getTermDay();
	const term = termDay.getSolarTerm();
	const next = term.next(1);
	const at = term.getJulianDay().getSolarTime();

	return {
		date: ymd(solar),
		week: solar.getWeek().getName(),
		lunar: {
			year: lunarYear.getName(),
			zodiac: lunarYear.getEarthBranch().getZodiac().getName(),
			month: lunarMonth.getName(),
			leap: lunarMonth.isLeap(),
			day: lunar.getName(),
		},
		ganzhi: { year: cycle.getYear().getName(), month: cycle.getMonth().getName(), day: today.getName() },
		nayin: today.getSound().getName(),
		yi: cycle.getRecommends().map((t) => t.getName()),
		ji: cycle.getAvoids().map((t) => t.getName()),
		chong: {
			zodiac: branch.getOpposite().getZodiac().getName(),
			// 通书写「冲猴（甲申）」：所冲之日取天干相克（隔四位）、地支相冲，甲子日冲戊午
			ganzhi: HeavenStem.fromIndex(today.getHeavenStem().getIndex() + 4).getName() + branch.getOpposite().getName(),
			sha: branch.getOminous().getName(),
		},
		duty: cycle.getDuty().getName(),
		star: { name: star.getName(), ecliptic: star.getEcliptic().getName() },
		gods: {
			ji: gods.filter((g) => g.getLuck().getName() === "吉").map((g) => g.getName()),
			xiong: gods.filter((g) => g.getLuck().getName() === "凶").map((g) => g.getName()),
		},
		pengzu: [pengzu.getPengZuHeavenStem().getName(), pengzu.getPengZuEarthBranch().getName()],
		nineStar: solar.getNineStar().toString(),
		term: {
			name: term.getName(),
			day: termDay.getDayIndex(),
			...(termDay.getDayIndex() === 0 && { time: `${pad(at.getHour())}:${pad(at.getMinute())}` }),
		},
		nextTerm: { name: next.getName(), date: ymd(next.getSolarDay()) },
	};
}

/**
 * 今日读一卦：按通行本卦序一天一卦，64 天读完一轮，谁在哪天打开都是同一卦。
 * 不按干支（六十甲子配不满六十四卦），也不随机（逐日页要预渲染、搜索引擎看到的要和用户看到的一样）。
 * 起点 2026-01-01 读乾；只是个固定的日子，没有别的含义。
 */
export function dailyGua(year: number, month: number, day: number): { name: string; slug: string } {
	const days = Math.round((Date.UTC(year, month - 1, day) - Date.UTC(2026, 0, 1)) / 86_400_000);
	const [name, slug] = GUA[((days % 64) + 64) % 64]!;
	return { name, slug };
}
