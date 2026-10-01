/**
 * 卦页用的小工具：卦名简称、卦名字体、卦爻辞拆分、相关卦与卦宫。零 DOM，也不引 JSON 数据：
 * 卦爻辞原文由调用方传进来。卦页网址在 src/data/gua-slugs.ts。
 * 起卦脚本的入口包不引这个模块（首屏 JS 不增加），成卦、解读、分享卡都是按需加载后才用。
 */
import { GUA } from "../data/gua-slugs.js";
import { GUA64, GUAS } from "./liuyao/const.js";
import { palace, setShiYao, soul } from "./liuyao/utils.js";

/** 卦名简称：乾为天 → 乾，地天泰 → 泰，风天小畜 → 小畜。遁卦用「遁」，不用 guaci.json 首行的「遯」。 */
export const shortName = (name: string) => (name[1] === "为" ? name.slice(0, 1) : name.slice(2));

/**
 * 站酷小薇没有的字：卦名、卦辞、爻辞、节气名、三候名里出现的全部，由 tools/xiaowei-missing.py 算出
 * （换字体版本或改了 guaci.json、huangli.json 的三候就重跑，把输出抄到这里）。
 * 「己」不是 cmap 缺字：小薇把它画得和「巳」一模一样（左竖顶到横上、封口），「己巳」看成「巳巳」，
 * 按缺字处理（脚本里「字形有误」的手工清单）。
 */
const NO_XIAOWEI = /[㧑刲卼咥咷嗃夬姤寘己愬柅洟牿甃畬禴稊窞繘繻纆胏脢臲茀菑蔀藟虩衎袽豮輹遯邅雊鞶頄颙餗鴠鴽鵙鹖鼫]/;

/**
 * 本该用站酷小薇的一块文字实际用哪种字体：含小薇缺的字就整块改用宋体，不让浏览器逐字回退、
 * 一块里混着两种字体。一块是一个卦名、一句卦辞，或者一起显示的全部爻辞（调用方拼起来传入），
 * 免得爻辞一行小薇一行宋体。返回 tokens.css 的变量名，页面写 `var(…)`，canvas 读它的值。
 *
 * 只管简体。繁体页不用它：标题字体芫荽缺的字由霞鹜文楷 TC 补，两者同出 Klee One，都是楷书，
 * 补上的字和周围看不出差别；整块换成宋体反倒突兀。
 */
export const fontOf = (text: string) => (NO_XIAOWEI.test(text) ? "--font-body" : "--font-display");

export interface YaoCi {
	/** 初九 … 上六，乾坤另有用九、用六 */
	title: string;
	/** 爻辞，不含爻题 */
	text: string;
	/** 小象：「象曰：…」 */
	xiang: string;
}

export interface GuaCi {
	/** 第十一卦 */
	no: string;
	/** 首行的卦名全称与简称：天山遁、遯（繁体：天山遯、遯；天雷無妄、雷風恆是台湾写法，不是原文）。简体页的简称用 shortName，遁卦不写「遯」。 */
	name: string;
	short: string;
	/** 上卦、下卦：坤、乾 */
	upper: string;
	lower: string;
	/** 卦辞，整行（不一定以「泰：」开头，如「履虎尾…」） */
	ci: string;
	/** 「彖曰：…」 */
	tuan: string;
	/** 大象：「象曰：…」 */
	xiang: string;
	/** 初爻在前；乾、坤多一条用九、用六 */
	yao: YaoCi[];
}

/**
 * 拆开 guaci.json（或 guaci-hant.json）的一卦。格式：首行「《易经》第十一卦 泰 地天泰 坤上乾下」
 * （繁体是「《易經》」），然后卦辞、彖、象各一行，一个空行，再是每爻一行爻辞、一行小象。
 */
export function parseGua(text: string): GuaCi {
	const [head = "", ci = "", tuan = "", xiang = "", , ...rest] = text.split("\n");
	const [no = "", short = "", name = "", trigrams = ""] = head.replace(/《易[经經]》/, "").split(" ");
	const yao: YaoCi[] = [];
	for (let i = 0; i < rest.length; i += 2) {
		const line = rest[i] as string;
		yao.push({ title: line.slice(0, 2), text: line.slice(3), xiang: rest[i + 1] ?? "" });
	}
	return { no, name, short, upper: trigrams.slice(0, 1), lower: trigrams.slice(2, 3), ci, tuan, xiang, yao };
}

/** 卦码：六位，初爻在前，1 阳 0 阴（见 const.ts 的 GUA64）。 */
export function markOf(name: string): string {
	const mark = Object.keys(GUA64).find((m) => GUA64[m] === name);
	if (!mark) throw new Error(`不认识的卦名：${name}`);
	return mark;
}

const named = (mark: string) => GUA64[mark] as string;

/** 错卦（六爻阴阳全变）、综卦（上下颠倒）、互卦（二至四爻为下卦，三至五爻为上卦）。与本卦相同时照样列出。 */
export function related(name: string): [kind: string, name: string][] {
	const m = markOf(name);
	return [
		["错卦", named([...m].map((b) => (b === "1" ? "0" : "1")).join(""))],
		["综卦", named([...m].reverse().join(""))],
		["互卦", named(m.slice(1, 4) + m.slice(2, 5))],
	];
}

/** 繁体卦宫要换的字：只有这几个（八卦名里的离、兑，加宫、纯、游魂、归魂）。 */
const GONG_HANT: Record<string, string> = { 宫: "宮", 纯: "純", 游: "遊", 归: "歸", 离: "離", 兑: "兌" };

/** 卦宫与世：坤宫 · 三世卦，乾宫 · 八纯卦，乾宫 · 游魂卦；繁体：乾宮 · 遊魂卦。 */
export function gongOf(name: string, hant = false): string {
	const m = markOf(name);
	const { shi } = setShiYao(m);
	const hun = soul(m);
	const s = `${GUAS[palace(m, shi)]}宫 · ${hun ? `${hun}卦` : shi === 6 ? "八纯卦" : `${"一二三四五"[shi - 1]}世卦`}`;
	return hant ? s.replace(/[宫纯游归离兑]/g, (c) => GONG_HANT[c] as string) : s;
}

/** 通行本卦序的上一卦、下一卦。乾没有上一卦，未济没有下一卦，不循环。 */
export function neighbors(name: string): { prev?: string; next?: string } {
	const i = GUA.findIndex(([n]) => n === name);
	if (i < 0) throw new Error(`不认识的卦名：${name}`);
	return { prev: GUA[i - 1]?.[0], next: GUA[i + 1]?.[0] };
}
