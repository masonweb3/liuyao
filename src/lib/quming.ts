// 测名（M22a）的计算：零 DOM、零依赖，/quming/ 的页面脚本与测试共用（页面脚本只能 import 它：首页入口包不能变）。
// 字表是 src/data/quming-zi.json（tools/build-quming.py 由 Unihan 18.0.0 生成），页面第一次点进输入框时整份下载，
// 之后只查表求和，不再发请求。名字不出浏览器（AGENTS.md §1.5）。
// 康熙笔画：繁体字形 → 部首本字笔画 + 部外画（字表里已按例外表改过），数字一到十按数值、王 记 4（M22-1、M22-2）。
// 五格：中文通行算法，带假一，外格 = 天 + 地 − 人，超过 81 减 80、81 自成一条（M22-4 A ①）；三才只给三个尾数的五行（M22-19）。

export interface Data {
	/** 214 个部首本字，下标是部首号减 1 */
	rad: string;
	/** 《通用规范汉字表》8105 字（按表的序号排）：一字一条，见 build-quming.py 的 record() */
	g: Record<string, string>;
	/** 表外的 Big5 字与繁体字形 */
	z: Record<string, string>;
	/** 例外表里的字形 → 同文书局本页码 */
	x: Record<string, number>;
	/** 字表外的字 → Unihan 记的、字表里有的异体 */
	v: Record<string, string>;
	/** 姓（简体，一或两字）→ 每字 [普通话, 粤拼或 null] */
	sur: Record<string, [string, string | null][]>;
	/** 复姓（简体） */
	fu: string[];
	/** 港式姓氏写法（键是简体） */
	hk: Record<string, string>;
	/** 英文不雅词（LDNOOBW 单词条目加自建） */
	bad: string[];
	/** 正好是一个完整音节时放行的词 */
	pass: string[];
}

export interface Form {
	form: string;
	/** 康熙笔画（进五格的数） */
	kx: number;
	/** 部首号与部外画（原书「某部某画」） */
	rad: number;
	res: number;
	/** 今字形的笔画（Unihan kTotalStrokes） */
	today: number;
	/** 两条约定：数字按数值、王 记 4 */
	conv?: "num" | "wang";
	/** 例外表：同文书局本页码 */
	page?: number;
	/** 被书序检查标出、又没看过影印本 */
	unchecked: boolean;
}

export interface Zi {
	/** 规范字（读音、字表用它）；表外的 Big5 字就是自己 */
	simp: string;
	/** 可选的字形，默认在前；只有一个时不让选 */
	forms: Form[];
	/** 可选的普通话读音，默认在前 */
	readings: string[];
	/** 台湾读音（繁体页的默认） */
	tw: string;
	jyut: string;
	/** 在《通用规范汉字表》里 */
	inTgh: boolean;
}

export interface Pick {
	/** 字表外的字改按这个异体算 */
	sub?: string;
	form?: string;
	read?: string;
}

export interface Char {
	/** 写的字 */
	input: string;
	/** 实际算的字（按异体算时是异体） */
	used: string;
	zi: Zi;
	form: Form;
	read: string;
	jyut: string;
	surname: boolean;
	/** 姓的读音来自姓氏表（不让选） */
	fixed: boolean;
}

export interface Hit {
	sys: "py" | "wg" | "jp";
	word: string;
	/** 命中的那一串（首字母大写） */
	joined: string;
	/** 跨了字；否则是正好等于一个音节 */
	cross: boolean;
	/** 分开写的样子 */
	sep: string;
}

export interface Result {
	chars: Char[];
	/** 姓有几个字 */
	surLen: number;
	strokes: number[];
	wuge: Record<Ge, number>;
	/** 天格、人格、地格尾数配的五行 */
	sancai: string;
	roman: { py: string; wg: string; jp: string; hk: string | null };
	hits: Hit[];
	/** 写成 姓欧、名阳静 时，提示的复姓（照写的字） */
	fu: string | null;
}

export type Ge = "tian" | "ren" | "di" | "wai" | "zong";
export const GE: Ge[] = ["tian", "ren", "di", "wai", "zong"];

export interface Missing {
	index: number;
	ch: string;
	variant: string | null;
}

// 部首号从哪里起是几画（114 禸 按康熙的分组记 5）
const STEPS = [1, 7, 30, 61, 95, 118, 147, 167, 176, 187, 195, 201, 205, 209, 211, 212, 214];
export const radStrokes = (r: number) => STEPS.filter((s) => r >= s).length;

const NUM = "一二三四五六七八九十";
const EL = "水木木火火土土金金水";

export interface Table {
	data: Data;
	/** 繁体字形 → 规范字 */
	simpOf: Map<string, string>;
}

