import { describe, expect, it } from "vitest";
import {
	afterJudge,
	dayLabel,
	FALLBACK,
	fromBeijingInput,
	type Judgement,
	NEXT,
	parseYao,
	settled,
	toBeijingInput,
	tossCaption,
	yaoTitle,
} from "./flow.js";

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

it("一事一占：静心之后只能向前，解读与往卦之间不回到起卦", () => {
	expect([NEXT.calm, NEXT.cast, NEXT.reveal]).toEqual([["cast"], ["reveal"], ["reading"]]);
	expect([NEXT.reading, NEXT.history]).toEqual([["history"], ["reading"]]);
});

it("往卦日期按北京时间，跨年才写年份", () => {
	const now = new Date("2026-09-26T12:00:00+08:00");
	expect(dayLabel(new Date("2026-09-25T23:30:00+08:00"), now)).toBe("9月25日");
	expect(dayLabel(new Date("2026-09-25T16:30:00Z"), now)).toBe("9月26日");
	expect(dayLabel(new Date("2025-12-31T23:59:00+08:00"), now)).toBe("2025年12月31日");
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

describe("手动排盘", () => {
	it("六爻初爻在前，容忍全角数字与空格", () => {
		expect(parseYao("978776")).toEqual([9, 7, 8, 7, 7, 6]);
		expect(parseYao(" ９７８ ７７６ ")).toEqual([9, 7, 8, 7, 7, 6]);
		for (const bad of ["", "97877", "9787766", "978775", "97a776"]) expect(parseYao(bad), bad).toBeNull();
	});
	it("起卦时间按北京时间读写，与设备时区无关", () => {
		expect(toBeijingInput(new Date("2026-09-26T13:30:00Z"))).toBe("2026-09-26T21:30");
		expect(fromBeijingInput("2025-02-03T22:20")?.toISOString()).toBe("2025-02-03T14:20:00.000Z");
		for (const bad of ["", "1899-12-31T23:59", "2025-02-03", "2025-13-40T25:00"]) expect(fromBeijingInput(bad), bad).toBeNull();
	});
	it("只能从首屏进入，择类之后直接解读", () => {
		expect(NEXT.home).toContain("manual");
		expect(NEXT.manual).toEqual(["home", "topic"]);
		expect(NEXT.topic).toContain("reading");
	});
});
