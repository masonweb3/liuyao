import { ChildLimit, DefaultChildLimitProvider, EightChar, SixtyCycle } from "tyme4ts";
import { describe, expect, it } from "vitest";
import { type Birth, bazi, equationOfTime, guanXi, type Options, shenSha } from "./bazi.js";

const solar = (y: number, m: number, d: number, h: number, mi: number, gender: Birth["gender"]): Birth => ({
	calendar: "solar",
	year: y,
	month: m,
	day: d,
	hour: h,
	minute: mi,
	gender,
});

// 命例对照（2026-10-01）：易安居（zhouyi.cc/bazi/pp）与元亨利贞（china95.net/paipan/bazi）同一生辰的结果，详见 docs/review-m19/compare.md。
// 四柱、胎元、命宫、大运干支与岁数逐项与易安居一致；元亨利贞的节气表在 2000 年后、1900 年代偏差十几到四十分钟，
// 2025-02-03 22:20 那一例它排成甲辰年（它的立春是 22:27，日本国立天文台是 22:10），其余四柱一致。
// yiAnJu 是易安居的起运（周岁、月、天）与交运月日，对 tyme4ts 的 china95 算法（只算到天）。
const CASES: {
	label: string;
	birth: Birth;
	options?: Options;
	pillars: string;
	taiYuan: string;
	mingGong: string;
	daYun: string;
	startAge: number;
	startYear: number;
	yiAnJu?: [number, number, number, string];
}[] = [
	{ label: "立春前、大寒后", birth: solar(1984, 2, 4, 10, 0, "男"), pillars: "癸亥 乙丑 戊辰 丁巳", taiYuan: "丙辰", mingGong: "癸亥", daYun: "甲子 癸亥 壬戌", startAge: 10, startYear: 1993, yiAnJu: [9, 7, 21, "09-25"] },
	{ label: "立春后两小时", birth: solar(1984, 2, 5, 1, 0, "女"), pillars: "甲子 丙寅 己巳 乙丑", taiYuan: "丁巳", mingGong: "丙寅", daYun: "乙丑 甲子 癸亥", startAge: 1, startYear: 1984, yiAnJu: [0, 0, 8, "02-13"] },
	{ label: "2025 立春前十分钟", birth: solar(2025, 2, 3, 22, 0, "男"), pillars: "甲辰 丁丑 癸卯 癸亥", taiYuan: "戊辰", mingGong: "己巳", daYun: "戊寅 己卯 庚辰", startAge: 1, startYear: 2025, yiAnJu: [0, 0, 0, "02-03"] },
	// 易安居起运 9 岁 10 个月 29 天：它的节气取到分，差两小时进成一天
	{ label: "2025 立春后十分钟", birth: solar(2025, 2, 3, 22, 20, "女"), pillars: "乙巳 戊寅 癸卯 癸亥", taiYuan: "己巳", mingGong: "庚辰", daYun: "己卯 庚辰 辛巳", startAge: 11, startYear: 2035 },
	{ label: "晚子时（换日）", birth: solar(1990, 5, 15, 23, 30, "男"), options: { lateZi: "day-advances" }, pillars: "庚午 辛巳 辛巳 戊子", taiYuan: "壬申", mingGong: "戊子", daYun: "壬午 癸未 甲申", startAge: 8, startYear: 1997, yiAnJu: [7, 1, 6, "06-21"] },
	{ label: "早子时", birth: solar(1990, 5, 16, 0, 30, "女"), pillars: "庚午 辛巳 辛巳 戊子", taiYuan: "壬申", mingGong: "戊子", daYun: "庚辰 己卯 戊寅", startAge: 4, startYear: 1993, yiAnJu: [3, 3, 19, "09-04"] },
	{ label: "农历闰四月", birth: { calendar: "lunar", year: 2020, month: 4, day: 10, hour: 8, minute: 30, leap: true, gender: "男" }, pillars: "庚子 辛巳 乙亥 庚辰", taiYuan: "壬申", mingGong: "甲申", daYun: "壬午 癸未 甲申", startAge: 2, startYear: 2021, yiAnJu: [1, 4, 22, "10-23"] },
	{ label: "1905 年", birth: solar(1905, 7, 8, 6, 15, "女"), pillars: "乙巳 癸未 戊申 乙卯", taiYuan: "甲戌", mingGong: "癸未", daYun: "甲申 乙酉 丙戌", startAge: 11, startYear: 1915, yiAnJu: [10, 5, 8, "12-16"] },
	{ label: "1937 年冬至", birth: solar(1937, 12, 21, 18, 40, "女"), pillars: "丁丑 壬子 壬午 己酉", taiYuan: "癸卯", mingGong: "戊申", daYun: "癸丑 甲寅 乙卯", startAge: 7, startYear: 1943, yiAnJu: [5, 2, 4, "02-25"] },
	{ label: "立冬前十小时", birth: solar(2003, 11, 7, 18, 0, "男"), pillars: "癸未 壬戌 甲申 癸酉", taiYuan: "癸丑", mingGong: "壬戌", daYun: "辛酉 庚申 己未", startAge: 11, startYear: 2013, yiAnJu: [9, 10, 24, "10-01"] },
	// 易安居起运 5 岁 0 个月 12 天：同上，进位差一天
	{ label: "2012 年春分", birth: solar(2012, 3, 20, 14, 45, "女"), pillars: "壬辰 癸卯 庚辰 癸未", taiYuan: "甲午", mingGong: "丁未", daYun: "壬寅 辛丑 庚子", startAge: 6, startYear: 2017 },
];

