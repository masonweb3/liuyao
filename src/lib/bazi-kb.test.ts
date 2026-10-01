import { EarthBranch, HeavenStem, SixtyCycle, SolarTime, TenStar } from "tyme4ts";
import { describe, expect, it } from "vitest";
import namesHant from "../data/bazi-names-hant.json" with { type: "json" };
import rizhuHant from "../data/bazi-rizhu-hant.json" with { type: "json" };
import rizhu from "../data/bazi-rizhu.json" with { type: "json" };
import tianganHant from "../data/bazi-tiangan-hant.json" with { type: "json" };
import tiangan from "../data/bazi-tiangan.json" with { type: "json" };
import huangliHant from "../data/huangli-hant.json" with { type: "json" };
import { type Birth, bazi, guanXi } from "./bazi.js";
import {
	changsheng,
	changshengTable,
	csHead,
	GAN,
	GAN_SLUG,
	ganFacts,
	jieMonth,
	KB_PAGES,
	nayinGroups,
	nayinId,
	nextDays,
	nextHead,
	relations,
	RIZHU_SLUG,
	rizhuFacts,
	rizhuPath,
	sameHead,
	shishenLogic,
	shishenTable,
	SIXTY,
	STEPS,
	tenHead,
	ZHI,
	ZHI_SLUG,
	zhiFacts,
} from "./bazi-kb.js";
import { huangliOf, termIn } from "./huangli.js";
import { FIRST, inWindow, LAST } from "./huangli-days.js";

// 随便几个盘：知识页的表要和排盘页（bazi.ts）查出来的一样
const CHARTS: Birth[] = [
	{ calendar: "solar", year: 1984, month: 2, day: 4, hour: 10, minute: 0, gender: "男" },
	{ calendar: "solar", year: 1990, month: 5, day: 15, hour: 23, minute: 30, gender: "女" },
	{ calendar: "solar", year: 2001, month: 9, day: 9, hour: 14, minute: 5, gender: "男" },
	{ calendar: "solar", year: 1977, month: 12, day: 30, hour: 3, minute: 40, gender: "女" },
	{ calendar: "solar", year: 2012, month: 7, day: 1, hour: 8, minute: 15, gender: "男" },
];

describe("网址", () => {
	it("88 页（第一批 27、第二批六十日柱 61），无调全拼带尾斜杠，不重复", () => {
		expect(KB_PAGES).toHaveLength(88);
		const paths = KB_PAGES.map((p) => p.path);
		expect(new Set(paths).size).toBe(88);
		for (const p of paths) expect(p).toMatch(/^\/bazi\/([a-z]+\/)+$/);
		expect(paths).toContain("/bazi/tiangan/wu/");
		expect(paths).toContain("/bazi/dizhi/wu/");
		expect(paths).toContain("/bazi/rizhu/");
	});

	it("日柱 slug：干的全拼加支的全拼，六十甲子次序，不重复", () => {
		expect(SIXTY).toEqual(SixtyCycle.NAMES);
		expect(new Set(RIZHU_SLUG).size).toBe(60);
		expect([0, 4, 5, 54, 59].map((k) => RIZHU_SLUG[k])).toEqual(["jiazi", "wuchen", "jisi", "wuwu", "guihai"]);
		for (const [k, gz] of SIXTY.entries()) expect(RIZHU_SLUG[k]).toBe(GAN_SLUG[GAN.indexOf(gz[0]!)]! + ZHI_SLUG[ZHI.indexOf(gz[1]!)]!);
		expect(rizhuPath("己巳", true)).toBe("/zh-hant/bazi/rizhu/jisi/");
		expect(KB_PAGES.filter((p) => p.kind === "zhu").map((p) => p.path)).toEqual(SIXTY.map((gz) => rizhuPath(gz)));
	});
});

