/**
 * 黄历的一天（M17）。零 DOM：逐日页、按月数据在构建时算；今日页只在今天落在时间窗外时才在浏览器里加载它。
 *
 * 以日为单位，不看时刻：交节那天整天算新的月建（tyme4ts 的 SixtyCycleDay 就这样取），建除因此在交节日与前一天重复，
 * 正是黄历「逢节重建」的排法。起卦的 calendar.ts 按精确时刻，所以交节当天交节之前，两边的月柱不同。
 *
 * 宜忌、神煞全部查 tyme4ts 的表，只改两处写法：农历十一月、十二月写冬月、腊月（M17-15）；
 * 凶神「元武」写「玄武」（M17-13，清代避讳的写法，值神里本来就是玄武）。
 * 6tail 说宜忌表是从通行万年历十几年的数据里整理出规律做成的，神煞名用《协纪辨方书》的写法。
 * 与通行黄历的对照见 huangli.test.ts 开头。日家九星不显示（M17-14：流派不同，对照 10 天只有 2 天一致）。
 */
import { HeavenStem, SolarDay, SolarTerm } from "tyme4ts";
import { GUA } from "../data/gua-slugs.js";
import { JIEQI, ymd } from "./huangli-days.js";

export interface Huangli {
	/** 公历「2026-10-01」 */
	date: string;
	/** 星期「四」 */
	week: string;
	lunar: {
		/** 农历年（春节起算）的干支「丙午」和生肖「马」；年柱按立春，见 ganzhi.year */
		year: string;
		zodiac: string;
		/** 「八月」「闰六月」「冬月」「腊月」 */
		month: string;
		leap: boolean;
		/** 「初一」「廿一」 */
		day: string;
	};
	/** 农历节日「中秋节」 */
	festival?: string;
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
	/**
	 * 所在节气与第几天（交节日为 0）；交节日另给交节时刻「14:41」（北京时间）。
	 * hou 是这一天在本节气的第几候（0 初候、1 二候、2 三候），候名在释义数据的 jieqi.<名>.hou 里。
	 */
	term: { name: string; day: number; time?: string; hou: number };
	/** 下一个节气（不含今天）与交节时刻 */
	nextTerm: { name: string; date: string; time: string };
}

const pad = (n: number) => String(n).padStart(2, "0");
const dayOf = (d: SolarDay) => ymd(d.getYear(), d.getMonth(), d.getDay());
const hm = (t: SolarTerm) => {
	const at = t.getJulianDay().getSolarTime();
	return `${pad(at.getHour())}:${pad(at.getMinute())}`;
};
const monthName = (s: string) => s.replace("十一月", "冬月").replace("十二月", "腊月");

// 构建时一个日子要算好几次（逐日页本身、邻近几天的本月日历、按月数据）。
const cache = new Map<string, Huangli>();

export function huangli(year: number, month: number, day: number): Huangli {
	const key = ymd(year, month, day);
	const hit = cache.get(key);
	if (hit) return hit;
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
	const festival = lunar.getFestival()?.getName();
	const godNames = (luck: string) =>
		gods.filter((g) => g.getLuck().getName() === luck).map((g) => (g.getName() === "元武" ? "玄武" : g.getName()));

	const h: Huangli = {
		date: key,
		week: solar.getWeek().getName(),
		lunar: {
			year: lunarYear.getName(),
			zodiac: lunarYear.getEarthBranch().getZodiac().getName(),
			month: monthName(lunarMonth.getName()),
			leap: lunarMonth.isLeap(),
			day: lunar.getName(),
		},
		...(festival && { festival }),
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
		gods: { ji: godNames("吉"), xiong: godNames("凶") },
		pengzu: [pengzu.getPengZuHeavenStem().getName(), pengzu.getPengZuEarthBranch().getName()],
		term: {
			name: term.getName(),
			day: termDay.getDayIndex(),
			...(termDay.getDayIndex() === 0 && { time: hm(term) }),
			// 七十二候的下标 = 节气下标（从冬至起）× 3 + 第几候
			hou: solar.getPhenologyDay().getPhenology().getIndex() % 3,
		},
		nextTerm: { name: next.getName(), date: dayOf(next.getSolarDay()), time: hm(next) },
	};
	cache.set(key, h);
	return h;
}

