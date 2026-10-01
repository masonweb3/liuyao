import { describe, expect, it } from "vitest";
import { guaPath } from "../data/gua-slugs.js";
import { related } from "./gua.js";
import { cast } from "./liuyao/najia.js";
import { byNumbers, byTime, fromSums, type Meihua, moment } from "./meihua.js";

/** 北京时间某个时辰里的一刻；日期随意，数字起卦只看时辰。 */
const at = (hhmm: string, day = "2026-10-01") => new Date(`${day}T${hhmm}:00+08:00`);

/**
 * 《梅花易数》卷一的卦例（维基文库本），只取起卦的数和卦名，论断不抄。
 * 时间起卦的两例换成真实的日子：甲辰年腊月十七是 2025-01-16，乙巳年三月十六是 2025-04-13。
 * 体、用写经卦名；互卦、变卦写卦全名。
 */
const CASES: [name: string, m: Meihua, ben: string, dong: number, hu: string, bian: string, ti: string, yong: string][] = [
	// 辰年五数，十二月十二数，十七日十七数……加申时九数……是为泽火革。初爻变咸，互见乾巽。
	["观梅占", byTime(at("16:00", "2025-01-16")), "泽火革", 1, "天风姤", "泽山咸", "兑", "离"],
	// 巳年六数，三月三数，十六日十六数……卯时四数……得天风姤……五爻动，变鼎卦，互见重乾。
	["牡丹占", byTime(at("06:00", "2025-04-13")), "天风姤", 5, "乾为天", "火风鼎", "巽", "乾"],
	// 一声属乾为上卦，五声属巽为下卦……加酉时数共得十六数……第四爻变巽卦，互见重乾。
	["邻夜扣门借物占", byNumbers([1, 5], at("18:00")), "天风姤", 4, "乾为天", "巽为风", "巽", "乾"],
	// 乾一巽五之数，加卯时四数，总十数，除六得四为动爻，是为天风姤之九四。
	["老人有忧色占", byNumbers([1, 5], at("06:30")), "天风姤", 4, "乾为天", "巽为风", "巽", "乾"],
	// 艮七离三加午时七，总十七数，除十二，余五为动爻……卦则贲之家人，互见震、坎，离为体。
	["少年有喜色占", byNumbers([7, 3], at("12:00")), "山火贲", 5, "雷水解", "风火家人", "离", "艮"],
	// 坎六坤八，加午时七，共二十一数……三爻动得地水师之三爻……师变升，互坤、震，乃坤为体。
	["牛哀鸣占", byNumbers([8, 6], at("11:00")), "地水师", 3, "地雷复", "地风升", "坤", "坎"],
	// 巽五乾一共六数，加卯时四数，总十数，除六得四，爻动变乾，是为小畜之六四……互见离、兑。乾金为体。
	["鸡悲鸣占", byNumbers([5, 1], at("05:00")), "风天小畜", 4, "火泽睽", "乾为天", "乾", "巽"],
	// 兑二离三，加辰时五数，总十数，去六余四，变山泽损，是睽之九四……互见坎、离，兑金为体。
	["枯枝坠地占", byNumbers([3, 2], at("08:00")), "火泽睽", 4, "水火既济", "山泽损", "兑", "离"],
	// 字画占，动爻不加时：西七画为艮，林八画为坤……总十五画，除二六一十二，余数得三，是山地剥卦。第三爻动，变艮，互见重坤。
	["西林寺牌额占", fromSums(7, 8, 15), "山地剥", 3, "坤为地", "艮为山", "艮", "坤"],
	// 同上，「林」添两勾作十画：除八得二为兑卦，合上艮，是为山泽损。第五爻变，动为中孚卦，互卦见坤、震。
	["西林寺添两勾", fromSums(7, 10, 17), "山泽损", 5, "地雷复", "风泽中孚", "兑", "艮"],
	// 字声占，动爻不加时：今日动共八数，得坤为上卦……静如何共五数，得巽……八五总为十三数……为地风升。初爻动，变泰卦，互见震、兑。
	["今日动静如何", fromSums(8, 5, 13), "地风升", 1, "雷泽归妹", "地天泰", "坤", "巽"],
];