/** 字表下载后建一次索引：按 g 的次序（规范字表序号）反查繁体字形的规范字，先到先得（鍾 → 钟 不是 锺） */
export function table(data: Data): Table {
	const simpOf = new Map<string, string>();
	for (const [c, rec] of Object.entries(data.g)) for (const f of rec.split(";")[4] ?? "") if (!(f in data.g) && !simpOf.has(f)) simpOf.set(f, c);
	return { data, simpOf };
}

function form(t: Table, f: string): Form {
	const [rad, res, today, flag] = (t.data.g[f] ?? t.data.z[f])!.split(";")[0]!.split(".");
	const r = Number(rad);
	const n = Number(res);
	const book = radStrokes(r) + n;
	const num = NUM.indexOf(f) + 1;
	const conv = num ? "num" : f === "王" ? "wang" : undefined;
	return {
		form: f,
		kx: num || (f === "王" ? 4 : book),
		rad: r,
		res: f === "王" ? 0 : n,
		today: today ? Number(today) : book,
		...(conv && { conv }),
		...(t.data.x[f] && { page: t.data.x[f] }),
		unchecked: flag === "1",
	};
}

/** 一个字在字表里的样子；不在字表里返回 null。繁体页上写的字本身就是它的一个字形时照写的算，不让选（陳、云、杰）。 */
export function lookup(t: Table, ch: string, hant = false): Zi | null {
	const { g, z } = t.data;
	const simp = ch in g ? ch : (t.simpOf.get(ch) ?? (ch in z ? ch : null));
	if (!simp) return null;
	const [, rd = "", jyut = "", tw = "", fm = ""] = (g[simp] ?? z[simp])!.split(";");
	const all = fm ? [...fm] : [simp];
	const forms = ch !== simp || (hant && all.includes(ch)) ? [ch] : all;
	const readings = rd ? rd.split(" ") : [];
	return { simp, forms: forms.map((f) => form(t, f)), readings, tw: tw || readings[0] || "", jyut, inTgh: simp in g };
}

// ---------- 读音与拼写 ----------
const TONES = "āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ";
const BASE = "aeiouü";

/** 带调拼音 → [不带调的拼音（ü 照留）, 声调 1–5] */
export function splitTone(py: string): [string, number] {
	let tone = 5;
	let out = "";
	for (const ch of py.normalize("NFC")) {
		const i = TONES.indexOf(ch);
		if (i >= 0) {
			tone = (i % 4) + 1;
			out += BASE[Math.floor(i / 4)];
		} else out += ch;
	}
	return [out, tone];
}

const ZY_INI: [string, string][] = [
	["zh", "ㄓ"], ["ch", "ㄔ"], ["sh", "ㄕ"], ["b", "ㄅ"], ["p", "ㄆ"], ["m", "ㄇ"], ["f", "ㄈ"], ["d", "ㄉ"], ["t", "ㄊ"], ["n", "ㄋ"], ["l", "ㄌ"],
	["g", "ㄍ"], ["k", "ㄎ"], ["h", "ㄏ"], ["j", "ㄐ"], ["q", "ㄑ"], ["x", "ㄒ"], ["r", "ㄖ"], ["z", "ㄗ"], ["c", "ㄘ"], ["s", "ㄙ"],
];
const ZY_FIN: Record<string, string> = {
	a: "ㄚ", o: "ㄛ", e: "ㄜ", ê: "ㄝ", ai: "ㄞ", ei: "ㄟ", ao: "ㄠ", ou: "ㄡ", an: "ㄢ", en: "ㄣ", ang: "ㄤ", eng: "ㄥ", er: "ㄦ",
	i: "ㄧ", ia: "ㄧㄚ", ie: "ㄧㄝ", iao: "ㄧㄠ", iu: "ㄧㄡ", ian: "ㄧㄢ", in: "ㄧㄣ", iang: "ㄧㄤ", ing: "ㄧㄥ", iong: "ㄩㄥ",
	u: "ㄨ", ua: "ㄨㄚ", uo: "ㄨㄛ", uai: "ㄨㄞ", ui: "ㄨㄟ", uan: "ㄨㄢ", un: "ㄨㄣ", uang: "ㄨㄤ", ong: "ㄨㄥ",
	ü: "ㄩ", üe: "ㄩㄝ", üan: "ㄩㄢ", ün: "ㄩㄣ",
};
const ZY_YW: Record<string, string> = {
	yi: "i", ya: "ia", ye: "ie", yao: "iao", you: "iu", yan: "ian", yin: "in", yang: "iang", ying: "ing", yong: "iong",
	yu: "ü", yue: "üe", yuan: "üan", yun: "ün", wu: "u", wa: "ua", wo: "uo", wai: "uai", wei: "ui", wan: "uan",
	wen: "un", wang: "uang", weng: "ong",
};
const ZY_TONE = ["", "", "ˊ", "ˇ", "ˋ"];

