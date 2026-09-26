import { describe, expect, it } from "vitest";
import guaci from "../data/guaci.json" with { type: "json" };
import { yaoTitle } from "./flow.js";
import { fontOf, GUA, guaPath, parseGua, shortName } from "./gua.js";
import { GUA64, GUAS, YAOS } from "./liuyao/const.js";

const TEXT: Record<string, string> = guaci;
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

	it("网址带尾斜杠", () => {
		expect(guaPath("地天泰")).toBe("/gua/di-tian-tai/");
		expect(guaPath("天泽履")).toBe("/gua/tian-ze-lv/");
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
});

describe("parseGua", () => {
	it("64 卦都拆得出卦辞、彖、象和每一爻的爻辞与小象", () => {
		for (const [mark, name] of Object.entries(GUA64)) {
			const g = parseGua(TEXT[name] as string);
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
	it("含站酷小薇缺字的整段改用宋体", () => {
		expect(fontOf("地天泰")).toBe("--font-display");
		expect(fontOf("天山遁")).toBe("--font-display");
		expect(fontOf("泽天夬")).toBe("--font-body");
		expect(fontOf("天风姤")).toBe("--font-body");
		expect(fontOf("遯：亨。小利贞。")).toBe("--font-body");
	});
});