describe("十神", () => {
	const table = shishenTable();

	it("10×10 每一格都合「五行生克 × 阴阳同异」，5×2 来历表取甲那一行", () => {
		const logic = shishenLogic();
		expect(logic.map((r) => r.same + r.diff).join(" ")).toBe("比肩劫财 食神伤官 偏财正财 七杀正官 偏印正印");
		for (let i = 0; i < 10; i++)
			for (let j = 0; j < 10; j++) {
				// 木火土金水的生序：差 0 同我、1 我生、2 我克、3 克我、4 生我
				const rel = ((((j >> 1) - (i >> 1)) % 5) + 5) % 5;
				expect(table[i]![j], `${GAN[i]}见${GAN[j]}`).toBe(i % 2 === j % 2 ? logic[rel]!.same : logic[rel]!.diff);
			}
	});

	it("与排盘页的十神一致：天干与藏干的十神都按日主查这张表", () => {
		for (const b of CHARTS) {
			const c = bazi(b);
			const me = GAN.indexOf(c.pillars[2]!.gan);
			for (const [k, p] of c.pillars.entries()) {
				if (k !== 2) expect(p.shiShen).toBe(table[me]![GAN.indexOf(p.gan)]);
				for (const h of p.cangGan) expect(h.shiShen).toBe(table[me]![GAN.indexOf(h.gan)]);
			}
		}
	});
});

describe("十二长生", () => {
	it("起点：甲亥、乙午、丙戊寅、丁己酉、庚巳、辛子、壬申、癸卯；阳干顺数，阴干逆数", () => {
		expect(changshengTable().map((r) => r.byStep[0]).join("")).toBe("亥午寅酉寅酉巳子申卯");
		for (const [i, g] of [...GAN].entries()) {
			const steps = changsheng(g).map((z) => ZHI.indexOf(z));
			for (let s = 1; s < 12; s++) expect((steps[s]! - steps[s - 1]! + 12) % 12).toBe(i % 2 ? 11 : 1);
		}
		expect(STEPS[0]).toBe("长生");
		expect(STEPS[11]).toBe("养");
	});

	it("与排盘页的星运、自坐一致", () => {
		for (const b of CHARTS) {
			const c = bazi(b);
			const me = c.pillars[2]!.gan;
			for (const p of c.pillars) {
				expect(p.xingYun).toBe(STEPS[changsheng(me).indexOf(p.zhi)]);
				expect(p.ziZuo).toBe(STEPS[changsheng(p.gan).indexOf(p.zhi)]);
			}
		}
	});
});

describe("纳音", () => {
	const groups = nayinGroups();

	it("30 组，每组两柱同名，五行取末字，锚点不重复", () => {
		expect(groups).toHaveLength(30);
		expect(groups[0]).toMatchObject({ pair: ["甲子", "乙丑"], name: "海中金", wuXing: "金", id: "jiazi" });
		for (const g of groups) expect(SixtyCycle.fromName(g.pair[1]).getSound().getName()).toBe(g.name);
		expect(new Set(groups.map((g) => g.id)).size).toBe(30);
		// 五行各六组
		for (const w of "金木水火土") expect(groups.filter((g) => g.wuXing === w)).toHaveLength(6);
	});

	it("阴干的柱链到它所在那一组：乙丑 #jiazi、乙亥 #jiaxu，不按字面拼", () => {
		expect(nayinId("乙丑")).toBe("jiazi");
		expect(nayinId("乙亥")).toBe("jiaxu");
		expect(nayinId("癸亥")).toBe("renxu");
		const ids = new Set(groups.map((g) => g.id));
		for (let k = 0; k < 60; k++) expect(ids).toContain(nayinId(SixtyCycle.fromIndex(k).getName()));
	});

	it("天干页、地支页的柱与纳音和排盘页一致", () => {
		for (const b of CHARTS)
			for (const p of bazi(b).pillars) {
				const g = ganFacts(p.gan).pillars.find((x) => x.ganZhi === p.ganZhi)!;
				const z = zhiFacts(p.zhi, "2026-10-01 00:00").pillars.find((x) => x.ganZhi === p.ganZhi)!;
				expect(g.naYin).toBe(p.naYin);
				expect(z).toEqual(g);
			}
	});
});