/** 拼音 → 注音（M22-12：由 kMandarin 的台湾读音机械换算）；换算不了的照原样返回 */
export function zhuyin(py: string): string {
	const [s, tone] = splitTone(py);
	let ini = "";
	let fin = s;
	if (s in ZY_YW) fin = ZY_YW[s]!;
	else {
		const hit = ZY_INI.find(([p]) => s.startsWith(p));
		if (hit) {
			ini = hit[1];
			fin = s.slice(hit[0].length);
		}
		if ("ㄐㄑㄒ".includes(ini || "-") && fin.startsWith("u")) fin = `ü${fin.slice(1)}`;
		if ("ㄓㄔㄕㄖㄗㄘㄙ".includes(ini || "-") && fin === "i") fin = "";
	}
	if (fin && !(fin in ZY_FIN)) return py;
	const z = ini + (fin ? ZY_FIN[fin] : "");
	return tone === 5 ? `˙${z}` : z + ZY_TONE[tone];
}

const WG_INI: Record<string, string> = {
	b: "p", p: "p'", m: "m", f: "f", d: "t", t: "t'", n: "n", l: "l", g: "k", k: "k'", h: "h",
	j: "ch", q: "ch'", x: "hs", zh: "ch", ch: "ch'", sh: "sh", r: "j", z: "ts", c: "ts'", s: "s", y: "y", w: "w",
};
const WG_WHOLE: Record<string, string> = {
	zhi: "chih", chi: "ch'ih", shi: "shih", ri: "jih", zi: "tzu", ci: "tz'u", si: "ssu", er: "erh", e: "o",
	yi: "i", you: "yu", yan: "yen", ye: "yeh", yong: "yung", yu: "yü", yue: "yüeh", yuan: "yüan", yun: "yün",
};

