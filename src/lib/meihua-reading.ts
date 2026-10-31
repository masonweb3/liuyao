/**
 * 梅花的成卦屏与解读页要显示的一切：卦象、体用生克、断语与建议、卦爻辞与白话、起卦算式。零 DOM。
 *
 * 只在梅花页的 Worker 里跑（scripts/meihua-worker.ts，单独打包）：这里要用 tyme4ts 和全部卦爻辞，
 * 页面脚本一 import 它们，就会和首页共用分包（见 meihua-page.ts 文件头）。
 * 卦辞、白话、断语模板都是六爻那几份（guaci.json、baihua.json、yao-baihua.json、templates.ts）；
 * 吉凶由 meihua-duan.ts 按体用生克判（M21-5、M21-18）。
 */
import baihua from "../data/baihua.json" with { type: "json" };
import { guaPath } from "../data/gua-slugs.js";
import guaci from "../data/guaci.json" with { type: "json" };
import { TEMPLATES } from "../data/templates.js";
import yaoBaihua from "../data/yao-baihua.json" with { type: "json" };
import guaciHant from '../data/guaci-hant.json';
import baihuaHant from '../data/baihua-hant.json';
import yaoHant from '../data/yao-baihua-hant.json';
import templatesHant from '../data/templates-hant.json';
import wordsHant from '../data/meihua-reading-hant.json';
import { yaoHtml, yaoTitle } from "./flow.js";
import { fontOf, shortName } from "./gua.js";
import type { LateZiSect } from "./liuyao/calendar.js";
import { ZHIS } from "./liuyao/const.js";
import type { Topic } from "./liuyao/duan.js";
import type { Yao } from "./liuyao/najia.js";
import { byNumbers, byTime, type Hexagram, type Meihua, type Moment, type Trigram, yearName } from "./meihua.js";
import { duan, type Rel, type Verdict } from "./meihua-duan.js";
import { type By, dayName, hourOf, monthName } from "./meihua-page.js";

export interface GuaView {
	/** 雷风恒 */
	name: string;
	/** 恒 */
	short: string;
	/** 卦页 /gua/lei-feng-heng/ */
	href: string;
	/** 卦名、卦辞的字体（fontOf，tokens.css 的变量名）：夬、姤这类小薇缺字的整块用宋体 */
	font: string;
	ci: string;
	ciFont: string;
	baihua: string;
	/** 六爻的 HTML，上卦一组、下卦一组，上爻在上 */
	lines: string;
}

export interface MeihuaView {
	/** Worker 附上的现有卦页字体清单，主线程不 import 词库或字体模块。 */
	fonts?: {variable:string;family:string;files:{url:string;range:string}[]}[];
	/** 本卦铜钱和，初爻在前，动爻 9 或 6：和往卦记录的 params 相同 */
	params: Yao[];
	verdict: Verdict;
	conclusion: string;
	advice: string[];
	/** 所问的类别，按择类屏的叫法（子女、朋友） */
	topic: string;
	ben: GuaView;
	bian: GuaView;
	hu: {
		name: string;
		short: string;
		font: string;
		/** 乾金、兑金 */
		lower: string;
		upper: string;
		/** 本卦是乾或坤，取变卦之互（M21-10） */
		fromBian: boolean;
		lines: string;
		/** 解读页互卦一段的整句 */
		say: string;
	};
	dong: { title: string; text: string; font: string; baihua: string };
	/** 依据表四行：体卦、用卦、互卦、变卦 → [说明, 对体卦] */
	rows: [string, string][];
	/** 依据：用定基调、互看经过、变看结局三句，印由第三步或「一吉一凶」定下时多一句 */
	reasons: string[];
	/** 起卦算式三行 */
	formula: string[];
	/** 丙午年 八月廿一 申时 */
	when: string;
	by: By["by"];
	/** 数字起卦报的数：3、5 */
	nums: string;
	hour: string;
}

