// Copied from TaoracleHQ/najia @108d13a (MIT)
//   Copyright (c) 2026 Taoracle
//   Copyright (c) 2019 najia (bopo)
// License text and list of local changes: see NOTICE.
/**
 * 起卦 —— the main casting flow, ported from `najia/najia.py`.
 *
 * The Python original returns a mutable `self.data` dict and also owns a jinja2
 * renderer. This port returns a plain immutable result and leaves formatting to
 * the caller.
 */
import { type Ganzhi, type GanzhiOptions, ganzhiFromDate } from "./calendar.js";
import {
	GUA64,
	GUAS,
	type Gua,
	type Qing6,
	type Shen6,
	YAOS,
} from "./const.js";
import {
	getGod6,
	getNajia,
	getQin6,
	getType,
	gongXing,
	gz5x,
	palace,
	type ShiYao,
	setShiYao,
	soul,
	yaoXing,
} from "./utils.js";

/**
 * 爻 as the sum of three coins, 背 = 3 and 字 = 2: 6 老阴 (动), 7 少阳,
 * 8 少阴, 9 老阳 (动). Six of them, 初爻 first.
 *
 * Upstream codes these 1 单 / 2 拆 / 3 重 / 4 交. The coin sums are used here
 * so the UI, manual entry and stored history all share one representation.
 */
export type Yao = 6 | 7 | 8 | 9;
export type Params = readonly number[] | string;

/** One coin: 3 背 or 2 字. */
export type Coin = 2 | 3;

/** Throw three coins for one 爻. */
export function toss(): { coins: [Coin, Coin, Coin]; yao: Yao } {
	const bits = crypto.getRandomValues(new Uint8Array(3));
	const coins = [...bits].map((b) => (b & 1 ? 3 : 2)) as [Coin, Coin, Coin];
	return { coins, yao: (coins[0] + coins[1] + coins[2]) as Yao };
}

/**
 * Normalise 爻 input to exactly six {@link Yao} values.
 *
 * The Python original accepts a string but then compares its characters against
 * integers (`if 3 in params`), so string input silently produces no 变卦 and no
 * 动爻. Normalising once up front removes that trap.
 */
export function normaliseParams(params: Params): Yao[] {
	const raw = typeof params === "string" ? [...params] : params;
	if (raw.length !== 6) {
		throw new Error(`卦 needs exactly 6 爻, got ${raw.length}`);
	}
	return raw.map((value, i) => {
		const n = typeof value === "number" ? value : Number.parseInt(value, 10);
		if (n !== 6 && n !== 7 && n !== 8 && n !== 9) {
			throw new Error(`爻 ${i + 1} must be 6 / 7 / 8 / 9, got ${String(value)}`);
		}
		return n;
	});
}

/** 卦码 from cast outcomes —— parity gives 阴阳. */
function markOf(params: readonly Yao[]): string {
	return params.map((p) => String(p % 2)).join("");
}

export interface Hexagram {
	/** 卦名 */
	name: string;
	/** 六位卦码, 初爻 first */
	mark: string;
	/** 卦宫 */
	gong: Gua;
	/** 六亲 per 爻 */
	qin6: Qing6[];
	/** 干支五行 per 爻, e.g. `己卯木` */
	qinx: string[];
}

export interface Hidden extends Hexagram {
	/** Positions in the 本宫卦 holding the 六亲 the cast 卦 lacks, ascending. */
	seat: number[];
}

export interface CastResult {
	/** Cast outcomes, normalised */
	params: Yao[];
	/** 本卦 */
	gua: Hexagram;
	/** 世应爻 */
	shiy: ShiYao;
	/** 卦型 —— 游魂 / 归魂 / 六冲 / 六合, or `""` */
	type: string;
	/** 游魂 / 归魂, or `""` */
	soul: "游魂" | "归魂" | "";
	/** 六神, 初爻 first, rotated by the day's 天干 */
	god6: Shen6[];
	/** Zero-based positions of 动爻 */
	dong: number[];
	/** 变卦, or `null` when nothing moves */
	bian: Hexagram | null;
	/** 伏神, or `null` when all five 六亲 are present */
	hide: Hidden | null;
	/** 干支 for the moment of casting */
	ganzhi: Ganzhi;
}

