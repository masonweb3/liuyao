import { SolarDay, SolarTerm } from "tyme4ts";
import { describe, expect, it } from "vitest";
import { GUA } from "../data/gua-slugs.js";
import { beijingYmd, dailyGua, huangli } from "./huangli.js";
import { ganzhiFromDate } from "./liuyao/calendar.js";

// 期望值是 tyme4ts 的输出，逐项与黄历网（huangli.com）同日的页面核过（2026-10-01）：
// 宜、忌、值神、建除、纳音、彭祖、冲煞十天全同（对方宜忌、神煞最多只显示 9 项，核的是前 9 项）。
// 吉神凶煞有五天不同，都是农历月与节月不一致的日子：对方按农历月查同一张神煞表（用农历月重查能逐字复现它），
// 按《协纪辨方书》神煞随月建、月建以节为界，这里的是对的；对方的列表也和它自己的值神、建除对不上。
// 日家九星对方不给。

describe("黄历的一天", () => {
	it("寒露当天（2026-10-08，14:29 交节）：整天算戌月", () => {
		expect(huangli(2026, 10, 8)).toEqual({
			date: "2026-10-08",
			week: "四",
			lunar: { year: "丙午", zodiac: "马", month: "八月", leap: false, day: "廿八" },
			ganzhi: { year: "丙午", month: "戊戌", day: "乙卯" },
			nayin: "大溪水",
			yi: ["祭祀", "入殓", "移柩", "开生坟", "破土", "启钻", "安葬", "除服", "成服", "馀事勿取"],
			ji: [],
			chong: { zodiac: "鸡", ganzhi: "己酉", sha: "西" },
			duty: "执",
			star: { name: "勾陈", ecliptic: "黑道" },
			gods: { ji: ["六合", "圣心", "五合", "鸣吠对"], xiong: ["大时", "大败", "咸池", "小耗", "四废", "五虚", "勾陈"] },
			pengzu: ["乙不栽植千株不长", "卯不穿井水泉不香"],
			nineStar: "六白金",
			term: { name: "寒露", day: 0, time: "14:29" },
			nextTerm: { name: "霜降", date: "2026-10-23" },
		});
	});

	it("正月初一（2026-02-17）", () => {
		expect(huangli(2026, 2, 17)).toEqual({
			date: "2026-02-17",
			week: "二",
			lunar: { year: "丙午", zodiac: "马", month: "正月", leap: false, day: "初一" },
			ganzhi: { year: "丙午", month: "庚寅", day: "壬戌" },
			nayin: "大海水",
			yi: ["祭祀", "塞穴", "结网", "破土", "谢土", "安葬", "移柩", "除服", "成服", "馀事勿取"],
			ji: ["嫁娶", "入宅"],
			chong: { zodiac: "龙", ganzhi: "丙辰", sha: "北" },
			duty: "成",
			star: { name: "司命", ecliptic: "黄道" },
			gods: { ji: ["天德合", "月空", "阳德", "三合", "天喜", "天医", "司命"], xiong: ["月厌", "地火", "四击", "大煞"] },
			pengzu: ["壬不泱水更难提防", "戌不吃犬作怪上床"],
			nineStar: "五黄土",
			term: { name: "立春", day: 13 },
			nextTerm: { name: "雨水", date: "2026-02-18" },
		});
	});

	it("交节日换月建，建除与前一天重复；起卦按精确时刻，交节前仍是上个月", () => {
		const before = huangli(2026, 10, 7);
		const day = huangli(2026, 10, 8);
		expect(before.ganzhi.month).toBe("丁酉");
		expect(day.ganzhi.month).toBe("戊戌");
		expect(before.duty).toBe(day.duty);
		expect(before.term).toEqual({ name: "秋分", day: 14 });
		// 同一天上午 10 点（北京时间）起卦，月柱还是丁酉
		expect(ganzhiFromDate(new Date("2026-10-08T02:00:00Z")).month).toBe("丁酉");
	});

	it("立春（2027-02-04 09:46）换年柱；农历年要到春节才换", () => {
		const eve = huangli(2027, 2, 3);
		const day = huangli(2027, 2, 4);
		expect(eve.ganzhi).toEqual({ year: "丙午", month: "辛丑", day: "癸丑" });
		expect(day.ganzhi).toEqual({ year: "丁未", month: "壬寅", day: "甲寅" });
		expect(day.lunar).toEqual({ year: "丙午", zodiac: "马", month: "十二月", leap: false, day: "廿八" });
		expect(day.term).toEqual({ name: "立春", day: 0, time: "09:46" });
		expect(eve.duty).toBe("建");
		expect(day.duty).toBe("建");
		expect(day.ji).toEqual(["诸事不宜"]);
	});

	it("闰月", () => {
		expect(huangli(2025, 8, 10).lunar).toEqual({ year: "乙巳", zodiac: "蛇", month: "闰六月", leap: true, day: "十七" });
		expect(huangli(2025, 7, 24).lunar.month).toBe("六月");
		expect(huangli(2025, 7, 25).lunar.month).toBe("闰六月");
	});

	it("所冲之日：天干隔四位、地支相冲", () => {
		expect(huangli(2025, 8, 10).chong).toEqual({ zodiac: "蛇", ganzhi: "乙巳", sha: "西" }); // 辛亥日
		expect(huangli(2026, 10, 1).chong).toEqual({ zodiac: "虎", ganzhi: "壬寅", sha: "南" }); // 戊申日
	});

	it("时间窗首尾（前后各一年）", () => {
		const first = huangli(2025, 10, 1);
		expect(first.ganzhi).toEqual({ year: "乙巳", month: "乙酉", day: "癸卯" });
		expect([first.duty, first.star.name, first.nineStar]).toEqual(["破", "明堂", "九紫火"]);
		const last = huangli(2027, 10, 1);
		expect(last.ganzhi).toEqual({ year: "丁未", month: "己酉", day: "癸丑" });
		expect([last.duty, last.star.name, last.nineStar]).toEqual(["定", "勾陈", "八白土"]);
	});

	it("窗内每一天：建除只在交「节」那天与前一天重复（气不换月建）", () => {
		let d = SolarDay.fromYmd(2025, 10, 1);
		let prev = huangli(2025, 9, 30);
		let repeats = 0;
		for (; !d.isAfter(SolarDay.fromYmd(2027, 10, 1)); d = d.next(1)) {
			const h = huangli(d.getYear(), d.getMonth(), d.getDay());
			const jie = h.term.day === 0 && SolarTerm.fromName(d.getYear(), h.term.name).isJie();
			expect(h.duty === prev.duty, h.date).toBe(jie);
			if (jie) repeats++;
			prev = h;
		}
		expect(repeats).toBe(24);
	});
});

describe("今日读一卦", () => {
	it("按卦序一天一卦，2026-01-01 读乾，64 天一轮", () => {
		expect(dailyGua(2026, 1, 1)).toEqual({ name: "乾为天", slug: "qian-wei-tian" });
		expect(dailyGua(2026, 1, 2).name).toBe("坤为地");
		expect(dailyGua(2025, 12, 31).name).toBe("火水未济");
		expect(dailyGua(2026, 3, 6).name).toBe("乾为天");
		const seen = new Set<string>();
		for (let d = SolarDay.fromYmd(2027, 5, 1), i = 0; i < 64; i++, d = d.next(1)) {
			seen.add(dailyGua(d.getYear(), d.getMonth(), d.getDay()).name);
		}
		expect(seen.size).toBe(GUA.length);
	});
});

describe("北京时间的今天", () => {
	it("按 UTC+8 换日，与本机时区无关", () => {
		expect(beijingYmd(new Date("2026-09-30T15:59:59Z"))).toEqual([2026, 9, 30]);
		expect(beijingYmd(new Date("2026-09-30T16:00:00Z"))).toEqual([2026, 10, 1]);
	});
});