describe("天干", () => {
	it("构成：阴阳五行、方位、相合（写法同排盘页）、六柱", () => {
		const jia = ganFacts("甲");
		expect([jia.yinYang, jia.wuXing, jia.direction, jia.he]).toEqual(["阳", "木", "东", "甲己合土"]);
		expect(jia.pillars.map((p) => p.ganZhi).join(" ")).toBe("甲子 甲戌 甲申 甲午 甲辰 甲寅");
		expect([...GAN].map((g) => ganFacts(g).direction).join("")).toBe("东东南南中中西西北北");
		expect([...GAN].map((g) => ganFacts(g).he).join(" ")).toBe(
			"甲己合土 乙庚合金 丙辛合水 丁壬合木 戊癸合火 甲己合土 乙庚合金 丙辛合水 丁壬合木 戊癸合火",
		);
		for (const g of GAN) {
			const f = ganFacts(g);
			expect(f.yinYang).toBe(HeavenStem.fromName(g).getYinYang() === 1 ? "阳" : "阴");
			expect(f.ten.map((x) => x.star)).toEqual(shishenTable()[f.index]);
		}
	});

	it("正文引用的「」只有方位、合名和本页的小节名（小节名与页面逐字一致）", () => {
		for (const [data, hant] of [[tiangan, false], [tianganHant, true]] as const) {
			for (const [slug, item] of Object.entries(data.items)) {
				const g = GAN[GAN_SLUG.indexOf(slug as (typeof GAN_SLUG)[number])]!;
				const f = ganFacts(g);
				const ok = [hant && f.direction === "东" ? "東" : f.direction, f.he, tenHead(g), csHead(g, hant)];
				for (const q of [item.intro, ...item.read].join("").matchAll(/「(.+?)」/g)) expect(ok, `${slug}：${q[1]}`).toContain(q[1]);
			}
		}
	});
});