/**
 * 今日读一卦（M17-6）：按通行本卦序一天一卦，64 天读完一轮，谁在哪天打开都是同一卦。
 * 不按干支（六十甲子配不满六十四卦），也不随机（逐日页要预渲染，搜索引擎看到的要和用户看到的一样）。
 * 起点 2026-01-01 读乾；只是个固定的日子，没有别的含义。
 */
export function dailyGua(year: number, month: number, day: number): { name: string; slug: string } {
	const n = Math.round((Date.UTC(year, month - 1, day) - Date.UTC(2026, 0, 1)) / 86_400_000);
	const [name, slug] = GUA[((n % 64) + 64) % 64]!;
	return { name, slug };
}

const parse = (date: string) => date.split("-").map(Number) as [number, number, number];
export const huangliOf = (date: string) => huangli(...parse(date));

/** 某节气落在某公历年的那一次：日期与交节时刻（北京时间）。tyme4ts 的节气年从上一年冬至算起，所以要对一下年份。 */
export function termIn(year: number, name: string): { date: string; time: string } {
	for (const y of [year, year + 1]) {
		const t = SolarTerm.fromName(y, name);
		if (t.getSolarDay().getYear() === year) return { date: dayOf(t.getSolarDay()), time: hm(t) };
	}
	throw new Error(`${year} 年找不到${name}`);
}

/** 交节日前后的节气：上一个、下一个（节气页的前后链接） */
export function termNeighbors(date: string): { prev: { name: string; date: string }; next: { name: string; date: string } } {
	const t = SolarDay.fromYmd(...parse(date)).getTermDay().getSolarTerm();
	const at = (x: SolarTerm) => ({ name: x.getName(), date: dayOf(x.getSolarDay()) });
	return { prev: at(t.next(-1)), next: at(t.next(1)) };
}

/** 这一次节气三候各从哪天起：从交节日往后数，候名换了就是下一候的第一天（与逐日页的「正当某候」同一种算法）。 */
export function houStarts(date: string): string[] {
	let d = SolarDay.fromYmd(...parse(date));
	const starts = [date];
	let name = d.getPhenologyDay().getPhenology().getName();
	while (starts.length < 3) {
		d = d.next(1);
		const n = d.getPhenologyDay().getPhenology().getName();
		if (n !== name) starts.push(dayOf(d));
		name = n;
	}
	return starts;
}

const CN = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
/** 1–24 的中文数字：一、十、十七、二十四 */
export const cn = (n: number) => (n <= 10 ? CN[n]! : `${n < 20 ? "" : CN[Math.floor(n / 10)]}十${CN[n % 10]}`);

/** 节气的固定属性：立春起第几个、季与季中第几个、太阳黄经、所在节月（正月节、正月中……） */
export function termFacts(name: string) {
	const k = JIEQI.findIndex(([n]) => n === name);
	if (k < 0) throw new Error(`不认识的节气：${name}`);
	const month = Math.floor(k / 2);
	return {
		no: k + 1,
		season: "春夏秋冬"[Math.floor(k / 6)]!,
		inSeason: (k % 6) + 1,
		longitude: (SolarTerm.NAMES.indexOf(name) * 15 + 270) % 360,
		month: `${month ? cn(month + 1) : "正"}月`,
		jie: k % 2 === 0,
		branch: "寅卯辰巳午未申酉戌亥子丑"[month]!,
	};
}