/** 拼音（可带调）→ 威妥玛（不带调号，送气符号写 '） */
export function wadeGiles(py: string): string {
	const s = splitTone(py)[0].toLowerCase();
	if (s in WG_WHOLE) return WG_WHOLE[s]!;
	const ini = ["zh", "ch", "sh"].find((p) => s.startsWith(p)) ?? (s[0] && s[0] in WG_INI ? s[0] : "");
	let fin = s.slice(ini.length);
	if ("jqx".includes(ini || "-")) fin = fin.replace(/^u/, "ü");
	fin = fin
		.replace(/^üe$/, "üeh")
		.replace(/^ie$/, "ieh")
		.replace(/ian$/, "ien")
		.replace(/ong$/, "ung");
	if (fin === "e" && "gkh".includes(ini || "-")) fin = "o";
	if (fin === "uo" && !["g", "k", "h", "sh"].includes(ini)) fin = "o";
	if (fin === "ui" && "gk".includes(ini || "-")) fin = "uei";
	return (WG_INI[ini] ?? ini) + fin;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** 只留字母（比对谐音用）：去掉声调、ü 的两点、送气符号 */
const letters = (s: string) => splitTone(s)[0].replace(/ü/g, "u").replace(/[^a-z]/gi, "").toLowerCase();

/** 汉语拼音的连写：a、o、e 开头的音节跟在别的音节后面时加隔音符号（Xi'an） */
const joinPy = (syl: string[]) => syl.map((x, i) => (i && /^[aoe]/.test(x) ? `'${x}` : x)).join("");

// ---------- 英文谐音（M22-13、M22-30） ----------
// 名字的音节按姓名、名姓两种次序各连成一串，和词表比对：只在跨了字、或正好等于一个完整音节时才算（调研 §4.3）
function scan(t: Table, sys: Hit["sys"], sur: string[], giv: string[]): Hit[] {
	const out: Hit[] = [];
	for (const syl of [[...sur, ...giv], [...giv, ...sur]]) {
		const plain = syl.map(letters);
		const joined = plain.join("");
		const bounds: number[] = [];
		plain.reduce((a, x) => (bounds.push(a + x.length), a + x.length), 0);
		const starts = [0, ...bounds.slice(0, -1)];
		for (const w of t.data.bad) {
			for (let i = joined.indexOf(w); i >= 0; i = joined.indexOf(w, i + 1)) {
				const j = i + w.length;
				const cross = bounds.slice(0, -1).some((b) => i < b && b < j);
				const whole = starts.some((a, k) => a === i && bounds[k] === j);
				if (!cross && !(whole && !t.data.pass.includes(w))) continue;
				if (out.some((h) => h.word === w)) continue;
				out.push({ sys, word: w, joined: cap(syl.join("")), cross, sep: syl.map(cap).join(" ") });
			}
		}
	}
	return out;
}

// ---------- 测名 ----------
export const HAN = /^\p{Script=Han}+$/u;

export type Problem = "empty" | "surEmpty" | "split" | "surBad" | "givEmpty" | "givBad";

/** 输入校验：姓 1–2 个汉字，名 1–3 个汉字（按字数，不按 UTF-16 码元：规范字表有 196 个补充平面的字） */
export function check(sur: string, giv: string): Problem | null {
	const s = [...sur];
	const g = [...giv];
	if (!s.length && !g.length) return "empty";
	if (!s.length) return g.length > 1 && HAN.test(giv) ? "split" : "surEmpty";
	if (!HAN.test(sur) || s.length > 2) return "surBad";
	if (!g.length) return "givEmpty";
	if (!HAN.test(giv) || g.length > 3) return "givBad";
	return null;
}

/** 超过 81 的数减 80 再查（81 自成一条） */
export function fold(n: number): number {
	while (n > 81) n -= 80;
	return n;
}

export function wuge(s: number[], g: number[]): Record<Ge, number> {
	const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
	const tian = s.length === 1 ? s[0]! + 1 : sum(s);
	const ren = s.at(-1)! + g[0]!;
	const di = g.length === 1 ? g[0]! + 1 : sum(g);
	return { tian, ren, di, wai: tian + di - ren, zong: sum(s) + sum(g) };
}

/**
 * 算一个名字。picks 按字的位置（姓在前）记用户点选的异体、字形、读音。
 * 有字不在字表里时返回 missing（Unihan 记了字表里的异体就带上，页面问一句能不能按它算）。
 */
export function measure(t: Table, sur: string, giv: string, picks: Record<number, Pick> = {}, hant = false): Result | { missing: Missing } {
	const input = [...sur, ...giv];
	const surLen = [...sur].length;
	const chars: Char[] = [];
	for (const [i, ch] of input.entries()) {
		const p = picks[i] ?? {};
		const used = p.sub ?? ch;
		const zi = lookup(t, used, hant);
		if (!zi) return { missing: { index: i, ch, variant: t.data.v[ch] ?? null } };
		const f = zi.forms.find((x) => x.form === p.form) ?? zi.forms[0]!;
		chars.push({ input: ch, used, zi, form: f, read: "", jyut: zi.jyut, surname: i < surLen, fixed: false });
	}
	// 姓的读音查姓氏表（复姓整条查，再逐字查），不让选（M22-21）；表里没有的取默认读音
	const surSimp = chars.slice(0, surLen).map((c) => c.zi.simp);
	const table = t.data.sur[surSimp.join("")] ?? null;
	for (const [i, c] of chars.entries()) {
		const own = hant ? c.zi.tw : c.zi.readings[0] ?? "";
		const row = c.surname ? (table?.[i] ?? t.data.sur[c.zi.simp]?.[0]) : undefined;
		if (row) {
			c.read = row[0];
			c.jyut = row[1] ?? c.jyut;
			c.fixed = true;
		} else c.read = c.surname ? own : (c.zi.readings.includes(picks[i]?.read ?? "") ? picks[i]!.read! : own);
	}
	const strokes = chars.map((c) => c.form.kx);
	const w = wuge(strokes.slice(0, surLen), strokes.slice(surLen));
	const S = chars.slice(0, surLen);
	const G = chars.slice(surLen);
	const py = (cs: Char[]) => cs.map((c) => splitTone(c.read)[0]);
	const wg = (cs: Char[]) => cs.map((c) => wadeGiles(c.read));
	const jp = (cs: Char[]) => cs.map((c) => c.jyut.replace(/\d/g, ""));
	const hits = [...scan(t, "py", py(S), py(G)), ...scan(t, "wg", wg(S), wg(G)), ...scan(t, "jp", jp(S), jp(G))];
	const giv0 = chars[surLen]!.zi.simp;
	const fu = surLen === 1 && G.length > 1 && t.data.fu.includes(surSimp[0] + giv0) ? input[0]! + input[1]! : null;
	return {
		chars,
		surLen,
		strokes,
		wuge: w,
		sancai: [w.tian, w.ren, w.di].map((n) => EL[n % 10]).join(""),
		roman: {
			py: `${cap(joinPy(py(S)))} ${cap(joinPy(py(G)))}`,
			wg: `${cap(wg(S).join("-"))} ${cap(wg(G).join("-"))}`,
			jp: chars.map((c) => c.jyut || "—").join(" "),
			hk: t.data.hk[surSimp.join("")] ?? null,
		},
		hits,
		fu,
	};
}
