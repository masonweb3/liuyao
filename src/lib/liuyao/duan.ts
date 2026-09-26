/**
 * 断卦 —— 取用神, 旺衰, 动变, then a flat score -> 吉 / 平 / 凶.
 *
 * Rules follow 《增删卜易》. Where 野鹤 names an exemption (月破 of a 动爻 is not
 * 真破; 动/旺 不为空; 空破之退神待填实而退) it is implemented, because those
 * exemptions are what his own cases turn on. 应期、三合、墓绝、神煞 are out of
 * MVP scope, see docs/research.md §3.1.
 */
import { type Qing6, XING5, ZHI5, ZHIS } from "./const.js";
import type { CastResult } from "./najia.js";
import { getQin6 } from "./utils.js";

export type Topic = "财" | "事业" | "父母" | "子孙" | "兄弟" | "婚恋" | "自身";
export type Gender = "男" | "女";
export type Question =
	| { topic: "婚恋"; gender: Gender }
	| { topic: Exclude<Topic, "婚恋"> };
export type Verdict = "吉" | "平" | "凶";

export interface Duan {
	verdict: Verdict;
	reasons: string[];
	score: number;
	/** 用神; `fu` when it is the 伏神 hidden under `pos` (0 = 初爻). */
	yongShen: { qin: Qing6; pos: number; fu: boolean };
}

export interface Effect {
	score: number;
	reasons: string[];
}

// 初始值，待用真实卦例评估。
// ponytail: flat additive score; weight rules individually if cases disagree.
const JI = 2;
const XIONG = -2;

const POS = ["初爻", "二爻", "三爻", "四爻", "五爻", "上爻"];

const YONG: Record<Exclude<Topic, "婚恋" | "自身">, Qing6> = {
	财: "妻财",
	事业: "官鬼",
	父母: "父母",
	子孙: "子孙",
	兄弟: "兄弟",
};

/** 进神: each 地支 steps to the next of its own 五行. 退神 is the reverse. */
const JIN: Record<string, string> = {
	亥: "子",
	寅: "卯",
	巳: "午",
	申: "酉",
	丑: "辰",
	辰: "未",
	未: "戌",
	戌: "丑",
};

const xingOf = (zhi: string): string =>
	XING5[ZHI5[ZHIS.indexOf(zhi as (typeof ZHIS)[number])] as number] as string;

/**
 * What `other` does to `zhi`: 生 / 扶 (same 五行) / 克 / 泄 (zhi 生 other) /
 * 耗 (zhi 克 other). Read off 六亲, which already encodes the five relations.
 */
function rel(zhi: string, other: string): "生" | "扶" | "克" | "泄" | "耗" {
	const REL = { 父母: "生", 兄弟: "扶", 官鬼: "克", 子孙: "泄", 妻财: "耗" } as const;
	return REL[getQin6(xingOf(zhi), xingOf(other))];
}

const chong = (a: string, b: string): boolean =>
	Math.abs(ZHIS.indexOf(a as (typeof ZHIS)[number]) - ZHIS.indexOf(b as (typeof ZHIS)[number])) === 6;

const name = (zhi: string) => zhi + xingOf(zhi);

/**
 * 旺衰 —— 月建 and 日辰 acting on one 爻.
 *
 * @param helped a non-restrained 动爻 生 this 爻; with 动 or 日辰生扶 it keeps
 *   月破 from being 真破 (「惟静而不动，又无日辰动爻生助，实则到底而破矣」).
 */
export function wangShuai(
	zhi: string,
	yue: string,
	ri: string,
	dong: boolean,
	helped = false,
): Effect {
	const n = name(zhi);
	const po = chong(yue, zhi);

	let m = 0;
	let mReason = "";
	if (yue === zhi) [m, mReason] = [2, `${n}临月建，旺`];
	else if (!po) {
		const r = rel(zhi, yue);
		if (r === "扶") [m, mReason] = [1, `${n}得${yue}月扶，旺`];
		else if (r === "生") [m, mReason] = [1, `${yue}月生${n}，相`];
		else if (r === "克") [m, mReason] = [-1, `${yue}月克${n}，衰`];
		else if (r === "泄") mReason = `${n}休于${yue}月`;
		else mReason = `${n}囚于${yue}月`;
	}

	let d = 0;
	let dReason = "";
	if (ri === zhi) [d, dReason] = [2, `${n}临日辰，旺`];
	else if (chong(ri, zhi)) {
		// 静爻逢日冲: 旺则暗动，衰则日破. 动爻逢日冲: 衰则冲散.
		if (!dong)
			[d, dReason] = m > 0 ? [1, `${ri}日冲${n}，旺而暗动`] : [-1, `${ri}日冲${n}，衰而日破`];
		else
			[d, dReason] = m > 0 ? [0, `${ri}日冲${n}，旺而不散`] : [-1, `${ri}日冲动爻${n}，冲散`];
	} else {
		const r = rel(zhi, ri);
		if (r === "扶") [d, dReason] = [1, `${ri}日扶${n}`];
		else if (r === "生") [d, dReason] = [1, `${ri}日生${n}`];
		else if (r === "克") [d, dReason] = [-1, `${ri}日克${n}`];
	}

	if (po) {
		const why = dong ? "爻动" : d > 0 ? "得日辰生扶" : helped ? "得动爻相生" : "";
		[m, mReason] = why
			? [-1, `${yue}月冲${n}，月破；然${why}，非真破`]
			: [-2, `${yue}月冲${n}，月破，静而无援，为真破`];
	}

	return { score: m + d, reasons: [mReason, dReason].filter(Boolean) };
}

