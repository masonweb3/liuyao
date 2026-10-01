/**
 * 八字知识页（M19b）的数据：十天干、十二地支、十神、纳音、十二长生。全部在构建时由 tyme4ts 与 bazi.ts 算出、写进 HTML，
 * 页面不带脚本，不手写一张表（设计定稿 docs/design-bazi-kb.md §0.2）。
 *
 * 刑冲合会只拿 bazi.ts 的 guanXi 判断「有没有」、取它的写法（两字按干支序，半合按三合局次序，M19-15）；
 * 知识页列的是「这一支和谁有关系」，所以三刑（三支凑齐）与相刑（只见两支）分开列（设计发现 2），
 * 不沿用盘面「三刑凑齐就不再列相刑」的四柱语义。
 */
import { EarthBranch, HeavenStem, SixtyCycle, SolarDay, SolarTerm, Terrain } from "tyme4ts";
import { guanXi, type GuanXiType } from "./bazi.js";
import { FIRST, HANT, inWindow, ymd } from "./huangli-days.js";

export const GAN = "甲乙丙丁戊己庚辛壬癸";
export const ZHI = "子丑寅卯辰巳午未申酉戌亥";
/** 网址 slug：无调全拼，上线后不改。戊与午都是 wu，分在两个目录下，不冲突 */
export const GAN_SLUG = ["jia", "yi", "bing", "ding", "wu", "ji", "geng", "xin", "ren", "gui"] as const;
export const ZHI_SLUG = ["zi", "chou", "yin", "mao", "chen", "si", "wu", "wei", "shen", "you", "xu", "hai"] as const;

export type Kind = "tiangan" | "gan" | "dizhi" | "zhi" | "shishen" | "nayin" | "changsheng";

/** 全部 27 页（简体网址，繁体加 /zh-hant）：路由、sitemap 都从这里取 */
export const KB_PAGES: { kind: Kind; name?: string; path: string }[] = [
	{ kind: "tiangan", path: "/bazi/tiangan/" },
	...[...GAN].map((name, i) => ({ kind: "gan" as const, name, path: `/bazi/tiangan/${GAN_SLUG[i]}/` })),
	{ kind: "dizhi", path: "/bazi/dizhi/" },
	...[...ZHI].map((name, i) => ({ kind: "zhi" as const, name, path: `/bazi/dizhi/${ZHI_SLUG[i]}/` })),
	{ kind: "shishen", path: "/bazi/shishen/" },
	{ kind: "nayin", path: "/bazi/nayin/" },
	{ kind: "changsheng", path: "/bazi/changsheng/" },
];

export const kbPath = (path: string, hant = false) => `${hant ? HANT : ""}${path}`;
export const ganPath = (g: string, hant = false) => kbPath(`/bazi/tiangan/${GAN_SLUG[GAN.indexOf(g)]}/`, hant);
export const zhiPath = (z: string, hant = false) => kbPath(`/bazi/dizhi/${ZHI_SLUG[ZHI.indexOf(z)]}/`, hant);

/** 天干页正文引用的两个小节名（「甲日主看十天干」「癸的十二长生」）：页面与测试都从这里取，逐字一致 */
export const tenHead = (g: string) => `${g}日主看十天干`;
export const csHead = (g: string, hant = false) => `${g}的${hant ? "十二長生" : "十二长生"}`;

/** 十二长生的十二步：长生、沐浴……养 */
export const STEPS = Terrain.NAMES;

// 干支的阴阳按次序：甲、子起单数位属阳
const yy = (i: number) => (i % 2 ? "阴" : "阳");
const pad = (n: number) => String(n).padStart(2, "0");

/**
 * 纳音表每行的锚点 id：这一组第一柱（阳干阳支）的全拼，如 #jiazi。阴干总在一组的第二柱，
 * 乙丑落在 #jiazi，不按字面拼 #yichou（不存在）。
 */
export function nayinId(ganZhi: string): string {
	const k = SixtyCycle.fromName(ganZhi).getIndex();
	const first = SixtyCycle.fromIndex(k - (k % 2)).getName();
	return GAN_SLUG[GAN.indexOf(first[0]!)]! + ZHI_SLUG[ZHI.indexOf(first[1]!)]!;
}