const GUACI: Record<string, string> = guaci;
const BAIHUA: Record<string, string> = baihua;
const YAO_BAIHUA: Record<string, Record<string, string>> = yaoBaihua;
/** 择类屏的叫法（同 reading.ts） */
const LABEL: Partial<Record<Topic, string>> = { 子孙: "子女", 兄弟: "朋友" };

const TRI_HANT:Record<string,string>={乾:'乾',兑:'兌',离:'離',震:'震',巽:'巽',坎:'坎',艮:'艮',坤:'坤'};
const el = (t: Trigram,hant=false) => `${hant?TRI_HANT[t.name]:t.name}${t.element}`;
const guaName=(name:string,hant=false)=>hant?(guaciHant as Record<string,string>)[name]!.split('\n')[0]!.split(' ')[2]!:name;
const guaShort=(name:string,hant=false)=>{if(!hant)return shortName(name);const n=guaName(name,true);return n[1]==='為'?n.slice(0,1):n.slice(2);};
const guaFont=(name:string)=>`--gua-${guaPath(name).split('/')[2]}`;

/** 一卦六爻：上卦一组、下卦一组（梅花看两个经卦，中间多留一点缝），组旁可带体、用标签。 */
function lines(h: Hexagram, dong: number, tags?: { upper: string; lower: string },hant=false): string {
	const yao = (i: number) => {
		const yang = h.mark[i] === "1";
		const moving = i === dong - 1;
		const title = yaoTitle(i, yang);
		return yaoHtml(yang, moving, moving ? `${title}${hant?' 動':' 动'}` : title);
	};
	const group = (from: number, tag = "") =>
		`<div class="grp"><div class="tri">${[from + 2, from + 1, from].map(yao).join("")}</div>${tag}</div>`;
	return group(3, tags?.upper) + group(0, tags?.lower);
}

function gua(h: Hexagram, dong: number, tags?: { upper: string; lower: string },hant=false): GuaView {
	const ci = ((hant?guaciHant:GUACI) as Record<string,string>)[h.name]!.split("\n")[1] ?? "";
	const name=guaName(h.name,hant);
	return {
		name,
		short: guaShort(h.name,hant),
		href: guaPath(h.name,hant),
		font: hant?guaFont(h.name):fontOf(h.name),
		ci,
		ciFont: hant?guaFont(h.name):fontOf(ci),
		baihua: ((hant?baihuaHant:BAIHUA) as Record<string,string>)[h.name]!,
		lines: lines(h, dong, tags,hant),
	};
}

/** 依据表右列：用卦、互卦、变卦对体卦的五种关系，叫法同说明区（「为体所生」「为体所克」，不写「体生用」：互卦、变卦的经卦不是用卦）。 */
const PLAIN: Record<Rel, string> = { 比和: "比和", 生体: "生体", 克体: "克体", 体生: "为体所生", 体克: "为体所克" };
// 依据各句的白话：这件事（用卦）、经过之中（互卦）、结局（变卦）。克体一侧只说「有些阻力」，不写恐吓式的话。
const SAY: Record<Rel, string> = { 比和: "与体卦比和", 生体: "生体卦", 克体: "克体卦", 体生: "为体所生", 体克: "为体所克" };
const SELF: Record<Rel, string> = { 比和: "与你相合", 生体: "对你有所助益", 克体: "对你有些阻力", 体生: "要你多花些心力", 体克: "你能应对" };
const GOT: Record<Rel, string> = { 比和: "相合处", 生体: "助力", 克体: "阻力", 体生: "耗费", 体克: "把握" };
const END: Record<Rel, string> = { 比和: "顺当", 生体: "有所进益", 克体: "有些阻力", 体生: "要多费些心力", 体克: "可以把握" };

