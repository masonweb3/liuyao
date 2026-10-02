/**
 * 八字白话（M20）：样例盘逐句对照设计稿（docs/design-bazi-baihua.md 的 S1–S5），再拿一张生辰网格拼出全部白话（简繁），
 * 逐句过红线（M20-11）、查空位与标点，最后查每条句式至少用到一次。
 *
 * 网格默认约一万两千盘（1901–2026 年，每 97 小时 13 分一个，男女交替；每 5 个取 1 个按时辰不详再排；每 7 个取 1 个
 * 放到海外时区，其中一半开真太阳时；每 3 个取 1 个选晚子时仍算当天）。设计稿那张 72,882 盘的网格（1950–2009 年每 7 小时
 * 13 分）用 BAIHUA_GRID=full 跑：几分钟，CI 不跑。
 */
import { EarthBranch, HeavenStem, SolarTerm, Sound, Zodiac } from "tyme4ts";
import { describe, expect, it } from "vitest";
import HANT from "../data/bazi-baihua-hant.json" with { type: "json" };
import HANS from "../data/bazi-baihua.json" with { type: "json" };
import namesHant from "../data/bazi-names-hant.json" with { type: "json" };
import huangliHant from "../data/huangli-hant.json" with { type: "json" };
import { type Birth, bazi, type Options } from "./bazi.js";
import { BEN_QI, DIRECTION, type Plain, plain, USED } from "./bazi-baihua.js";
import { localOffset } from "./bazi-time.js";

// 繁体页的名称表：照 Bazi.astro 的 data-names 拼（十神等查八字名称表，纳音、生肖、节气查黄历的名称表）
const hl = (huangliHant as unknown as { names: Record<string, string> }).names;
const NAMES: Record<string, string> = {
	...namesHant,
	...Object.fromEntries([...Sound.NAMES, ...Zodiac.NAMES, ...SolarTerm.NAMES].map((n) => [n, hl[n] ?? n])),
};
const YEAR = 2026;

const solar = (y: number, m: number, d: number, h: number | undefined, mi: number | undefined, gender: Birth["gender"]): Birth => ({
	calendar: "solar",
	year: y,
	month: m,
	day: d,
	...(h !== undefined && { hour: h, minute: mi }),
	gender,
});
const make = (birth: Birth, options: Options = {}, extra: { city?: string; hant?: boolean; year?: number } = {}) => {
	const chart = bazi(birth, options);
	return { chart, p: plain({ chart, options, year: extra.year ?? YEAR, city: extra.city, hant: extra.hant, names: extra.hant ? NAMES : {} }) };
};
const abroad = (tz: string, y: number, m: number, d: number, h: number, mi: number, gender: Birth["gender"], hant = false, city = "温哥华") => {
	const o = localOffset(tz, y, m, d, h, mi);
	return make(solar(y, m, d, h, mi, gender), { offset: o.offset, dst: o.dst }, { city, hant });
};
/** 白话里的全部文字（标签、段落），用来查红线 */
const texts = (p: Plain): string[] => [
	...Object.values(p.ui).flat(),
	...p.dm.card,
	...p.dm.paras,
	p.wx.sub,
	...p.wx.rows.flatMap((r) => [r.label, r.hidden, ...r.chars.flatMap((c) => [c.pos, ...(c.ss ? [c.ss] : [])])]),
	...p.wx.paras,
	p.dy.lead,
	...(p.dy.pre ? [p.dy.pre.ages, p.dy.pre.years] : []),
	...p.dy.steps.flatMap((s) => [s.ages, s.years, s.ten, s.gz, s.rel, ...(s.year ? [s.year] : [])]),
];
/** 成句的（要以句号收尾） */
const sentences = (p: Plain): string[] => [
	...p.dm.paras,
	p.wx.sub,
	...p.wx.paras,
	p.dy.lead,
	...p.dy.steps.flatMap((s) => [s.gz, s.rel, ...(s.year ? [s.year] : [])]),
];

