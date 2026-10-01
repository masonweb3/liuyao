/**
 * 八字排盘（M19）。零 DOM，只依赖 tyme4ts：/bazi/ 在浏览器里算，生辰不上传（AGENTS.md §1.5）。
 *
 * 只出盘面，不带断语。四柱、十神、藏干、十二长生、纳音、空亡、胎元、命宫、身宫、大运都查 tyme4ts；
 * 刑冲合会、神煞、五行个数自写（tyme4ts 的 God 是黄历日神，不是八字神煞，这里不用）。
 *
 * 时刻（M19-5、M19-10）：输入是出生地的钟表时刻，另给那一刻的 UTC 偏移（默认 UTC+8）。年柱、月柱与起运按同一瞬间的
 * 北京时间比节气（tyme4ts 的节气按北京时间；交节是一个瞬间，与出生地无关）；日柱、时柱按当地：标准时（夏令时拨回去），
 * 开了真太阳时就按当地的太阳。和六爻一样与机器所在时区无关。
 */
import { equationOfTime } from "./bazi-time.js";
import type { LateZiSect } from "./liuyao/calendar.js";
import {
	ChildLimit,
	China95ChildLimitProvider,
	DefaultChildLimitProvider,
	EarthBranch,
	EightChar,
	Gender as TymeGender,
	HeavenStem,
	LunarHour,
	LunarSect1ChildLimitProvider,
	LunarSect2ChildLimitProvider,
	SixtyCycle,
	SixtyCycleYear,
	SolarDay,
	SolarTerm,
	SolarTime,
} from "tyme4ts";

export type Gender = "男" | "女";

export interface Birth {
	/** solar 公历；lunar 农历（月份写正数，闰月另给 leap） */
	calendar: "solar" | "lunar";
	year: number;
	month: number;
	day: number;
	/** 时辰不知道（M19-11）时不给：只排年、月、日三柱 */
	hour?: number;
	minute?: number;
	leap?: boolean;
	gender: Gender;
}

/**
 * 起运（qiYun）算法，即出生到前后一个「节」的时长怎么折成岁数。都是三天折一年，差在零头：
 * - sect2：按分钟折，算到时辰以下（12 分钟一天、1 分钟两小时）。元亨利贞网现在的结果和它一致。
 * - default：按秒折，算到分钟，是 tyme4ts 的默认。
 * - china95：按分钟折，只算到天，零头舍去。易安居网和它一致（名字是 tyme4ts 起的，现在的元亨利贞已不是这样）。
 * - sect1：只数日子和时辰，不看分钟（一天四个月、一个时辰十天）。
 */
export type QiYunSect = "sect2" | "default" | "china95" | "sect1";

export interface Options {
	/**
	 * 晚子时（23–24 点）日柱换不换日。默认换日（M19-1：多数排盘网站这样排，用户常拿别家的盘来对；
	 * 六爻的默认仍是不换日）。时柱两种都按次日起。
	 */
	lateZi?: LateZiSect;
	/** 默认 sect2（M19-2） */
	qiYun?: QiYunSect;
	/** 真太阳时：出生地东经度数（西经为负）。不给就不校正 */
	longitude?: number;
	/** 出生那一刻当地的 UTC 偏移（分钟，东正西负，可带小数），含夏令时。默认 480：北京时间 */
	offset?: number;
	/** 那一刻夏令时拨快了多少分钟（默认 0）。日柱、时柱按标准时排，钟表减去它 */
	dst?: number;
}

export interface Pillar {
	/** 干支「甲子」 */
	ganZhi: string;
	gan: string;
	zhi: string;
	/** 天干、地支的五行 */
	ganWuXing: string;
	zhiWuXing: string;
	/** 天干十神（shiShen），对日干而言；日柱是日主本身，为 null */
	shiShen: string | null;
	/** 藏干（cangGan）：本气、中气、余气，各带十神 */
	cangGan: { gan: string; shiShen: string }[];
	/** 十二长生：星运（xingYun）是日干临本柱地支，自坐（ziZuo）是本柱天干临本柱地支 */
	xingYun: string;
	ziZuo: string;
	/** 纳音（naYin） */
	naYin: string;
	/** 本柱所在旬的空亡（kongWang）「戌亥」 */
	kongWang: string;
	/** 本柱带的神煞（shenSha），查法见 SHEN_SHA */
	shenSha: string[];
}

