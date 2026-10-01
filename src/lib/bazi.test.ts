import { ChildLimit, DefaultChildLimitProvider, EightChar, SixtyCycle } from "tyme4ts";
import { describe, expect, it } from "vitest";
import { type Birth, bazi, guanXi, type Options, shenSha } from "./bazi.js";
import { equationOfTime, localOffset } from "./bazi-time.js";

const solar = (y: number, m: number, d: number, h: number, mi: number, gender: Birth["gender"]): Birth => ({
	calendar: "solar",
	year: y,
	month: m,
	day: d,
	hour: h,
	minute: mi,
	gender,
});

// 命例对照（2026-10-01；默认选项：晚子时换日、起运 sect2，M19-1、M19-2）：易安居（zhouyi.cc/bazi/pp）与元亨利贞（china95.net/paipan/bazi）同一生辰的结果，详见 docs/review-m19/compare.md。
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
	{ label: "晚子时（默认换日）", birth: solar(1990, 5, 15, 23, 30, "男"), pillars: "庚午 辛巳 辛巳 戊子", taiYuan: "壬申", mingGong: "戊子", daYun: "壬午 癸未 甲申", startAge: 8, startYear: 1997, yiAnJu: [7, 1, 6, "06-21"] },
	// 两站都按换日排；选「仍算当天」时只有日柱不同
	{ label: "晚子时（不换日）", birth: solar(1990, 5, 15, 23, 30, "男"), options: { lateZi: "day-stays" }, pillars: "庚午 辛巳 庚辰 戊子", taiYuan: "壬申", mingGong: "戊子", daYun: "壬午 癸未 甲申", startAge: 8, startYear: 1997 },
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
		expect(r.guanXi.map((g) => g.name)).toEqual(["戊癸合火", "巳亥相冲"]);
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

	it("晚子时：默认换日（M19-1，与六爻的默认不同），可选不换日；时柱都用次日天干起子时", () => {
		const b = solar(1990, 5, 15, 23, 30, "男");
		expect(bazi(b).pillars.slice(2).map((p) => p.ganZhi)).toEqual(["辛巳", "戊子"]);
		expect(bazi(b, { lateZi: "day-stays" }).pillars.slice(2).map((p) => p.ganZhi)).toEqual(["庚辰", "戊子"]);
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
		// 公历、农历都写钟表时刻那一天，不跟着校正退到前一天
		expect([r.solar, r.lunar]).toEqual(["1990-11-08 01:00", "庚午年九月廿二"]);
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

	it("十一月、十二月写冬月、腊月（与黄历同）", () => {
		expect(bazi(solar(1937, 12, 21, 18, 40, "女")).lunar).toBe("丁丑年冬月十九");
		expect(bazi(solar(1938, 1, 10, 12, 0, "女")).lunar).toBe("丁丑年腊月初九");
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
			"六冲:寅申相冲:02",
			"六冲:子午相冲:13",
			"相刑:寅申相刑:02",
		]);
		expect(names("甲申 丙辰 戊寅 庚戌")).toEqual(["六冲:寅申相冲:02", "六冲:辰戌相冲:13", "相刑:寅申相刑:02"]);
	});

	it("三刑凑齐不再列相刑；子卯相刑、自刑、六害", () => {
		expect(names("甲寅 丁巳 戊申 庚子").filter((s) => s.includes("刑"))).toEqual(["三刑:寅巳申三刑:012"]);
		expect(names("甲寅 丁巳 戊子 己卯").filter((s) => s.includes("刑") || s.includes("害"))).toEqual([
			"相刑:寅巳相刑:01",
			"相刑:子卯相刑:23",
			"六害:寅巳相害:01",
		]);
		expect(names("壬辰 癸卯 庚辰 癸未")).toEqual(["半合:卯未半合木局:13", "自刑:辰辰自刑:02", "六害:卯辰相害:01", "六害:卯辰相害:12"]);
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

describe("刑冲合会的写法（M19-15）", () => {
	it("每个关系只有一种写法，与柱序无关：两字按干支序，半合照三合局的次序", () => {
		const names = (gz: string[]) => guanXi(gz).map((g) => g.name).sort();
		for (const c of CASES) {
			const gz = bazi(c.birth, c.options).pillars.map((p) => p.ganZhi);
			expect(names([...gz].reverse()), c.label).toEqual(names(gz));
		}
		expect(guanXi(["丙子", "甲申"]).map((g) => g.name)).toEqual(["申子半合水局"]);
		expect(guanXi(["丙戌", "乙卯"]).map((g) => g.name)).toEqual(["卯戌合火"]);
		expect(guanXi(["丙戌", "乙未"]).map((g) => g.name)).toEqual(["未戌相刑"]);
	});

	it("最密的一盘（甲寅 己巳 甲寅 己巳）12 条，只有 3 个名字", () => {
		const gx = guanXi(["甲寅", "己巳", "甲寅", "己巳"]);
		expect(gx).toHaveLength(12);
		expect([...new Set(gx.map((g) => g.name))]).toEqual(["甲己合土", "寅巳相刑", "寅巳相害"]);
		expect(gx.filter((g) => g.name === "甲己合土").map((g) => g.zhu.join(""))).toEqual(["01", "03", "12", "23"]);
	});
});

describe("出生地的时区与夏令时（M19-5）", () => {
	it("浏览器时区库给出当天的偏移与夏令时：大陆 1988、台湾 1975、香港 1970 的夏令时，南半球，钟表跳过与重复的一小时", () => {
		expect(localOffset("Asia/Shanghai", 1998, 11, 5, 7, 25)).toEqual({ offset: 480, dst: 0 });
		expect(localOffset("Asia/Shanghai", 1988, 7, 1, 7, 30)).toEqual({ offset: 540, dst: 60 });
		expect(localOffset("Asia/Taipei", 1975, 7, 1, 12, 0)).toEqual({ offset: 540, dst: 60 });
		expect(localOffset("Asia/Hong_Kong", 1970, 7, 1, 12, 0)).toEqual({ offset: 540, dst: 60 });
		expect(localOffset("America/Vancouver", 1998, 11, 5, 7, 25)).toEqual({ offset: -480, dst: 0 });
		expect(localOffset("America/Vancouver", 1998, 7, 5, 7, 25)).toEqual({ offset: -420, dst: 60 });
		expect(localOffset("Australia/Sydney", 2000, 1, 15, 12, 0)).toEqual({ offset: 660, dst: 60 });
		expect(localOffset("America/Los_Angeles", 2021, 3, 14, 2, 30).offset).toBe(-480);
		expect(localOffset("America/Los_Angeles", 2021, 11, 7, 1, 30).offset).toBe(-420);
	});

	it("海外出生：年柱、月柱按同一瞬间的北京时间比节气，日柱、时柱按当地钟表", () => {
		// 洛杉矶 2025-02-03 07:00（UTC−8）是北京时间 23:00，已过立春（22:10）
		const la = bazi(solar(2025, 2, 3, 7, 0, "男"), { offset: -480 });
		expect([la.solar, la.beijing]).toEqual(["2025-02-03 07:00", "2025-02-03 23:00"]);
		expect(la.pillars.map((p) => p.ganZhi)).toEqual(["乙巳", "戊寅", "癸卯", "丙辰"]);
		// 同一个钟表时刻在北京还没到立春
		const bj = bazi(solar(2025, 2, 3, 7, 0, "男"));
		expect(bj.pillars.map((p) => p.ganZhi)).toEqual(["甲辰", "丁丑", "癸卯", "丙辰"]);
		expect(bj.beijing).toBeUndefined();
		// 起运按同一瞬间算：与北京时间 23:00 出生的一样
		expect(la.qiYun).toEqual(bazi(solar(2025, 2, 3, 23, 0, "男")).qiYun);
		// 温哥华 1998-11-05 07:25（设计稿 27 ⑤）：北京时间当天 23:25，四柱同北京 07:25 那一盘
		const van = bazi(solar(1998, 11, 5, 7, 25, "女"), { offset: -480 });
		expect(van.beijing).toBe("1998-11-05 23:25");
		expect(van.pillars.map((p) => p.ganZhi)).toEqual(["戊寅", "壬戌", "丙辰", "壬辰"]);
	});

	it("夏令时：日柱、时柱按标准时（钟表拨回一小时），年柱、月柱与起运按真实的瞬间", () => {
		// 大陆 1988-07-01 07:30（夏令时 UTC+9）：标准时 06:30 是卯时，不按钟表的辰时
		const dst = bazi(solar(1988, 7, 1, 7, 30, "女"), { offset: 540, dst: 60 });
		expect(dst.beijing).toBe("1988-07-01 06:30");
		expect(dst.pillars[3]!.zhi).toBe("卯");
		expect(bazi(solar(1988, 7, 1, 7, 30, "女")).pillars[3]!.zhi).toBe("辰");
		expect(dst.qiYun).toEqual(bazi(solar(1988, 7, 1, 6, 30, "女")).qiYun);
		// 温哥华 1998-07-05 07:25（夏令时 UTC−7）：标准时 06:25，卯时
		expect(bazi(solar(1998, 7, 5, 7, 25, "女"), { offset: -420, dst: 60 }).pillars[3]!.zhi).toBe("卯");
	});

	it("海外开真太阳时：按出生地的经度与那一刻的 UTC 偏移校正（夏令时也拨掉）", () => {
		// 温哥华西经 123.1°、UTC−7：太阳时 = 钟表 + (−123.1×4 + 420) 分 + 均时差
		const r = bazi(solar(1998, 7, 5, 12, 0, "男"), { offset: -420, dst: 60, longitude: -123.1 });
		const eot = equationOfTime(Date.UTC(1998, 6, 5, 19, 0));
		expect(r.zhenTaiYang!.minutes).toBeCloseTo(-123.1 * 4 + 420 + eot, 1);
		expect(r.zhenTaiYang!.time).toBe("1998-07-05 10:43");
	});

	it("虚岁按当地的出生年：当地与北京时间不在同一年时，大运岁数与同一年的流年岁数一致", () => {
		// 洛杉矶 1999-12-31 20:00（UTC−8）是北京时间 2000-01-01 12:00；奥克兰 2000-01-01 01:00（UTC+13）是北京时间 1999-12-31 20:00
		for (const [birth, offset] of [[solar(1999, 12, 31, 20, 0, "男"), -480], [solar(2000, 1, 1, 1, 0, "女"), 780]] as const) {
			const r = bazi(birth, { offset });
			for (const d of r.daYun) {
				expect(d.startAge).toBe(d.liuNian[0]!.age);
				expect(d.startAge).toBe(d.startYear - birth.year + 1);
				expect(d.endAge).toBe(d.liuNian[9]!.age);
			}
		}
	});
});

describe("时辰不知道（M19-11）", () => {
	const noHour = { calendar: "solar", year: 1998, month: 11, day: 5, gender: "女" } as const;

	it("只排三柱：命宫、身宫不出；五行、刑冲合会、神煞按三柱；起运按中午估，另给当天 0:00 与 23:59 的范围", () => {
		const r = bazi(noHour);
		expect(r.solar).toBe("1998-11-05");
		expect(r.pillars.map((p) => p.ganZhi)).toEqual(["戊寅", "壬戌", "丙辰"]);
		expect([r.mingGong, r.shenGong, r.zhenTaiYang, r.jie]).toEqual([undefined, undefined, undefined, undefined]);
		expect(r.taiYuan.ganZhi).toBe("癸丑");
		expect(r.wuXing).toEqual({ 木: 1, 火: 1, 土: 3, 金: 0, 水: 1 });
		expect(r.guanXi.map((g) => `${g.name}:${g.zhu.join("")}`)).toEqual(["辰戌相冲:12"]);
		expect(r.pillars.map((p) => p.shenSha)).toEqual([0, 1, 2].map((k) => shenSha(["戊寅", "壬戌", "丙辰"], k)));
		expect([r.qiYun.years, r.qiYun.months, r.qiYun.days]).toEqual([9, 2, 20]);
		expect(r.qiYun.range).toEqual([
			{ years: 9, months: 0, days: 20 },
			{ years: 9, months: 4, days: 20 },
		]);
		// 真太阳时、晚子时都不起作用
		expect(bazi(noHour, { longitude: 104.07, lateZi: "day-stays" }).pillars).toEqual(r.pillars);
	});

	it("出生那天交节：写出是哪个节、几点交节，盘按中午 12 点排", () => {
		const r = bazi({ ...noHour, year: 2025, month: 2, day: 3 });
		expect(r.jie).toEqual({ name: "立春", time: "2025-02-03 22:10" });
		expect(r.pillars.map((p) => p.ganZhi)).toEqual(["甲辰", "丁丑", "癸卯"]);
	});

	it("农历输入也能不填时辰", () => {
		const r = bazi({ calendar: "lunar", year: 2020, month: 4, day: 10, leap: true, gender: "男" });
		expect([r.solar, r.lunar]).toEqual(["2020-06-01", "庚子年闰四月初十"]);
	});
});

describe("农历年与年柱不同（立春换年）", () => {
	it("春节后、立春前：农历已是新年，年柱仍是上一年，给出立春的交节时刻", () => {
		const r = bazi(solar(1984, 2, 4, 10, 0, "男"));
		expect([r.lunar.slice(0, 2), r.pillars[0]!.ganZhi, r.liChun]).toEqual(["甲子", "癸亥", "1984-02-04 23:18"]);
	});

	it("立春后、春节前：年柱已换，农历还是上一年", () => {
		const r = bazi(solar(2021, 2, 8, 10, 0, "女"));
		expect([r.lunar.slice(0, 2), r.pillars[0]!.ganZhi, r.liChun]).toEqual(["庚子", "辛丑", "2021-02-03 22:58"]);
	});

	it("两者相同时不给", () => {
		expect(bazi(solar(1998, 11, 5, 7, 25, "女")).liChun).toBeUndefined();
	});
});