// 红线（M20-11）：M19a、M19b 两组（含吉、贵、性格，步名「病死墓绝」），加五行强弱与用神喜忌、六亲、财运事业、人称
const RED = [
	/寿元|壽元|疾病|灾厄|災厄|牢狱|牢獄|克夫|剋夫|克妻|剋妻|婚变|婚變|吉|凶|兇|贵|貴|贱|賤|性格|性情|改命|改运|改運|转运|轉運|化解/,
	/[病死墓绝絕]/,
	/缺|补|補|旺|衰|强|強|弱|得令|失令|用神|喜用|忌神|喜忌|格局|从格|從格|身强|身弱/,
	/配偶|夫妻|父母|子女|兄弟|姐妹|妻|夫|儿|兒|女儿|母亲|父亲/,
	/健康|运势|運勢|运气|運氣|好运|好運|走运|走運|财运|財運|官运|官運|事业|事業|婚姻|感情|性子|脾气|脾氣|命好|命苦|富|穷|窮|发财|發財|升官/,
	/你|您/,
	/一定|必定|必然|保证|保證|之内|之內/,
];
const TEN_NAMES = ["比肩", "劫财", "食神", "伤官", "偏财", "正财", "七杀", "正官", "偏印", "正印", "劫財", "傷官", "偏財", "正財", "七殺"];
// 去掉十神全名之后不许再有这几个单字：挡住「财运」「官运」「杀伤」一类拼接
const BARE = /[财財官杀殺伤傷劫印]/;
// 繁体：台湾用语，s2twp 的误转（衝、幹、醜、閤、隻、齣）与简体用语（北京、默認），生克义用「剋」；
// 再加一组简繁不同的常用字，挡住填进去的名字没换成繁体
const HANT_BAD = /[兇矇佔鹹衝醜幹閤隻齣克]|北京|默認|[冲会东时运岁财杀伤这个里关说与对为气数点没阳阴顺语门]/;

function redline(s: string): string | undefined {
	for (const rx of RED) if (rx.test(s)) return `${rx.exec(s)![0]}：${s}`;
	let bare = s;
	for (const n of TEN_NAMES) bare = bare.replaceAll(n, "");
	if (BARE.test(bare)) return `单字${BARE.exec(bare)![0]}：${s}`;
}
function malformed(p: Plain): string | undefined {
	for (const s of texts(p)) if (/[{}]|undefined|NaN|null/.test(s) || s === "") return `空位或空串：${JSON.stringify(s)}`;
	for (const s of sentences(p)) if (!/^[^\s，。；、].*。$/.test(s) || /[，；、。]{2}|[，；、]。/.test(s)) return `标点：${s}`;
}