export interface GanZhiNaYin {
	ganZhi: string;
	naYin: string;
}

export type GuanXiType = "天干五合" | "地支六合" | "三合" | "半合" | "三会" | "六冲" | "三刑" | "相刑" | "自刑" | "六害";

/** 刑冲合会（guanXi） */
export interface GuanXi {
	type: GuanXiType;
	/** 「甲己合土」「申子辰三合水局」「寅巳申三刑」 */
	name: string;
	/** 涉及哪几柱（传进来的干支表的下标；四柱是 0 年、1 月、2 日、3 时） */
	zhu: number[];
}

export interface LiuNian {
	/** 公历年。干支年从这一年立春起算 */
	year: number;
	/** 虚岁：出生那个公历年算 1 岁（与大运的岁数同一算法，见 daYun） */
	age: number;
	ganZhi: string;
	/** 天干十神、地支本气十神 */
	shiShen: string;
	zhiShiShen: string;
}

/** 大运（daYun） */
export interface DaYun {
	ganZhi: string;
	shiShen: string;
	zhiShiShen: string;
	/** 虚岁与公历年，各十年 */
	startAge: number;
	endAge: number;
	startYear: number;
	endYear: number;
	/** 流年（liuNian） */
	liuNian: LiuNian[];
}

/** 起运的年、月、天（时辰不详时给范围用） */
export interface Span {
	years: number;
	months: number;
	days: number;
}

export interface Bazi {
	gender: Gender;
	/** 出生的公历时刻，当地钟表时间「1990-05-15 23:30」；农历输入已换成公历。时辰不详时只有日期「1990-05-15」 */
	solar: string;
	/** 不是北京时间（偏移不是 UTC+8）时：同一瞬间的北京时间 */
	beijing?: string;
	/** 开了真太阳时才有：校正后的时刻与校正了多少分钟（经度差加均时差） */
	zhenTaiYang?: { time: string; minutes: number };
	/** 农历「庚午年四月廿一」，按当地的日子；闰月写「闰四月」，十一、十二月写「冬月」「腊月」 */
	lunar: string;
	/** 农历年与年柱不同（春节后、立春前，或立春后、春节前）时：那一年立春的交节时刻（北京时间） */
	liChun?: string;
	/** 生肖，按年柱（立春起） */
	shengXiao: string;
	/** 年、月、日、时四柱；时辰不详时只有前三柱 */
	pillars: Pillar[];
	/** 胎元（taiYuan）、命宫（mingGong）、身宫（shenGong）。命宫、身宫要用生时，时辰不详时没有 */
	taiYuan: GanZhiNaYin;
	mingGong?: GanZhiNaYin;
	shenGong?: GanZhiNaYin;
	/** 五行个数（wuXing）：四柱八个字各算一个，地支取本身五行，不算藏干 */
	wuXing: Record<"木" | "火" | "土" | "金" | "水", number>;
	guanXi: GuanXi[];
	/**
	 * 起运：出生后几年几月几天几小时（算法不到的单位为 0），交运时刻（北京时间），大运顺排还是逆排。
	 * 时辰不详时按当天中午 12 点估，range 是当天 0:00 与 23:59 出生的起运（带交运那年，白话写「起止年份可能差一年」用）
	 */
	qiYun: Span & { hours: number; at: string; forward: boolean; range?: [Span & { startYear: number }, Span & { startYear: number }] };
	/** 时辰不详、出生那天正好交节（年柱、月柱要看出生时刻）时：那个节与交节时刻（北京时间）。盘按中午 12 点排 */
	jie?: { name: string; time: string };
	/** 十步大运，从起运那步开始 */
	daYun: DaYun[];
}

