// Copied from TaoracleHQ/najia @108d13a (MIT)
//   Copyright (c) 2026 Taoracle
//   Copyright (c) 2019 najia (bopo)
// License text and list of local changes: see NOTICE.
/**
 * Deterministic 六爻 derivations, ported from `najia/utils.py`.
 *
 * Every function here is pure. Where the Python original accepted either a
 * string or a pair of indices, the port keeps that flexibility but types it
 * explicitly instead of relying on `type(x) == str` checks at runtime.
 */
import {
	GANS,
	GUA5,
	GUA64,
	LIUHE,
	NAJIA,
	QING6,
	type Qing6,
	SHEN6,
	type Shen6,
	XING5,
	type Xing5,
	YAOS,
	ZHI5,
	ZHIS,
} from "./const.js";

function required<T>(value: T | undefined, message: string): T {
	if (value === undefined) throw new Error(message);
	return value;
}

/** Index of a 天干, accepting the character or an already-resolved index. */
function ganIndex(gan: string | number): number {
	if (typeof gan === "number") return gan;
	const index = GANS.indexOf(gan as (typeof GANS)[number]);
	if (index < 0) throw new Error(`unknown 天干: ${gan}`);
	return index;
}

/** Index of a 地支, accepting the character or an already-resolved index. */
function zhiIndex(zhi: string | number): number {
	if (typeof zhi === "number") return zhi;
	const index = ZHIS.indexOf(zhi as (typeof ZHIS)[number]);
	if (index < 0) throw new Error(`unknown 地支: ${zhi}`);
	return index;
}

/** Split a 干支 pair such as `甲子` into its two components. */
function splitGanzhi(gz: string | readonly [number, number]): [number, number] {
	if (typeof gz !== "string") return [gz[0], gz[1]];
	const chars = [...gz];
	if (chars.length !== 2)
		throw new Error(`干支 must be two characters, got "${gz}"`);
	return [ganIndex(chars[0] as string), zhiIndex(chars[1] as string)];
}

/** 干支五行 —— append the 五行 of the 地支 to the 干支. `甲子` -> `甲子水`. */
export function gz5x(gz: string): string {
	const [, zhi] = splitGanzhi(gz);
	return gz + XING5[required(ZHI5[zhi], `no 五行 for 地支 index ${zhi}`)];
}

/**
 * 六神, rotated to start at the 六神 the day's 天干 opens with.
 *
 * 排六神口诀：甲乙起青龙 丙丁起朱雀 戊日起勾陈 己日起腾蛇 庚辛起白虎 壬癸起玄武
 */
export function getGod6(gz: string): Shen6[] {
	const [gan] = splitGanzhi(gz);
	let offset = Math.ceil((gan + 1) / 2) - 7;
	if (gan === 4) offset = -4;
	else if (gan === 5) offset = -3;
	else if (gan > 5) offset += 1;
	return [...SHEN6.slice(offset), ...SHEN6.slice(0, offset)];
}

/** 内卦 (初二三爻) of a six-bit 卦码. */
function inner(symbol: string): string {
	return symbol.slice(0, 3);
}

/** 外卦 (四五上爻) of a six-bit 卦码. */
function outer(symbol: string): string {
	return symbol.slice(3);
}

export interface ShiYao {
	/** 世爻, 1-6 counting from 初爻. */
	shi: number;
	/** 应爻 */
	ying: number;
}

/*
 * Deviation from the Python reference: `set_shi_yao` there returns a third
 * value, `index`, which upstream's own `compile()` never reads — it always
 * passes 世爻 to `palace()`. For the eight 游魂卦 the two disagree (火地晋
 * resolves to 乾宫 via 世爻 but 离宫 via `index`), so `index` is a trap of
 * exactly the invisible kind this port exists to avoid. It is dropped.
 */

/**
 * 世爻 / 应爻.
 *
 * 寻世诀：天同二世天变五，地同四世地变初。本宫六世三世异，人同游魂人变归。
 *
 * Within each trigram, position 0 is 地 (the lower 爻), 1 is 人, 2 is 天.
 */
export function setShiYao(symbol: string): ShiYao {
	const wai = outer(symbol);
	const nei = inner(symbol);
	const at = (shi: number): ShiYao => ({
		shi,
		ying: shi > 3 ? shi - 3 : shi + 3,
	});

	// 天同二世天变五
	if (wai[2] === nei[2]) {
		if (wai[1] !== nei[1] && wai[0] !== nei[0]) return at(2);
	} else if (wai[1] === nei[1] && wai[0] === nei[0]) {
		return at(5);
	}

	// 人同游魂人变归
	if (wai[1] === nei[1]) {
		if (wai[0] !== nei[0] && wai[2] !== nei[2]) return at(4);
	} else if (wai[0] === nei[0] && wai[2] === nei[2]) {
		return at(3);
	}

	// 地同四世地变初
	if (wai[0] === nei[0]) {
		if (wai[1] !== nei[1] && wai[2] !== nei[2]) return at(4);
	} else if (wai[1] === nei[1] && wai[2] === nei[2]) {
		return at(1);
	}

	// 本宫六世
	if (wai === nei) return at(6);

	// 三世异
	return at(3);
}