describe("经典卦例", () => {
	it.each(CASES)("%s", (_, m, ben, dong, hu, bian, ti, yong) => {
		expect([m.ben.name, m.dong, m.hu.name, m.bian.name, m.ti.name, m.yong.name]).toEqual([ben, dong, hu, bian, ti, yong]);
	});

	it("观梅占的数：三十四、四十三", () => {
		const m = byTime(at("16:00", "2025-01-16"));
		expect(m.moment).toEqual({ year: "辰", month: 12, leap: false, day: 17, hour: "申" });
		expect(m.sums).toEqual([34, 43, 43]);
	});

	it("牡丹占的数：二十五、二十九", () => {
		const m = byTime(at("06:00", "2025-04-13"));
		expect(m.moment).toEqual({ year: "巳", month: 3, leap: false, day: 16, hour: "卯" });
		expect(m.sums).toEqual([25, 29, 29]);
	});

	it("体用生克与原书论断一致", () => {
		const r = (name: string) => (CASES.find(([n]) => n === name) as (typeof CASES)[number])[1].rel;
		// 兑金为体，离火克之……幸变为艮土，兑金得生
		expect(r("观梅占").yong).toBe("克体");
		expect(r("观梅占").bian).toBe("生体");
		// 巽木为体，乾金克之，互卦又见重乾，克体之卦多矣
		expect(r("牡丹占")).toEqual({ yong: "克体", hu: ["克体", "克体"], bian: "体生" });
		// 乾金为体，离火克之
		expect(r("鸡悲鸣占").hu).toContain("克体");
		// 兑金为体，离火克之
		expect(r("枯枝坠地占").yong).toBe("克体");
		// 卦断遗论：西林寺额得山地剥，体用互变，俱比和
		expect(r("西林寺牌额占")).toEqual({ yong: "比和", hu: ["比和", "比和"], bian: "比和" });
		// 卦断遗论：今日动静……用克体
		expect(r("今日动静如何").yong).toBe("克体");
		// 坤为体，互变俱克之（互卦里的坤与体比和，震克体；用卦坎水反被体克）
		expect(r("牛哀鸣占")).toEqual({ yong: "体克", hu: ["克体", "比和"], bian: "克体" });
	});
});

describe("起卦规则", () => {
	it("余数为零：上下卦作坤，动爻作上爻", () => {
		const m = fromSums(16, 8, 12);
		expect([m.ben.name, m.dong, m.ti.name, m.yong.name]).toEqual(["坤为地", 6, "坤", "坤"]);
		expect(fromSums(8, 8, 6).dong).toBe(6);
		expect(fromSums(9, 9, 7).ben.name).toBe("乾为天");
	});

	it("动爻在下卦则下卦为用，在上卦则上卦为用", () => {
		for (let dong = 1; dong <= 6; dong++) {
			const m = fromSums(1, 8, dong);
			expect(m.ben.name).toBe("天地否");
			expect(m.yong.name).toBe(dong <= 3 ? "坤" : "乾");
			expect(m.ti.name).toBe(dong <= 3 ? "乾" : "坤");
		}
	});

	it("全部 8×8×6 种：变卦只变动爻一爻；互卦除乾、坤外与卦页的 related() 一致；params 交给六爻引擎排出同样的本卦、变卦", () => {
		for (let u = 1; u <= 8; u++)
			for (let l = 1; l <= 8; l++)
				for (let d = 1; d <= 6; d++) {
					const m = fromSums(u, l, d);
					const diff = [...m.ben.mark].filter((b, i) => b !== m.bian.mark[i]).length;
					expect(diff).toBe(1);
					expect(m.ben.mark[d - 1]).not.toBe(m.bian.mark[d - 1]);
					if (m.ben.name !== "乾为天" && m.ben.name !== "坤为地")
						expect(m.hu.name).toBe((related(m.ben.name).find(([k]) => k === "互卦") as [string, string])[1]);
					const r = cast(m.params, { date: at("12:00") });
					expect([r.gua.name, r.bian?.name, r.dong]).toEqual([m.ben.name, m.bian.name, [d - 1]]);
					for (const h of [m.ben, m.hu, m.bian]) expect(guaPath(h.name)).toBe(`/gua/${h.slug}/`);
				}
	});

	it("乾坤无互，互其变卦（卷一「互卦起例」）", () => {
		// 乾三爻动变天泽履，履的互卦是风火家人；卦页上乾的互卦仍是乾为天
		expect(fromSums(1, 1, 3).hu.name).toBe("风火家人");
		expect(fromSums(8, 8, 2).hu.name).toBe((related("地水师").find(([k]) => k === "互卦") as [string, string])[1]);
		expect(related("乾为天").find(([k]) => k === "互卦")?.[1]).toBe("乾为天");
	});

	it("一个数：此数为上卦，加时为下卦与动爻", () => {
		// 七声，午时（七）：上艮；十四，下坎；十四除六余二
		const m = byNumbers([7], at("12:00"));
		expect(m.sums).toEqual([7, 14, 14]);
		expect([m.ben.name, m.dong]).toEqual(["山水蒙", 2]);
	});

	it("起卦的数只收正整数，一个或两个", () => {
		const noon = at("12:00");
		for (const bad of [0, -3, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 2 ** 53]) {
			expect(() => byNumbers([bad], noon)).toThrow();
			expect(() => byNumbers([3, bad], noon)).toThrow();
		}
		expect(() => byNumbers([], noon)).toThrow();
		expect(() => byNumbers([1, 2, 3], noon)).toThrow();
		expect(() => fromSums(0, 1, 1)).toThrow();
		expect(byNumbers([2 ** 40, 3], noon).ben.name).toBe("地火明夷"); // 大数照样除：2^40 除八余零作坤
	});
});