export interface Pillar {
	ganZhi: string;
	naYin: string;
	/** 纳音表里它所在那一组的锚点 */
	id: string;
}
const pillar = (k: number): Pillar => {
	const c = SixtyCycle.fromIndex(k);
	return { ganZhi: c.getName(), naYin: c.getSound().getName(), id: nayinId(c.getName()) };
};

/** 一个天干的十二步各落在哪个地支（下标是步：0 长生 … 11 养） */
export function changsheng(g: string): string[] {
	const h = HeavenStem.fromName(g);
	const byStep: string[] = [];
	for (const z of ZHI) byStep[h.getTerrain(EarthBranch.fromName(z)).getIndex()] = z;
	return byStep;
}

/** 十神对照表 10×10：行是日主，列是遇到的天干（日主.getTenStar(他干)，同 bazi.ts） */
export const shishenTable = () =>
	[...GAN].map((me) => [...GAN].map((o) => HeavenStem.fromName(me).getTenStar(HeavenStem.fromName(o)).getName()));

/** 十神的来历 5×2：五行关系 × 阴阳同异，名字取甲日主那一行（测试逐格核过十个日主都成立） */
export const REL = ["同我", "我生", "我克", "克我", "生我"] as const;
export const shishenLogic = () => {
	const jia = shishenTable()[0]!;
	return REL.map((rel, r) => ({ rel, same: jia[2 * r]!, diff: jia[2 * r + 1]! }));
};

/** 三十组纳音：两柱、名字、五行（名字的末字） */
export const nayinGroups = () =>
	Array.from({ length: 30 }, (_, n) => {
		const [a, b] = [pillar(2 * n), pillar(2 * n + 1)];
		return { pair: [a.ganZhi, b.ganZhi] as const, name: a.naYin, wuXing: a.naYin.at(-1)!, id: a.id };
	});

export function ganFacts(g: string) {
	const i = GAN.indexOf(g);
	if (i < 0) throw new Error(`不认识的天干：${g}`);
	const h = HeavenStem.fromIndex(i);
	// 合干差五位；名字照排盘页的写法（guanXi：按天干序，甲己合土）
	const he = guanXi([`${g}子`, `${GAN[(i + 5) % 10]}子`]).find((r) => r.type === "天干五合")!.name;
	return {
		index: i,
		yinYang: yy(i),
		wuXing: h.getElement().getName(),
		// 天干的方位用 tyme4ts（戊己中央土写「中」是对的）；地支的不能用，见 zhiFacts
		direction: h.getDirection().getName(),
		he,
		ten: [...GAN].map((o) => ({ gan: o, star: h.getTenStar(HeavenStem.fromName(o)).getName() })),
		changsheng: changsheng(g),
		/** 六十甲子里的六柱，按甲子起的次序 */
		pillars: Array.from({ length: 6 }, (_, n) => pillar(i + 10 * n)),
	};
}

// 地支的方位按三会取：亥子丑北、寅卯辰东、巳午未南、申酉戌西（同 bazi.ts 的 SAN_HUI）。
// 不用 EarthBranch.getDirection()：它按五行取，丑辰未戌都给「中」，丑页就会同时写「方位 中」与「亥子丑三会水局」（设计发现 8）
const DIRECTION = "北北东东东南南南西西西北";
// 地支月从哪个节交起：子月大雪起，丑月小寒起……（八字按交节时刻换月）
const JIE = ["大雪", "小寒", "立春", "惊蛰", "清明", "立夏", "芒种", "小暑", "立秋", "白露", "寒露", "立冬"];
const QI = ["余气", "中气", "本气"]; // HideHeavenStemType：0 余气、1 中气、2 本气
const SAN_HE = ["申子辰", "巳酉丑", "寅午戌", "亥卯未"];

/** 地支关系在页面上的次序与类名（设计稿 31：一行一类） */
export const REL_TYPES: [GuanXiType, string][] = [
	["地支六合", "六合"],
	["三合", "三合"],
	["半合", "半合"],
	["三会", "三会"],
	["六冲", "六冲"],
	["六害", "六害"],
	["三刑", "三刑"],
	["相刑", "相刑"],
	["自刑", "自刑"],
];

/**
 * 这一支在刑冲合会里的全部关系：与每一支（含自己，自刑）两两查，与另外两支三个一组查三合、三会、三刑。
 * 同类按地支序列出；半合照三合局的次序（申子在子辰前）。
 */
