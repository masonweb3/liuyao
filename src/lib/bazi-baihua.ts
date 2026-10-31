/**
 * 八字白话（M20）：把 /bazi/ 的盘面说成白话，三块：日主、五行与十神、大运时间轴。零 DOM；在 Worker 里和排盘一起算
 * （M20-10：句式与拼句代码不进页面脚本），页面脚本只负责画。
 *
 * 只讲有什么、叫什么，不论好坏、不下断语（AGENTS.md §1.5）。句式全在 src/data/bazi-baihua.json 与 -hant.json（键不转，
 * 只转值），这里只把干支、五行、柱名、十神、个数、年份填进空位，不另写一个字的句子。说「这一盘」，不说「你」（M20-12）。
 * 不提神煞名（名字带「贵」）与十二长生步名（自坐可能落在死、墓、绝）。为 0 的只说「0 个」「没有」（M20-3）。
 */
import HANT from "../data/bazi-baihua-hant.json" with { type: "json" };
import HANS from "../data/bazi-baihua.json" with { type: "json" };
import { type Bazi, guanXi, type Options } from "./bazi.js";

const G = "甲乙丙丁戊己庚辛壬癸";
const Z = "子丑寅卯辰巳午未申酉戌亥";
const WX = "木火土金水";
const CN = "一二三四五六七八九十";
// 地支本气、天干方位（甲乙、丙丁……各一个），同 tyme4ts（bazi-baihua.test.ts 逐个核对）
export const BEN_QI = "癸己甲乙戊丙丁己庚辛戊壬";
export const DIRECTION = "东南中西北";
// 十神两两一类，按对日主的关系：同我、我生、我克、克我、生我（口径同 /bazi/shishen/）
const TEN = ["比肩", "劫财", "食神", "伤官", "偏财", "正财", "七杀", "正官", "偏印", "正印"];
// tyme4ts 的名字是简体：繁体页先查页面带来的名称表（十神、节气），刑冲合会与方位只换这三个字
const SIMP = "冲会东";
const TRAD = "沖會東";

/** 拼过的句式（键路径）。测试拿它查每条句式至少用到一次 */
export const USED = new Set<string>();

export interface Chip {
	ch: string;
	/** 年干、月支、日主…… */
	pos: string;
	/** 天干的十神（日主没有） */
	ss?: string;
}

export interface Row {
	el: string;
	n: number;
	/** 「同我 · 比肩、劫财」 */
	label: string;
	chars: Chip[];
	/** 藏干里这一行的五行：「丙 比肩（年支寅）、丁 劫财（月支戌）」，没有就是「没有」 */
	hidden: string;
}

export interface Step {
	ages: string;
	years: string;
	ganZhi: string;
	/** 天干与地支本气的十神「偏财 · 偏财」 */
	ten: string;
	/** 今年在这一步 */
	now: boolean;
	/** 「天干庚，对丙是偏财；地支申，本气庚，也是偏财。」 */
	gz: string;
	/** 与原局各柱的刑冲合会 */
	rel: string;
	/** 今年那步：今年流年一句 */
	year?: string;
}

export interface Plain {
	/** 页面画表、按钮用的字（h2、小标题、固定说明在构建时写进页面，见 Bazi.astro） */
	ui: { jump: string; gan: string; caption: string; cols: string[]; cang: string; none: string; now: string; pre: string };
	dm: { gan: string; card: [string, string]; paras: string[] };
	wx: { sub: string; rows: Row[]; paras: string[] };
	dy: { lead: string; pre?: { ages: string; years: string }; steps: Step[] };
}

export interface Input {
	chart: Bazi;
	options?: Options;
	/** 今年（北京时间的年份），页面传进来 */
	year: number;
	/** 出生地的显示名（本语言），海外出生那句用 */
	city?: string;
	hant?: boolean;
	/** 繁体页的名称表（页面 data-names：十神、节气……） */
	names?: Record<string, string>;
}