describe("八字白话（M20）：样例盘", () => {
	it("S1 主例（1998-11-05 07:25 女，北京时间）逐句", () => {
		const { chart: c, p } = make(solar(1998, 11, 5, 7, 25, "女"));
		expect(c.pillars.map((x) => x.ganZhi)).toEqual(["戊寅", "壬戌", "丙辰", "壬辰"]);
		expect(p.dm.card).toEqual(["阳火 · 十天干第三 · 方位南", "日柱丙辰 · 辰里藏戊、乙、癸"]);
		expect(p.dm.paras).toEqual([
			"日主是日柱的天干，这一盘是丙。丙在十天干里排第三，五行属火，属阳，方位配南。盘面上的十神，都是拿其余天干（连同地支里藏的天干）和丙相比得来的。",
			"日柱丙辰：丙坐在辰上。辰里藏着戊、乙、癸，对丙分别是食神、正印、正官。",
		]);
		expect(p.wx.sub).toBe("按对日主丙的关系排：同我、我生、我克、克我、生我。八个字里的天干、地支各算一个，藏干另列。");
		expect(p.wx.rows.map((r) => [r.el, r.n, r.label])).toEqual([
			["火", 1, "同我 · 比肩、劫财"],
			["土", 4, "我生 · 食神、伤官"],
			["金", 0, "我克 · 偏财、正财"],
			["水", 2, "克我 · 七杀、正官"],
			["木", 1, "生我 · 偏印、正印"],
		]);
		expect(p.wx.rows[1]!.chars).toEqual([
			{ ch: "戊", pos: "年干", ss: "食神" },
			{ ch: "戌", pos: "月支" },
			{ ch: "辰", pos: "日支" },
			{ ch: "辰", pos: "时支" },
		]);
		expect(p.wx.rows[0]!.chars).toEqual([{ ch: "丙", pos: "日主" }]);
		expect(p.wx.rows.map((r) => r.hidden)).toEqual([
			"丙 比肩（年支寅）、丁 劫财（月支戌）",
			"戊 食神（年支寅、月支戌、日支辰、时支辰）",
			"辛 正财（月支戌）",
			"癸 正官（日支、时支辰）",
			"甲 偏印（年支寅）、乙 正印（日支、时支辰）",
		]);
		expect(p.wx.paras).toEqual([
			"八个字里，土最多，有 4 个；水 2 个，木、火各 1 个；金是 0 个，八个字里没有金。",
			"算上地支里藏的天干，金有 1 个：月支戌里的辛。",
			"日主以外的三个天干，十神分别是食神（戊，年干）、七杀（壬，月干、时干）。比肩、劫财、正财、正官、偏印、正印只藏在地支里。伤官、偏财在这一盘上没有。",
			"天干上这几个称呼的来由：丙火生戊土，戊、丙都属阳，称食神；壬水克丙火，壬、丙都属阳，称七杀。",
		]);
		expect(p.dy.lead).toBe("11 岁（2008 年）起运，大运逆排（从月柱往前数六十甲子），十年一步。1–10 岁还没有大运。今年（2026 年）在庚申运。");
		expect(p.dy.pre).toEqual({ ages: "1–10岁", years: "1998–2007" });
		const now = p.dy.steps.filter((s) => s.now);
		expect(now).toHaveLength(1);
		expect(now[0]).toEqual({
			ages: "21–30岁",
			years: "2018–2027",
			ganZhi: "庚申",
			ten: "偏财 · 偏财",
			now: true,
			gz: "天干庚，对丙是偏财；地支申，本气庚，也是偏财。",
			rel: "与四柱之间：寅申相冲（年柱）、寅申相刑（年柱）。",
			year: "今年（2026 年）是丙午年。天干丙，对丙是比肩；地支午，本气丁，是劫财。与四柱之间：寅午戌三合火局（年柱、月柱）。",
		});
		// 十步全列，不按岁数截（M20-6）：第十步过 100 岁
		expect(p.dy.steps).toHaveLength(10);
		expect(p.dy.steps[9]!.ages).toBe("101–110岁");
		expect(p.ui.cols).toEqual(["五行", "个数", "对日主 · 十神", "八个字里", "藏干里"]);
		expect(p.ui.gan).toBe("天干丙");
	});

	it("S1 繁体：名字与刑冲合会换成繁体，句式取繁体那份", () => {
		const { p } = make(solar(1998, 11, 5, 7, 25, "女"), {}, { hant: true });
		expect(p.dm.card[0]).toBe("陽火 · 十天干第三 · 方位南");
		expect(p.wx.rows[2]!.label).toBe("我剋 · 偏財、正財");
		expect(p.wx.rows[0]!.hidden).toBe("丙 比肩（年支寅）、丁 劫財（月支戌）");
		expect(p.wx.paras[3]).toBe("天干上這幾個稱呼的來由：丙火生戊土，戊、丙都屬陽，稱食神；壬水剋丙火，壬、丙都屬陽，稱七殺。");
		const now = p.dy.steps.find((s) => s.now)!;
		expect(now.rel).toBe("與四柱之間：寅申相沖（年柱）、寅申相刑（年柱）。");
		expect(now.ten).toBe("偏財 · 偏財");
		expect(p.dy.lead).toBe("11 歲（2008 年）起運，大運逆排（從月柱往前數六十甲子），十年一步。1–10 歲還沒有大運。今年（2026 年）在庚申運。");
		expect(p.ui.cols[3]).toBe("八個字裡");
		// 甲乙方位「東」
		expect(make(solar(1975, 1, 9, 12, 0, "女"), {}, { hant: true }).p.dm.card[0]).toBe("陰木 · 十天干第二 · 方位東");
	});

	it("S2 海外：温哥华 1991-06-06 18:40 男（夏令时），按北京时间排会是另一个日主；水 0、克我一类全无；1 岁起运", () => {
		const { chart: c, p } = abroad("America/Vancouver", 1991, 6, 6, 18, 40, "男");
		expect(c.pillars.map((x) => x.ganZhi)).toEqual(["辛未", "甲午", "丁未", "己酉"]);
		// 夏令时：日柱、时柱按拨回去的标准时间（审查 S4）
		expect(p.dm.paras[2]).toBe(
			"出生在温哥华，日柱、时柱按当地的标准时间（拨回夏令时）排。同一刻北京时间是6月7日 09:40；有的排盘工具把出生时刻一律换成北京时间来排，那样日柱是戊申，日主是戊。",
		);
		// 拿同一刻的北京时间真排一次（设计稿 S2：辛未 甲午 戊申 丁巳）
		expect(bazi(solar(1991, 6, 7, 9, 40, "男")).pillars[2]!.ganZhi).toBe("戊申");
		expect(p.wx.paras).toContain("算上地支里藏的天干，水也没有。");
		// 一整类没有的不单列，并进「没有」那一串（审查 S1）
		expect(p.wx.paras[2]).toBe(
			"日主以外的三个天干，十神分别是食神（己，时干）、偏财（辛，年干）、正印（甲，月干）。比肩、偏印只藏在地支里。劫财、伤官、正财、七杀、正官在这一盘上没有。",
		);
		expect(p.wx.paras.join("")).not.toMatch(/这一类十神/);
		// 开了真太阳时：按当地的真太阳时排
		const o = localOffset("America/Vancouver", 1991, 6, 6, 18, 40);
		const zty = make(solar(1991, 6, 6, 18, 40, "男"), { ...o, longitude: -123.1 }, { city: "温哥华" }).p;
		expect(zty.dm.paras.at(-1)).toMatch(/^出生在温哥华，日柱、时柱按当地的真太阳时排。同一刻北京时间是6月7日 09:40；/);
		expect(c.daYun[0]!.startAge).toBe(1);
		expect(p.dy.pre).toBeUndefined();
		expect(p.dy.lead).toMatch(/^1 岁（1991 年）起运，大运逆排（从月柱往前数六十甲子），十年一步。今年/);
		const tw = abroad("America/Vancouver", 1991, 6, 6, 18, 40, "男", true, "溫哥華").p;
		expect(tw.dm.paras[2]).toBe(
			"出生在溫哥華，日柱、時柱按當地的標準時間（撥回夏令時）排。同一刻換算成 UTC+8 是6月7日 09:40；有的排盤工具把出生時刻一律換成 UTC+8 來排，那樣日柱是戊申，日主是戊。",
		);
	});

	it("海外在 UTC+8 以东：北京时间还是前一天，日柱往前推", () => {
		// 奥克兰 2001-07-10 02:00（NZST，UTC+12）是北京时间 7 月 9 日 22:00
		const { chart: c, p } = abroad("Pacific/Auckland", 2001, 7, 10, 2, 0, "女", false, "奥克兰");
		expect(c.beijing).toBe("2001-07-09 22:00");
		const bj = bazi(solar(2001, 7, 9, 22, 0, "女")).pillars[2]!.ganZhi;
		expect(bj).not.toBe(c.pillars[2]!.ganZhi);
		expect(p.dm.paras.at(-1)).toBe(`出生在奥克兰，日柱、时柱按当地时间排。同一刻北京时间是7月9日 22:00；有的排盘工具把出生时刻一律换成北京时间来排，那样日柱是${bj}，日主是${bj[0]}。`);
		// 同一天的不出：东京 2001-07-10 12:00 是北京 11:00
		expect(abroad("Asia/Tokyo", 2001, 7, 10, 12, 0, "女", false, "东京").p.dm.paras).toHaveLength(2);
	});

	it("S3 时辰不详（1975-01-09 女）：三柱六个字，金水为 0、藏干里各有一个；起运按中午估，0 点与 23:59 差一年", () => {
		const { chart: c, p } = make(solar(1975, 1, 9, undefined, undefined, "女"));
		expect(c.pillars.map((x) => x.ganZhi)).toEqual(["甲寅", "丁丑", "乙卯"]);
		expect(p.dm.paras[1]).toBe("日柱乙卯：乙坐在卯上。卯里只藏着乙，对乙是比肩。");
		expect(p.dm.paras[2]).toBe("时辰不详，日柱按出生那天排。若是晚子时（23 点到 0 点）出生，本站默认把日柱算到次日，那样日柱是丙辰，日主是丙。");
		expect(p.wx.paras[0]).toBe("时辰不详，只数年、月、日三柱。六个字里，木最多，有 4 个；火、土各 1 个；金、水都是 0 个，六个字里没有金、水。");
		expect(p.wx.paras[1]).toBe("算上地支里藏的天干，金有 1 个：月支丑里的辛；水有 1 个：月支丑里的癸。");
		expect(p.wx.paras[2]).toMatch(/^日主以外的两个天干，十神分别是/);
		expect(p.ui.cols[3]).toBe("六个字里");
		expect(p.dy.lead).toMatch(
			/^时辰不详，起运按当天中午估：约 2 岁（1976 年）起运，大运逆排（从月柱往前数六十甲子），十年一步。当天 0 点出生是 1975 年交运，23:59 出生是 1976 年，各步的起止年份可能差一年。今年/,
		);
		// 只差一年时写「1岁」「1975」，不写「1–1岁」
		expect(p.dy.pre).toEqual({ ages: "1岁", years: "1975" });
		// 和三柱的关系：时辰不详时原局三柱，运的下标是 3
		expect(p.dy.steps.every((s) => s.rel.startsWith("与三柱之间"))).toBe(true);
	});

	it("S4 两行为 0、生我一类全无（1970-01-06 18:49 女）", () => {
		const { chart: c, p } = make(solar(1970, 1, 6, 18, 49, "女"));
		expect(c.pillars.map((x) => x.ganZhi)).toEqual(["己酉", "丁丑", "丙戌", "丁酉"]);
		expect(p.wx.paras[0]).toMatch(/木、水都是 0 个，八个字里没有木、水。$/);
		expect(p.wx.paras[1]).toBe("算上地支里藏的天干，木也没有；水有 1 个：月支丑里的癸。");
		// 生我一类（偏印、正印）整类没有：并进「没有」那一串（审查 S1）
		expect(p.wx.paras[2]).toBe(
			"日主以外的三个天干，十神分别是劫财（丁，月干、时干）、伤官（己，年干）。食神、正财、正官只藏在地支里。比肩、偏财、七杀、偏印、正印在这一盘上没有。",
		);
		expect(p.dy.steps[9]!.ages).toBe("100–109岁");
	});

	it("S5 起运最晚（1950-09-08 11:29 女）：12 岁起运，起运前 1–11 岁，第十步 102–111 岁", () => {
		const { p } = make(solar(1950, 9, 8, 11, 29, "女"));
		expect(p.dy.lead).toMatch(/^12 岁（1961 年）起运，大运.排（从月柱往.数六十甲子），十年一步。1–11 岁还没有大运。/);
		expect(p.dy.pre).toEqual({ ages: "1–11岁", years: "1950–1960" });
		expect(p.dy.steps[9]!.ages).toBe("102–111岁");
	});

	it("晚子时：默认算次日，写出仍算当天的日柱；选了仍算当天的，写出默认的日柱", () => {
		const a = make(solar(1990, 5, 15, 23, 30, "男"));
		expect(a.chart.pillars[2]!.ganZhi).toBe("辛巳");
		expect(a.p.dm.paras.at(-1)).toBe("这一盘的出生时刻落在晚子时（23 点到 0 点），本站默认把日柱算到次日；选项里可改成仍算当天，那样日柱是庚辰，日主是庚。");
		const b = make(solar(1990, 5, 15, 23, 30, "男"), { lateZi: "day-stays" });
		expect(b.chart.pillars[2]!.ganZhi).toBe("庚辰");
		expect(b.p.dm.paras.at(-1)).toBe("这一盘的出生时刻落在晚子时（23 点到 0 点），选项里选了仍算当天；本站默认算到次日，那样日柱是辛巳，日主是辛。");
		expect(make(solar(1990, 5, 15, 22, 59, "男")).p.dm.paras).toHaveLength(2);
	});

	it("晚子时按换算后的时刻：真太阳时、夏令时说清按哪个时刻，「当天」写成日期（审查 S4）", () => {
		// 喀什东经 76 度，填 5 月 16 日 02:30，真太阳时是 5 月 15 日 23 点多
		const k = make(solar(1990, 5, 16, 2, 30, "男"), { longitude: 75.99 });
		expect(k.chart.zhenTaiYang!.time).toMatch(/^1990-05-15 23:/);
		expect(k.p.dm.paras.at(-1)).toMatch(
			/^按真太阳时，这一盘的出生时刻是5月15日 23:\d\d，落在晚子时（23 点到 0 点）：本站默认把日柱算到次日；选项里可改成仍算5月15日，那样日柱是庚辰，日主是庚。$/,
		);
		// 温哥华 7 月 10 日 00:30（夏令时）拨回去是 7 月 9 日 23:30
		const o = localOffset("America/Vancouver", 1991, 7, 10, 0, 30);
		const v = make(solar(1991, 7, 10, 0, 30, "女"), { ...o, lateZi: "day-stays" }, { city: "温哥华" });
		const adv = bazi(solar(1991, 7, 10, 0, 30, "女"), o).pillars[2]!.ganZhi;
		expect(v.p.dm.paras[2]).toBe(
			`按标准时间（拨回夏令时），这一盘的出生时刻是7月9日 23:30，落在晚子时（23 点到 0 点）：选项里选了仍算7月9日；本站默认算到次日，那样日柱是${adv}，日主是${adv[0]}。`,
		);
	});

	it("今年还没起运、已在第十步之后；时辰不详又正好交节", () => {
		// 丙午年阳年男命顺排，离惊蛰四天多，2 岁（2027 年）起运
		const young = make(solar(2026, 3, 1, 9, 0, "男"));
		expect(young.chart.daYun[0]!.startYear).toBeGreaterThan(YEAR);
		expect(young.p.dy.lead).toMatch(/今年（2026 年）还没有起运。$/);
		expect(young.p.dy.steps.some((s) => s.now)).toBe(false);
		const old = make(solar(1901, 3, 1, 8, 0, "女"));
		expect(old.p.dy.lead).toMatch(/今年（2026 年）已在第十步之后。$/);
		const jie = make(solar(2025, 2, 3, undefined, undefined, "男"));
		expect(jie.chart.jie?.name).toBe("立春");
		expect(jie.p.dy.lead).toMatch(/^时辰不详，出生那天正好交立春：出生在交节之前还是之后，各步大运的干支都不一样；/);
		expect(make(solar(2025, 2, 3, undefined, undefined, "男"), {}, { hant: true }).p.dy.lead).toMatch(/^時辰不詳，出生那天正好交立春：/);
		// 那句只说干支：当天 0:00 与 23:59 出生，第一步大运的干支不同；顺逆只在立春那天翻（惊蛰那天不翻），起运早晚立春那天多半不变（审查实算 1901–2026）
		for (const [m, d, flips] of [[2, 3, true], [3, 5, false]] as const) {
			const [a, z] = [bazi(solar(2025, m, d, 0, 0, "男")), bazi(solar(2025, m, d, 23, 59, "男"), { lateZi: "day-stays" })];
			expect(a.daYun[0]!.ganZhi).not.toBe(z.daYun[0]!.ganZhi);
			expect(a.qiYun.forward !== z.qiYun.forward).toBe(flips);
		}
	});

	it("地支本气、天干方位两张小表与 tyme4ts 一致", () => {
		expect([...BEN_QI]).toEqual(EarthBranch.NAMES.map((z) => EarthBranch.fromName(z).getHideHeavenStemMain().getName()));
		expect(HeavenStem.NAMES.map((_, i) => DIRECTION[i >> 1])).toEqual(HeavenStem.NAMES.map((g) => HeavenStem.fromName(g).getDirection().getName()));
	});
});