describe("命例对照", () => {
	for (const c of CASES) {
		it(c.label, () => {
			const r = bazi(c.birth, c.options);
			expect(r.pillars.map((p) => p.ganZhi).join(" ")).toBe(c.pillars);
			expect(r.taiYuan.ganZhi).toBe(c.taiYuan);
			expect(r.mingGong.ganZhi).toBe(c.mingGong);
			expect(r.daYun.slice(0, 3).map((d) => d.ganZhi).join(" ")).toBe(c.daYun);
			expect([r.daYun[0]!.startAge, r.daYun[0]!.startYear]).toEqual([c.startAge, c.startYear]);
			if (c.yiAnJu) {
				const q = bazi(c.birth, { ...c.options, qiYun: "china95" }).qiYun;
				const [y, m, d, at] = c.yiAnJu;
				expect([q.years, q.months, q.days, q.at.slice(5, 10)]).toEqual([y, m, d, at]);
			}
		});
	}

	it("全盘：1984-02-04 10:00 男（藏干十神、星运、纳音、空亡与两站一致；偏印两站写作枭神、枭）", () => {
		const r = bazi(solar(1984, 2, 4, 10, 0, "男"));
		expect(r.solar).toBe("1984-02-04 10:00");
		expect(r.lunar).toBe("甲子年正月初三");
		expect(r.shengXiao).toBe("猪");
		expect(r.pillars).toEqual([
			{ ganZhi: "癸亥", gan: "癸", zhi: "亥", ganWuXing: "水", zhiWuXing: "水", shiShen: "正财", cangGan: [{ gan: "壬", shiShen: "偏财" }, { gan: "甲", shiShen: "七杀" }], xingYun: "绝", ziZuo: "帝旺", naYin: "大海水", kongWang: "子丑", shenSha: [] },
			{ ganZhi: "乙丑", gan: "乙", zhi: "丑", ganWuXing: "木", zhiWuXing: "土", shiShen: "正官", cangGan: [{ gan: "己", shiShen: "劫财" }, { gan: "癸", shiShen: "正财" }, { gan: "辛", shiShen: "伤官" }], xingYun: "养", ziZuo: "衰", naYin: "海中金", kongWang: "戌亥", shenSha: ["天乙贵人", "太极贵人"] },
			{ ganZhi: "戊辰", gan: "戊", zhi: "辰", ganWuXing: "土", zhiWuXing: "土", shiShen: null, cangGan: [{ gan: "戊", shiShen: "比肩" }, { gan: "乙", shiShen: "正官" }, { gan: "癸", shiShen: "正财" }], xingYun: "冠带", ziZuo: "冠带", naYin: "大林木", kongWang: "戌亥", shenSha: ["太极贵人"] },
			{ ganZhi: "丁巳", gan: "丁", zhi: "巳", ganWuXing: "火", zhiWuXing: "火", shiShen: "正印", cangGan: [{ gan: "丙", shiShen: "偏印" }, { gan: "庚", shiShen: "食神" }, { gan: "戊", shiShen: "比肩" }], xingYun: "临官", ziZuo: "帝旺", naYin: "沙中土", kongWang: "子丑", shenSha: ["天乙贵人", "太极贵人", "禄神", "驿马"] },
		]);
		expect(r.wuXing).toEqual({ 木: 1, 火: 2, 土: 3, 金: 0, 水: 2 });
		expect(r.guanXi.map((g) => g.name)).toEqual(["癸戊合火", "亥巳相冲"]);
		expect(r.qiYun).toEqual({ years: 9, months: 7, days: 21, hours: 14, at: "1993-09-26 00:00", forward: false });
		expect(r.daYun).toHaveLength(10);
		expect(r.daYun[9]).toMatchObject({ ganZhi: "乙卯", startAge: 100, startYear: 2083, endYear: 2092 });
	});

	it("起运默认 sect2，与元亨利贞的「出生后几年几月几天几小时、某日某时交运」一致（节气时刻两边相同的几例）", () => {
		const at = (b: Birth, o?: Options) => {
			const q = bazi(b, o).qiYun;
			return [q.years, q.months, q.days, q.hours, q.at.slice(0, 13)];
		};
		expect(at(solar(1984, 2, 4, 10, 0, "男"))).toEqual([9, 7, 21, 14, "1993-09-26 00"]);
		expect(at(solar(1984, 2, 5, 1, 0, "女"))).toEqual([0, 0, 8, 10, "1984-02-13 11"]);
		expect(at(solar(1990, 5, 15, 23, 30, "男"))).toEqual([7, 1, 6, 8, "1997-06-22 07"]);
	});

	it("tyme4ts 的全局起运设置用完还原", () => {
		bazi(solar(1984, 2, 4, 10, 0, "男"), { qiYun: "china95" });
		expect(ChildLimit.provider).toBeInstanceOf(DefaultChildLimitProvider);
	});

	it("流年：每步大运十年，公历年连续，虚岁按出生那年算 1 岁", () => {
		const r = bazi(solar(1984, 2, 4, 10, 0, "男"));
		const years = r.daYun.flatMap((d) => d.liuNian);
		expect(years).toHaveLength(100);
		expect(years.every((n, i) => n.year === 1993 + i && n.age === n.year - 1983)).toBe(true);
		expect(years[0]).toEqual({ year: 1993, age: 10, ganZhi: "癸酉", shiShen: "正财", zhiShiShen: "伤官" });
	});
});

