import { describe, expect, it } from "vitest";
import { SPECIAL, TEMPLATES } from "../data/templates.js";
import yaoBaihua from "../data/yao-baihua.json" with { type: "json" };
import { cast } from "./liuyao/najia.js";
import { compose } from "./reading.js";

const at = (iso: string) => ({ date: new Date(`${iso}+08:00`) });
const YAO: Record<string, Record<string, string>> = yaoBaihua;

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

	it("本卦、变卦链到各自的卦页", () => {
		expect(x.ben.href).toBe("/gua/dui-wei-ze/");
		expect(x.bian?.href).toBe("/gua/tian-shui-song/");
	});

	it("卦名、卦辞、动爻都用站酷小薇", () => {
		expect([x.ben.font, x.ben.ciFont, x.dong.font]).toEqual(["--font-display", "--font-display", "--font-display"]);
	});

	it("两爻齐动，以上爻为主", () => {
		expect(x.dong.heading).toBe("动爻 · 两爻齐动，以上爻为主");
		expect(x.dong.lines).toEqual([
			{ title: "上六", text: "引兑。", main: true },
			{ title: "初九", text: "和兑，吉。", main: false },
		]);
	});

	it("兑卦的爻辞白话还没写：不带白话", () => {
		expect(x.dong.lines.map((l) => l.baihua)).toEqual([undefined, undefined]);
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
		expect(x.dong).toEqual({ heading: "静卦", lines: [], note: SPECIAL.jingGua, font: "--font-display" });
	});

	it("乾坤六爻皆动，占用九、用六，带各自的白话", () => {
		const qian = compose(cast([9, 9, 9, 9, 9, 9]), { topic: "自身" });
		expect(qian.dong.lines).toEqual([
			{ title: "用九", text: "见群龙无首，吉。", main: true, baihua: YAO.乾为天?.用九 },
		]);
		expect(qian.dong.note).toBe(SPECIAL.yongJiu);
		const kun = compose(cast([6, 6, 6, 6, 6, 6]), { topic: "自身" });
		expect(kun.dong.lines).toEqual([{ title: "用六", text: "利永贞。", main: true, baihua: YAO.坤为地?.用六 }]);
		expect([qian, kun].map((x) => x.dong.lines[0]?.baihua)).not.toContain(undefined);
	});

	it("他卦六爻皆动，以变卦卦辞为归", () => {
		const x = compose(cast([9, 6, 9, 6, 9, 6]), { topic: "自身" });
		expect(x.dong).toEqual({ heading: "动爻 · 六爻皆动", lines: [], note: SPECIAL.quanDong, font: "--font-display" });
	});

	it("站酷小薇缺字：卦名、卦辞各自整块改宋体，动爻几条算一块", () => {
		// 天风姤，初六（系于金柅，「柅」小薇没有）与九二（包有鱼…）齐动
		const x = compose(cast([6, 9, 7, 7, 7, 7]), { topic: "自身" });
		expect(x.ben).toMatchObject({ name: "天风姤", short: "姤", font: "--font-body", ciFont: "--font-body" });
		expect(x.bian).toMatchObject({ name: "天火同人", font: "--font-display", ciFont: "--font-display" });
		expect(x.dong.lines.map((l) => l.title)).toEqual(["九二", "初六"]);
		expect(x.dong.font).toBe("--font-body");
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

describe("爻辞白话", () => {
	it("单个动爻带出这一爻的白话：屯卦初九", () => {
		const x = compose(cast([9, 8, 8, 8, 7, 8]), { topic: "自身" });
		expect(x.ben.name).toBe("水雷屯");
		expect(x.dong.lines).toEqual([
			{ title: "初九", text: "磐桓，利居贞，利建侯。", main: false, baihua: YAO.水雷屯?.初九 },
		]);
	});

	it("阴爻动取「六」字爻题的白话：屯卦六三", () => {
		const x = compose(cast([7, 8, 6, 8, 7, 8]), { topic: "自身" });
		expect(x.dong.lines.map((l) => [l.title, l.baihua])).toEqual([["六三", YAO.水雷屯?.六三]]);
	});

	it("两爻齐动各带各的白话：讼卦九二、上九", () => {
		const x = compose(cast([8, 9, 8, 7, 7, 9]), { topic: "自身" });
		expect(x.ben.name).toBe("天水讼");
		expect(x.dong.lines.map((l) => [l.title, l.main, l.baihua])).toEqual([
			["上九", true, YAO.天水讼?.上九],
			["九二", false, YAO.天水讼?.九二],
		]);
	});

	it("乾卦不是六爻全动时，不带用九", () => {
		const x = compose(cast([9, 7, 7, 7, 7, 9]), { topic: "自身" });
		expect(x.dong.lines.map((l) => l.title)).toEqual(["上九", "初九"]);
		expect(x.dong.lines.map((l) => l.baihua)).toEqual([YAO.乾为天?.上九, YAO.乾为天?.初九]);
	});

	it("静卦没有动爻，也就没有爻辞白话", () => {
		expect(compose(cast([7, 8, 8, 8, 7, 8]), { topic: "自身" }).dong.lines).toEqual([]);
	});
});