/** 依据：用卦、互卦、变卦各一句；印由第三步或「一吉一凶」定下时，再补一句它是怎么来的（duan() 的次序）。 */
function reasons(m: Meihua,hant=false): string[] {
	const { ti, yong, hu, bian, rel } = m;
	const tr=(s:string,h:string)=>hant?h:s;
	const say=hant?wordsHant.say:SAY,self=hant?wordsHant.self:SELF,got=hant?wordsHant.got:GOT,end=hant?wordsHant.end:END;
	const t = el(ti,hant);
	const y = el(yong,hant);
	const first = {
		比和: tr(`用卦${y}与体卦${t}比和`,`用卦${y}與體卦${t}比和`),
		生体: tr(`用卦${y}生体卦${t}`,`用卦${y}生體卦${t}`),
		克体: tr(`用卦${y}克体卦${t}`,`用卦${y}克體卦${t}`),
		体生: tr(`体卦${t}生用卦${y}`,`體卦${t}生用卦${y}`),
		体克: tr(`体卦${t}克用卦${y}`,`體卦${t}克用卦${y}`),
	}[rel.yong];
	const [h0, h1] = rel.hu;
	const l = el(hu.lower,hant);
	const u = el(hu.upper,hant);
	const name=guaName(hu.name,hant);
	// 互卦是乾为天、坤为地时上下同一经卦，不写「乾金、乾金」
	const mid =
		hu.lower.name === hu.upper.name
			? tr(`互卦${name}，上下两个经卦都是${l}，${say[h0]}，经过之中多有${got[h0]}`,`互卦${name}，上下兩個經卦都是${l}，${say[h0]}，經過之中多有${got[h0]}`)
			: h0 === h1
				? tr(`互卦${name}，${l}、${u}都${say[h0]}，经过之中多有${got[h0]}`,`互卦${name}，${l}、${u}都${say[h0]}，經過之中多有${got[h0]}`)
				: tr(`互卦${name}，${l}${say[h0]}，${u}${say[h1]}，经过之中有${got[h0]}，也有${got[h1]}`,`互卦${name}，${l}${say[h0]}，${u}${say[h1]}，經過之中有${got[h0]}，也有${got[h1]}`);
	const to = inner(m) ? bian.lower : bian.upper;
	// 第三步（审查 R2）：duan() 最先判它。成立时补一句，不然依据说「结局顺当」、印却是凶
	const four = [rel.yong, ...rel.hu, rel.bian];
	const ke = four.filter((r) => r === "克体").length;
	// 「体生」是唯一判平的用卦；其余用卦判出平，只能是用卦与变卦一吉一凶（第三步只判凶）。审查 S1
	const why =
		ke === 4
			? [tr('用卦、互卦两个经卦、变卦四处都克体，所以断为凶。','用卦、互卦兩個經卦、變卦四處都克體，所以斷為凶。')]
			: ke >= 2 && !four.includes("生体")
				? [tr(`用卦、互卦两个经卦、变卦四处合看，${ke === 2 ? "两" : "三"}处克体，没有一处生体，所以断为凶。`,`用卦、互卦兩個經卦、變卦四處合看，${ke===2?'兩':'三'}處克體，沒有一處生體，所以斷為凶。`)]
				: rel.yong !== "体生" && duan(rel) === "平"
					? [tr('用卦与变卦一吉一凶，所以断为平。','用卦與變卦一吉一凶，所以斷為平。')]
					: [];
	return [
		`${first}，${tr('这件事','這件事')}${self[rel.yong]}。`,
		`${mid}。`,
		tr(`变卦${guaName(bian.name,hant)}，${y}变为${el(to,hant)}，${say[rel.bian]}，结局${end[rel.bian]}。`,`變卦${guaName(bian.name,hant)}，${y}變為${el(to,hant)}，${say[rel.bian]}，結局${end[rel.bian]}。`),
		...why,
	];
}