export function relations(z: string): { type: GuanXiType; name: string }[] {
	const out: { type: GuanXiType; name: string }[] = [];
	const add = (type: GuanXiType, name: string) => {
		if (!out.some((r) => r.name === name)) out.push({ type, name });
	};
	for (const y of ZHI) for (const r of guanXi([`甲${z}`, `甲${y}`])) if (r.type !== "天干五合") add(r.type, r.name);
	const others = [...ZHI].filter((y) => y !== z);
	for (let a = 0; a < others.length; a++)
		for (let b = a + 1; b < others.length; b++)
			for (const r of guanXi([`甲${z}`, `甲${others[a]}`, `甲${others[b]}`]))
				if (r.type === "三合" || r.type === "三会" || r.type === "三刑") add(r.type, r.name);
	const rank = (r: { type: GuanXiType; name: string }) =>
		REL_TYPES.findIndex(([t]) => t === r.type) * 10 +
		(r.type === "半合" ? SAN_HE.find((s) => s.includes(r.name[0]!) && s.includes(r.name[1]!))!.indexOf(r.name[0]!) : 0);
	// sort 是稳定的：同类同位的保持地支序
	return out.sort((p, q) => rank(p) - rank(q));
}

/** 北京时间「2026-10-01 08:30」：节月、该日按北京时间比（同黄历，与构建机器的时区无关） */
export const beijingNow = (now = new Date()) => new Date(now.getTime() + 8 * 3_600_000).toISOString().slice(0, 16).replace("T", " ");

const stamp = (t: SolarTerm) => {
	const at = t.getJulianDay().getSolarTime();
	return `${ymd(at.getYear(), at.getMonth(), at.getDay())} ${pad(at.getHour())}:${pad(at.getMinute())}`;
};

/**
 * 这一支的节月：从哪个节交起、到下一个节为止，取 now 那一刻还没过完的那一回（按交节时刻，不按日：
 * 八字的月柱按时刻换，和黄历逢节重建不同，设计发现 5）。每次部署重算，同节气页。
 */
export function jieMonth(z: string, now: string) {
	const name = JIE[ZHI.indexOf(z)]!;
	for (let y = Number(now.slice(0, 4)) - 1; ; y++) {
		const s = SolarTerm.fromName(y, name);
		const e = s.next(2);
		if (stamp(e) > now) return { from: { name, time: stamp(s) }, to: { name: e.getName(), time: stamp(e) } };
	}
}

/**
 * 从 today（含）起接下来 n 个这一支的日子，只取黄历时间窗内的：逐日页只在窗内（设计发现 7：窗末尾会少列，一天都没有时整节不出）。
 */
export function nextDays(z: string, today: string, n = 6): string[] {
	const out: string[] = [];
	const start = today < FIRST ? FIRST : today;
	let d = SolarDay.fromYmd(...(start.split("-").map(Number) as [number, number, number]));
	for (let s = start; out.length < n && inWindow(s); d = d.next(1), s = ymd(d.getYear(), d.getMonth(), d.getDay())) {
		if (d.getSixtyCycleDay().getSixtyCycle().getEarthBranch().getName() === z) out.push(s);
	}
	return out;
}

export function zhiFacts(z: string, now: string) {
	const j = ZHI.indexOf(z);
	if (j < 0) throw new Error(`不认识的地支：${z}`);
	const b = EarthBranch.fromIndex(j);
	const start = (2 * j + 23) % 24;
	return {
		index: j,
		yinYang: yy(j),
		wuXing: b.getElement().getName(),
		zodiac: b.getZodiac().getName(),
		direction: DIRECTION[j]!,
		/** 时辰「23:00–01:00」 */
		hours: `${pad(start)}:00–${pad((start + 2) % 24)}:00`,
		/** 藏干：本气、中气、余气 */
		cang: b.getHideHeavenStems().map((h) => {
			const g = h.getHeavenStem();
			return { gan: g.getName(), type: QI[h.getType()]!, yinYang: yy(g.getIndex()), wuXing: g.getElement().getName() };
		}),
		month: jieMonth(z, now),
		rels: relations(z),
		/** 六十甲子里的五柱，按甲子起的次序 */
		pillars: Array.from({ length: 5 }, (_, n) => pillar(j + 12 * n)),
		days: nextDays(z, now.slice(0, 10)),
	};
}

/** 十天干的十二长生表：每个天干（注阴阳）的十二步 */
export const changshengTable = () => [...GAN].map((g, i) => ({ gan: g, yinYang: yy(i), byStep: changsheng(g) }));