describe("时刻", () => {
	it("AGENTS.md §4.4：2025 立春 22:10 交节，年、月柱按精确时刻换", () => {
		const at = (mi: number) => bazi(solar(2025, 2, 3, 22, mi, "男")).pillars.slice(0, 2).map((p) => p.ganZhi);
		expect(at(0)).toEqual(["甲辰", "丁丑"]);
		expect(at(20)).toEqual(["乙巳", "戊寅"]);
	});

	it("晚子时：默认不换日（与六爻一致），可选换日；时柱都用次日天干起子时", () => {
		const b = solar(1990, 5, 15, 23, 30, "男");
		expect(bazi(b).pillars.slice(2).map((p) => p.ganZhi)).toEqual(["庚辰", "戊子"]);
		expect(bazi(b, { lateZi: "day-advances" }).pillars.slice(2).map((p) => p.ganZhi)).toEqual(["辛巳", "戊子"]);
	});

	it("均时差：十一月初约 +16 分，二月中约 −14 分", () => {
		expect(equationOfTime(Date.UTC(1990, 10, 3, 4, 50))).toBeCloseTo(16.4, 0);
		expect(equationOfTime(Date.UTC(2026, 1, 11, 4))).toBeCloseTo(-14.2, 0);
	});

	it("真太阳时：东经 120 度只差均时差，12:50 校正到 13:06 进未时（元亨利贞同为丁未时）", () => {
		const r = bazi(solar(1990, 11, 3, 12, 50, "男"), { longitude: 120 });
		expect(r.zhenTaiYang).toEqual({ time: "1990-11-03 13:06", minutes: 16.4 });
		expect(r.pillars.map((p) => p.ganZhi)).toEqual(["庚午", "丙戌", "壬申", "丁未"]);
		expect(bazi(solar(1990, 11, 3, 12, 50, "男")).zhenTaiYang).toBeUndefined();
	});

	it("真太阳时只校正日、时柱：立冬 00:23 后出生，校正到前一天 23:06，月柱仍是亥月（元亨利贞排成戌月，见 compare.md）", () => {
		const r = bazi(solar(1990, 11, 8, 1, 0, "男"), { longitude: 87.6, lateZi: "day-advances" });
		expect(r.zhenTaiYang?.time).toBe("1990-11-07 23:06");
		expect(r.pillars.map((p) => p.ganZhi)).toEqual(["庚午", "丁亥", "丁丑", "庚子"]);
		expect(r.qiYun.at).toBe(bazi(solar(1990, 11, 8, 1, 0, "男")).qiYun.at);
	});
});