/** 解读页互卦一段：只看两个经卦；乾、坤取变卦之互，动在初爻、上爻时变卦之互仍是自身（审查 R1）。 */
function huSay(m: Meihua, fromBian: boolean,hant=false): string {
	const t=(s:string,h:string)=>hant?h:s;
	const say =
		m.hu.lower.name === m.hu.upper.name
			? t(`互卦只看它的两个经卦对体卦的生克，不读卦辞：上下都是${el(m.hu.lower,hant)}。`,`互卦只看它的兩個經卦對體卦的生克，不讀卦辭：上下都是${el(m.hu.lower,hant)}。`)
			: t(`互卦只看它的两个经卦对体卦的生克，不读卦辞：${el(m.hu.lower,hant)}在下，${el(m.hu.upper,hant)}在上。`,`互卦只看它的兩個經卦對體卦的生克，不讀卦辭：${el(m.hu.lower,hant)}在下，${el(m.hu.upper,hant)}在上。`);
	if (!fromBian) return say;
	const qk = t('乾、坤的互卦仍是自身，原书说「乾坤无互，互其变卦」，这里取变卦的互卦；','乾、坤的互卦仍是自身，原書說「乾坤無互，互其變卦」，這裡取變卦的互卦；');
	return m.hu.name === m.ben.name
		? t(`${say}${qk}动在初爻、上爻时，变卦的互卦仍是${m.hu.name}，与卦页相同。`,`${say}${qk}動在初爻、上爻時，變卦的互卦仍是${guaName(m.hu.name,true)}，與卦頁相同。`)
		: `${say}${qk}${t('卦页上列的是一般的取法，所以两处不同。','卦頁上列的是一般的取法，所以兩處不同。')}`;
}

const inner = (m: Meihua) => m.dong <= 3;

/** 「÷8 余 4」；余数为零时作八、作六（坤、上爻），写出来免得看不懂。 */
const rest = (n: number, by: number,hant=false) => (n % by ? `${hant?'餘':'余'} ${n % by}` : `${hant?'餘':'余'} 0，作 ${by}`);

/** 起卦算式三行：上卦、下卦、动爻各怎么来。 */
function formula(m: Meihua, by: By, date: Date, mo: Moment | null,hant=false): string[] {
	const [up, down, moving] = m.sums;
	const upper = `÷8 ${rest(up, 8,hant)}，上卦${hant?TRI_HANT[m.ben.upper.name]:m.ben.upper.name}`;
	const lower = `÷8 ${rest(down, 8,hant)}，下卦${hant?TRI_HANT[m.ben.lower.name]:m.ben.lower.name}`;
	const dong = `÷6 ${rest(moving, 6,hant)}，${yaoTitle(m.dong - 1, m.ben.mark[m.dong - 1] === "1")}${hant?'動':'动'}`;
	const hour = hourOf(date);
	const h = `${hour.name}${hant?'時':'时'} ${hour.num}`;
	if (mo) {
		const y = `${mo.year}年 ${ZHIS.indexOf(mo.year) + 1}`;
		return [
			`${y} ＋ ${monthName(mo.month, mo.leap,hant)} ${mo.month} ＋ ${dayName(mo.day)} ${mo.day} ＝ ${up}，${upper}`,
			`${up} ＋ ${h} ＝ ${down}，${lower}`,
			`${moving} ${dong}`,
		];
	}
	const [a, b] = by.by === "num" ? by.nums : [];
	if (b !== undefined) return [`${a} ${upper}`, `${b} ${lower}`, `${a} ＋ ${b} ＋ ${h} ＝ ${moving}，${dong}`];
	return [`${a} ${upper}`, `${a} ＋ ${h} ＝ ${down}，${lower}`, `${moving} ${dong}`];
}

export interface Request {
	hant?: boolean;
	by: By;
	/** 起卦时刻，ISO 8601 */
	at: string;
	topic: Topic;
	lateZi: LateZiSect;
}