const PROVIDERS = {
	sect2: LunarSect2ChildLimitProvider,
	default: DefaultChildLimitProvider,
	china95: China95ChildLimitProvider,
	sect1: LunarSect1ChildLimitProvider,
} as const;

const G = "甲乙丙丁戊己庚辛壬癸";
const Z = "子丑寅卯辰巳午未申酉戌亥";
const gi = (gz: string) => G.indexOf(gz[0]!);
const zi = (gz: string) => Z.indexOf(gz[1]!);

const pad = (n: number) => String(n).padStart(2, "0");
const fmt = (t: SolarTime) =>
	`${t.getYear()}-${pad(t.getMonth())}-${pad(t.getDay())} ${pad(t.getHour())}:${pad(t.getMinute())}`;

/**
 * 神煞：以什么查、查到哪个字。规则是古籍里的公有领域查法，出处见每行（卷次按维基文库本《三命通会》）；
 * 歌诀是通行的口诀，只用来记表。只列中性或吉神，劫煞、亡神、孤辰寡宿这类名字带凶意的不列（engine.md 待定 M19-6）。
 *
 * 天乙、太极、文昌年干、日干都查（元亨利贞也两样都查，易安居只查日干）。
 * 年支、日支起查的四个（驿马、桃花、华盖、将星）不查起查的那一柱自己，与易安居同。
 */
type Rule = (gz: string[], k: number) => boolean;
// 以年干、日干（from 是柱的下标）查本柱地支。表按天干序：甲 0 … 癸 9
const byGan =
	(table: string[], from: number[]): Rule =>
	(gz, k) =>
		from.some((f) => table[gi(gz[f]!)]!.includes(gz[k]![1]!));
// 以年支、日支的三合局查本柱地支。表按局：申子辰、巳酉丑、寅午戌、亥卯未（地支序 mod 4 正好是这四局）
const byJu =
	(table: string): Rule =>
	(gz, k) =>
		[0, 2].some((f) => f !== k && table[zi(gz[f]!) % 4] === gz[k]![1]);
// 以月支查本柱的干或支
const byMonth =
	(table: string, ju: boolean): Rule =>
	(gz, k) =>
		gz[k]!.includes(table[ju ? zi(gz[1]!) % 4 : zi(gz[1]!)]!);