/** 释义数据（huangli.json / huangli-hant.json）里页面要用的部分；繁体多一张 tyme4ts 简体名 → 繁体的对照表。 */
export interface Data {
	/** 照录涉医、涉讼的词时接的注（M17-10） */
	note: { med: string; law: string };
	jieqi: Record<string, { lead: string; text: string; hou: { name: string; text: string }[] }>;
	duty: Record<string, { name: string; text: string }>;
	tianshen: Record<string, { name: string; text: string }>;
	yiji: Record<string, { name: string; text: string; note?: Note }>;
	names?: Record<string, string>;
}

export type Note = "med" | "law";
/** 彭祖百忌照录，但带「药」「词讼」的句子也接注（「未不服药毒气入肠」「癸不词讼理弱敌强」）；宜忌词的注标在释义数据里 */
const pengzuNote = (line: string): Note | undefined => (line.includes("药") ? "med" : line.includes("词讼") ? "law" : undefined);
/** 不是一件事的标记词（M17-12）：排在词后、次要色，不进词义；一行只有它时用主色 */
const MARKS = ["馀事勿取", "诸事不宜"];

export interface Words {
	/** 词；带 note 的词后标小号「注」 */
	list: { key: string; name: string; note?: Note }[];
	/** 标记词照录原文次序；有两天宜里「馀事勿取」「诸事不宜」都有（通行黄历也这样列），两个都显示 */
	marks?: string[];
}

/** 页面上显示的一天：文字都已按简繁写好。逐日页、今日页的按月数据、窗口外的今日页都用它。 */
export interface Show {
	date: string;
	year: string;
	/** 「10月1日」 */
	md: string;
	/** 「星期四」 */
	week: string;
	festival?: string;
	/** 「八月廿一」 */
	lunar: string;
	/** 「丙午年 丁酉月 戊申日」 */
	ganzhi: string;
	/** 「马年」 */
	zodiac: string;
	yi: Words;
	ji: Words;
	/** 宜忌下方的注：涉医的词一句、涉讼的词一句；再是标记词的说明 */
	notes: string[];
	markNotes: string[];
	/** 「冲虎（壬寅）煞南」 */
	chong: string;
	/** 「闭日」 */
	duty: string;
	/** 「白虎 · 黑道」 */
	star: string;
	nayin: string;
	gods: { ji: string[]; xiong: string[] };
	pengzu: { text: string; note?: Note }[];
	/** 彭祖百忌下方的注 */
	pengzuNotes: string[];
	/** 逐日页的节气一句：「秋分第 9 天，正当秋分二候「蛰虫坯户」。」 */
	term: string;
	/** 今日页的节气一句：「今天是秋分第 9 天。下一个节气寒露，10月8日 14:29 交节。」 */
	today: string;
	/** 所在节气的简体名：今日页在二十四节气表里标出它 */
	termKey: string;
	/** 「寒露 · 10月8日 14:29 交节」，key 是简体节气名（链节气页） */
	next: { key: string; text: string };
	gua: { name: string; slug: string };
}

const md = (date: string) => {
	const [, m, d] = parse(date);
	return `${m}月${d}日`;
};