describe("农历输入", () => {
	it("闰月换成公历，农历写闰", () => {
		const r = bazi({ calendar: "lunar", year: 2020, month: 4, day: 10, hour: 8, minute: 30, leap: true, gender: "男" });
		expect(r.solar).toBe("2020-06-01 08:30");
		expect(r.lunar).toBe("庚子年闰四月初十");
		const plain = bazi({ calendar: "lunar", year: 2020, month: 4, day: 10, hour: 8, minute: 30, gender: "男" });
		expect(plain.solar).toBe("2020-05-02 08:30");
	});

	it("不存在的日子抛错：没有的闰月、小月三十", () => {
		expect(() => bazi({ calendar: "lunar", year: 2021, month: 4, day: 1, hour: 0, minute: 0, leap: true, gender: "女" })).toThrow();
		// 2020 年正月是小月（29 天）
		expect(() => bazi({ calendar: "lunar", year: 2020, month: 1, day: 30, hour: 0, minute: 0, gender: "女" })).toThrow();
	});
});

describe("刑冲合会", () => {
	const names = (gz: string) => guanXi(gz.split(" ")).map((g) => `${g.type}:${g.name}:${g.zhu.join("")}`);

	it("三合凑齐不再列半合；只差一字时列含旺支的半合，不列拱合", () => {
		expect(names("甲申 丙子 戊辰 庚午")).toEqual(["三合:申子辰三合水局:012", "六冲:子午相冲:13"]);
		// 寅申既冲又刑（申刑寅）
		expect(names("甲申 丙子 戊寅 庚午")).toEqual([
			"半合:申子半合水局:01",
			"半合:寅午半合火局:23",
			"六冲:申寅相冲:02",
			"六冲:子午相冲:13",
			"相刑:申寅相刑:02",
		]);
		expect(names("甲申 丙辰 戊寅 庚戌")).toEqual(["六冲:申寅相冲:02", "六冲:辰戌相冲:13", "相刑:申寅相刑:02"]);
	});

	it("三刑凑齐不再列相刑；子卯相刑、自刑、六害", () => {
		expect(names("甲寅 丁巳 戊申 庚子").filter((s) => s.includes("刑"))).toEqual(["三刑:寅巳申三刑:012"]);
		expect(names("甲寅 丁巳 戊子 己卯").filter((s) => s.includes("刑") || s.includes("害"))).toEqual([
			"相刑:寅巳相刑:01",
			"相刑:子卯相刑:23",
			"六害:寅巳相害:01",
		]);
		expect(names("壬辰 癸卯 庚辰 癸未")).toEqual(["半合:卯未半合木局:13", "自刑:辰辰自刑:02", "六害:辰卯相害:01", "六害:卯辰相害:12"]);
	});

	it("天干五合、地支六合、三会", () => {
		expect(names("甲子 己丑 丙寅 辛亥")).toEqual(["天干五合:甲己合土:01", "天干五合:丙辛合水:23", "地支六合:子丑合土:01", "地支六合:寅亥合木:23", "三会:亥子丑三会水局:013"]);
	});
});

