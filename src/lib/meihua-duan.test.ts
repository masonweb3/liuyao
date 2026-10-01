import { describe, expect, it } from "vitest";
import { byNumbers, byTime, fromSums, type Meihua } from "./meihua.js";
import { duan, tiYong, type Verdict } from "./meihua-duan.js";

const at = (hhmm: string, day = "2026-10-01") => new Date(`${day}T${hhmm}:00+08:00`);
const el = (t: { name: string; element: string }) => `${t.name}${t.element}`;
const verdictOf = (m: Meihua) => duan((tiYong(m.params) as NonNullable<ReturnType<typeof tiYong>>).rel);

describe("体用生克只看本卦六爻", () => {
	it("全部 8×8×6 种：体、用、互卦两经卦、变卦经卦与生克都和引擎一样", () => {
		for (let u = 1; u <= 8; u++)
			for (let l = 1; l <= 8; l++)
				for (let d = 1; d <= 6; d++) {
					const m = fromSums(u, l, d);
					const t = tiYong(m.params);
					expect(t).not.toBeNull();
					if (!t) continue;
					expect([el(t.ti), el(t.yong)]).toEqual([`${m.ti.name}${m.ti.element}`, `${m.yong.name}${m.yong.element}`]);
					expect(t.hu.map((h) => h.name)).toEqual([m.hu.lower.name, m.hu.upper.name]);
					expect(t.bian.name).toBe((d <= 3 ? m.bian.lower : m.bian.upper).name);
					expect(t.rel).toEqual(m.rel);
				}
	});

	it("不是恰好一爻动就不判", () => {
		expect(tiYong([7, 7, 7, 7, 7, 7])).toBeNull();
		expect(tiYong([9, 6, 7, 7, 7, 7])).toBeNull();
		expect(tiYong([9, 7, 7])).toBeNull();
	});
});

describe("吉凶（M21-5 A，三层）", () => {
	// 原书 10 个有结局的卦例（docs/review-m21/engine.md M21-5）：规则判的、原书结局判作的吉凶
	const CASES: [string, Meihua, Verdict, Verdict][] = [
		["观梅占", byTime(at("16:00", "2025-01-16")), "平", "平"], // 女子伤股，不至凶危
		["牡丹占", byTime(at("06:00", "2025-04-13")), "凶", "凶"], // 为马所践毁
		["少年有喜色占", byNumbers([7, 3], at("12:00")), "吉", "吉"], // 定亲
		["西林寺添两勾", fromSums(7, 10, 17), "吉", "吉"], // 为吉卦
		["老人有忧色占", byNumbers([1, 5], at("06:30")), "凶", "凶"], // 第三层：用、互俱克体
		["牛哀鸣占", byNumbers([8, 6], at("11:00")), "凶", "凶"], // 第三层：互下、变克体
		["鸡悲鸣占", byNumbers([5, 1], at("05:00")), "吉", "凶"], // 原书兼看爻辞
		["枯枝坠地占", byNumbers([3, 2], at("08:00")), "平", "凶"], // 原书兼看卦名
		["西林寺牌额占", fromSums(7, 8, 15), "吉", "凶"], // 卦断遗论：不拘体用
		["今日动静如何", fromSums(8, 5, 13), "凶", "平"], // 同上，有人相请、酒食不丰
	];

	it.each(CASES)("%s：规则判 %s", (_, m, rule) => {
		expect(verdictOf(m)).toBe(rule);
	});

	it("与原书结局对上 6 例（两层只有 4 例）", () => {
		expect(CASES.filter(([, m, , book]) => verdictOf(m) === book)).toHaveLength(6);
	});

	it("两层：用吉变凶、用凶变吉为平，用平随变卦", () => {
		const r = (yong: string, bian: string, hu: [string, string] = ["比和", "比和"]) =>
			duan({ yong, hu, bian } as Parameters<typeof duan>[0]);
		expect(r("生体", "克体")).toBe("平");
		expect(r("克体", "生体")).toBe("平");
		expect(r("体生", "体克")).toBe("吉");
		expect(r("体生", "克体", ["生体", "比和"])).toBe("凶");
		expect(r("比和", "体生")).toBe("吉");
		expect(r("克体", "体生", ["生体", "比和"])).toBe("凶");
		// 第三层：克体两处以上又无生体为凶，有生体就照两层
		expect(r("体克", "克体", ["克体", "比和"])).toBe("凶");
		expect(r("克体", "生体", ["克体", "比和"])).toBe("平");
	});

	it("384 种起法的分布：吉 222、平 77、凶 85（与 engine.md 的试算相同）", () => {
		const n = { 吉: 0, 平: 0, 凶: 0 };
		for (let u = 1; u <= 8; u++) for (let l = 1; l <= 8; l++) for (let d = 1; d <= 6; d++) n[verdictOf(fromSums(u, l, d))]++;
		expect(n).toEqual({ 吉: 222, 平: 77, 凶: 85 });
	});
});
