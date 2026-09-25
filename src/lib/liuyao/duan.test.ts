import { describe, expect, it } from "vitest";
import { duan, huaBian, wangShuai, xunKong } from "./duan.js";
import { cast } from "./najia.js";

const at = (iso: string) => ({ date: new Date(`${iso}+08:00`) });

describe("旺衰", () => {
	it.each([
		// [爻, 月, 日, 动, 有动爻生, score, reasons]
		["卯", "卯", "午", false, false, 2, ["卯木临月建，旺"]],
		["卯", "寅", "午", false, false, 1, ["卯木得寅月扶，旺"]],
		["卯", "子", "午", false, false, 1, ["子月生卯木，相"]],
		["卯", "申", "午", false, false, -1, ["申月克卯木，衰"]],
		["卯", "巳", "午", false, false, 0, ["卯木休于巳月"]],
		["卯", "辰", "午", false, false, 0, ["卯木囚于辰月"]],
		["卯", "酉", "午", false, false, -2, ["酉月冲卯木，月破，静而无援，为真破"]],
		["巳", "亥", "丑", true, false, -1, ["亥月冲巳火，月破；然爻动，非真破"]],
		["卯", "酉", "子", false, false, 0, ["酉月冲卯木，月破；然得日辰生扶，非真破", "子日生卯木"]],
		["卯", "酉", "午", false, true, -1, ["酉月冲卯木，月破；然得动爻相生，非真破"]],
		["卯", "巳", "卯", false, false, 2, ["卯木休于巳月", "卯木临日辰，旺"]],
		["卯", "巳", "寅", false, false, 1, ["卯木休于巳月", "寅日扶卯木"]],
		["卯", "巳", "亥", false, false, 1, ["卯木休于巳月", "亥日生卯木"]],
		["卯", "巳", "申", false, false, -1, ["卯木休于巳月", "申日克卯木"]],
		["卯", "寅", "酉", false, false, 2, ["卯木得寅月扶，旺", "酉日冲卯木，旺而暗动"]],
		["卯", "巳", "酉", false, false, -1, ["卯木休于巳月", "酉日冲卯木，衰而日破"]],
		["卯", "巳", "酉", true, false, -1, ["卯木休于巳月", "酉日冲动爻卯木，冲散"]],
	] as const)("%s爻 %s月 %s日 动=%s", (zhi, yue, ri, dong, helped, score, reasons) => {
		expect(wangShuai(zhi, yue, ri, dong, helped)).toEqual({ score, reasons });
	});
});

describe("旬空", () => {
	it.each([
		["午", "午未", "卯", true, false, 0, ["午火旬空，动不为空"]],
		["午", "午未", "卯", false, true, 0, ["午火旬空，旺不为空"]],
		["午", "午未", "子", false, false, 0, ["午火旬空，逢日冲，冲空则实"]],
		["午", "午未", "卯", false, false, -1, ["午火旬空，静而无气"]],
		["巳", "午未", "卯", false, false, 0, []],
	] as const)("%s in %s 日%s 动=%s 旺=%s", (zhi, kong, ri, dong, wang, score, reasons) => {
		expect(xunKong(zhi, kong, ri, dong, wang)).toEqual({ score, reasons });
	});
});

describe("动变", () => {
	it.each([
		// [爻, 变, 月, 日, 空, 旺, score, reasons]
		["巳", "寅", "亥", "丑", "午未", false, 2, ["巳火化寅木，回头生"]],
		["巳", "子", "卯", "丑", "申酉", false, -2, ["巳火化子水，回头克"]],
		["寅", "卯", "午", "丑", "子丑", false, 1, ["寅木化卯木，化进神"]],
		["卯", "寅", "午", "丑", "子丑", false, -1, ["卯木化寅木，化退神"]],
		["卯", "寅", "午", "丑", "子丑", true, 0, ["卯木化寅木，化退神；旺而暂不退"]],
		// 卦例 B: 戌土月破而化未土旬空.
		["戌", "未", "辰", "子", "午未", false, -1, ["戌土化未土，化退神；逢空破，待填实而退", "变爻未土旬空，化空"]],
		["巳", "子", "午", "丑", "申酉", false, -3, ["巳火化子水，回头克", "变爻子水逢午月冲，化破"]],
	] as const)("%s化%s %s月 %s日", (zhi, bian, yue, ri, kong, wang, score, reasons) => {
		expect(huaBian(zhi, bian, yue, ri, kong, wang)).toEqual({ score, reasons });
	});
});

describe("取用神", () => {
	// 乾为天: 初子孙子水 二妻财寅木 三父母辰土(应) 四官鬼午火 五兄弟申金 上父母戌土(世)
	const qian = cast([7, 7, 7, 7, 7, 7], at("2020-04-25T10:00:00"));

	it.each([
		["财", "妻财", 1],
		["事业", "官鬼", 3],
		["子孙", "子孙", 0],
		["兄弟", "兄弟", 4],
	] as const)("%s -> %s", (topic, qin, pos) => {
		expect(duan(qian, { topic }).yongShen).toEqual({ qin, pos, fu: false });
	});

	it("婚恋：男取妻财，女取官鬼", () => {
		expect(duan(qian, { topic: "婚恋", gender: "男" }).yongShen.qin).toBe("妻财");
		expect(duan(qian, { topic: "婚恋", gender: "女" }).yongShen.qin).toBe("官鬼");
	});

	it("自身取世爻", () => {
		const d = duan(qian, { topic: "自身" });
		expect(d.yongShen).toEqual({ qin: "父母", pos: 5, fu: false });
		expect(d.reasons[0]).toBe("以世爻为用神：父母戌土，上爻安静");
	});

	it("两现皆静，取持世者", () => {
		const d = duan(qian, { topic: "父母" });
		expect(d.yongShen.pos).toBe(5);
		expect(d.reasons).toContain("用神父母两现（三爻、上爻），取上爻");
		expect(d.reasons).toContain("用神持世");
	});

	it("两现取动：卦例 B 取上爻戌土", () => {
		const r = cast([7, 7, 7, 7, 7, 9], at("2020-04-15T10:00:00"));
		expect(duan(r, { topic: "父母" }).yongShen.pos).toBe(5);
	});
});

