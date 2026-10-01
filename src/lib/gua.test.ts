import { describe, expect, it } from "vitest";
import { GUA, guaPath } from "../data/gua-slugs.js";
import guaciHant from "../data/guaci-hant.json" with { type: "json" };
import guaci from "../data/guaci.json" with { type: "json" };
import { yaoTitle } from "./flow.js";
import { fontOf, gongOf, markOf, neighbors, parseGua, related, shortName } from "./gua.js";
import { GUA64, GUAS, YAOS } from "./liuyao/const.js";

const TEXT: Record<string, string> = guaci;
const HANT: Record<string, string> = guaciHant;
const trigram = (bits: string) => GUAS[YAOS.indexOf(bits as (typeof YAOS)[number])];

/** 1 → 一，10 → 十，64 → 六十四 */
function cn(n: number): string {
	const d = "〇一二三四五六七八九";
	const t = Math.floor(n / 10);
	return (t === 0 ? "" : t === 1 ? "十" : `${d[t]}十`) + (n % 10 ? d[n % 10] : "");
}

describe("slug 表", () => {
	it("64 条，卦名正好是 guaci.json 的键，slug 互不重复", () => {
		expect(GUA).toHaveLength(64);
		expect(GUA.map(([n]) => n).sort()).toEqual(Object.keys(TEXT).sort());
		expect(new Set(GUA.map(([, s]) => s)).size).toBe(64);
		for (const [, slug] of GUA) expect(slug).toMatch(/^[a-z]+(-[a-z]+){2,3}$/);
	});

	it("按通行本卦序排列：第 N 条就是首行写的第 N 卦", () => {
		GUA.forEach(([name], i) => expect(parseGua(TEXT[name] as string).no, name).toBe(`第${cn(i + 1)}卦`));
	});

	it("网址带尾斜杠；不认识的卦名直接报错", () => {
		expect(guaPath("地天泰")).toBe("/gua/di-tian-tai/");
		expect(guaPath("天泽履")).toBe("/gua/tian-ze-lv/");
		expect(guaPath("天山遁", true)).toBe("/zh-hant/gua/tian-shan-dun/");
		expect(() => guaPath("天天天")).toThrow();
	});
});

describe("guaci.json 与引擎一致", () => {
	it("每卦首行的「X上Y下」与引擎卦码的上下卦相同", () => {
		for (const [mark, name] of Object.entries(GUA64)) {
			const g = parseGua(TEXT[name] as string);
			expect([g.upper, g.lower], name).toEqual([trigram(mark.slice(3)), trigram(mark.slice(0, 3))]);
		}
	});

	it("卦名简称取自全名，与首行一致（遁卦首行写作「遯」）", () => {
		for (const [name, text] of Object.entries(TEXT))
			expect(shortName(name), name).toBe((text.split(" ")[1] as string).replace("遯", "遁"));
	});

	it("首行的全名就是键", () => {
		for (const [name, text] of Object.entries(TEXT)) expect(parseGua(text).name).toBe(name);
	});
});

/** 繁体八卦名里和简体不同的只有这两个 */
const hans = (s: string) => s.replace("離", "离").replace("兌", "兑");

describe("guaci-hant.json 与 guaci.json 逐卦对应（抓转录时漏掉、多出、错位的行）", () => {
	it("键和顺序完全相同", () => {
		expect(Object.keys(HANT)).toEqual(Object.keys(TEXT));
	});

	it("每卦行数、空行位置、爻题序列、象曰的位置都相同", () => {
		// 每行记成一个记号：首行、卦辞、彖、象、空行，爻辞记爻题
		const shape = (text: string) =>
			text.split("\n").map((l, i) => {
				if (i < 2) return ["首", "辞"][i];
				if (l === "") return "空";
				return l.match(/^(彖|象)曰：/)?.[1] ?? l.match(/^(初[六九]|[六九][二三四五]|上[六九]|用[九六])：/)?.[1] ?? `？${l}`;
			});
		for (const name of Object.keys(TEXT)) expect(shape(HANT[name] as string), name).toEqual(shape(TEXT[name] as string));
	});

	it("卦序与上下卦相同（因而也与引擎一致）", () => {
		for (const name of Object.keys(TEXT)) {
			const [s, h] = [parseGua(TEXT[name] as string), parseGua(HANT[name] as string)];
			expect([h.no, hans(h.upper), hans(h.lower)], name).toEqual([s.no, s.upper, s.lower]);
		}
	});

	it("繁体首行：卦名用维基文库页名，只有無妄、恆换成台湾常见写法；经文照原文", () => {
		const g = (name: string) => parseGua(HANT[name] as string);
		expect([g("天山遁").name, g("天山遁").short]).toEqual(["天山遯", "遯"]);
		expect([g("天雷无妄").name, g("天雷无妄").short]).toEqual(["天雷無妄", "無妄"]);
		expect([g("雷风恒").name, g("雷风恒").short]).toEqual(["雷風恆", "恆"]);
		expect(g("离为火").name).toBe("離為火");
		expect(g("天雷无妄").ci).toMatch(/^无妄：/);
		for (const name of Object.keys(HANT)) {
			const { name: full, short } = g(name);
			expect(full.endsWith(short) || full.startsWith(`${short}為`), name).toBe(true);
			expect([...full].length, name).toBe([...name].length);
		}
	});

	it("繁体的每个字都在 Big5 里，判据同 NOTICE（原文混入的「觌」「济」已改正）", () => {
		// 标准 Big5 的字：逐个码位用 WHATWG 的 big5 解码器解出来。它含香港增补字符集，所以只取标准 Big5 的
		// 码位段（首字节 A1–F9），跳过 C6A1–C8FE 这段扩展区。
		const decoder = new TextDecoder("big5");
		const big5 = new Set<string>();
		for (let lead = 0xa1; lead <= 0xf9; lead++)
			for (let trail = 0x40; trail <= 0xfe; trail++) {
				const code = lead * 256 + trail;
				if ((trail > 0x7e && trail < 0xa1) || (code >= 0xc6a1 && code <= 0xc8fe)) continue;
				const ch = decoder.decode(new Uint8Array([lead, trail]));
				if ([...ch].length === 1 && ch !== "�") big5.add(ch);
			}
		// 不在 Big5 里、但照原文保留的字：「无」是经文用字（维基文库特意标了不转换），牀、羣、衆是传统写法的
		// 异体，不是简化字。
		const allowed = new Set("无牀羣衆");
		for (const [name, text] of Object.entries(HANT)) {
			const outside = [...new Set(text)].filter((ch) => !/\s/.test(ch) && !big5.has(ch) && !allowed.has(ch));
			expect(outside.join(""), name).toBe("");
		}
	});
});

