import { describe, expect, it } from "vitest";
import { afterJudge, FALLBACK, type Judgement, NEXT, settled, tossCaption, yaoTitle } from "./flow.js";

const j = (over: Partial<Judgement>): Judgement => ({ ...FALLBACK, topic: "财", ...over });

describe("afterJudge", () => {
	it("自伤优先于一切，包括紧急", () => {
		expect(afterJudge(j({ selfHarm: true, emergency: true, gambling: true }))).toBe("guard");
	});
	it("彩票赌博婉拒，即使 topic 是财", () => {
		expect(afterJudge(j({ gambling: true }))).toBe("decline");
	});
	it("紧急先提示，确认后继续往下走", () => {
		expect(afterJudge(j({ emergency: true }))).toBe("emergency");
		expect(afterJudge(j({ emergency: true }), true)).toBe("calm");
		expect(afterJudge(j({ emergency: true, insincere: true }), true)).toBe("insincere");
	});
	it("没有 Jev 或婚恋都去择类", () => {
		expect(afterJudge(FALLBACK)).toBe("topic");
		expect(afterJudge(j({ topic: "婚恋" }))).toBe("topic");
		expect(settled(j({ topic: "婚恋" }))).toBeNull();
	});
	it("类别明确直接静心", () => {
		expect(afterJudge(j({ topic: "事业" }))).toBe("calm");
		expect(settled(j({ topic: "事业" }))).toEqual({ topic: "事业" });
	});
	it("每个结果都是 ask 允许去的屏", () => {
		for (const s of ["guard", "decline", "emergency", "insincere", "topic", "calm"] as const)
			expect(NEXT.ask).toContain(s);
	});
});

it("一事一占：静心之后只能向前", () => {
	expect([NEXT.calm, NEXT.cast, NEXT.reveal]).toEqual([["cast"], ["reveal"], []]);
});

describe("文字", () => {
	it("爻题", () => {
		expect([yaoTitle(0, true), yaoTitle(2, false), yaoTitle(4, true), yaoTitle(5, false)]).toEqual([
			"初九",
			"六三",
			"九五",
			"上六",
		]);
	});
	it("铜钱", () => {
		expect([6, 7, 8, 9].map((y) => tossCaption(y as 6 | 7 | 8 | 9))).toEqual([
			"三字 · 老阴",
			"一背两字 · 少阳",
			"两背一字 · 少阴",
			"三背 · 老阳",
		]);
	});
});