describe("神煞", () => {
	it("年支、日支起查的不查自己那一柱：年支午是将星本位，不标在年柱", () => {
		// 庚午 辛巳 庚辰 戊子：日支辰（申子辰）将星在子；年支午（寅午戌）将星在午，即年柱自己
		const gz = ["庚午", "辛巳", "庚辰", "戊子"];
		expect(gz.map((_, k) => shenSha(gz, k))).toEqual([["月德贵人"], ["天德贵人"], ["月德贵人", "魁罡"], ["将星"]]);
	});

	it("天德按月支查干或支，月德按月支三合局查干", () => {
		// 午月天德在亥、月德在丙
		const gz = ["丙寅", "甲午", "癸亥", "壬子"];
		expect(shenSha(gz, 0)).toContain("月德贵人");
		expect(shenSha(gz, 2)).toContain("天德贵人");
	});

	it("只出十三种中性或吉神，不出劫煞、亡神这类凶名", () => {
		const allowed = new Set(["天乙贵人", "太极贵人", "文昌贵人", "天德贵人", "月德贵人", "禄神", "羊刃", "金舆", "驿马", "桃花", "华盖", "将星", "魁罡"]);
		const seen = CASES.flatMap((c) => bazi(c.birth, c.options).pillars.flatMap((p) => p.shenSha));
		expect(seen.every((s) => allowed.has(s))).toBe(true);
		expect(new Set(seen).size).toBeGreaterThan(8);
	});
});

describe("命宫、身宫的排法", () => {
	// 命宫：子上起正月逆数至生月，于生月上起生时顺数至卯（《三命通会·论坐命宫》）。月按节，与 tyme4ts、易安居同。
	// 身宫：子上起正月顺数至生月，于生月上起生时逆数至酉（6tail 的算法；没找到能对照的网页排盘）。
	const Z = "子丑寅卯辰巳午未申酉戌亥";
	it("144 种月、时组合都按上面两句歌诀", () => {
		for (let m = 0; m < 12; m++) {
			for (let h = 0; h < 12; h++) {
				// 正月寅；月柱、时柱的天干不影响宫位的地支，取下标相同的那个干支就行
				const e = new EightChar(SixtyCycle.fromIndex(0), SixtyCycle.fromIndex(m + 2), SixtyCycle.fromIndex(0), SixtyCycle.fromIndex(h));
				const ming = (((-m + 3 - h) % 12) + 12) % 12; // 正月在子（0），逆数 m 位，再顺数到卯：卯时距生时 3 − h 位
				const shen = (((m - (9 - h)) % 12) + 12) % 12; // 正月在子，顺数 m 位，再逆数到酉：酉时距生时 9 − h 位
				expect([e.getOwnSign().getEarthBranch().getName(), e.getBodySign().getEarthBranch().getName()]).toEqual([Z[ming], Z[shen]]);
			}
		}
	});
});
