/**
 * 择日的事项与命中规则（M18）。零依赖：择日首页的脚本在浏览器里用它筛黄历的按月数据（/huangli/data/{年-月}.json），
 * 构建时 zeri.ts 用同一个函数筛 tyme4ts 的宜忌，两条路径由 zeri.test.ts 逐日核对。
 * 不 import 别的模块，理由同 huangli-days.ts：它再引谁，打包时谁就被拆成首页与择日页共用的分包，首页入口包跟着变。
 */

/**
 * 事项：slug 是网址（/zeri/banjia/2026-11/），上线后不改；words 是 tyme4ts 宜忌里的简体原词。
 * 置产、纳财不做（投资，AGENTS.md §1.5）；求医、治病、针灸、探病、求医疗病、词讼不做；开业只看开市，立券、交易不算。
 */
export const ITEMS = [
	{ slug: "banjia", name: "搬家", hant: "搬家", words: ["移徙", "入宅"] },
	{ slug: "jiehun", name: "结婚", hant: "結婚", words: ["嫁娶"] },
	{ slug: "kaiye", name: "开业", hant: "開業", words: ["开市"] },
	{ slug: "chuxing", name: "出行", hant: "出行", words: ["出行"] },
	{ slug: "zhuangxiu", name: "装修", hant: "裝修", words: ["修造", "动土"] },
	{ slug: "dinghun", name: "订婚", hant: "訂婚", words: ["订盟", "纳采"] },
] as const;

export type Slug = (typeof ITEMS)[number]["slug"];

const NONE = "诸事不宜";

/**
 * 这一天对这件事命中的宜词（按事项表的词序）；不是吉日返回空数组。
 * 吉日：事项词至少一个在宜里，一个都不在忌里，宜忌里都没有「诸事不宜」。
 * - 一个词在宜、另一个在忌（宜移徙忌入宅、宜修造忌动土）不算：搬家、装修是一件事，忌里那一半做不了。
 * - 「诸事不宜」在宜在忌都不算：逐日页上这一天写着「诸事不宜」，列成吉日就自相矛盾（窗内只影响三天，见 zeri.test.ts）。
 * - 「馀事勿取」不影响：它说的是宜里没列的事。
 * 岁破、四离、四绝、杨公忌等不另加：宜忌已由神煞定好（tyme4ts 的表按月建 × 日干支），和逐日页同一份宜忌。
 */
export function hits(slug: Slug, yi: readonly string[], ji: readonly string[]): string[] {
	const words: readonly string[] = ITEMS.find((i) => i.slug === slug)!.words;
	if (yi.includes(NONE) || ji.includes(NONE) || words.some((w) => ji.includes(w))) return [];
	return words.filter((w) => yi.includes(w));
}

/** 按月数据里的一行宜或忌（huangli.ts 的 Words）→ 简体原词。词带 key；标记词已按简繁写好，繁体的换回简体。 */
const MARKS: Record<string, string> = { 諸事不宜: "诸事不宜", 餘事勿取: "馀事勿取" };
export const keys = (w: { list: readonly { key: string }[]; marks?: readonly string[] }) => [
	...w.list.map((x) => x.key),
	...(w.marks ?? []).map((m) => MARKS[m] ?? m),
];

/** 浏览器里的一天（按月数据的一条，简繁都行）对这件事命中的宜词 */
export const cardHits = (slug: Slug, c: { yi: Parameters<typeof keys>[0]; ji: Parameters<typeof keys>[0] }) =>
	hits(slug, keys(c.yi), keys(c.ji));

const BRANCHES = "子丑寅卯辰巳午未申酉戌亥";
/**
 * 这一天冲的生肖：0 鼠、1 牛……11 猪（与地支同序）。日支的对冲：申日冲寅，冲虎。
 * 生肖由用户自己选，不从生日推，只在浏览器里用（AGENTS.md §1.5）。
 * 参数是日干支「戊申」，或按月数据的 ganzhi「丙午年 丁酉月 戊申日」：取最后一个地支字（干支字简繁相同）。
 */
export const clash = (ganzhi: string) => {
	const branch = [...ganzhi].reverse().find((ch) => BRANCHES.includes(ch))!;
	return (BRANCHES.indexOf(branch) + 6) % 12;
};