describe("地支", () => {
	const NOW = "2026-10-01 00:00";

	it("构成：阴阳五行、生肖、时辰、藏干（本气、中气、余气）", () => {
		const zi = zhiFacts("子", NOW);
		expect([zi.yinYang, zi.wuXing, zi.zodiac, zi.hours]).toEqual(["阳", "水", "鼠", "23:00–01:00"]);
		expect(zi.cang).toEqual([{ gan: "癸", type: "本气", yinYang: "阴", wuXing: "水" }]);
		expect(zhiFacts("丑", NOW).cang.map((c) => c.gan + c.type).join(" ")).toBe("己本气 癸中气 辛余气");
		expect(zhiFacts("寅", NOW).cang.map((c) => c.gan).join("")).toBe("甲丙戊");
		expect(zhiFacts("亥", NOW).hours).toBe("21:00–23:00");
		for (const z of ZHI) {
			const f = zhiFacts(z, NOW);
			expect(f.cang.map((c) => c.gan)).toEqual(EarthBranch.fromName(z).getHideHeavenStems().map((h) => h.getName()));
			expect(f.cang[0]!.type).toBe("本气");
		}
	});

	it("方位按三会：和这一支所在的三会局对得上（不用 EarthBranch.getDirection，它给丑辰未戌「中」）", () => {
		const dir = { 木: "东", 火: "南", 金: "西", 水: "北" } as Record<string, string>;
		for (const z of ZHI) {
			const hui = relations(z).find((r) => r.type === "三会")!;
			expect(zhiFacts(z, NOW).direction, z).toBe(dir[hui.name[5]!]);
		}
	});

	it("刑冲合会：条数、丑的全部九条与次序（三刑、相刑分开），写法同排盘页", () => {
		const counts = Object.fromEntries([...ZHI].map((z) => [z, relations(z).length]));
		expect(counts).toEqual({ 子: 8, 丑: 9, 寅: 9, 卯: 8, 辰: 7, 巳: 9, 午: 8, 未: 9, 申: 9, 酉: 8, 戌: 9, 亥: 7 });
		expect(relations("丑").map((r) => r.name)).toEqual([
			"子丑合土",
			"巳酉丑三合金局",
			"酉丑半合金局",
			"亥子丑三会水局",
			"丑未相冲",
			"丑午相害",
			"丑戌未三刑",
			"丑未相刑",
			"丑戌相刑",
		]);
		expect(relations("子").map((r) => r.name).join(" ")).toBe("子丑合土 申子辰三合水局 申子半合水局 子辰半合水局 亥子丑三会水局 子午相冲 子未相害 子卯相刑");
		expect(relations("卯").filter((r) => r.type === "半合").map((r) => r.name)).toEqual(["亥卯半合木局", "卯未半合木局"]);
		expect(relations("辰").at(-1)!.name).toBe("辰辰自刑");
		const order = "地支六合 三合 半合 三会 六冲 六害 三刑 相刑 自刑".split(" ");
		for (const z of ZHI) {
			const rels = relations(z);
			// 次序按类
			expect(rels.map((r) => order.indexOf(r.type))).toEqual(rels.map((r) => order.indexOf(r.type)).sort((a, b) => a - b));
			for (const r of rels) {
				expect(r.name, r.name).toContain(z);
				const two = r.name.slice(0, 2);
				// 两字的合、冲、害、刑按地支序；半合按三合局的次序
				if (r.type === "半合") expect(["申子辰", "巳酉丑", "寅午戌", "亥卯未"].some((s) => s.includes(two))).toBe(true);
				else if (r.type !== "三合" && r.type !== "三会" && r.type !== "三刑") expect(ZHI.indexOf(two[0]!) <= ZHI.indexOf(two[1]!), r.name).toBe(true);
				// 与 guanXi 判断一致：把名字里的支摆成几柱，guanXi 查得到这个关系
				const zhis = r.type === "自刑" ? [z, z] : [...r.name.replace(/(合|半合|三合|三会|相冲|相害|相刑|三刑|自刑).*$/, "")];
				expect(guanXi(zhis.map((x) => `甲${x}`)).map((x) => x.name), r.name).toContain(r.name);
			}
		}
	});

	it("节月：按交节时刻取还没过完的那一回，和节气页的交节时刻一致", () => {
		expect(jieMonth("子", NOW)).toEqual({ from: { name: "大雪", time: "2026-12-07 10:52" }, to: { name: "小寒", time: "2027-01-05 22:09" } });
		// 酉月正在走；申月今年的已过完，取明年的
		expect(jieMonth("酉", NOW).from.time).toBe("2026-09-07 22:41");
		expect(jieMonth("申", NOW).to.time).toBe("2027-09-08 04:28");
		// 交节前一分钟还是这一回，到交节那一分钟就换下一回
		expect(jieMonth("酉", "2026-10-08 14:28").from.time.slice(0, 4)).toBe("2026");
		expect(jieMonth("酉", "2026-10-08 14:29").from.time.slice(0, 4)).toBe("2027");
		for (const z of ZHI) {
			const m = jieMonth(z, NOW);
			for (const x of [m.from, m.to]) expect(x.time, `${z} ${x.name}`).toBe(`${x.time.slice(0, 10)} ${termIn(Number(x.time.slice(0, 4)), x.name).time}`);
			// 交节后一分钟，月柱的地支就是这一支
			const [d, t] = m.from.time.split(" ");
			const [y, mo, da] = d!.split("-").map(Number) as [number, number, number];
			const [h, mi] = t!.split(":").map(Number) as [number, number];
			expect(SolarTime.fromYmdHms(y, mo, da, h, mi, 0).next(60).getSixtyCycleHour().getMonth().getEarthBranch().getName()).toBe(z);
			expect(m.to.time > NOW).toBe(true);
		}
	});

	it("接下来的该日：今天起、黄历时间窗内，日支与逐日页一致；窗末尾少列，窗外一天都没有", () => {
		expect(nextDays("子", "2026-10-01")).toEqual(["2026-10-05", "2026-10-17", "2026-10-29", "2026-11-10", "2026-11-22", "2026-12-04"]);
		expect(nextDays("申", "2026-10-01")[0]).toBe("2026-10-01");
		for (const z of ZHI) for (const d of nextDays(z, "2026-10-01")) expect(huangliOf(d).ganzhi.day[1]).toBe(z);
		expect(nextDays("子", "2027-12-20").length).toBeLessThan(6);
		expect(nextDays("子", "2028-01-01")).toEqual([]);
	});
});