describe("时刻", () => {
	it("按北京时间：同一刻用 UTC 写也一样", () => {
		expect(byTime(new Date("2025-01-16T08:00:00Z"))).toEqual(byTime(at("16:00", "2025-01-16")));
		// 北京 01:30 是丑时，UTC 那天还是前一天 17:30
		expect(moment(new Date("2025-01-15T17:30:00Z")).hour).toBe("丑");
		expect(moment(new Date("2025-01-15T17:30:00Z")).day).toBe(17);
	});

	it("时辰交界：23 点起子时，1 点起丑时，11 点起午时", () => {
		const h = (hhmm: string) => moment(at(hhmm, "2025-01-16")).hour;
		expect([h("22:59"), h("23:00"), h("00:59"), h("01:00"), h("10:59"), h("11:00")]).toEqual([
			"亥",
			"子",
			"子",
			"丑",
			"巳",
			"午",
		]);
	});

	it("年支按农历年，不按立春：2024-02-05 已过立春、未到春节，仍是卯年", () => {
		const m = moment(at("12:00", "2024-02-05"));
		expect([m.year, m.month, m.day]).toEqual(["卯", 12, 26]);
		// 春节当天换年
		expect(moment(at("12:00", "2025-01-29")).year).toBe("巳");
		expect(moment(at("12:00", "2025-01-28")).year).toBe("辰");
	});

	it("闰月按本月数：2025 年闰六月", () => {
		const m = moment(at("12:00", "2025-08-01"));
		expect([m.month, m.leap, m.day]).toEqual([6, true, 8]);
		const plain = moment(at("12:00", "2025-07-01"));
		expect([plain.month, plain.leap]).toEqual([6, false]);
		// 闰六月初八与六月初八起出同一卦（同一时辰）
		expect(byTime(at("12:00", "2025-08-01")).ben).toEqual(byTime(at("12:00", "2025-07-02")).ben);
	});

	it("晚子时：默认不换日；选「算次日」时，除夕 23:30 成了新年正月初一", () => {
		const eve = at("23:30", "2025-01-28"); // 甲辰年腊月廿九，这年没有三十
		expect(moment(eve)).toEqual({ year: "辰", month: 12, leap: false, day: 29, hour: "子" });
		expect(moment(eve, "day-advances")).toEqual({ year: "巳", month: 1, leap: false, day: 1, hour: "子" });
		// 子时的另一半（0 点后）两种都是次日
		expect(moment(at("00:30", "2025-01-29"))).toEqual(moment(eve, "day-advances"));
		expect(byTime(eve).sums).toEqual([5 + 12 + 29, 5 + 12 + 29 + 1, 5 + 12 + 29 + 1]);
	});
});
