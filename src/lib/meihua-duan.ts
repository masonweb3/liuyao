/**
 * 梅花的吉凶（M21-5 A）：按体用生克，完全由代码判，Jev 不参与（同 AGENTS.md §4.6）。
 *
 * 零依赖，只看本卦六爻：首页往卦列表（按需加载的 view.ts）给梅花条目盖印要用它，
 * 不能因此把引擎和 tyme4ts 牵进 view 包；梅花页的 Worker 也用它，两处的印永远一致。
 *
 * 三层（原书卷二「体用总诀」，试算见 docs/review-m21/engine.md M21-5）：
 * 1. 用卦定基调：用卦生体、比和、体克用为吉，体生用为平，克体为凶。
 * 2. 变卦定结局：用吉而变凶、用凶而变吉，都为平；用平随变卦；其余照用卦。
 * 3. 用卦、互卦下上两经卦、变卦四处里克体的有两处以上，又没有一处生体，判凶（原书「克体之卦多」）。
 * 原书 10 个有结局的卦例对上 6 例；余下 4 例原书兼看爻辞、卦名、外应，或明说「不拘体用」，代码不追。
 * 不看卦气旺衰。
 */

/** 某一经卦对体卦：比和、生体、克体、体生（泄）、体克（耗）。 */
export type Rel = "比和" | "生体" | "克体" | "体生" | "体克";
export type Verdict = "吉" | "平" | "凶";

export interface Trigram {
	/** 乾 兑 离 震 巽 坎 艮 坤 */
	name: string;
	element: string;
}

export interface TiYong {
	ti: Trigram;
	yong: Trigram;
	/** 互卦下、上两经卦 */
	hu: [Trigram, Trigram];
	/** 变卦里由用卦变成的那一经卦 */
	bian: Trigram;
	rel: { yong: Rel; hu: [Rel, Rel]; bian: Rel };
}

// 先天数的次序（乾一兑二……坤八）：三爻初爻在前，同 const.ts 的 YAOS、GUA5。
const BITS = ["111", "110", "101", "100", "011", "010", "001", "000"];
const NAMES = "乾兑离震巽坎艮坤";
const ELEMENTS = "金金火木木水土土";
/** 相生的次序，隔一位相克 */
const CYCLE = "木火土金水";

const trigram = (bits: string): Trigram => {
	const i = BITS.indexOf(bits);
	return { name: NAMES[i] as string, element: ELEMENTS[i] as string };
};

const relOf = (ti: Trigram, other: Trigram) =>
	(["比和", "体生", "体克", "克体", "生体"] as const)[
		(CYCLE.indexOf(other.element) - CYCLE.indexOf(ti.element) + 5) % 5
	] as Rel;

/** 本卦六爻（初爻在前，铜钱和 6–9）→ 体用与生克。梅花只有一个动爻；不是恰好一爻动就 null。 */
export function tiYong(params: readonly number[]): TiYong | null {
	const moving = params.flatMap((y, i) => (y === 6 || y === 9 ? [i] : []));
	if (params.length !== 6 || moving.length !== 1) return null;
	const d = moving[0] as number;
	const mark = params.map((y) => y % 2).join("");
	const changed = [...mark].map((b, i) => (i === d ? String(1 - Number(b)) : b)).join("");
	// 卷一：「乾坤无互，互其变卦。」
	const h = mark === "111111" || mark === "000000" ? changed : mark;
	const hu = h.slice(1, 4) + h.slice(2, 5);
	const inner = d < 3;
	const ti = trigram(inner ? mark.slice(3) : mark.slice(0, 3));
	const yong = trigram(inner ? mark.slice(0, 3) : mark.slice(3));
	const bian = trigram(inner ? changed.slice(0, 3) : changed.slice(3));
	const huT: [Trigram, Trigram] = [trigram(hu.slice(0, 3)), trigram(hu.slice(3))];
	return {
		ti,
		yong,
		hu: huT,
		bian,
		rel: { yong: relOf(ti, yong), hu: [relOf(ti, huT[0]), relOf(ti, huT[1])], bian: relOf(ti, bian) },
	};
}

const BASE: Record<Rel, Verdict> = { 生体: "吉", 比和: "吉", 体克: "吉", 体生: "平", 克体: "凶" };

export function duan(rel: TiYong["rel"]): Verdict {
	const all = [rel.yong, ...rel.hu, rel.bian];
	if (all.filter((r) => r === "克体").length >= 2 && !all.includes("生体")) return "凶";
	const y = BASE[rel.yong];
	const b = BASE[rel.bian];
	if (y === "平") return b;
	return b !== "平" && b !== y ? "平" : y;
}
