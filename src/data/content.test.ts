/**
 * 内容覆盖与红线检查.
 *
 * guaci.json format, for whoever renders it: one string per 卦, lines split by
 * "\n". Line 0 is the title, line 1 the 卦辞 — which does NOT always start with
 * 「名：」 (履虎尾…、否之匪人…、同人于野…), so show the whole line rather than
 * splitting on the colon. 爻辞 lines start with 初九/六二/…/上六 and a full-width
 * colon, each followed by its 小象; 用九/用六 exist only in 乾 and 坤.
 */
import { describe, expect, it } from "vitest";
import { GUA64 } from "../lib/liuyao/const.js";
import baihua from "./baihua.json" with { type: "json" };
import * as copy from "./copy.js";
import guaci from "./guaci.json" with { type: "json" };
import { SPECIAL, TEMPLATES } from "./templates.js";

const NAMES = Object.values(GUA64).sort();

function strings(value: unknown): string[] {
	if (typeof value === "string") return [value];
	if (value && typeof value === "object") return Object.values(value).flatMap(strings);
	return [];
}

describe("覆盖", () => {
	it("64 卦都有卦辞与白话", () => {
		expect(Object.keys(guaci).sort()).toEqual(NAMES);
		expect(Object.keys(baihua).sort()).toEqual(NAMES);
		for (const [name, text] of Object.entries(baihua)) expect(text, name).toMatch(/^.+，是.+。/);
	});

	it("每个（类别 × 吉凶）都有结论和至少两条建议", () => {
		for (const [topic, cells] of Object.entries(TEMPLATES))
			for (const [verdict, t] of Object.entries(cells)) {
				expect(t.conclusion, `${topic}${verdict}`).not.toBe("");
				expect(t.advice.length, `${topic}${verdict}`).toBeGreaterThanOrEqual(2);
			}
	});

	it("卦辞的爻位与卦码一一对应，可按爻位取爻辞", () => {
		const label = (i: number, yang: boolean) => {
			const n = yang ? "九" : "六";
			return i === 0 ? `初${n}` : i === 5 ? `上${n}` : `${n}${"二三四五"[i - 1]}`;
		};
		for (const [mark, name] of Object.entries(GUA64)) {
			const lines = (guaci as Record<string, string>)[name]!.split("\n");
			expect(lines[0], name).toContain(name);
			const found = lines.flatMap((l) => l.match(/^(初[六九]|[六九][二三四五]|上[六九])：/)?.[1] ?? []);
			expect(found, name).toEqual([...mark].map((bit, i) => label(i, bit === "1")));
		}
		const yong = Object.entries(guaci).flatMap(([name, text]) =>
			/\n用[九六]：/.test(text) ? [name] : [],
		);
		expect(yong.sort()).toEqual(["乾为天", "坤为地"].sort());
	});
});

describe("红线", () => {
	const all = [...strings(baihua), ...strings(TEMPLATES), ...strings(SPECIAL), ...strings(copy)];

	it("不出现改命、转运、化解之类的字样", () => {
		expect(strings(copy).length).toBeGreaterThan(10);
		for (const s of all) expect(s).not.toMatch(/改命|转运|化解|算命|消灾|开光|大师|血光/);
	});

	it("不打包票，不给应期", () => {
		for (const s of all) expect(s).not.toMatch(/一定|必定|必然|保证|之内/);
	});
});
