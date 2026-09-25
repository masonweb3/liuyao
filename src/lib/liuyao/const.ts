// Copied from TaoracleHQ/najia @108d13a (MIT)
//   Copyright (c) 2026 Taoracle
//   Copyright (c) 2019 najia (bopo)
// License text and list of local changes: see NOTICE.
/**
 * Constant tables, ported from `najia/const.py`.
 *
 * Only the tables the computation actually reads are ported. The Python module
 * also carries presentation-layer tables (`SYMBOL`, `NUMCN`, `MONS`, `DAYS`,
 * `WEEK`, `SHXS`) used by its jinja2 renderer, plus three tables no code path
 * reads (`SHENX`, `JIEQI`, `GONG8`, `CHONG`). They are deliberately omitted —
 * see README for why rendering is out of scope. `CHONG` in particular is dead:
 * `attack()` hardcodes the two 六冲 trigram codes instead of consulting it.
 */

/** 六神 */
export const SHEN6 = ["青龙", "朱雀", "勾陈", "螣蛇", "白虎", "玄武"] as const;

/** 六亲 */
export const QING6 = ["兄弟", "父母", "官鬼", "妻财", "子孙"] as const;

/** 五行 */
export const XING5 = ["木", "火", "土", "金", "水"] as const;

/**
 * 纳甲 —— per 卦宫, the [内卦, 外卦] 干支 assignment.
 *
 * Each entry is a 天干 followed by three 地支, e.g. 乾金甲子外壬午 →
 * 内 甲子寅辰 / 外 壬午申戌.
 */
export const NAJIA = [
	["甲子寅辰", "壬午申戌"], // 乾金甲子外壬午
	["丁巳卯丑", "丁亥酉未"], // 兑金丁巳外丁亥
	["己卯丑亥", "己酉未巳"], // 离火己卯外己酉
	["庚子寅辰", "庚午申戌"], // 震木庚子外庚午
	["辛丑亥酉", "辛未巳卯"], // 巽木辛丑外辛未
	["戊寅辰午", "戊申戌子"], // 坎水戊寅外戊申
	["丙辰午申", "丙戌子寅"], // 艮土丙辰外丙戌
	["乙未巳卯", "癸丑亥酉"], // 坤土乙未外癸丑
] as const;

/**
 * 六十四卦. Keys are six-bit codes read 初爻 first: index 0 is 初爻, index 5 is
 * 上爻. `1` is 阳, `0` is 阴.
 */
export const GUA64: Record<string, string> = {
	"111111": "乾为天",
	"011111": "天风姤",
	"001111": "天山遁",
	"000111": "天地否",
	"000011": "风地观",
	"000001": "山地剥",
	"000101": "火地晋",
	"111101": "火天大有",
	"110110": "兑为泽",
	"010110": "泽水困",
	"000110": "泽地萃",
	"001110": "泽山咸",
	"001010": "水山蹇",
	"001000": "地山谦",
	"001100": "雷山小过",
	"110100": "雷泽归妹",
	"101101": "离为火",
	"001101": "火山旅",
	"011101": "火风鼎",
	"010101": "火水未济",
	"010001": "山水蒙",
	"010011": "风水涣",
	"010111": "天水讼",
	"101111": "天火同人",
	"100100": "震为雷",
	"000100": "雷地豫",
	"010100": "雷水解",
	"011100": "雷风恒",
	"011000": "地风升",
	"011010": "水风井",
	"011110": "泽风大过",
	"100110": "泽雷随",
	"011011": "巽为风",
	"111011": "风天小畜",
	"101011": "风火家人",
	"100011": "风雷益",
	"100111": "天雷无妄",
	"100101": "火雷噬嗑",
	"100001": "山雷颐",
	"011001": "山风蛊",
	"010010": "坎为水",
	"110010": "水泽节",
	"100010": "水雷屯",
	"101010": "水火既济",
	"101110": "泽火革",
	"101100": "雷火丰",
	"101000": "地火明夷",
	"010000": "地水师",
	"001001": "艮为山",
	"101001": "山火贲",
	"111001": "山天大畜",
	"110001": "山泽损",
	"110101": "火泽睽",
	"110111": "天泽履",
	"110011": "风泽中孚",
	"001011": "风山渐",
	"000000": "坤为地",
	"100000": "地雷复",
	"110000": "地泽临",
	"111000": "地天泰",
	"111100": "雷天大壮",
	"111110": "泽天夬",
	"111010": "水天需",
	"000010": "水地比",
};

/** 八卦名, indexed by 卦宫. */
export const GUAS = ["乾", "兑", "离", "震", "巽", "坎", "艮", "坤"] as const;

/** 卦五行, as indices into {@link XING5}. */
export const GUA5 = [3, 3, 1, 0, 0, 4, 2, 2] as const;

/** 三爻卦码, ordered so the index is the 卦宫 number. */
export const YAOS = [
	"111",
	"110",
	"101",
	"100",
	"011",
	"010",
	"001",
	"000",
] as const;

/** 天干 */
export const GANS = [
	"甲",
	"乙",
	"丙",
	"丁",
	"戊",
	"己",
	"庚",
	"辛",
	"壬",
	"癸",
] as const;

/** 地支 */
export const ZHIS = [
	"子",
	"丑",
	"寅",
	"卯",
	"辰",
	"巳",
	"午",
	"未",
	"申",
	"酉",
	"戌",
	"亥",
] as const;

/** 地支五行, as indices into {@link XING5}. */
export const ZHI5 = [4, 2, 0, 0, 2, 1, 1, 2, 3, 3, 2, 4] as const;

/** 旬空 */
export const KONG = ["子丑", "寅卯", "辰巳", "午未", "申酉", "戌亥"] as const;

/** 六合卦 —— matched as a substring of the 卦名. */
export const LIUHE = ["否", "困", "旅", "豫", "节", "贲", "复", "泰"] as const;

export type Shen6 = (typeof SHEN6)[number];
export type Qing6 = (typeof QING6)[number];
export type Xing5 = (typeof XING5)[number];
export type Gua = (typeof GUAS)[number];
export type Gan = (typeof GANS)[number];
export type Zhi = (typeof ZHIS)[number];
export type Kong = (typeof KONG)[number];
