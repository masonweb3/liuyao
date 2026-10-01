import { describe, expect, it } from "vitest";
import type { Topic } from "./liuyao/duan.js";
import { byNumbers, byTime } from "./meihua.js";
import { duan, tiYong } from "./meihua-duan.js";
import type { By } from "./meihua-page.js";
import { compose } from "./meihua-reading.js";

const at = (hhmm: string, day = "2026-10-01") => new Date(`${day}T${hhmm}:00+08:00`).toISOString();
const view = (by: By, when: string, topic: Topic = "事业") => compose({ by, at: when, topic, lateZi: "day-stays" });

describe("设计稿的实算例子（docs/design-meihua.md）", () => {
	it("此刻 2026-10-01 16:08 时间起卦：雷风恒之雷水解，九三动，互泽天夬，吉", () => {
		const v = view({ by: "time" }, at("16:08"));
		expect([v.ben.name, v.bian.name, v.hu.name, v.dong.title, v.verdict]).toEqual(["雷风恒", "雷水解", "泽天夬", "九三", "吉"]);
		expect(v.formula).toEqual([
			"午年 7 ＋ 八月 8 ＋ 廿一 21 ＝ 36，÷8 余 4，上卦震",
			"36 ＋ 申时 9 ＝ 45，÷8 余 5，下卦巽",
			"45 ÷6 余 3，九三动",
		]);
		expect(v.when).toBe("丙午年 八月廿一 申时");
		expect(v.conclusion).toBe("可成，宜积极推进。");
		expect(v.rows).toEqual([
			["震木 · 上卦，不动", "—"],
			["巽木 · 下卦，九三动", "比和"],
			["泽天夬 · 乾金、兑金", "克体、克体"],
			["雷水解 · 巽木变坎水", "生体"],
		]);
		expect(v.reasons).toEqual([
			"用卦巽木与体卦震木比和，这件事与你相合。",
			"互卦泽天夬，乾金、兑金都克体卦，经过之中多有阻力。",
			"变卦雷水解，巽木变为坎水，生体卦，结局有所进益。",
		]);
		expect(v.hu.say).toBe("互卦只看它的两个经卦对体卦的生克，不读卦辞：乾金在下，兑金在上。");
		// 夬缺站酷小薇：互卦名整块用宋体
		expect(v.hu.font).toBe("--font-body");
		expect(v.ben.font).toBe("--font-display");
		expect(v.ben.href).toBe("/gua/lei-feng-heng/");
	});

	it("报数 3、5（申时）：火风鼎之天风姤，六五动，凶；姤整块宋体", () => {
		const v = view({ by: "num", nums: [3, 5] }, at("16:08"));
		expect([v.ben.name, v.bian.name, v.hu.name, v.dong.title, v.verdict]).toEqual(["火风鼎", "天风姤", "泽天夬", "六五", "凶"]);
		expect(v.formula).toEqual(["3 ÷8 余 3，上卦离", "5 ÷8 余 5，下卦巽", "3 ＋ 5 ＋ 申时 9 ＝ 17，÷6 余 5，六五动"]);
		expect(v.conclusion).toBe("时机未到，暂且守成。");
		// 第三步定的凶（审查 R2）：体生用、夬两经卦与姤的乾金都克体
		expect(v.reasons[3]).toBe("用卦、互卦两个经卦、变卦四处合看，三处克体，没有一处生体，所以断为凶。");
		expect(v.rows.slice(1)).toEqual([
			["离火 · 上卦，六五动", "为体所生"],
			["泽天夬 · 乾金、兑金", "克体、克体"],
			["天风姤 · 离火变乾金", "克体"],
		]);
		expect(v.bian.font).toBe("--font-body");
		expect([v.by, v.nums, v.hour, v.when]).toEqual(["num", "3、5", "申", "申时"]);
	});

	it("只报一个数 7（午时）：山水蒙之山地剥", () => {
		const v = view({ by: "num", nums: [7] }, at("12:00"));
		expect([v.ben.name, v.bian.name]).toEqual(["山水蒙", "山地剥"]);
		expect(v.formula).toEqual(["7 ÷8 余 7，上卦艮", "7 ＋ 午时 7 ＝ 14，÷8 余 6，下卦坎", "14 ÷6 余 2，九二动"]);
	});

	it("乾坤无互 1、1（申时）：乾为天，互卦取变卦火天大有之互，泽天夬", () => {
		const v = view({ by: "num", nums: [1, 1] }, at("16:08"));
		expect([v.ben.name, v.bian.name, v.hu.name, v.hu.fromBian]).toEqual(["乾为天", "火天大有", "泽天夬", true]);
		expect(v.hu.say).toBe(
			"互卦只看它的两个经卦对体卦的生克，不读卦辞：乾金在下，兑金在上。乾、坤的互卦仍是自身，原书说「乾坤无互，互其变卦」，这里取变卦的互卦；卦页上列的是一般的取法，所以两处不同。",
		);
		expect(view({ by: "num", nums: [3, 5] }, at("16:08")).hu.fromBian).toBe(false);
	});

	it("乾动初爻 1、1（辰时）：变卦天风姤之互仍是乾为天，与卦页相同（审查 R1）；上下同一经卦不叠写", () => {
		const v = view({ by: "num", nums: [1, 1] }, at("08:00"));
		expect([v.ben.name, v.dong.title, v.bian.name, v.hu.name, v.hu.fromBian]).toEqual(["乾为天", "初九", "天风姤", "乾为天", true]);
		expect(v.hu.say).toBe(
			"互卦只看它的两个经卦对体卦的生克，不读卦辞：上下都是乾金。乾、坤的互卦仍是自身，原书说「乾坤无互，互其变卦」，这里取变卦的互卦；动在初爻、上爻时，变卦的互卦仍是乾为天，与卦页相同。",
		);
		expect(v.reasons).toEqual([
			"用卦乾金与体卦乾金比和，这件事与你相合。",
			"互卦乾为天，上下两个经卦都是乾金，与体卦比和，经过之中多有相合处。",
			"变卦天风姤，乾金变为巽木，为体所克，结局可以把握。",
		]);
	});

	it("雷风恒九二（报数 4、5，辰时）：前两步是吉，第三步两处克体、没有生体，断凶并写明（审查 R2）", () => {
		const v = view({ by: "num", nums: [4, 5] }, at("08:00"));
		expect([v.ben.name, v.dong.title, v.verdict]).toEqual(["雷风恒", "九二", "凶"]);
		expect(v.reasons).toEqual([
			"用卦巽木与体卦震木比和，这件事与你相合。",
			"互卦泽天夬，乾金、兑金都克体卦，经过之中多有阻力。",
			"变卦雷山小过，巽木变为艮土，为体所克，结局可以把握。",
			"用卦、互卦两个经卦、变卦四处合看，两处克体，没有一处生体，所以断为凶。",
		]);
	});

	it("山地剥初六（报数 7、8，卯时）：用卦比和、变卦克体，一吉一凶断平并写明（审查 S1）", () => {
		const v = view({ by: "num", nums: [7, 8] }, at("06:00"));
		expect([v.ben.name, v.dong.title, v.verdict]).toEqual(["山地剥", "初六", "平"]);
		expect(v.reasons[3]).toBe("用卦与变卦一吉一凶，所以断为平。");
	});

	it("原书观梅占 2025-01-16 申时：泽火革，初九动，互天风姤，变泽山咸", () => {
		const v = view({ by: "time" }, at("16:00", "2025-01-16"));
		expect([v.ben.name, v.dong.title, v.hu.name, v.bian.name]).toEqual(["泽火革", "初九", "天风姤", "泽山咸"]);
		expect(v.formula[0]).toBe("辰年 5 ＋ 腊月 12 ＋ 十七 17 ＝ 34，÷8 余 2，上卦兑");
		expect(v.when).toBe("甲辰年 腊月十七 申时");
	});

	it("闰月写「闰六月 6」；余数为零写「余 0，作 8」「余 0，作 6」", () => {
		const v = view({ by: "time" }, at("12:00", "2025-08-01"));
		expect(v.formula[0]).toMatch(/^巳年 6 ＋ 闰六月 6 ＋ 初八 8 ＝ 20，÷8 余 4，上卦震$/);
		expect(view({ by: "num", nums: [16, 8] }, at("12:00")).formula.slice(0, 2)).toEqual(["16 ÷8 余 0，作 8，上卦坤", "8 ÷8 余 0，作 8，下卦坤"]);
		// 2 ＋ 3 ＋ 子时 1 ＝ 6
		expect(view({ by: "num", nums: [2, 3] }, at("00:30")).formula[2]).toBe("2 ＋ 3 ＋ 子时 1 ＝ 6，÷6 余 0，作 6，上六动");
	});
});