const SHEN_SHA: [string, Rule][] = [
	// 卷三〈论天乙贵人〉。歌诀：甲戊庚牛羊，乙己鼠猴乡，丙丁猪鸡位，壬癸兔蛇藏，六辛逢马虎
	["天乙贵人", byGan(["丑未", "子申", "亥酉", "亥酉", "丑未", "子申", "丑未", "寅午", "卯巳", "卯巳"], [0, 2])],
	// 卷三〈论太极贵〉。歌诀：甲乙生人子午中，丙丁鸡兔定亨通，戊己两干临四季，庚辛寅亥禄丰隆，壬癸巳申偏喜美
	["太极贵人", byGan(["子午", "子午", "卯酉", "卯酉", "辰戌丑未", "辰戌丑未", "寅亥", "寅亥", "巳申", "巳申"], [0, 2])],
	// 《三命通会》无专章，用通行歌诀：甲乙巳午报君知，丙戊申宫丁己鸡，庚猪辛鼠壬逢虎，癸人见卯入云梯
	["文昌贵人", byGan(["巳", "午", "申", "酉", "申", "酉", "亥", "子", "寅", "卯"], [0, 2])],
	// 卷三〈论天月德〉。歌诀：正丁二申宫，三壬四辛同，五亥六甲上，七癸八寅逢，九丙十归乙，子巳丑庚中（表按地支序，子月起）
	["天德贵人", byMonth("巳庚丁申壬辛亥甲癸寅丙乙", false)],
	// 同上：寅午戌月在丙，申子辰月在壬，亥卯未月在甲，巳酉丑月在庚
	["月德贵人", byMonth("壬庚丙甲", true)],
	// 卷三〈论十干禄〉：甲禄寅，乙禄卯，庚禄申，辛禄酉，壬禄亥，癸禄子，丙禄巳，丁禄午，戊寄巳，己寄午
	["禄神", byGan([..."寅卯巳午巳午申酉亥子"], [2])],
	// 卷三〈论羊刃〉：「羊刃常居禄前一辰」，阴干也取禄前。元亨利贞、易安居阴干取禄后（乙寅、癸亥），见待定 M19-6
	["羊刃", byGan([..."卯辰午未午未酉戌子丑"], [2])],
	// 卷三〈论金舆〉：禄前二辰。歌诀：甲龙乙蛇丙戊羊，丁己猴歌庚犬方，辛猪壬牛癸逢虎
	["金舆", byGan([..."辰巳未申未申戌亥丑寅"], [2])],
	// 卷三〈论驿马〉：申子辰马在寅，寅午戌马在申，巳酉丑马在亥，亥卯未马在巳
	["驿马", byJu("寅亥申巳")],
	// 桃花即卷二〈论咸池〉：申子辰在酉，巳酉丑在午，寅午戌在卯，亥卯未在子
	["桃花", byJu("酉午卯子")],
	// 卷二〈论将星华盖〉：「以三合中位谓之将星」「三合底处得库谓之华盖」
	["华盖", byJu("辰丑戌未")],
	["将星", byJu("子酉午卯")],
	// 卷六〈魁罡〉：「此格有四日：庚辰、壬辰、戊戌、庚戌」，只看日柱
	["魁罡", (gz, k) => k === 2 && ["庚辰", "庚戌", "壬辰", "戊戌"].includes(gz[2]!)],
];

export const shenSha = (gz: string[], k: number) => SHEN_SHA.filter(([, rule]) => rule(gz, k)).map(([name]) => name);

const TYPES: GuanXiType[] = ["天干五合", "地支六合", "三合", "半合", "三会", "六冲", "三刑", "相刑", "自刑", "六害"];
// 三合局按地支序 mod 4 分组，中间一字是旺支（子酉午卯）；三会按方位
const SAN_HE = [["申子辰", "水"], ["巳酉丑", "金"], ["寅午戌", "火"], ["亥卯未", "木"]] as const;
const SAN_HUI = [["寅卯辰", "木"], ["巳午未", "火"], ["申酉戌", "金"], ["亥子丑", "水"]] as const;
// 卷二〈论三刑〉：寅刑巳、巳刑申、申刑寅；丑刑戌、戌刑未、未刑丑；子卯相刑；辰午酉亥自刑。
// 五合、六合、三合、六害、冲分见卷二〈论十干合〉〈论支元六合〉〈论支元三合〉〈论六害〉〈论冲击〉
const SAN_XING = ["寅巳申", "丑戌未"];
const ZI_XING = "辰午酉亥";

// 两字的关系按干支序写（M19-15）：甲己合土、辰戌相冲、卯戌合火，与柱序无关，同一个关系只有一种写法
const pair = (a: string, b: string, order: string) => (order.indexOf(a) <= order.indexOf(b) ? a + b : b + a);

/**
 * 刑冲合会。传任意几柱的干支（四柱，或以后加上大运、流年），两两查合、冲、刑、害，
 * 三个一组查三合、三会、三刑。三合、三刑凑齐了就不再列其中两两的半合、相刑。半合只算含旺支的，不算拱合。
 * 名字只按干支取，同名的（月日、月时各一个辰戌相冲）靠 zhu 区分，界面合成一行。
 */