const mod = (a: number, n: number) => ((a % n) + n) % n;
/** 干支往后数 n 天（n 可负）：天干、地支各进 n 位 */
const shift = (gz: string, n: number) => G[mod(G.indexOf(gz[0]!) + n, 10)]! + Z[mod(Z.indexOf(gz[1]!) + n, 12)]!;
const elOf = (g: string) => WX[G.indexOf(g) >> 1]!;
/** 「1990-05-15 23:30」→ 分钟数（UTC 纪元起，只拿来比日子与钟点） */
const minutes = (s: string) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10), +s.slice(11, 13), +s.slice(14, 16)) / 6e4;

export function plain({ chart: c, options = {}, year, city = "", hant = false, names = {} }: Input): Plain {
	const T = hant ? HANT : HANS;
	const W = T.words;
	const f = (key: string, v: Record<string, string | number> = {}) => {
		USED.add(key);
		const tpl = key.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], T);
		if (typeof tpl !== "string") throw new Error(`没有句式 ${key}`);
		return tpl.replace(/\{(\w+)\}/g, (_, k: string) => {
			if (v[k] === undefined) throw new Error(`${key} 的 {${k}} 没有填`);
			return String(v[k]);
		});
	};
	const tw = (s: string) => (hant ? (names[s] ?? [...s].map((ch) => TRAD[SIMP.indexOf(ch)] ?? ch).join("")) : s);
	const yy = (g: string) => (G.indexOf(g) % 2 ? W.yin : W.yang);
	const zhu = (k: number) => W.zhu[k]!;

	const known = c.pillars.length === 4;
	const N = W.chars[known ? 0 : 1]!;
	const day = c.pillars[2]!;
	const dm = day.gan;
	const di = G.indexOf(dm);
	const dir = tw(DIRECTION[di >> 1]!);

	// ---------- 日主 ----------
	const dmParas = [
		f("dm.intro", { g: dm, n: CN[di]!, el: elOf(dm), yy: yy(dm), dir }),
		day.cangGan.length === 1
			? f("dm.sitOne", { gz: day.ganZhi, g: dm, z: day.zhi, h: day.cangGan[0]!.gan, ss: tw(day.cangGan[0]!.shiShen) })
			: f("dm.sit", { gz: day.ganZhi, g: dm, z: day.zhi, hs: day.cangGan.map((x) => x.gan).join("、"), sss: day.cangGan.map((x) => tw(x.shiShen)).join("、") }),
	];
	// 晚子时换不换日（M19-1）、海外出生（M19-5）都只动日柱：另一种排法的日柱由日子差几天推出，不必再排一次
	const advance = (options.lateZi ?? "day-advances") === "day-advances";
	const dayOf = (m: number) => Math.floor(m / 1440) + (advance && mod(m, 1440) >= 1380 ? 1 : 0);
	if (!known) {
		const alt = shift(day.ganZhi, 1);
		dmParas.push(advance ? f("dm.noTime", { gz: alt, g: alt[0]! }) : f("dm.noTimeStay"));
	} else {
		// 日柱、时柱按的时刻：真太阳时，或当地标准时（夏令时拨回去），同 bazi.ts
		const dst = Math.round(options.dst ?? 0);
		const local = c.zhenTaiYang ? minutes(c.zhenTaiYang.time) : minutes(c.solar) - dst;
		const basis = c.zhenTaiYang ? "solar" : dst ? "standard" : "time";
		if (mod(local, 1440) >= 1380) {
			const alt = shift(day.ganZhi, advance ? -1 : 1);
			// 换算后的钟点和填的不同（真太阳时、夏令时）：说清按哪个时刻，「当天」写成那一天的日期（审查 S4）
			if (local !== minutes(c.solar)) {
				const t = new Date(local * 6e4);
				const d = `${t.getUTCMonth() + 1}月${t.getUTCDate()}日`;
				const at = { basis: W.late[basis as "solar" | "standard"], date: `${d} ${String(t.getUTCHours()).padStart(2, "0")}:${String(t.getUTCMinutes()).padStart(2, "0")}`, day: d };
				dmParas.push(f(advance ? "dm.lateZiAt" : "dm.lateZiStayAt", { ...at, gz: alt, g: alt[0]! }));
			} else dmParas.push(f(advance ? "dm.lateZi" : "dm.lateZiStay", { gz: alt, g: alt[0]! }));
		}
		// 不在 UTC+8 出生：把出生时刻换成北京时间来排的工具，日柱会差几天（M20-2）
		const bj = c.beijing;
		const diff = bj ? dayOf(minutes(bj)) - dayOf(local) : 0;
		if (bj && diff) {
			const alt = shift(day.ganZhi, diff);
			dmParas.push(f("dm.abroad", { city, basis: W.abroad[basis], date: `${+bj.slice(5, 7)}月${+bj.slice(8, 10)}日 ${bj.slice(11, 16)}`, gz: alt, g: alt[0]! }));
		}
	}

	// ---------- 五行与十神（M20-3、M20-4）：五行按对日主的关系排，五行一行一类 ----------
	const posGan = (k: number) => (k === 2 ? W.self : f("words.gan", { z: zhu(k) }));
	const posZhi = (k: number) => f("words.zhi", { z: zhu(k) });
	const hidden = c.pillars.flatMap((p, k) => p.cangGan.map((x) => ({ k, zhi: p.zhi, gan: x.gan, ss: x.shiShen, el: elOf(x.gan) })));
	/** 藏干按天干合并：「戊（年支寅、月支戌）」；都在同一个字的支里时字只写一次「日支、时支辰」 */
	const merge = (items: typeof hidden) => {
		const by = new Map<string, typeof hidden>();
		for (const x of items) by.set(x.gan, [...(by.get(x.gan) ?? []), x]);
		return [...by.values()].map((xs) => ({
			gan: xs[0]!.gan,
			ss: xs[0]!.ss,
			n: xs.length,
			pos: new Set(xs.map((x) => x.zhi)).size === 1 ? xs.map((x) => posZhi(x.k)).join("、") + xs[0]!.zhi : xs.map((x) => posZhi(x.k) + x.zhi).join("、"),
		}));
	};
	const groups = [0, 1, 2, 3, 4].map((g) => ({ el: WX[(WX.indexOf(elOf(dm)) + g) % 5]!, rel: W.rel[g]!, names: [TEN[g * 2]!, TEN[g * 2 + 1]!] }));
	const rows = groups.map(({ el, rel, names: ns }): Row => {
		const hs = merge(hidden.filter((x) => x.el === el));
		return {
			el,
			n: c.wuXing[el as keyof Bazi["wuXing"]],
			label: f("wx.label", { rel, names: ns.map(tw).join("、") }),
			chars: c.pillars.flatMap((p, k) => [
				...(p.ganWuXing === el ? [{ ch: p.gan, pos: posGan(k), ...(p.shiShen && { ss: tw(p.shiShen) }) }] : []),
				...(p.zhiWuXing === el ? [{ ch: p.zhi, pos: posZhi(k) }] : []),
			]),
			hidden: hs.length ? hs.map((x) => f("wx.hidden", { h: x.gan, ss: tw(x.ss), pos: x.pos })).join("、") : f("ui.none"),
		};
	});

	const wx = c.wuXing as Record<string, number>;
	const has = [...WX].filter((e) => wx[e]! > 0).sort((a, b) => wx[b]! - wx[a]!);
	const max = wx[has[0]!]!;
	const tops = has.filter((e) => wx[e] === max);
	// 三行以上并列时不说「最多」（审查 S3）
	let count = f(tops.length >= 3 ? "wx.even" : tops.length > 1 ? "wx.tops" : "wx.top", { n: N, els: tops.join("、"), k: max });
	const rest = [...new Set(has.filter((e) => wx[e]! < max).map((e) => wx[e]!))].map((k) => {
		const es = has.filter((e) => wx[e] === k);
		return f(es.length > 1 ? "wx.rests" : "wx.rest", { els: es.join("、"), k });
	});
	if (rest.length) count += `；${rest.join("，")}`;
	const zeros = [...WX].filter((e) => wx[e] === 0);
	count += zeros.length ? `；${f(zeros.length > 1 ? "wx.zeros" : "wx.zero", { els: zeros.join("、"), n: N })}` : `。${f("wx.all")}`;
	const wxParas = [known ? count : f("wx.noTime") + count];
	// 为 0 的看藏干：有就说在哪一支里，没有就说「也没有」
	if (zeros.length)
		wxParas.push(
			f("wx.cang", {
				list: zeros
					.map((e) => {
						const hs = merge(hidden.filter((x) => x.el === e));
						return hs.length
							? f("wx.cangHas", { el: e, k: hs.reduce((s, x) => s + x.n, 0), list: hs.map((x) => f("wx.cangAt", { pos: x.pos, h: x.gan })).join("、") })
							: f("wx.cangNone", { el: e });
					})
					.join("；"),
			}),
		);

	// 十神：天干上的、只藏在地支里的、没有的；天干上的称呼怎么来。一整类没有的不单说一句，并进「没有」那一串
	// （审查 S1：女命整类没有克我、男命整类没有我克，单列会被读成「无夫星」「无妻星」）
	const exposed = new Map<string, { o: string; pos: string[] }>();
	c.pillars.forEach((p, k) => {
		if (k !== 2) exposed.set(p.shiShen!, { o: p.gan, pos: [...(exposed.get(p.shiShen!)?.pos ?? []), posGan(k)] });
	});
	const inHidden = new Set(hidden.map((x) => x.ss));
	const only = TEN.filter((n) => inHidden.has(n) && !exposed.has(n));
	const absent = TEN.filter((n) => !exposed.has(n) && !inHidden.has(n));
	let ten = f("ten.exposed", {
		n: W.stems[known ? 0 : 1]!,
		list: TEN.filter((n) => exposed.has(n))
			.map((n) => f("ten.item", { ss: tw(n), h: exposed.get(n)!.o, pos: exposed.get(n)!.pos.join("、") }))
			.join("、"),
	});
	if (only.length) ten += f("ten.only", { list: only.map(tw).join("、") });
	if (absent.length) ten += f("ten.absent", { list: absent.map(tw).join("、") });
	wxParas.push(ten);
	const why = TEN.filter((n) => exposed.has(n)).map((n) => {
		const o = exposed.get(n)!.o;
		const ss = tw(n);
		if (o === dm) return f("ten.twin", { o, g: dm, ss });
		const [eo, eg] = [elOf(o), elOf(dm)];
		const how = [
			() => f("ten.same", { o, g: dm, el: eg }),
			() => f("ten.sheng", { a: dm, ea: eg, b: o, eb: eo }),
			() => f("ten.ke", { a: dm, ea: eg, b: o, eb: eo }),
			() => f("ten.ke", { a: o, ea: eo, b: dm, eb: eg }),
			() => f("ten.sheng", { a: o, ea: eo, b: dm, eb: eg }),
		][TEN.indexOf(n) >> 1]!();
		const same = yy(o) === yy(dm);
		return f("ten.why", { how, yy: same ? f("ten.yySame", { o, g: dm, yy: yy(o) }) : f("ten.yyDiff", { o, yo: yy(o), g: dm, yg: yy(dm) }), ss });
	});
	wxParas.push(f("ten.origin", { list: why.join("；") }));

	// ---------- 大运时间轴（M20-5、M20-6）：十步全列，不按岁数截 ----------
	const gzs = c.pillars.map((p) => p.ganZhi);
	const nPillars = W.pillars[known ? 0 : 1]!;
	const gzText = (gz: string, ss: string, zss: string) =>
		f(ss === zss ? "dy.gzSame" : "dy.gz", { h: gz[0]!, g: dm, ss: tw(ss), z: gz[1]!, bq: BEN_QI[Z.indexOf(gz[1]!)]!, zss: tw(zss) });
	// 运或流年接在原局后面查刑冲合会，只留含它那一柱的（时辰不详时原局三柱，它的下标是 3）；同名合并，写法同盘面（M19-15）
	const relText = (gz: string) => {
		const by = new Map<string, Set<number>>();
		for (const g of guanXi([...gzs, gz])) {
			if (!g.zhu.includes(gzs.length)) continue;
			const s = by.get(g.name) ?? new Set<number>();
			for (const k of g.zhu) if (k !== gzs.length) s.add(k);
			by.set(g.name, s);
		}
		const list = [...by].map(([name, ks]) =>
			f("dy.relItem", {
				name: tw(name),
				zhu: [...ks]
					.sort((a, b) => a - b)
					.map((k) => f("words.pillar", { z: zhu(k) }))
					.join("、"),
			}),
		);
		return list.length ? f("dy.rel", { n: nPillars, list: list.join("、") }) : f("dy.relNone", { n: nPillars });
	};

	const first = c.daYun[0]!;
	const order = c.qiYun.forward ? W.forward : W.backward;
	let lead: string;
	const range = c.qiYun.range;
	if (!known && c.jie) lead = f("dy.noTimeJie", { jie: tw(c.jie.name) });
	else if (!known && range)
		lead =
			range[0].startYear === range[1].startYear
				? f("dy.noTimeSame", { a: first.startAge, y: first.startYear, dir: order })
				: f("dy.noTime", { a: first.startAge, y: first.startYear, dir: order, y0: range[0].startYear, y1: range[1].startYear });
	else {
		lead = f("dy.lead", { a: first.startAge, y: first.startYear, dir: order });
		if (first.startAge === 2) lead += f("dy.preOne");
		else if (first.startAge > 2) lead += f("dy.pre", { b: first.startAge - 1 });
	}
	const cur = c.daYun.findIndex((d) => d.startYear <= year && year <= d.endYear);
	lead +=
		cur >= 0 ? f("dy.now", { year, gz: c.daYun[cur]!.ganZhi }) : year < first.startYear ? f("dy.before", { year }) : f("dy.after", { year });

	const born = +c.solar.slice(0, 4);
	const steps = c.daYun.map((d, i): Step => {
		const n = d.liuNian.find((x) => x.year === year);
		return {
			ages: f("dy.ages", { a: d.startAge, b: d.endAge }),
			years: `${d.startYear}–${d.endYear}`,
			ganZhi: d.ganZhi,
			ten: `${tw(d.shiShen)} · ${tw(d.zhiShiShen)}`,
			now: i === cur,
			gz: gzText(d.ganZhi, d.shiShen, d.zhiShiShen),
			rel: relText(d.ganZhi),
			...(i === cur && n && { year: f("dy.year", { year, gz: n.ganZhi }) + gzText(n.ganZhi, n.shiShen, n.zhiShiShen) + relText(n.ganZhi) }),
		};
	});

	return {
		ui: {
			jump: f("ui.jump"),
			gan: f("ui.gan", { g: dm }),
			caption: f("heads.wx"),
			cols: T.ui.cols.map((_, i) => f(`ui.cols.${i}`, { n: N })),
			cang: f("ui.cang"),
			none: f("ui.none"),
			now: f("ui.now"),
			pre: f("ui.pre"),
		},
		dm: {
			gan: dm,
			card: [
				f("dm.card", { yy: yy(dm), el: elOf(dm), n: CN[di]!, dir }),
				f("dm.cardCang", { gz: day.ganZhi, z: day.zhi, hs: day.cangGan.map((x) => x.gan).join("、") }),
			],
			paras: dmParas,
		},
		wx: { sub: f("wx.sub", { g: dm, n: N }), rows, paras: wxParas },
		dy: {
			lead,
			...(first.startAge > 1 && {
				pre: {
					ages: first.startAge === 2 ? f("dy.agesOne", { a: 1 }) : f("dy.ages", { a: 1, b: first.startAge - 1 }),
					years: first.startYear - 1 === born ? String(born) : `${born}–${first.startYear - 1}`,
				},
			}),
			steps,
		},
	};
}
