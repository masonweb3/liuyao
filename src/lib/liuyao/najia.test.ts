import { describe, expect, it } from "vitest";
import { ganzhiFromDate } from "./calendar.js";
import { cast, toss } from "./najia.js";

// 《增删卜易》卦例, see docs/research.md §3.4.
describe("增删卜易卦例", () => {
	it("A: 亥月己丑日，兑为泽之天水讼", () => {
		const r = cast([9, 7, 8, 7, 7, 6], {
			date: new Date("2022-12-02T10:00:00+08:00"),
		});
		expect(r.ganzhi.month[1]).toBe("亥");
		expect(r.ganzhi.day).toBe("己丑");
		expect(r.ganzhi.xkong).toBe("午未");
		expect(r.gua.name).toBe("兑为泽");
		expect(r.shiy.shi).toBe(6);
		expect(r.dong).toEqual([0, 5]);
		expect([r.gua.qin6[5], r.gua.qinx[5]]).toEqual(["父母", "丁未土"]);
		expect([r.gua.qin6[0], r.gua.qinx[0]]).toEqual(["官鬼", "丁巳火"]);
		expect(r.bian?.name).toBe("天水讼");
		expect([r.bian?.qin6[5], r.bian?.qinx[5]]).toEqual(["父母", "壬戌土"]);
		// 讼 is 离宫, but 变卦六亲 read against the 本卦's 兑宫: 寅木 is 妻财, not 父母.
		expect(r.bian?.gong).toBe("离");
		expect([r.bian?.qin6[0], r.bian?.qinx[0]]).toEqual(["妻财", "戊寅木"]);
	});

	it("B: 辰月戊子日，乾之夬", () => {
		const r = cast([7, 7, 7, 7, 7, 9], {
			date: new Date("2020-04-15T10:00:00+08:00"),
		});
		expect(r.ganzhi.month[1]).toBe("辰");
		expect(r.ganzhi.day).toBe("戊子");
		expect(r.ganzhi.xkong).toBe("午未");
		expect(r.gua.name).toBe("乾为天");
		expect(r.shiy.shi).toBe(6);
		expect([r.gua.qin6[5], r.gua.qinx[5]]).toEqual(["父母", "壬戌土"]);
		expect(r.bian?.name).toBe("泽天夬");
		expect([r.bian?.qin6[5], r.bian?.qinx[5]]).toEqual(["父母", "丁未土"]);
	});

	it("C: 未月丁卯日，天火同人之革", () => {
		const r = cast([7, 8, 7, 7, 7, 9], {
			date: new Date("2020-07-23T10:00:00+08:00"),
		});
		expect(r.ganzhi.month[1]).toBe("未");
		expect(r.ganzhi.day).toBe("丁卯");
		expect(r.ganzhi.xkong).toBe("戌亥");
		expect(r.gua.name).toBe("天火同人");
		expect(r.gua.gong).toBe("离");
		expect(r.soul).toBe("归魂");
		expect(r.shiy).toEqual({ shi: 3, ying: 6 });
		expect([r.gua.qin6[5], r.gua.qinx[5]]).toEqual(["子孙", "壬戌土"]);
		expect(r.bian?.name).toBe("泽火革");
		expect([r.bian?.qin6[5], r.bian?.qinx[5]]).toEqual(["子孙", "丁未土"]);
	});

	it("D: 天山遁，子水子孙伏于初爻辰土之下", () => {
		const r = cast([8, 8, 7, 7, 7, 7]);
		expect(r.gua.name).toBe("天山遁");
		expect(r.gua.qinx[0]).toBe("丙辰土");
		expect(r.hide?.seat).toEqual([0, 1]);
		expect([r.hide?.qin6[0], r.hide?.qinx[0]]).toEqual(["子孙", "甲子水"]);
		expect([r.hide?.qin6[1], r.hide?.qinx[1]]).toEqual(["妻财", "甲寅木"]);
	});
});

describe("装卦陷阱", () => {
	it("游魂卦按世爻定宫：火地晋属乾宫", () => {
		const r = cast([8, 8, 8, 7, 8, 7]);
		expect(r.gua.name).toBe("火地晋");
		expect(r.soul).toBe("游魂");
		expect(r.gua.gong).toBe("乾");
	});
});

describe("干支", () => {
	it("按立春精确时刻换年换月（2025-02-03 22:10:28）", () => {
		const before = ganzhiFromDate(new Date("2025-02-03T22:00:00+08:00"));
		const after = ganzhiFromDate(new Date("2025-02-03T22:20:00+08:00"));
		expect([before.year, before.month]).toEqual(["甲辰", "丁丑"]);
		expect([after.year, after.month]).toEqual(["乙巳", "戊寅"]);
	});

	it("一律按 UTC+8，与宿主时区无关", () => {
		// Same instant as 2025-02-03 22:20 UTC+8.
		const r = ganzhiFromDate(new Date("2025-02-03T14:20:00Z"));
		expect([r.year, r.month]).toEqual(["乙巳", "戊寅"]);
	});

	it("晚子时默认不换日，可选换日", () => {
		const lateZi = new Date("2024-06-05T23:30:00+08:00");
		const stays = ganzhiFromDate(lateZi);
		const advances = ganzhiFromDate(lateZi, { lateZi: "day-advances" });
		const today = ganzhiFromDate(new Date("2024-06-05T12:00:00+08:00"));
		const tomorrow = ganzhiFromDate(new Date("2024-06-06T12:00:00+08:00"));
		expect(stays.day).toBe(today.day);
		expect(advances.day).toBe(tomorrow.day);
		expect(advances.xkong).toBe(tomorrow.xkong);
		expect(stays.hour).toBe(advances.hour);
	});
});

describe("起卦", () => {
	it("铜钱：背 3 字 2，三枚相加得 6–9", () => {
		const seen = new Set<number>();
		for (let i = 0; i < 1000; i++) {
			const { coins, yao } = toss();
			expect(coins.every((c) => c === 2 || c === 3)).toBe(true);
			expect(yao).toBe(coins[0] + coins[1] + coins[2]);
			seen.add(yao);
		}
		expect([...seen].sort()).toEqual([6, 7, 8, 9]);
	});

	it("手动录入：接受 6–9 的数组或字符串，拒绝其他", () => {
		expect(cast("987766").gua.name).toBe(cast([9, 8, 7, 7, 6, 6]).gua.name);
		expect(() => cast([1, 2, 1, 2, 1, 2])).toThrow();
		expect(() => cast([7, 7, 7, 7, 7])).toThrow();
		expect(() => cast("77777x")).toThrow();
	});
});