export function guanXi(gz: string[]): GuanXi[] {
	const out: GuanXi[] = [];
	const zhis = gz.map((x) => x[1]!);
	const holders = (chars: string) => zhis.flatMap((z, k) => (chars.includes(z) ? [k] : []));
	const full = (chars: string) => [...chars].every((c) => zhis.includes(c));

	for (const [chars, wx] of SAN_HE) {
		if (full(chars)) out.push({ type: "三合", name: `${chars}三合${wx}局`, zhu: holders(chars) });
	}
	for (const [chars, wx] of SAN_HUI) {
		if (full(chars)) out.push({ type: "三会", name: `${chars}三会${wx}局`, zhu: holders(chars) });
	}
	for (const chars of SAN_XING) {
		if (full(chars)) out.push({ type: "三刑", name: `${chars}三刑`, zhu: holders(chars) });
	}

	for (let i = 0; i < gz.length; i++) {
		for (let j = i + 1; j < gz.length; j++) {
			const [a, b] = [gz[i]!, gz[j]!];
			const zhu = [i, j];
			const he = HeavenStem.fromName(a[0]!).combine(HeavenStem.fromName(b[0]!));
			if (he) out.push({ type: "天干五合", name: `${pair(a[0]!, b[0]!, G)}合${he.getName()}`, zhu });

			const [x, y] = [a[1]!, b[1]!];
			const xy = pair(x, y, Z);
			const zx = EarthBranch.fromName(x);
			const zy = EarthBranch.fromName(y);
			const liuHe = zx.combine(zy);
			if (liuHe) out.push({ type: "地支六合", name: `${xy}合${liuHe.getName()}`, zhu });
			if (zx.getOpposite().equals(zy)) out.push({ type: "六冲", name: `${xy}相冲`, zhu });
			if (zx.getHarm().equals(zy)) out.push({ type: "六害", name: `${xy}相害`, zhu });
			if (x === y && ZI_XING.includes(x)) out.push({ type: "自刑", name: `${xy}自刑`, zhu });
			const xing = xy === "子卯" || SAN_XING.some((s) => !full(s) && s.includes(x) && s.includes(y) && x !== y);
			if (xing) out.push({ type: "相刑", name: `${xy}相刑`, zhu });

			for (const [chars, wx] of SAN_HE) {
				const half = x !== y && chars.includes(x) && chars.includes(y) && (x === chars[1] || y === chars[1]);
				// 半合照三合局的次序写：申子、子辰，不写子申
				if (half && !full(chars)) out.push({ type: "半合", name: `${[...chars].filter((c) => c === x || c === y).join("")}半合${wx}局`, zhu });
			}
		}
	}
	return out.sort((p, q) => TYPES.indexOf(p.type) - TYPES.indexOf(q.type));
}

/** 本柱所在旬的空亡：tyme4ts 的 getExtraEarthBranches 就是旬空的两个地支 */
const kong = (c: SixtyCycle) =>
	c
		.getExtraEarthBranches()
		.map((b) => b.getName())
		.join("");

const naYin = (c: SixtyCycle): GanZhiNaYin => ({ ganZhi: c.getName(), naYin: c.getSound().getName() });

/**
 * 排一个八字盘。农历日期不存在（闰月不对、小月三十）时 tyme4ts 会抛错，界面应先按 LunarYear/LunarMonth 只给合法选项。
 */