describe("日柱（第二批）", () => {
	const TODAY = "2026-10-01";
	const plus = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

	it("构成与排盘页一致：60 个日柱的藏干与十神、星运与自坐、纳音、旬空（2026 年起连续 60 天中午各排一盘）", () => {
		const seen = new Set<string>();
		for (let n = 0; n < 60; n++) {
			const [year, month, day] = plus(FIRST, n).split("-").map(Number) as [number, number, number];
			const p = bazi({ calendar: "solar", year, month, day, hour: 12, minute: 0, gender: "男" }).pillars[2]!;
			const f = rizhuFacts(p.ganZhi, TODAY);
			seen.add(p.ganZhi);
			expect([f.gan, f.zhi, f.ganWuXing, f.zhiWuXing]).toEqual([p.gan, p.zhi, p.ganWuXing, p.zhiWuXing]);
			expect(f.cang.map((c) => ({ gan: c.gan, shiShen: c.star })), p.ganZhi).toEqual(p.cangGan);
			expect(f.cang[0]!.type).toBe("本气");
			// 日柱的天干就是日主：星运、自坐是同一步
			expect(p.xingYun).toBe(p.ziZuo);
			expect(f.stepName).toBe(p.xingYun);
			expect(STEPS[f.step]).toBe(p.xingYun);
			expect(f.naYin).toBe(p.naYin);
			expect(f.id).toBe(nayinId(p.ganZhi));
			expect(f.kong).toBe(p.kongWang);
			// 旬首：tyme4ts 的 getTen 与按次序数到的旬首一致
			expect(f.xun).toBe(SIXTY[f.index - (f.index % 10)]);
			expect(f.same).toHaveLength(6);
			expect(f.same).toContain(p.ganZhi);
			for (const x of f.same) expect(x[0]).toBe(p.gan);
		}
		expect(seen.size).toBe(60);
		const jiazi = rizhuFacts("甲子", TODAY);
		expect([jiazi.stepName, jiazi.step, jiazi.naYin, jiazi.xun, jiazi.kong]).toEqual(["沐浴", 1, "海中金", "甲子", "戌亥"]);
		expect(rizhuFacts("乙丑", TODAY).cang.map((c) => c.gan + c.type + c.star).join(" ")).toBe("己本气偏财 癸中气偏印 辛余气七杀");
	});

	it("接下来的该日：今天起、黄历时间窗内、每 60 天一次，一天不漏，日柱与逐日页一致", () => {
		expect(rizhuFacts("甲子", TODAY).days).toEqual(["2026-10-17", "2026-12-16", "2027-02-14", "2027-04-15", "2027-06-14", "2027-08-13", "2027-10-12", "2027-12-11"]);
		for (const gz of SIXTY) {
			const { days } = rizhuFacts(gz, TODAY);
			expect(days.length, gz).toBeGreaterThan(0);
			expect(plus(days[0]!, -60) < TODAY, gz).toBe(true);
			expect(plus(days.at(-1)!, 60) > LAST, gz).toBe(true);
			for (const [i, d] of days.entries()) {
				expect(inWindow(d) && d >= TODAY, d).toBe(true);
				expect(huangliOf(d).ganzhi.day, d).toBe(gz);
				if (i) expect(plus(days[i - 1]!, 60)).toBe(d);
			}
		}
		// 窗末尾：一天都没有时整节不出
		expect(nextDays("甲子", "2027-12-12", Number.POSITIVE_INFINITY)).toEqual([]);
	});

	it("正文引用的「」只有十神名、纳音名、十二长生步名和本页的小节名（小节名与页面逐字一致）", () => {
		const NAMES: Record<string, string> = { ...(huangliHant as unknown as { names: Record<string, string> }).names, ...namesHant };
		const sounds = nayinGroups().map((g) => g.name);
		for (const [data, hant] of [[rizhu, false], [rizhuHant, true]] as const) {
			const tw = (s: string) => (hant ? (NAMES[s] ?? s) : s);
			for (const [slug, item] of Object.entries(data.items)) {
				const gz = SIXTY[RIZHU_SLUG.indexOf(slug)]!;
				const ok = [...TenStar.NAMES, ...sounds, ...STEPS].map(tw).concat(tenHead(gz[0]!), sameHead(gz[0]!, hant), nextHead(gz, hant));
				for (const q of [item.intro, ...item.read].join("").matchAll(/「(.+?)」/g)) expect(ok, `${slug}：${q[1]}`).toContain(q[1]);
			}
		}
	});
});