/** 旬空 —— 动不为空，旺不为空，冲空则实; only a 静而衰 爻 is truly 空. */
export function xunKong(
	zhi: string,
	kong: string,
	ri: string,
	dong: boolean,
	wang: boolean,
): Effect {
	if (!kong.includes(zhi)) return { score: 0, reasons: [] };
	const n = name(zhi);
	if (dong) return { score: 0, reasons: [`${n}旬空，动不为空`] };
	if (wang) return { score: 0, reasons: [`${n}旬空，旺不为空`] };
	if (chong(ri, zhi)) return { score: 0, reasons: [`${n}旬空，逢日冲，冲空则实`] };
	return { score: -1, reasons: [`${n}旬空，静而无气`] };
}

/** 化变 —— how a 动爻 relates to the 爻 it turns into, or `""` for none of these. */
export function hua(zhi: string, bian: string): "化进神" | "化退神" | "回头生" | "回头克" | "" {
	const r = rel(zhi, bian);
	if (r === "扶" && JIN[zhi] === bian) return "化进神";
	if (r === "扶" && JIN[bian] === zhi) return "化退神";
	if (r === "生") return "回头生";
	if (r === "克") return "回头克";
	return "";
}

/**
 * 动爻化变 —— the 用神 moving into `bian`: 回头生克, 进神退神, 化空, 化破.
 *
 * 退神 retreats at once only 休囚化休囚; if either side is 旺 it waits, and if
 * either side is 空破 it waits for 填实 (进神退神章).
 */
export function huaBian(
	zhi: string,
	bian: string,
	yue: string,
	ri: string,
	kong: string,
	wang: boolean,
): Effect {
	const out: Effect = { score: 0, reasons: [] };
	const add = (score: number, reason: string) => {
		out.score += score;
		out.reasons.push(reason);
	};
	const label = `${name(zhi)}化${name(bian)}`;
	const bKong = kong.includes(bian);
	const bPo = chong(yue, bian);
	const h = hua(zhi, bian);

	if (h === "化进神") add(1, `${label}，化进神`);
	else if (h === "化退神") {
		if (kong.includes(zhi) || chong(yue, zhi) || bKong || bPo)
			add(0, `${label}，化退神；逢空破，待填实而退`);
		else if (wang || wangShuai(bian, yue, ri, false).score > 0)
			add(0, `${label}，化退神；旺而暂不退`);
		else add(-1, `${label}，化退神`);
	} else if (h === "回头生") add(2, `${label}，回头生`);
	else if (h === "回头克") add(-2, `${label}，回头克`);

	if (bKong) add(-1, `变爻${name(bian)}旬空，化空`);
	if (bPo) add(-1, `变爻${name(bian)}逢${yue}月冲，化破`);
	return out;
}

/** Why a moving 原神 / 忌神 has no force on the 用神, if it has none. */
function restrained(zhi: string, bian: string, yue: string, kong: string): string {
	const h = hua(zhi, bian);
	if (h === "回头克") return "受回头克";
	if (h === "化退神") return h;
	if (kong.includes(bian)) return "化空";
	if (chong(yue, bian)) return "化破";
	return "";
}