describe("伏神", () => {
	// 天山遁缺子孙: 子水伏于初爻辰土之下, 辰土克子水.
	const dun = [8, 8, 7, 7, 7, 7];

	it("伏神衰而飞神不空不破，伏而难出", () => {
		const d = duan(cast(dun, at("2020-07-23T10:00:00")), { topic: "子孙" });
		expect(d.yongShen).toEqual({ qin: "子孙", pos: 0, fu: true });
		expect(d.reasons).toEqual([
			"用神子孙不上卦，子水伏于初爻辰土之下",
			"未月克子水，衰",
			"伏神衰弱，伏而难出",
			"飞神辰土克伏",
		]);
	});

	it("伏神旺相，可以得出", () => {
		const d = duan(cast(dun, at("2022-12-10T10:00:00")), { topic: "子孙" });
		expect(d.reasons).toContain("子水临月建，旺");
		expect(d.reasons).toContain("伏神旺相，可以得出");
	});
});

describe("原神、忌神", () => {
	// 乾为天问父母，用神上爻戌土持世: 原神午火, 忌神寅木.
	const date = at("2020-04-25T10:00:00");

	it("忌神发动克用神", () => {
		const d = duan(cast([7, 9, 7, 7, 7, 7], date), { topic: "父母" });
		expect(d.reasons).toContain("忌神妻财寅木发动，克用神");
	});

	it("原神发动生用神；忌神原神同动，连续相生", () => {
		const d = duan(cast([7, 9, 7, 9, 7, 7], date), { topic: "父母" });
		expect(d.reasons).toContain("原神官鬼午火发动，生用神");
		expect(d.reasons).toContain("忌神妻财寅木发动，然原神同动，连续相生");
	});

	it("原神受回头克，生之无力", () => {
		// 问财，用神寅木; 原神子水化丑土.
		const d = duan(cast([9, 7, 7, 7, 7, 7], date), { topic: "财" });
		expect(d.reasons).toContain("原神子孙子水发动，然受回头克，生之无力");
	});
});

// 《增删卜易》卦例，见 docs/research.md §3.4。原文三例结局皆成：
// A 巳年承袭世职；B 卯日得信、未日归家；C 辰年得选。B、C 的「成」出自应期推断
// （MVP 不做应期；B 原文亦言「以古法断，作用神无气」），故只要求不判为凶。
describe("增删卜易卦例", () => {
	it("A: 亥月己丑日占官，兑之讼 —— 官动生世，巳火月破而非真破", () => {
		const d = duan(cast([9, 7, 8, 7, 7, 6], at("2022-12-02T10:00:00")), { topic: "事业" });
		expect(d.reasons).toEqual([
			"用神官鬼巳火，初爻发动",
			"亥月冲巳火，月破；然爻动，非真破",
			"巳火化寅木，回头生",
			"用神发动生世",
		]);
		expect(d.verdict).toBe("吉");
	});

	it("B: 辰月戊子日占父归，乾之夬 —— 父破化空，动而持世", () => {
		const d = duan(cast([7, 7, 7, 7, 7, 9], at("2020-04-15T10:00:00")), { topic: "父母" });
		expect(d.reasons).toContain("辰月冲戌土，月破；然爻动，非真破");
		expect(d.reasons).toContain("戌土化未土，化退神；逢空破，待填实而退");
		expect(d.reasons).toContain("变爻未土旬空，化空");
		expect(d.reasons).toContain("用神持世");
		expect(d.verdict).toBe("平");
	});

	it("C: 未月丁卯日占功名，同人之革 —— 忌神戌土化退神，不克官", () => {
		const d = duan(cast([7, 8, 7, 7, 7, 9], at("2020-07-23T10:00:00")), { topic: "事业" });
		expect(d.reasons).toContain("忌神子孙戌土发动，然化退神，不能克用");
		expect(d.verdict).toBe("平");
	});
});

describe("吉凶", () => {
	it("用神临月建、得日生，吉", () => {
		// 乾为天问财，寅木临寅月，戊子日生之.
		const d = duan(cast([7, 7, 7, 7, 7, 7], at("2020-02-15T10:00:00")), { topic: "财" });
		expect(d.reasons).toEqual(["用神妻财寅木，二爻安静", "寅木临月建，旺", "子日生寅木"]);
		expect(d.verdict).toBe("吉");
	});

	it("静用神月破无援，忌神又动，凶", () => {
		// 乾之大有问财: 申月冲寅木，乙未日无生; 申金发动化未土回头生.
		const d = duan(cast([7, 7, 7, 7, 9, 7], at("2020-08-20T10:00:00")), { topic: "财" });
		expect(d.reasons).toEqual([
			"用神妻财寅木，二爻安静",
			"申月冲寅木，月破，静而无援，为真破",
			"忌神兄弟申金发动，克用神",
		]);
		expect(d.verdict).toBe("凶");
	});
});