// 句式 JSON 的键路径（数组按下标）与取值
const paths = (v: unknown, p = ""): string[] =>
	typeof v === "string" ? [p] : v && typeof v === "object" ? Object.entries(v).flatMap(([k, x]) => paths(x, p ? `${p}.${k}` : k)) : [];
const at = (o: unknown, path: string) => path.split(".").reduce<unknown>((x, k) => (x as Record<string, unknown>)[k], o) as string;
const slots = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("八字白话（M20）：句式", () => {
	it("简繁键一致，每条的空位一样；句式本身也过红线", () => {
		expect(paths(HANT)).toEqual(paths(HANS));
		for (const k of paths(HANS)) expect(slots(at(HANT, k)), k).toEqual(slots(at(HANS, k)));
		for (const k of paths(HANS)) {
			expect(redline(at(HANS, k)), k).toBeUndefined();
			expect(redline(at(HANT, k)), k).toBeUndefined();
			expect(at(HANT, k), k).not.toMatch(HANT_BAD);
		}
	});
});

// 网格：拼出全部白话，逐句查（M20-11）；顺带核对日柱换算（晚子时、海外按北京时间）与真排一次一致
describe("八字白话（M20）：网格", () => {
	const FULL = process.env.BAIHUA_GRID === "full";
	// 时区、城市名（简、繁，同 cities.json 的写法）、经度：UTC+8 以西与以东都有
	const ZONES: [string, [string, string], number][] = [
		["America/Vancouver", ["温哥华", "溫哥華"], -123.1],
		["America/New_York", ["纽约", "紐約"], -74],
		["Europe/London", ["伦敦", "倫敦"], -0.1],
		["Asia/Tokyo", ["东京", "東京"], 139.7],
		["Australia/Sydney", ["悉尼", "雪梨"], 151.2],
		["Pacific/Auckland", ["奥克兰", "奧克蘭"], 174.8],
		["Asia/Kolkata", ["加尔各答", "加爾各答"], 88.4],
		["America/Los_Angeles", ["洛杉矶", "洛杉磯"], -118.2],
	];

	it(`${FULL ? "设计稿那张网格（1950–2009）" : "1901–2026"}：简繁全部白话过红线，没有未填的空位，句末是句号；每条句式都用到`, () => {
		const [from, to, step] = FULL ? [Date.UTC(1950, 0, 1), Date.UTC(2010, 0, 1), 7 * 3600_000 + 13 * 60_000] : [Date.UTC(1901, 0, 1), Date.UTC(2026, 9, 1), 97 * 3600_000 + 13 * 60_000];
		const seen = new Set<string>();
		const bad: string[] = [];
		const st = { charts: 0, zero: [0, 0, 0, 0], none: 0, age1: 0, age2: 0, yearDiff: 0, abroad: 0, lateZi: 0, sitOne: 0, before: 0, after: 0, jie: 0 };
		const check = (birth: Birth, options: Options, city?: [string, string]) => {
			const chart = bazi(birth, options);
			st.charts++;
			for (const hant of [false, true]) {
				const p = plain({ chart, options, year: YEAR, city: city?.[hant ? 1 : 0], hant, names: hant ? NAMES : {} });
				const m = malformed(p);
				if (m) bad.push(m);
				for (const s of texts(p)) {
					if (seen.has(s)) continue;
					seen.add(s);
					// 城市名照名单原样（奧克蘭的「克」、哈巴罗夫斯克的「夫」），不算
					const x = city ? s.replaceAll(city[hant ? 1 : 0], "") : s;
					const r = redline(x);
					if (r) bad.push(r);
					if (hant && HANT_BAD.test(x)) bad.push(`繁体${HANT_BAD.exec(x)![0]}：${s}`);
				}
				if (hant) continue;
				const zeros = Object.values(chart.wuXing).filter((v) => v === 0).length;
				if (chart.pillars.length === 4) st.zero[Math.min(zeros, 3)]!++;
				// 一整类十神没有（天干、藏干里都没有那两个名目）：两个名目都写进「没有」那一串，不单列（审查 S1）
				const names = new Set(chart.pillars.flatMap((x, k) => [...(k === 2 ? [] : [x.shiShen!]), ...x.cangGan.map((h) => h.shiShen)]));
				const absent = p.wx.paras[p.wx.paras.length - 2]!.match(/([^。]*)在这一盘上没有。/)?.[1]?.split("、") ?? [];
				for (let g = 0; g < 10; g += 2) {
					const pair = [TEN_NAMES[g]!, TEN_NAMES[g + 1]!];
					if (pair.some((n) => names.has(n))) continue;
					st.none++;
					if (!pair.every((n) => absent.includes(n))) bad.push(`整类没有却没写进「没有」：${pair}：${p.wx.paras.join("")}`);
				}
				// 三行以上并列不说「最多」（审查 S3）
				if (/([木火土金水]、){2}[木火土金水]最多/.test(p.wx.paras[0]!)) bad.push(`三行以上并列说了最多：${p.wx.paras[0]}`);
				// 真太阳时、夏令时换算后落进晚子时：说清按哪个时刻（审查 S4）
				const lateAt = p.dm.paras.find((s) => s.includes("落在晚子时"));
				const shifted = chart.zhenTaiYang ? chart.zhenTaiYang.time !== chart.solar : (options.dst ?? 0) > 0;
				if (lateAt && shifted !== lateAt.startsWith("按")) bad.push(`晚子时没说清按哪个时刻：${lateAt}`);
				if (chart.daYun[0]!.startAge === 1) st.age1++;
				if (chart.daYun[0]!.startAge === 2) st.age2++;
				if (p.dy.lead.includes("可能差一年")) st.yearDiff++;
				if (p.dy.lead.includes("还没有起运")) st.before++;
				if (p.dy.lead.includes("第十步之后")) st.after++;
				if (p.dy.lead.includes("正好交")) st.jie++;
				if (p.dm.paras[1]!.includes("只藏着")) st.sitOne++;
				// 晚子时那句写的日柱 = 换一种晚子时选项真排出来的日柱；没写那句的，换了选项日柱不变
				const late = p.dm.paras.find((s) => s.includes("落在晚子时"));
				const clockHour = birth.hour ?? 12;
				if (late || (birth.hour !== undefined && (clockHour >= 20 || clockHour <= 3))) {
					const flipped = bazi(birth, { ...options, lateZi: (options.lateZi ?? "day-advances") === "day-advances" ? "day-stays" : "day-advances" }).pillars[2]!.ganZhi;
					if (late) {
						st.lateZi++;
						if (!late.includes(`日柱是${flipped}，`)) bad.push(`晚子时日柱不对（应为${flipped}）：${late}`);
					} else if (flipped !== chart.pillars[2]!.ganZhi) bad.push(`漏了晚子时那句：${JSON.stringify(birth)} ${JSON.stringify(options)}`);
				}
				// 海外那句写的日柱 = 把出生时刻换成北京时间真排出来的日柱；没写那句的，两者相同
				if (chart.beijing) {
					const bj = chart.beijing;
					const b = bazi(solar(+bj.slice(0, 4), +bj.slice(5, 7), +bj.slice(8, 10), +bj.slice(11, 13), +bj.slice(14, 16), birth.gender), { lateZi: options.lateZi }).pillars[2]!.ganZhi;
					const s = p.dm.paras.find((x) => x.startsWith("出生在"));
					if (s) {
						st.abroad++;
						if (!s.includes(`日柱是${b}，`)) bad.push(`海外日柱不对（应为${b}）：${s}`);
					} else if (b !== chart.pillars[2]!.ganZhi) bad.push(`漏了海外那句：${JSON.stringify(birth)} ${JSON.stringify(options)}`);
				}
			}
		};
		let i = 0;
		for (let t = from; t < to; t += step, i++) {
			const d = new Date(t);
			const birth = solar(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), i % 2 ? "女" : "男");
			const options: Options = i % 3 === 2 ? { lateZi: "day-stays" } : {};
			check(birth, options);
			if (i % 5 === 0) check({ ...birth, hour: undefined, minute: undefined }, options);
			if (i % 7 === 0) {
				const [tz, city, lon] = ZONES[(i / 7) % ZONES.length]!;
				const o = localOffset(tz, birth.year, birth.month, birth.day, birth.hour!, birth.minute!);
				check(birth, { ...options, offset: o.offset, dst: o.dst, ...(i % 2 === 0 && { longitude: lon }) }, city);
			}
		}
		console.log(`白话网格：${st.charts} 盘（简繁各拼一次），${seen.size} 个不同的句子与标签`, st);
		expect(bad.slice(0, 20)).toEqual([]);
		// 分支都有盘命中：为 0 的行数 0–3、一类十神全无、1 岁与 2 岁起运、时辰不详且差一年、海外、晚子时、地支只藏一干
		expect(st.zero.every((n) => n > 0)).toBe(true);
		for (const k of ["none", "age1", "age2", "yearDiff", "abroad", "lateZi", "sitOne"] as const) expect(st[k], k).toBeGreaterThan(0);
		if (!FULL) for (const k of ["before", "after", "jie"] as const) expect(st[k], k).toBeGreaterThan(0);
	}, 600_000);

	it("每条句式至少被用到一次（在上面的样例与网格之后跑）", () => {
		// 标题、导语、固定说明、「十神对照表」在构建时由 Bazi.astro 写进页面，不经过拼句
		const PAGE = ["lead", "heads.title", "heads.dm", "heads.dy", "ui.shishen", "wx.close", "dy.foot"];
		// words 里不带空位的是词表（阴阳、顺逆、年月日时、同我……），拼句时直接取用，不记在 USED 里；带空位的照样查
		const all = paths(HANS).filter((k) => !k.startsWith("words.") || at(HANS, k).includes("{"));
		expect(all.filter((k) => !USED.has(k) && !PAGE.includes(k))).toEqual([]);
		// 写进页面的那几条不该被拼句用到（免得改了一处忘了另一处）
		expect(PAGE.filter((k) => USED.has(k))).toEqual([]);
	});
});