describe("parseGua", () => {
	it("繁体首行的「《易經》」也能剥掉", () => {
		expect(parseGua(HANT["地天泰"] as string)).toMatchObject({ no: "第十一卦", name: "地天泰", short: "泰", upper: "坤", lower: "乾" });
	});

	it("64 卦都拆得出卦辞、彖、象和每一爻的爻辞与小象（简繁两份）", () => {
		for (const [mark, name] of Object.entries(GUA64))
			for (const g of [parseGua(TEXT[name] as string), parseGua(HANT[name] as string)]) {
				expect(g.ci, name).toMatch(/^.+。$/);
				expect(g.tuan, name).toMatch(/^彖曰：.+/);
				expect(g.xiang, name).toMatch(/^象曰：.+/);
				const titles = [...mark].map((bit, i) => yaoTitle(i, bit === "1"));
				if (name === "乾为天") titles.push("用九");
				if (name === "坤为地") titles.push("用六");
				expect(g.yao.map((y) => y.title), name).toEqual(titles);
				for (const y of g.yao) {
					expect(y.text, `${name}${y.title}`).toMatch(/^[^：]+$/);
					expect(y.xiang, `${name}${y.title}`).toMatch(/^象曰：.+/);
				}
			}
	});
});

describe("fontOf", () => {
	it("含站酷小薇缺字的整块改用宋体", () => {
		expect(fontOf("地天泰")).toBe("--font-display");
		expect(fontOf("天山遁")).toBe("--font-display");
		expect(fontOf("泽天夬")).toBe("--font-body");
		expect(fontOf("天风姤")).toBe("--font-body");
		expect(fontOf("遯：亨。小利贞。")).toBe("--font-body");
	});

	it("「己」字形与「巳」相同，按缺字处理；「巳」照用小薇", () => {
		expect(fontOf("己")).toBe("--font-body");
		expect(fontOf("己巳")).toBe("--font-body");
		expect(fontOf("巳")).toBe("--font-display");
	});

	it("全部爻辞算一块：一行缺字，整组宋体", () => {
		const yao = parseGua(TEXT["天风姤"] as string).yao.map((y) => y.text);
		expect(fontOf(yao[1] as string)).toBe("--font-display"); // 九二：包有鱼…
		expect(fontOf(yao.join(""))).toBe("--font-body");
	});
});

describe("卦页推导", () => {
	it("卦码初爻在前；不认识的卦名直接报错", () => {
		expect(markOf("乾为天")).toBe("111111");
		expect(markOf("水雷屯")).toBe("100010");
		expect(() => markOf("天天天")).toThrow();
	});

	it("错卦、综卦、互卦", () => {
		expect(related("乾为天")).toEqual([["错卦", "坤为地"], ["综卦", "乾为天"], ["互卦", "乾为天"]]);
		expect(related("地天泰")).toEqual([["错卦", "天地否"], ["综卦", "天地否"], ["互卦", "雷泽归妹"]]);
		expect(related("水雷屯")[1]).toEqual(["综卦", "山水蒙"]);
	});

	it("乾宫八卦的卦宫与世", () => {
		const qian = ["乾为天", "天风姤", "天山遁", "天地否", "风地观", "山地剥", "火地晋", "火天大有"];
		expect(qian.map((n) => gongOf(n))).toEqual([
			"乾宫 · 八纯卦",
			"乾宫 · 一世卦",
			"乾宫 · 二世卦",
			"乾宫 · 三世卦",
			"乾宫 · 四世卦",
			"乾宫 · 五世卦",
			"乾宫 · 游魂卦",
			"乾宫 · 归魂卦",
		]);
		expect(gongOf("地天泰")).toBe("坤宫 · 三世卦");
	});

	it("繁体卦宫", () => {
		expect(gongOf("火地晋", true)).toBe("乾宮 · 遊魂卦");
		expect(gongOf("火天大有", true)).toBe("乾宮 · 歸魂卦");
		expect(gongOf("兑为泽", true)).toBe("兌宮 · 八純卦");
		expect(gongOf("火山旅", true)).toBe("離宮 · 一世卦");
		expect(gongOf("地天泰", true)).toBe("坤宮 · 三世卦");
	});

	it("上一卦、下一卦不循环", () => {
		expect(neighbors("乾为天")).toEqual({ prev: undefined, next: "坤为地" });
		expect(neighbors("地天泰")).toEqual({ prev: "天泽履", next: "天地否" });
		expect(neighbors("火水未济")).toEqual({ prev: "水火既济", next: undefined });
	});
});