/** 起一卦，备好成卦屏与解读页的全部文字。数字不合规时抛错（页面先校验过，这里只是兜底）。 */
export function compose({ by, at, topic, lateZi,hant=false }: Request): MeihuaView {
	const text=(s:string,h:string)=>hant?h:s;
	const date = new Date(at);
	const tm = by.by === "time" ? byTime(date, lateZi) : null;
	const m: Meihua = tm ?? byNumbers(by.by === "num" ? by.nums : [], date);
	const mo = tm?.moment ?? null;
	const hour = hourOf(date).name;
	const verdict = duan(m.rel);
	const t = (hant?templatesHant.TEMPLATES:TEMPLATES)[topic][verdict];
	const plain=hant?wordsHant.plain:PLAIN;
	const ty = inner(m) ? "上" : "下";
	const yo = inner(m) ? "下" : "上";
	const dongTitle = yaoTitle(m.dong - 1, m.ben.mark[m.dong - 1] === "1");
	const tag = (k: "体" | "用", tri: Trigram, moving: boolean) =>
		`<span class="tag${k === "用" ? " yong" : ""}"><b>${hant&&k==='体'?'體':k}</b><span>${el(tri,hant)}${moving ? text('，动','，動') : ""}</span></span>`;
	const tiTag = tag("体", m.ti, false);
	const yongTag = tag("用", m.yong, true);
	// 时间起卦写出农历年月日；数字起卦只用时辰
	const when = mo
		? `${yearName(date, lateZi)}年 ${monthName(mo.month, mo.leap,hant)}${dayName(mo.day)} ${hour}${text('时','時')}`
		: `${hour}${text('时','時')}`;
	const yaoLine = ((hant?guaciHant:GUACI) as Record<string,string>)[m.ben.name]!.split("\n").find((l) => l.startsWith(`${dongTitle}：`)) ?? "";
	const yaoText = yaoLine.slice(dongTitle.length + 1);
	const fromBian = m.ben.name === "乾为天" || m.ben.name === "坤为地";
	return {
		params: m.params,
		verdict,
		conclusion: t.conclusion,
		advice: t.advice,
		topic: hant?({财:'財',事业:'事業',父母:'父母',子孙:'子女',兄弟:'朋友',婚恋:'婚戀',自身:'自身'}[topic]):LABEL[topic] ?? topic,
		ben: gua(m.ben, m.dong, inner(m) ? { upper: tiTag, lower: yongTag } : { upper: yongTag, lower: tiTag },hant),
		bian: gua(m.bian, 0,undefined,hant),
		hu: {
			name: guaName(m.hu.name,hant),
			short: guaShort(m.hu.name,hant),
			font: hant?guaFont(m.hu.name):fontOf(m.hu.name),
			lower: el(m.hu.lower,hant),
			upper: el(m.hu.upper,hant),
			fromBian,
			lines: lines(m.hu, 0,undefined,hant),
			say: huSay(m, fromBian,hant),
		},
		dong: { title: dongTitle, text: yaoText, font: hant?guaFont(m.ben.name):fontOf(yaoText), baihua: ((hant?yaoHant:YAO_BAIHUA) as Record<string,Record<string,string>>)[m.ben.name]?.[dongTitle] ?? "" },
		rows: [
			[`${el(m.ti,hant)} · ${ty}卦，${text('不动','不動')}`, "—"],
			[`${el(m.yong,hant)} · ${yo}卦，${dongTitle}${text('动','動')}`, plain[m.rel.yong]],
			[`${guaName(m.hu.name,hant)} · ${el(m.hu.lower,hant)}、${el(m.hu.upper,hant)}`, `${plain[m.rel.hu[0]]}、${plain[m.rel.hu[1]]}`],
			[`${guaName(m.bian.name,hant)} · ${el(m.yong,hant)}${text('变','變')}${el(inner(m) ? m.bian.lower : m.bian.upper,hant)}`, plain[m.rel.bian]],
		],
		reasons: reasons(m,hant),
		formula: formula(m, by, date, mo,hant),
		when,
		by: by.by,
		nums: by.by === "num" ? by.nums.join("、") : "",
		hour,
	};
}