describe("每一种起法都排得出完整的解读", () => {
	it("两个数 1–8 × 1–8 × 十二时辰：卦辞、爻辞、白话齐全，印与 meihua-duan 一致，params 与引擎相同", () => {
		const topics: Topic[] = ["财", "事业", "父母", "子孙", "兄弟", "婚恋", "自身"];
		let i = 0;
		for (let a = 1; a <= 8; a++)
			for (let b = 1; b <= 8; b++)
				for (let h = 0; h < 24; h += 2) {
					const when = at(`${String(h).padStart(2, "0")}:30`);
					const v = view({ by: "num", nums: [a, b] }, when, topics[i++ % topics.length]);
					const m = byNumbers([a, b], new Date(when));
					expect(v.params).toEqual(m.params);
					expect(v.verdict).toBe(duan((tiYong(m.params) as NonNullable<ReturnType<typeof tiYong>>).rel));
					for (const s of [v.ben.ci, v.ben.baihua, v.bian.ci, v.bian.baihua, v.dong.text, v.dong.baihua, v.conclusion, ...v.advice, ...v.reasons])
						expect(s.length).toBeGreaterThan(0);
					// 红线：不写改命、转运、化解这类字眼
					expect([...v.reasons, v.conclusion, ...v.advice].join("")).not.toMatch(/改命|转运|化解|血光|大凶/);
				}
	});

	it("384 种起法：依据句与印对得上；第三步 72 种、一吉一凶 65 种多一句；关系一律「为体所生」「为体所克」", () => {
		const extra = { 凶: 0, 平: 0 };
		for (let a = 1; a <= 8; a++)
			for (let b = 1; b <= 8; b++)
				// 子到巳六个时辰，动爻正好取遍 1–6
				for (let h = 0; h < 12; h += 2) {
					const v = view({ by: "num", nums: [a, b] }, at(`${String(h).padStart(2, "0")}:30`));
					expect(v.reasons.length).toBeLessThanOrEqual(4);
					const last = v.reasons[3];
					if (last === "用卦与变卦一吉一凶，所以断为平。") {
						expect(v.verdict).toBe("平");
						extra.平++;
					} else if (last !== undefined) {
						expect(last).toMatch(/^用卦、互卦两个经卦、变卦四处(合看，[两三]处克体，没有一处生体|都克体)，所以断为凶。$/);
						expect(v.verdict).toBe("凶");
						extra.凶++;
					}
					const text = [...v.reasons, ...v.rows.flat(), v.hu.say].join("");
					expect(text).not.toMatch(/体生用|体克用|体生之|体克之|为体卦所|，顺。|整除/);
					// 互卦上下同一经卦时不叠写「乾金、乾金都」「乾金在下，乾金在上」
					expect(text).not.toMatch(/(..)、\1都|(..)在下，\2在上/);
				}
		expect(extra).toEqual({ 凶: 72, 平: 65 });
	});

	it("时间起卦与引擎同卦（一天里每个时辰）", () => {
		for (let h = 0; h < 24; h++) {
			const when = at(`${String(h).padStart(2, "0")}:05`, "2026-02-17");
			expect(view({ by: "time" }, when).params).toEqual(byTime(new Date(when)).params);
		}
	});
});