/** 断卦 for a cast and a question. */
export function duan(r: CastResult, q: Question): Duan {
	const yue = r.ganzhi.month[1] as string;
	const ri = r.ganzhi.day[1] as string;
	const kong = r.ganzhi.xkong;
	const shi = r.shiy.shi - 1;
	const ying = r.shiy.ying - 1;
	const zhiAt = (i: number) => (r.gua.qinx[i] as string)[1] as string;
	const bianAt = (i: number) => (r.bian?.qinx[i] as string)[1] as string;
	const moving = (i: number) => r.dong.includes(i);

	let score = 0;
	const reasons: string[] = [];
	const add = (e: Effect) => {
		score += e.score;
		reasons.push(...e.reasons);
	};
	const say = (s: number, reason: string) => add({ score: s, reasons: [reason] });

	// 取用神 (yongShen)
	let qin: Qing6;
	let pos: number;
	let fu = false;
	if (q.topic === "自身") {
		pos = shi;
		qin = r.gua.qin6[shi] as Qing6;
	} else {
		qin = q.topic === "婚恋" ? (q.gender === "男" ? "妻财" : "官鬼") : YONG[q.topic];
		const found = r.gua.qin6.flatMap((x, i) => (x === qin ? [i] : []));
		if (found.length > 0) {
			// ponytail: 两现 取动，次取持世、临应，再取旺者，再取下爻。
			const key = (i: number) => [
				+moving(i),
				+(i === shi),
				+(i === ying),
				wangShuai(zhiAt(i), yue, ri, moving(i)).score,
			];
			const better = (a: number[], b: number[]) => {
				const k = a.findIndex((v, j) => v !== b[j]);
				return k >= 0 && (a[k] as number) > (b[k] as number);
			};
			pos = found.reduce((best, i) => (better(key(i), key(best)) ? i : best));
			if (found.length > 1)
				reasons.push(`用神${qin}两现（${found.map((i) => POS[i]).join("、")}），取${POS[pos]}`);
		} else {
			fu = true;
			const seat = r.hide?.seat.find((p) => r.hide?.qin6[p] === qin);
			if (seat === undefined) throw new Error(`no 伏神 for ${qin}`);
			pos = seat;
		}
	}

	const zhi = fu ? ((r.hide?.qinx[pos] as string)[1] as string) : zhiAt(pos);
	const dong = !fu && moving(pos);
	const n = name(zhi);
	if (fu) reasons.push(`用神${qin}不上卦，${n}伏于${POS[pos]}${name(zhiAt(pos))}之下`);
	else
		reasons.push(
			`${q.topic === "自身" ? "以世爻为用神：" : "用神"}${qin}${n}，${POS[pos]}${dong ? "发动" : "安静"}`,
		);

	// 原神 (yuanShen) 生用神, 忌神 (jiShen) 克用神 —— only 动爻 act, and only
	// through their 本爻; a 变爻 acts on nothing but its own 动爻.
	const others = r.dong.filter((i) => i !== pos);
	const yuan = others.filter((i) => rel(zhi, zhiAt(i)) === "生");
	const ji = others.filter((i) => rel(zhi, zhiAt(i)) === "克");
	const why = (i: number) => restrained(zhiAt(i), bianAt(i), yue, kong);
	const helped = yuan.some((i) => !why(i));

	const ws = wangShuai(zhi, yue, ri, dong, helped);
	add(ws);
	const wang = ws.score > 0;
	add(xunKong(zhi, kong, ri, dong, wang));
	if (dong) add(huaBian(zhi, bianAt(pos), yue, ri, kong, wang));

	for (const i of yuan) {
		const label = `原神${r.gua.qin6[i]}${name(zhiAt(i))}发动`;
		if (why(i)) say(0, `${label}，然${why(i)}，生之无力`);
		else say(1, `${label}，生用神`);
	}
	for (const i of ji) {
		const label = `忌神${r.gua.qin6[i]}${name(zhiAt(i))}发动`;
		if (why(i)) say(0, `${label}，然${why(i)}，不能克用`);
		// 忌神生原神，原神生用神: 贪生忘克.
		else if (helped) say(0, `${label}，然原神同动，连续相生`);
		else say(-1, `${label}，克用神`);
	}

	if (fu) {
		// 伏神 (fuShen) under its 飞神 (feiShen).
		const fei = zhiAt(pos);
		if (wang) say(0, "伏神旺相，可以得出");
		else if (kong.includes(fei)) say(0, `飞神${name(fei)}旬空，伏神得出`);
		else if (chong(yue, fei)) say(0, `飞神${name(fei)}月破，伏神得出`);
		else if (moving(pos)) say(0, `飞神${name(fei)}发动，伏神得出`);
		else say(-1, "伏神衰弱，伏而难出");
		const f = rel(zhi, fei);
		if (f === "生") say(1, `飞神${name(fei)}生伏`);
		else if (f === "克") say(-1, `飞神${name(fei)}克伏`);
	} else if (q.topic !== "自身") {
		// 持世 (chiShi): the matter sits with the asker.
		if (pos === shi) say(1, "用神持世");
		else if (dong && rel(zhiAt(shi), zhi) === "生") say(1, "用神发动生世");
	}

	return {
		verdict: score >= JI ? "吉" : score <= XIONG ? "凶" : "平",
		reasons,
		score,
		yongShen: { qin, pos, fu },
	};
}