/** 游魂 / 归魂, or `""` when neither. */
export function soul(symbol: string): "游魂" | "归魂" | "" {
	const wai = outer(symbol);
	const nei = inner(symbol);
	if (wai[1] === nei[1]) {
		if (wai[0] !== nei[0] && wai[2] !== nei[2]) return "游魂";
		return "";
	}
	if (wai[0] === nei[0] && wai[2] === nei[2]) return "归魂";
	return "";
}

/**
 * 卦宫.
 *
 * 认宫诀：一二三六外卦宫，四五游魂内变更。若问归魂何所取，归魂内卦是本宫。
 *
 * @param symbol six-bit 卦码
 * @param shi 世爻 from {@link setShiYao}
 */
export function palace(symbol: string, shi: number): number {
	const wai = outer(symbol);
	const nei = inner(symbol);
	const hun = soul(symbol);

	// 归魂内卦是本宫
	if (hun === "归魂") {
		return required(indexOfTrigram(nei), `unknown 内卦 "${nei}"`);
	}

	// 一二三六外卦宫
	if (shi === 1 || shi === 2 || shi === 3 || shi === 6) {
		return required(indexOfTrigram(wai), `unknown 外卦 "${wai}"`);
	}

	// 四五游魂内变更 —— invert the 内卦
	const flipped = [...nei].map((bit) => (bit === "1" ? "0" : "1")).join("");
	return required(indexOfTrigram(flipped), `unknown 变卦 "${flipped}"`);
}

function indexOfTrigram(trigram: string): number | undefined {
	const index = YAOS.indexOf(trigram as (typeof YAOS)[number]);
	return index < 0 ? undefined : index;
}

/**
 * 六冲卦.
 *
 * True when 内卦 and 外卦 are identical, or when the pair is 乾/震 in either
 * order — that is 天雷无妄 and 雷天大壮.
 */
export function attack(symbol: string): boolean {
	const wai = outer(symbol);
	const nei = inner(symbol);
	if (wai === nei) return true;
	const SIX_CLASH = new Set(["100", "111"]);
	return SIX_CLASH.has(nei) && SIX_CLASH.has(wai);
}

/** 六合卦, matched by 卦名 substring. */
export function unite(symbol: string): "六合" | null {
	const name = GUA64[symbol];
	if (name === undefined) return null;
	return LIUHE.some((token) => name.includes(token)) ? "六合" : null;
}

/** 卦型 —— 游魂 / 归魂 take precedence, then 六冲, then 六合. */
export function getType(symbol: string): string {
	const hun = soul(symbol);
	if (hun) return hun;
	if (attack(symbol)) return "六冲";
	return unite(symbol) ?? "";
}

/** 纳甲配干支, 初爻 first. */
export function getNajia(symbol: string): string[] {
	const nei = required(
		indexOfTrigram(inner(symbol)),
		`unknown 内卦 in "${symbol}"`,
	);
	const wai = required(
		indexOfTrigram(outer(symbol)),
		`unknown 外卦 in "${symbol}"`,
	);

	const neiEntry = required(NAJIA[nei], `no 纳甲 for 卦宫 ${nei}`)[0];
	const waiEntry = required(NAJIA[wai], `no 纳甲 for 卦宫 ${wai}`)[1];

	const spread = (entry: string): string[] => {
		const gan = entry[0] as string;
		return [...entry.slice(1)].map((zhi) => `${gan}${zhi}`);
	};

	return [...spread(neiEntry), ...spread(waiEntry)];
}

/**
 * 六亲 from two 五行 —— the first is the 卦宫 五行, the second the 爻 五行.
 *
 * Accepts either the character or an index into {@link XING5}.
 */
export function getQin6(
	gongXing: Xing5 | string | number,
	yaoXing: Xing5 | string | number,
): Qing6 {
	const resolve = (value: Xing5 | string | number): number => {
		if (typeof value === "number") return value;
		const index = XING5.indexOf(value as Xing5);
		if (index < 0) throw new Error(`unknown 五行: ${value}`);
		return index;
	};
	const diff = resolve(gongXing) - resolve(yaoXing);
	return required(
		QING6[diff < 0 ? diff + 5 : diff],
		`no 六亲 for offset ${diff}`,
	);
}

/** 卦宫 五行 as a character. */
export function gongXing(gong: number): Xing5 {
	return required(
		XING5[required(GUA5[gong], `no 五行 for 卦宫 ${gong}`)],
		"bad 五行 index",
	);
}

/** 爻 五行 as a character, from a 干支 such as `己卯`. */
export function yaoXing(gz: string): Xing5 {
	const [, zhi] = splitGanzhi(gz);
	return required(
		XING5[required(ZHI5[zhi], `no 五行 for 地支 index ${zhi}`)],
		"bad 五行 index",
	);
}