/** 六亲 and 干支五行 for a 卦码 read against a 卦宫. */
function relations(
	mark: string,
	gong: number,
): Pick<Hexagram, "qin6" | "qinx"> {
	const najia = getNajia(mark);
	const xing = gongXing(gong);
	return {
		qin6: najia.map((gz) => getQin6(xing, yaoXing(gz))),
		qinx: najia.map((gz) => gz5x(gz)),
	};
}

/**
 * @param gong 卦宫 reported for this 卦
 * @param relationGong 卦宫 the 六亲 are read against. Differs from `gong` for
 *   变卦: its 六亲 stay anchored to the 本卦's 卦宫 (体用不变) while the 卦宫 it
 *   reports is its own. Upstream does the same, just implicitly.
 */
function hexagram(
	mark: string,
	gong: number,
	relationGong: number = gong,
): Hexagram {
	const name = GUA64[mark];
	if (name === undefined) throw new Error(`unknown 卦码 "${mark}"`);
	return {
		name,
		mark,
		gong: GUAS[gong] as Gua,
		...relations(mark, relationGong),
	};
}

/**
 * 伏神 —— the 本宫卦 stands in for whichever 六亲 the cast 卦 is missing.
 *
 * Deviation from the Python reference: upstream derives `seat` by iterating a
 * `set` difference, so the order varies between interpreter runs (string hashing
 * is seeded per process). This returns ascending positions instead — the same
 * set, deterministically ordered.
 */
export function hidden(gong: number, qin6: readonly Qing6[]): Hidden | null {
	if (new Set(qin6).size >= 5) return null;

	// YAOS is indexed by 卦宫, so the 本宫卦 is its trigram doubled.
	const trigram = YAOS[gong];
	if (trigram === undefined) throw new Error(`unknown 卦宫 ${gong}`);
	const base = hexagram(`${trigram}${trigram}`, gong);

	const present = new Set(qin6);
	const seat = base.qin6
		.map((qin, position) => ({ qin, position }))
		.filter(({ qin }) => !present.has(qin))
		// Keep only the first position per missing 六亲, matching upstream's
		// `qin6.index(x)`, then order ascending.
		.filter(
			({ qin }, i, all) => all.findIndex((other) => other.qin === qin) === i,
		)
		.map(({ position }) => position)
		.sort((a, b) => a - b);

	return { ...base, seat };
}

/**
 * 变卦 —— 动爻 flip, or `null` when nothing moves.
 *
 * @param gong the 本卦's 卦宫; the 变卦's 六亲 are read against it, not against
 *   the 变卦's own 卦宫.
 */
export function transform(
	params: readonly Yao[],
	gong: number,
): Hexagram | null {
	if (!params.some((p) => p === 6 || p === 9)) return null;
	// 9 老阳 becomes 阴; 6 老阴 becomes 阳.
	const mark = params.map((p) => (p === 7 || p === 6 ? "1" : "0")).join("");
	return hexagram(mark, palace(mark, setShiYao(mark).shi), gong);
}

export interface CastOptions extends GanzhiOptions {
	/** Defaults to now. Always read as UTC+8, see {@link ganzhiFromDate}. */
	date?: Date;
}

/** 起卦 —— the full reading for a set of cast outcomes. */
export function cast(params: Params, options: CastOptions = {}): CastResult {
	const yao = normaliseParams(params);
	const mark = markOf(yao);

	const shiy = setShiYao(mark);
	const gong = palace(mark, shiy.shi);
	const gua = hexagram(mark, gong);

	const ganzhi = ganzhiFromDate(
		options.date ?? new Date(),
		options.lateZi === undefined ? {} : { lateZi: options.lateZi },
	);

	return {
		params: yao,
		gua,
		shiy,
		type: getType(mark),
		soul: soul(mark),
		god6: getGod6(ganzhi.day),
		dong: yao.flatMap((p, i) => (p === 6 || p === 9 ? [i] : [])),
		bian: transform(yao, gong),
		hide: hidden(gong, gua.qin6),
		ganzhi,
	};
}