export function show(h: Huangli, data: Data): Show {
	const hant = !!data.names;
	const t = (hans: string, tw: string) => (hant ? tw : hans);
	const tw = (s: string) => data.names?.[s] ?? s;
	const words = (all: string[]): Words => {
		const marks = all.filter((w) => MARKS.includes(w)).map(tw);
		return {
			list: all.filter((w) => !MARKS.includes(w)).map((w) => ({ key: w, name: tw(w), ...(data.yiji[w]?.note && { note: data.yiji[w].note }) })),
			...(marks.length > 0 && { marks }),
		};
	};
	const yi = words(h.yi);
	const ji = words(h.ji);
	const notes: string[] = [];
	for (const kind of ["med", "law"] as const) {
		const noted = [...yi.list, ...ji.list].filter((w) => w.note === kind).map((w) => `「${w.name}」`);
		if (noted.length) notes.push(`${noted.join("")}：${data.note[kind]}`);
	}
	const pengzu = h.pengzu.map((line) => ({ text: tw(line), ...(pengzuNote(line) && { note: pengzuNote(line) }) }));
	const markNotes: string[] = [];
	if (h.yi.includes("馀事勿取")) markNotes.push(t("「馀事勿取」照录旧历原文：除了上面这几件，其余的事都不取。", "「餘事勿取」照錄舊曆原文：除了上面這幾件，其餘的事都不取。"));
	// 窗内宜里有「诸事不宜」的 5 天，前面都还列着几件宜事（通行黄历同样照列），说「没有适宜的事」就自相矛盾
	if (h.yi.includes("诸事不宜"))
		markNotes.push(
			yi.list.length
				? t("「诸事不宜」照录旧历原文：除了上面这几件，其余不宜多安排。", "「諸事不宜」照錄舊曆原文：除了上面這幾件，其餘不宜多安排。")
				: t("「诸事不宜」照录旧历原文：这一天没有特别适宜的事。", "「諸事不宜」照錄舊曆原文：這一天沒有特別適宜的事。"),
		);
	if (h.ji.includes("诸事不宜")) markNotes.push(t("「诸事不宜」照录旧历原文：除了宜里那几件，其余都不宜安排。", "「諸事不宜」照錄舊曆原文：除了宜裡那幾件，其餘都不宜安排。"));

	const term = tw(h.term.name);
	const hou = `${"初二三"[h.term.hou]}候「${data.jieqi[h.term.name]!.hou[h.term.hou]!.name}」`;
	const at = h.term.time;
	const next = `${tw(h.nextTerm.name)} · ${md(h.nextTerm.date)} ${h.nextTerm.time} ${t("交节", "交節")}`;
	const [y, m, d] = parse(h.date);
	return {
		date: h.date,
		year: `${y}年`,
		md: md(h.date),
		week: `星期${h.week}`,
		...(h.festival && { festival: tw(h.festival) }),
		lunar: tw(h.lunar.month) + tw(h.lunar.day),
		ganzhi: `${h.ganzhi.year}年 ${h.ganzhi.month}月 ${h.ganzhi.day}日`,
		zodiac: `${tw(h.lunar.zodiac)}年`,
		yi,
		ji,
		notes,
		markNotes,
		chong: `${t("冲", "沖")}${tw(h.chong.zodiac)}（${h.chong.ganzhi}）煞${tw(h.chong.sha)}`,
		duty: `${tw(h.duty)}日`,
		star: `${tw(h.star.name)} · ${tw(h.star.ecliptic)}`,
		nayin: tw(h.nayin),
		gods: { ji: h.gods.ji.map(tw), xiong: h.gods.xiong.map(tw) },
		pengzu,
		pengzuNotes: pengzu.filter((p) => p.note).map((p) => `「${p.text}」：${data.note[p.note!]}`),
		term: at
			? t(`今天 ${at} 交节${term}，正当${term}${hou}。`, `今天 ${at} 交節${term}，正當${term}${hou}。`)
			: t(`${term}第 ${h.term.day + 1} 天，正当${term}${hou}。`, `${term}第 ${h.term.day + 1} 天，正當${term}${hou}。`),
		today:
			(at ? t(`今天 ${at} 交节${term}。`, `今天 ${at} 交節${term}。`) : `今天是${term}第 ${h.term.day + 1} 天。`) +
			t(`下一个节气${tw(h.nextTerm.name)}，${md(h.nextTerm.date)} ${h.nextTerm.time} 交节。`, `下一個節氣${tw(h.nextTerm.name)}，${md(h.nextTerm.date)} ${h.nextTerm.time} 交節。`),
		termKey: h.term.name,
		next: { key: h.nextTerm.name, text: next },
		gua: dailyGua(y, m, d),
	};
}

/** 本月日历格里的小字：交节那天写节气名，初一写月名（冬月、闰六月），其余写农历日 */
export function calNote(h: Huangli, data: Data): string {
	const tw = (s: string) => data.names?.[s] ?? s;
	if (h.term.day === 0) return tw(h.term.name);
	return tw(h.lunar.day === "初一" ? h.lunar.month : h.lunar.day);
}