export function bazi(birth: Birth, options: Options = {}): Bazi {
	const { year, month, day } = birth;
	const known = birth.hour !== undefined;
	const offset = options.offset ?? 480;
	// 当地的钟表时刻。农历按当地的日子换成公历；时辰不详按中午 12 点估
	const at = (h: number, mi: number) =>
		birth.calendar === "lunar"
			? LunarHour.fromYmdHms(year, birth.leap ? -month : month, day, h, mi, 0).getSolarTime()
			: SolarTime.fromYmdHms(year, month, day, h, mi, 0);
	const clock = known ? at(birth.hour!, birth.minute ?? 0) : at(12, 0);
	// 同一瞬间的北京时间。年柱、月柱和起运按它比节气，精确到秒：交节是一个瞬间，与出生地无关（M19-10）
	const beijingOf = (t: SolarTime) => t.next(Math.round((480 - offset) * 60));
	const beijing = beijingOf(clock);

	// 日柱、时柱按当地：标准时（夏令时拨回去）；开了真太阳时按出生地的太阳，经度每度 4 分钟加均时差
	let local = clock.next(-Math.round((options.dst ?? 0) * 60));
	let zhenTaiYang: Bazi["zhenTaiYang"];
	if (options.longitude !== undefined && known) {
		const utc = Date.UTC(clock.getYear(), clock.getMonth() - 1, clock.getDay(), clock.getHour(), clock.getMinute()) - offset * 60_000;
		const minutes = options.longitude * 4 - offset + equationOfTime(utc);
		local = clock.next(Math.round(minutes * 60));
		zhenTaiYang = { time: fmt(local), minutes: Math.round(minutes * 10) / 10 };
	}

	const yearMonth = beijing.getSixtyCycleHour();
	const dayHour = local.getSixtyCycleHour();
	const dayCycle =
		known && (options.lateZi ?? "day-advances") === "day-advances"
			? dayHour.getDay()
			: SolarDay.fromYmd(local.getYear(), local.getMonth(), local.getDay()).getSixtyCycleDay().getSixtyCycle();
	// 时辰不详也照样构造四柱（胎元只看月柱），时柱不出
	const eight = new EightChar(yearMonth.getYear(), yearMonth.getMonth(), dayCycle, dayHour.getSixtyCycle());
	const cycles = [eight.getYear(), eight.getMonth(), eight.getDay(), eight.getHour()].slice(0, known ? 4 : 3);
	const gz = cycles.map((c) => c.getName());
	const me = eight.getDay().getHeavenStem();
	const star = (g: HeavenStem) => me.getTenStar(g).getName();

	const pillars = cycles.map((c, k): Pillar => {
		const g = c.getHeavenStem();
		const z = c.getEarthBranch();
		return {
			ganZhi: c.getName(),
			gan: g.getName(),
			zhi: z.getName(),
			ganWuXing: g.getElement().getName(),
			zhiWuXing: z.getElement().getName(),
			shiShen: k === 2 ? null : star(g),
			cangGan: z.getHideHeavenStems().map((h) => ({ gan: h.getName(), shiShen: star(h.getHeavenStem()) })),
			xingYun: me.getTerrain(z).getName(),
			ziZuo: g.getTerrain(z).getName(),
			naYin: c.getSound().getName(),
			kongWang: kong(c),
			shenSha: shenSha(gz, k),
		};
	});

	const wuXing = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
	for (const c of cycles) {
		wuXing[c.getHeavenStem().getElement().getName() as keyof typeof wuXing]++;
		wuXing[c.getEarthBranch().getElement().getName() as keyof typeof wuXing]++;
	}

	// tyme4ts 的起运算法是全局静态设置，只在这几次构造里换掉，用完还原，免得影响别的调用
	const sex = birth.gender === "男" ? TymeGender.MAN : TymeGender.WOMAN;
	const saved = ChildLimit.provider;
	ChildLimit.provider = new PROVIDERS[options.qiYun ?? "sect2"]();
	let limit: ChildLimit;
	let range: [ChildLimit, ChildLimit] | undefined;
	try {
		limit = ChildLimit.fromSolarTime(beijing, sex);
		if (!known) range = [ChildLimit.fromSolarTime(beijingOf(at(0, 0)), sex), ChildLimit.fromSolarTime(beijingOf(at(23, 59)), sex)];
	} finally {
		ChildLimit.provider = saved;
	}
	const span = (l: ChildLimit): Span => ({ years: l.getYearCount(), months: l.getMonthCount(), days: l.getDayCount() });

	// 时辰不详、当天交节：这一天出生的年柱、月柱要看时刻（立春那天连大运顺逆都会变），盘按中午排，界面写明
	let jie: Bazi["jie"];
	if (!known) {
		const [early, late] = [beijingOf(at(0, 0)), beijingOf(at(23, 59))];
		if (early.getSixtyCycleHour().getMonth().getName() !== late.getSixtyCycleHour().getMonth().getName()) {
			const term = late.getTerm();
			jie = { name: term.getName(), time: fmt(term.getJulianDay().getSolarTime()) };
		}
	}

	// 岁数照 tyme4ts：出生那个公历年算 1 岁，交运那年是起运岁数，与易安居的大运岁数一致。
	// 元亨利贞的大运岁数是交运年减出生的干支年（立春前出生算上一年），多数比这里少一岁，见 compare.md。
	// 出生年取当地的：tyme4ts 的 DecadeFortune.getStartAge() 按传进去的北京时间算，海外 12 月 31 日晚上（北京已是次年）
	// 出生的会比同一年的流年少一岁，所以大运岁数在这里按当地出生年自己算
	const born = clock.getYear();
	const branchStar = (c: SixtyCycle) => star(c.getEarthBranch().getHideHeavenStemMain());
	const daYun = Array.from({ length: 10 }, (_, i): DaYun => {
		const d = limit.getStartDecadeFortune().next(i);
		const c = d.getSixtyCycle();
		const startYear = d.getStartSixtyCycleYear().getYear();
		return {
			ganZhi: c.getName(),
			shiShen: star(c.getHeavenStem()),
			zhiShiShen: branchStar(c),
			startAge: startYear - born + 1,
			endAge: startYear - born + 10,
			startYear,
			endYear: startYear + 9,
			liuNian: Array.from({ length: 10 }, (_, k): LiuNian => {
				const y = startYear + k;
				const n = SixtyCycleYear.fromYear(y).getSixtyCycle();
				return { year: y, age: y - born + 1, ganZhi: n.getName(), shiShen: star(n.getHeavenStem()), zhiShiShen: branchStar(n) };
			}),
		};
	});

	// 农历按当地的日子（农历输入原样换回），不跟真太阳时、晚子时变
	const lunarDay = SolarDay.fromYmd(clock.getYear(), clock.getMonth(), clock.getDay()).getLunarDay();
	const lunarMonth = lunarDay.getLunarMonth();
	const lunarYear = lunarMonth.getLunarYear().getSixtyCycle().getName();
	// 十一月、十二月写冬月、腊月，与黄历同（M17-15）
	const monthName = lunarMonth.getName().replace("十一月", "冬月").replace("十二月", "腊月");

	return {
		gender: birth.gender,
		solar: known ? fmt(clock) : fmt(clock).slice(0, 10),
		...(offset !== 480 && known && { beijing: fmt(beijing) }),
		...(zhenTaiYang && { zhenTaiYang }),
		lunar: `${lunarYear}年${monthName}${lunarDay.getName()}`,
		// 春节与立春之间出生，农历年与年柱不是同一个干支：界面写一行说明（以立春换年）
		...(lunarYear !== gz[0] && { liChun: fmt(SolarTerm.fromName(beijing.getYear(), "立春").getJulianDay().getSolarTime()) }),
		shengXiao: eight.getYear().getEarthBranch().getZodiac().getName(),
		pillars,
		taiYuan: naYin(eight.getFetalOrigin()),
		...(known && { mingGong: naYin(eight.getOwnSign()), shenGong: naYin(eight.getBodySign()) }),
		wuXing,
		guanXi: guanXi(gz),
		qiYun: {
			...span(limit),
			hours: limit.getHourCount(),
			at: fmt(limit.getEndTime()),
			forward: limit.isForward(),
			...(range && {
				range: range.map((l) => ({ ...span(l), startYear: l.getStartDecadeFortune().getStartSixtyCycleYear().getYear() })) as [
					Span & { startYear: number },
					Span & { startYear: number },
				],
			}),
		},
		...(jie && { jie }),
		daYun,
	};
}
