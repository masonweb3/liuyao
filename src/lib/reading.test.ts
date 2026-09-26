import { describe, expect, it } from "vitest";
import { SPECIAL, TEMPLATES } from "../data/templates.js";
import { cast } from "./liuyao/najia.js";
import { compose } from "./reading.js";

const at = (iso: string) => ({ date: new Date(`${iso}+08:00`) });

describe("卦例 A：亥月己丑日，兑为泽之天水讼，问事业", () => {
	const x = compose(cast([9, 7, 8, 7, 7, 6], at("2022-12-02T10:00:00")), { topic: "事业" });

	it("断语取自模板", () => {
		expect(x.verdict).toBe("吉");
		expect(x.conclusion).toBe(TEMPLATES.事业.吉.conclusion);
		expect(x.advice).toEqual(TEMPLATES.事业.吉.advice);
		expect(x.basis).toBe("所问属「事业」，以官鬼为用神。");
		expect(x.note).toBe("");
		expect(x.reasons[0]).toBe("用神官鬼巳火，初爻发动");
	});

	it("卦辞整行原文，附白话", () => {
		expect(x.ben).toMatchObject({ short: "兑", ci: "兑：亨。利贞。" });
		expect(x.ben.baihua).toMatch(/^兑，是/);
		expect(x.bian?.short).toBe("讼");
	});

	it("两爻齐动，以上爻为主", () => {
		expect(x.dong.heading).toBe("动爻 · 两爻齐动，以上爻为主");
		expect(x.dong.lines).toEqual([
			{ title: "上六", text: "引兑。", main: true },
			{ title: "初九", text: "和兑，吉。", main: false },
		]);
	});

	it("完整盘面", () => {
		const p = x.panel;
		expect(p).toMatchObject({
			pillars: "壬寅 辛亥 己丑 己巳",
			kong: "午未",
			yue: "亥水",
			ri: "丑土",
			ben: "兑宫金 · 八纯 · 六冲",
			bian: "离宫火 · 游魂",
			fu: "无（六亲俱全）",
		});
		expect(p.rows.map((r) => r.title)).toEqual(["上六", "九五", "九四", "六三", "九二", "初九"]);
		expect(p.rows[0]).toEqual({
			title: "上六",
			god: "勾陈",
			qin: "父母",
			gz: "丁未土",
			yang: false,
			moving: true,
			shiYing: "世",
			yong: false,
			bian: { qin: "父母", gz: "壬戌土", hua: "化进神" },
		});
		expect(p.rows[3]?.shiYing).toBe("应");
		expect(p.rows[4]?.bian).toBeNull();
		expect(p.rows[5]).toMatchObject({ qin: "官鬼", gz: "丁巳火", yong: true, bian: { qin: "妻财", gz: "戊寅木", hua: "回头生" } });
	});
});

describe("特殊卦形", () => {
	it("静卦：无变卦，以本卦卦辞为主", () => {
		const x = compose(cast([7, 7, 7, 7, 7, 7]), { topic: "自身" });
		expect(x.bian).toBeNull();
		expect(x.panel.bian).toBeNull();
		expect(x.dong).toEqual({ heading: "静卦", lines: [], note: SPECIAL.jingGua });
	});

	it("乾坤六爻皆动，占用九、用六", () => {
		const qian = compose(cast([9, 9, 9, 9, 9, 9]), { topic: "自身" });
		expect(qian.dong.lines).toEqual([{ title: "用九", text: "见群龙无首，吉。", main: true }]);
		expect(qian.dong.note).toBe(SPECIAL.yongJiu);
		const kun = compose(cast([6, 6, 6, 6, 6, 6]), { topic: "自身" });
		expect(kun.dong.lines).toEqual([{ title: "用六", text: "利永贞。", main: true }]);
	});

	it("他卦六爻皆动，以变卦卦辞为归", () => {
		const x = compose(cast([9, 6, 9, 6, 9, 6]), { topic: "自身" });
		expect(x.dong).toEqual({ heading: "动爻 · 六爻皆动", lines: [], note: SPECIAL.quanDong });
	});

	it("三爻以上齐动不标主爻", () => {
		const x = compose(cast([9, 6, 9, 7, 7, 7]), { topic: "自身" });
		expect(x.dong.heading).toBe("动爻 · 三爻齐动");
		expect(x.dong.lines.map((l) => [l.title, l.main])).toEqual([
			["九三", false],
			["六二", false],
			["初九", false],
		]);
	});

	it("卦例 D：用神子孙伏于初爻辰土之下", () => {
		const x = compose(cast([8, 8, 7, 7, 7, 7]), { topic: "子孙" });
		expect(x.basis).toBe("所问属「子女」，以子孙为用神。");
		expect(x.note).toBe(SPECIAL.fuCang);
		expect(x.panel.rows.some((r) => r.yong)).toBe(false);
		expect(x.panel.fu).toBe("子孙 甲子水，伏于初爻 丙辰土下 · 用神；妻财 甲寅木，伏于二爻 丙午火下");
	});

	it("婚恋按性别取用；自身以世爻为用", () => {
		const r = cast([9, 7, 8, 7, 7, 6], at("2022-12-02T10:00:00"));
		expect(compose(r, { topic: "婚恋", gender: "男" }).basis).toBe("所问属「婚恋」，男问以妻财为用神。");
		const self = compose(r, { topic: "自身" });
		expect(self.basis).toBe("所问属「自身」，以世爻为用神。");
		expect(self.panel.rows.findIndex((row) => row.yong)).toBe(0);
	});
});
