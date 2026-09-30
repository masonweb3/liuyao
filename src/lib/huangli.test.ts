import { SolarDay, SolarTerm } from "tyme4ts";
import { describe, expect, it } from "vitest";
import { GUA, HANT } from "../data/gua-slugs.js";
import huangliData from "../data/huangli.json" with { type: "json" };
import huangliHant from "../data/huangli-hant.json" with { type: "json" };
import { beijingYmd, days, FIRST, HANT as HANT_DAYS, LAST } from "./huangli-days.js";
import { cn, dailyGua, type Data, houStarts, huangli, show, termFacts, termIn } from "./huangli.js";
import { ganzhiFromDate } from "./liuyao/calendar.js";

// 期望值是 tyme4ts 的输出，逐项与黄历网（huangli.com）同日的页面核过（2026-10-01）：
// 宜、忌、值神、建除、纳音、彭祖、冲煞十天全同（对方宜忌、神煞最多只显示 9 项，核的是前 9 项）。
// 吉神凶煞有五天不同，都是农历月与节月不一致的日子：对方按农历月查同一张神煞表（用农历月重查能逐字复现它），
// 按《协纪辨方书》神煞随月建、月建以节为界，这里的是对的；对方的列表也和它自己的值神、建除对不上。
// 日家九星对方不给；页面也不显示（M17-14）。

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
			term: { name: "寒露", day: 0, time: "14:29", hou: 0 },
			nextTerm: { name: "霜降", date: "2026-10-23", time: "17:37" },
		});
	});

	it("正月初一（2026-02-17）", () => {
		expect(huangli(2026, 2, 17)).toEqual({
			date: "2026-02-17",
			week: "二",
			lunar: { year: "丙午", zodiac: "马", month: "正月", leap: false, day: "初一" },
			festival: "春节",
			ganzhi: { year: "丙午", month: "庚寅", day: "壬戌" },
			nayin: "大海水",
			yi: ["祭祀", "塞穴", "结网", "破土", "谢土", "安葬", "移柩", "除服", "成服", "馀事勿取"],
			ji: ["嫁娶", "入宅"],
			chong: { zodiac: "龙", ganzhi: "丙辰", sha: "北" },
			duty: "成",
			star: { name: "司命", ecliptic: "黄道" },
			gods: { ji: ["天德合", "月空", "阳德", "三合", "天喜", "天医", "司命"], xiong: ["月厌", "地火", "四击", "大煞"] },
			pengzu: ["壬不泱水更难提防", "戌不吃犬作怪上床"],
			term: { name: "立春", day: 13, hou: 2 },
			nextTerm: { name: "雨水", date: "2026-02-18", time: "23:51" },
		});
	});

	it("交节日换月建，建除与前一天重复；起卦按精确时刻，交节前仍是上个月", () => {
		const before = huangli(2026, 10, 7);
		const day = huangli(2026, 10, 8);
		expect(before.ganzhi.month).toBe("丁酉");
		expect(day.ganzhi.month).toBe("戊戌");
		expect(before.duty).toBe(day.duty);
		expect(before.term).toEqual({ name: "秋分", day: 14, hou: 2 });
		// 同一天上午 10 点（北京时间）起卦，月柱还是丁酉
		expect(ganzhiFromDate(new Date("2026-10-08T02:00:00Z")).month).toBe("丁酉");
	});

	it("立春（2027-02-04 09:46）换年柱；农历年要到春节才换", () => {
		const eve = huangli(2027, 2, 3);
		const day = huangli(2027, 2, 4);
		expect(eve.ganzhi).toEqual({ year: "丙午", month: "辛丑", day: "癸丑" });
		expect(day.ganzhi).toEqual({ year: "丁未", month: "壬寅", day: "甲寅" });
		expect(day.lunar).toEqual({ year: "丙午", zodiac: "马", month: "腊月", leap: false, day: "廿八" });
		expect(day.term).toEqual({ name: "立春", day: 0, time: "09:46", hou: 0 });
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

	it("2025-10 与 2027-10（对照用的两年）首尾", () => {
		const first = huangli(2025, 10, 1);
		expect(first.ganzhi).toEqual({ year: "乙巳", month: "乙酉", day: "癸卯" });
		expect([first.duty, first.star.name]).toEqual(["破", "明堂"]);
		const last = huangli(2027, 10, 1);
		expect(last.ganzhi).toEqual({ year: "丁未", month: "己酉", day: "癸丑" });
		expect([last.duty, last.star.name]).toEqual(["定", "勾陈"]);
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

describe("节气页用的交节、三候、节月", () => {
	it("按公历年取交节：冬至在年底（tyme4ts 的节气年从上一年冬至起）", () => {
		expect(termIn(2026, "寒露")).toEqual({ date: "2026-10-08", time: "14:29" });
		expect(termIn(2026, "冬至")).toEqual({ date: "2026-12-22", time: "04:50" });
		expect(termIn(2027, "小寒")).toEqual({ date: "2027-01-05", time: "22:09" });
	});
	it("三候起始日与逐日页的「正当某候」一致", () => {
		const [a, b, c] = houStarts("2026-10-08");
		expect(a).toBe("2026-10-08");
		expect(huangli(...(b!.split("-").map(Number) as [number, number, number])).term.hou).toBe(1);
		expect(huangli(...(c!.split("-").map(Number) as [number, number, number])).term.hou).toBe(2);
		expect(huangli(2026, 10, 13).term.hou).toBe(1);
	});
	it("立春起第几个、黄经、节月", () => {
		expect(termFacts("寒露")).toEqual({ no: 17, season: "秋", inSeason: 5, longitude: 195, month: "九月", jie: true, branch: "戌" });
		expect(termFacts("立春")).toMatchObject({ no: 1, longitude: 315, month: "正月", jie: true, branch: "寅" });
		expect(termFacts("冬至")).toMatchObject({ no: 22, longitude: 270, month: "十一月", jie: false, branch: "子" });
		expect([1, 10, 11, 17, 20, 24].map(cn)).toEqual(["一", "十", "十一", "十七", "二十", "二十四"]);
	});
});

describe("页面上显示的一天", () => {
	const hans = huangliData as Data;
	const hant = huangliHant as unknown as Data;
	it("逐日页的字：冲煞、值神、节气一句", () => {
		const s = show(huangli(2026, 10, 1), hans);
		expect([s.md, s.week, s.lunar, s.ganzhi, s.zodiac]).toEqual(["10月1日", "星期四", "八月廿一", "丙午年 丁酉月 戊申日", "马年"]);
		expect([s.chong, s.duty, s.star, s.nayin]).toEqual(["冲虎（壬寅）煞南", "闭日", "白虎 · 黑道", "大驿土"]);
		expect(s.term).toBe("秋分第 9 天，正当秋分二候「蛰虫坯户」。");
		expect(s.today).toBe("今天是秋分第 9 天。下一个节气寒露，10月8日 14:29 交节。");
		expect(s.gua).toEqual({ name: "山风蛊", slug: "shan-feng-gu" });
		expect(show(huangli(2026, 10, 8), hans).term).toBe("今天 14:29 交节寒露，正当寒露初候「鸿雁来宾」。");
	});
	it("标记词排在词后、不算词；加注词带注", () => {
		const hanlu = show(huangli(2026, 10, 8), hans);
		expect(hanlu.yi.marks).toEqual(["馀事勿取"]);
		expect(hanlu.yi.list.map((w) => w.name)).not.toContain("馀事勿取");
		expect(hanlu.ji).toEqual({ list: [] });
		expect(hanlu.notes).toEqual([]);
		expect(hanlu.markNotes).toEqual(["「馀事勿取」照录旧历原文：除了上面这几件，其余的事都不取。"]);
		const lichun = show(huangli(2027, 2, 4), hans);
		expect(lichun.ji).toEqual({ list: [], marks: ["诸事不宜"] });
		// 宜里两个标记词都有（通行黄历同样照列）：两个都照录；「诸事不宜」前面还有宜事，注不说「没有适宜的事」
		const both = show(huangli(2026, 3, 19), hans);
		expect(both.yi.marks).toEqual(["馀事勿取", "诸事不宜"]);
		expect(both.markNotes[1]).toBe("「诸事不宜」照录旧历原文：除了上面这几件，其余不宜多安排。");
		const song = show(huangli(2026, 10, 6), hans);
		expect(song.ji.list.find((w) => w.key === "词讼")!.note).toBe("law");
		expect(song.notes[0]).toBe(`「词讼」：${hans.note.law}`);
		expect(show(huangli(2026, 10, 25), hans).notes[0]).toMatch(/^「求医」「治病」：/);
	});
	it("繁体：名字走对照表，界面字另写", () => {
		const s = show(huangli(2026, 10, 1), hant);
		expect([s.chong, s.zodiac, s.star]).toEqual(["沖虎（壬寅）煞南", "馬年", "白虎 · 黑道"]);
		expect(s.term).toBe("秋分第 9 天，正當秋分二候「蟄蟲坯戶」。");
		expect(show(huangli(2027, 2, 4), hant).lunar).toBe("臘月廿八");
	});
	it("加注的词：涉医五个接医注，词讼接讼注（M17-10）", () => {
		const flagged = Object.fromEntries(Object.entries(hans.yiji).filter(([, v]) => v.note).map(([k, v]) => [k, v.note]));
		expect(flagged).toEqual({ 求医: "med", 治病: "med", 针灸: "med", 探病: "med", 求医疗病: "med", 词讼: "law" });
	});
	it("彭祖百忌照录，带「药」「词讼」的句子也接注", () => {
		const all = days().map((d) => show(huangli(...(d.split("-").map(Number) as [number, number, number])), hans));
		const med = all.find((s) => s.pengzu.some((p) => p.text === "未不服药毒气入肠"))!;
		expect(med.pengzu.find((p) => p.text === "未不服药毒气入肠")!.note).toBe("med");
		expect(med.pengzuNotes).toContain(`「未不服药毒气入肠」：${hans.note.med}`);
		const law = all.find((s) => s.pengzu.some((p) => p.text === "癸不词讼理弱敌强"))!;
		expect(law.pengzuNotes).toContain(`「癸不词讼理弱敌强」：${hans.note.law}`);
		expect(all.every((s) => s.pengzuNotes.length === s.pengzu.filter((p) => /药|词讼/.test(p.text)).length)).toBe(true);
	});
	it("时间窗是整年（M17-3），逐日页每天都能显示，繁体名字都在对照表里", () => {
		const all = days();
		expect([all[0], all[all.length - 1], all.length]).toEqual([FIRST, LAST, 730]);
		const names = hant.names!;
		const same = /^[甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥]+$/;
		for (const date of all) {
			const h = huangli(...(date.split("-").map(Number) as [number, number, number]));
			const shown = [...h.yi, ...h.ji, ...h.gods.ji, ...h.gods.xiong, ...h.pengzu, h.duty, h.star.name, h.star.ecliptic, h.nayin, h.lunar.month, h.lunar.day, h.lunar.zodiac, h.chong.zodiac, h.chong.sha, h.term.name, h.nextTerm.name, ...(h.festival ? [h.festival] : [])];
			for (const n of shown) if (!same.test(n)) expect(names[n], `${date} ${n}`).toBeDefined();
		}
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

it("繁体网址前缀两处一致（huangli-days.ts 不 import gua-slugs.ts）", () => {
	expect(HANT_DAYS).toBe(HANT);
});

describe("北京时间的今天", () => {
	it("按 UTC+8 换日，与本机时区无关", () => {
		expect(beijingYmd(new Date("2026-09-30T15:59:59Z"))).toEqual([2026, 9, 30]);
		expect(beijingYmd(new Date("2026-09-30T16:00:00Z"))).toEqual([2026, 10, 1]);
	});
});
