/**
 * 梅花页（/meihua/，M21）的页面逻辑：往卦与判重、Jev 之后的分流、报数校验、此刻的农历与时辰、回访、磬声。
 *
 * 零依赖（只有 import type）：页面脚本一 import 首页图里的模块（history.ts、flow.ts、copy.ts、revisit.ts、
 * sound.ts……）或用动态 import()，打包就会拆出与首页共用的分包，首页入口包跟着变（首屏 JS 不能增加，
 * 见 docs/review-m21/engine.md §三）。所以要用的那几行照抄在这里，meihua-page.test.ts 逐条与原件比；
 * 原件改了，测试会报不一致。梅花页的 Worker（单独打包）也 import 这里的取名函数。
 */
import type { Judgement } from "./flow.js";
import type { Entry } from "./history.js";
import type { Question, Topic } from "./liuyao/duan.js";
import type { Outcome, Past, Review } from "./revisit.js";

// ---------------------------------------------------------------- 往卦（照 history.ts）

/** 梅花怎么起的：时间起卦凭起卦时刻就能重排，数字起卦另存报的数。 */
export type By = { by: "time" } | { by: "num"; nums: number[] };

/**
 * 梅花的往卦与六爻同形，多一个 meihua 字段，存在同一个 liuyao:history 里（M21-6）：
 * 首屏的 history.ts 认得这种记录（params 是本卦，动爻写 9 或 6），把 meihua 字段原样带着读写，判重也就共用了。
 */
export interface MeihuaEntry extends Entry {
	meihua: By;
}

type Store = Pick<Storage, "getItem" | "setItem">;

export const KEY = "liuyao:history";
const TOPICS = ["财", "事业", "父母", "子孙", "兄弟", "婚恋", "自身"];

function valid(e: any): e is Entry {
	return (
		typeof e?.question === "string" &&
		TOPICS.includes(e.ask?.topic) &&
		(e.ask.topic !== "婚恋" || e.ask.gender === "男" || e.ask.gender === "女") &&
		Array.isArray(e.params) &&
		e.params.length === 6 &&
		e.params.every((y: unknown) => y === 6 || y === 7 || y === 8 || y === 9) &&
		typeof e.at === "string" &&
		!Number.isNaN(Date.parse(e.at)) &&
		(e.lateZi === "day-stays" || e.lateZi === "day-advances")
	);
}

export function entries(s: Store): Entry[] {
	try {
		const v: unknown = JSON.parse(s.getItem(KEY) ?? "[]");
		return Array.isArray(v) ? v.filter(valid) : [];
	} catch {
		return [];
	}
}

/** Throws when storage is full or blocked. */
export const record = (s: Store, e: Entry | MeihuaEntry) => s.setItem(KEY, JSON.stringify([e, ...entries(s)]));

const words = (q: string) =>
	q
		.normalize("NFKC")
		.replace(/\s/g, "")
		.replace(/[?!.,。~…]+$/u, "")
		.toLowerCase();

/** 一事一占：六爻、梅花问过的都算（M21-6）。 */
export const asked = (past: Entry[], q: string) => past.some((e) => e.question && words(e.question) === words(q));

/** 婚恋不问性别（M21-11）：记录里写一个占位的「男」，只为过 history.ts 的 valid()；梅花不读它，页面上也不显示。 */
export const askOf = (topic: Topic): Question => (topic === "婚恋" ? { topic, gender: "男" } : { topic });

/** A 梅花 record with a usable `meihua` field: an hour and up to two whole numbers. */
export function meihuaOf(e: Entry): By | null {
	const m = (e as Partial<MeihuaEntry>).meihua;
	if (m?.by === "time") return { by: "time" };
	if (m?.by === "num" && Array.isArray(m.nums) && [1, 2].includes(m.nums.length) && m.nums.every((n) => Number.isSafeInteger(n) && n > 0))
		return { by: "num", nums: m.nums };
	return null;
}

// ---------------------------------------------------------------- 屏幕与分流（照 flow.ts）

/** 没有 Jev（没配 key、超时、出错）：什么都没标，让问的人自己择类（照 flow.ts 的 FALLBACK）。 */
export const FALLBACK: Judgement = { topic: null, selfHarm: false, emergency: false, gambling: false, insincere: false };

export type Screen =
	| "home"
	| "ask"
	| "guard"
	| "decline"
	| "emergency"
	| "insincere"
	| "topic"
	| "method"
	| "num"
	| "reveal"
	| "reading";

/**
 * 可走的路。选起法、报数都还没起卦，可以来回；成卦那一刻写进往卦，此后只有展卷而读（一事一占，§1.6）。
 * 没有静心（M21-15），所问判过之后不回所问屏（同六爻择类之后）。
 */
export const NEXT: Record<Screen, readonly Screen[]> = {
	home: ["ask"],
	ask: ["home", "guard", "decline", "emergency", "insincere", "topic", "method"],
	guard: ["home"],
	decline: ["ask"],
	emergency: ["home", "insincere", "topic", "method"],
	insincere: ["ask"],
	topic: ["method"],
	method: ["num", "reveal"],
	num: ["method", "reveal"],
	reveal: ["reading"],
	reading: [],
};

/**
 * 自伤（阻断）→ 赌博（婉拒）→ 紧急（提示，确认后可继续）→ 不诚（请重写）→ 择类或选起法，次序同 flow.ts 的 afterJudge。
 * 只有一处不同：婚恋不问性别（M21-11），Jev 给了婚恋就直接选起法，六爻那边要去择类屏问性别。
 */
export function route(j: Judgement, emergencySeen = false): Screen {
	if (j.selfHarm) return "guard";
	if (j.gambling) return "decline";
	if (j.emergency && !emergencySeen) return "emergency";
	if (j.insincere) return "insincere";
	return j.topic === null ? "topic" : "method";
}

// ---------------------------------------------------------------- 报数（M21-17）

/** 报数的错：0、负数、小数；超过四位；只填了第二格；汉字数字、字母；一个也没填。字在页面上（Meihua.astro）。 */
export type NumError = "notInt" | "tooLong" | "secondOnly" | "notArabic" | "empty";

/**
 * 「起卦」时校验两格，不边打边报。全角数字（中文输入法常打出「３」）按 NFKC 换成半角，前导零去掉（07 → 7）；
 * 只收 1–9999。两格都错就两格都报。
 */
export function parseNums(first: string, second: string): { nums: number[] } | { errors: [NumError | null, NumError | null] } {
	const one = (raw: string): number | NumError | null => {
		const s = raw.normalize("NFKC").trim();
		if (!s) return null;
		if (/^\d+$/.test(s)) {
			const digits = s.replace(/^0+/, "");
			if (!digits) return "notInt";
			return digits.length > 4 ? "tooLong" : Number(digits);
		}
		return /^[+-]?[\d.,]+(e[+-]?\d+)?$/i.test(s) ? "notInt" : "notArabic";
	};
	const a = one(first);
	const b = one(second);
	const err = (v: number | NumError | null) => (typeof v === "string" ? v : null);
	if (typeof a === "number" && (b === null || typeof b === "number")) return { nums: b === null ? [a] : [a, b] };
	if (a === null) return { errors: [b === null ? "empty" : "secondOnly", err(b)] };
	return { errors: [err(a), err(b)] };
}

// ---------------------------------------------------------------- 此刻：时辰与农历（北京时间，M21-12）

const BEIJING = 8 * 3_600_000;
const STEMS = "甲乙丙丁戊己庚辛壬癸";
const BRANCHES = "子丑寅卯辰巳午未申酉戌亥";
const CN = "一二三四五六七八九十";

/** 0–23 点 → 时辰序号：23–1 点子 0，1–3 点丑 1…… */
const hourIndex = (hours: number) => Math.floor((hours + 1) / 2) % 12;

/** 北京时间的时辰，与它的地支数（子 1……亥 12）。 */
export function hourOf(d: Date): { name: string; num: number } {
	const i = hourIndex(new Date(d.getTime() + BEIJING).getUTCHours());
	return { name: BRANCHES[i] as string, num: i + 1 };
}

/** 正月 二月 …… 冬月 腊月，闰月前加「闰」。 */
export const monthName = (m: number, leap = false) =>
	`${leap ? "闰" : ""}${m === 1 ? "正" : m === 11 ? "冬" : m === 12 ? "腊" : CN[m - 1]}月`;

/** 初一 …… 初十 十一 …… 二十 廿一 …… 三十 */
export const dayName = (d: number) =>
	d === 10 ? "初十" : d === 20 ? "二十" : d === 30 ? "三十" : `${"初十廿"[Math.floor(d / 10)]}${"十一二三四五六七八九"[d % 10]}`;

export interface Lunar {
	/** 年干支：丙午 */
	year: string;
	month: number;
	leap: boolean;
	day: number;
}

/**
 * 北京时间这一天的农历，照 meihua.ts 的 lunarTable() 在构建时写进页面的表算（农历年、闰月按本月、晚子时不换日，
 * 同 moment() 的默认）。表里没有这一年就 null：页面只写时辰。
 */
export function lunarOf(table: string, d: Date): Lunar | null {
	const t = new Date(d.getTime() + BEIJING);
	const today = Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()) / 86_400_000;
	let found: Lunar | null = null;
	for (const part of table.split(",")) {
		const [y, leap, bits, first] = part.split(":") as [string, string, string, string];
		const start = Date.UTC(Number(y), 0, 1) / 86_400_000 + Number(first);
		let n = today - start;
		if (n < 0 || !bits) continue;
		found = null;
		let i = 0;
		for (let m = 1; m <= 12 && !found; m++) {
			for (const isLeap of m === Number(leap) ? [false, true] : [false]) {
				const len = bits[i++] === "1" ? 30 : 29;
				if (n < len) {
					const k = (Number(y) - 4) % 60;
					found = { year: `${STEMS[k % 10]}${BRANCHES[k % 12]}`, month: m, leap: isLeap, day: n + 1 };
					break;
				}
				n -= len;
			}
		}
	}
	return found;
}

/** 丙午年 八月廿一 申时（选起法卡片；首屏用全角空格隔开）；表外的年份只写时辰。 */
export function nowText(table: string, d: Date, gap = " "): string {
	const l = lunarOf(table, d);
	const h = `${hourOf(d).name}时`;
	return l ? `${l.year}年${gap}${monthName(l.month, l.leap)}${dayName(l.day)}${gap}${h}` : h;
}

/**
 * 「此刻」下一次要变是在几毫秒后：北京的时辰与子夜换日都在整点（UTC+8 是整时区），访客那里的时辰与日子在当地整点
 * （有半小时、三刻钟的时区）；访客那一句写到分钟（minutes），显示时每分钟。按点刷新，不轮询：卡片在时辰交界那一刻就换。
 */
export function untilNext(now: Date, minutes: boolean): number {
	const t = now.getTime();
	if (minutes) return 60_000 - (t % 60_000);
	const local = new Date(t);
	local.setMinutes(60, 0, 0);
	return Math.min(3_600_000 - (t % 3_600_000), local.getTime() - t);
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * 访客那里的日子或时辰与北京时间不同（海外、跨日）时，选起法下面加一句（照黄历 M17-11）：
 * 你那里是 9月30日 15:08，申时；梅花按北京时间起卦，此刻是 10月1日 卯时。相同时 null。
 */
export function localNote(now: Date): { local: string; localHour: string; beijing: string; beijingHour: string } | null {
	const bj = new Date(now.getTime() + BEIJING);
	const sameDay = bj.getUTCFullYear() === now.getFullYear() && bj.getUTCMonth() === now.getMonth() && bj.getUTCDate() === now.getDate();
	const li = hourIndex(now.getHours());
	const bi = hourIndex(bj.getUTCHours());
	if (sameDay && li === bi) return null;
	return {
		local: `${now.getMonth() + 1}月${now.getDate()}日 ${pad(now.getHours())}:${pad(now.getMinutes())}`,
		localHour: BRANCHES[li] as string,
		beijing: `${bj.getUTCMonth() + 1}月${bj.getUTCDate()}日`,
		beijingHour: BRANCHES[bi] as string,
	};
}

// ---------------------------------------------------------------- 回访（照 revisit.ts，M21-22：回访卡做，到时提醒不做）

const OUTCOMES = ["yes", "half", "no", "pending", "skip"];
const DAYS = [3, 7, 30];
const NOTE_MAX = 100;
const FIRST_VISIT = 3;

const moment = (v: unknown): v is string => typeof v === "string" && !Number.isNaN(Date.parse(v));

function review(v: any): Review | undefined {
	if (!OUTCOMES.includes(v?.outcome) || !moment(v.at)) return undefined;
	const note = typeof v.note === "string" ? [...v.note].slice(0, NOTE_MAX).join("") : "";
	return { outcome: v.outcome, note, at: v.at };
}

const remind = (v: any): Past["remind"] =>
	DAYS.includes(v?.days) && moment(v.at) ? { days: v.days, at: v.at } : undefined;

export const pasts = (s: Store): Past[] =>
	entries(s).map((e) => ({ ...e, review: review((e as Past).review), remind: remind((e as Past).remind) }));

export const find = (s: Store, at: string) => pasts(s).find((p) => p.at === at);

/** 记下回访：按起卦时刻找到那一条，整表写回。没有这一条 false；存满或被禁用时抛错。 */
export function save(s: Store, at: string, field: { review: Review }): boolean {
	const all = pasts(s);
	const i = all.findIndex((p) => p.at === at);
	if (i < 0) return false;
	all[i] = { ...all[i], ...field } as Past;
	s.setItem(KEY, JSON.stringify(all));
	return true;
}

const localDay = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000;

const dueDay = (p: Past) =>
	p.remind ? localDay(new Date(p.remind.at)) + p.remind.days : localDay(new Date(p.at)) + FIRST_VISIT;

/** 回访卡：从往卦点开、起卦满 3 天（或到了提醒那天）出，记下过的以后都出。 */
export const showCard = (p: Past, now: Date) => p.question !== "" && (p.review !== undefined || localDay(now) >= dueDay(p));

/** 往卦的日期，北京时间：9月26日，不是今年才写年（照 flow.ts 的 dayLabel）。 */
export function dayLabel(at: Date, now = new Date()): string {
	const d = new Date(at.getTime() + BEIJING);
	const year = d.getUTCFullYear() === new Date(now.getTime() + BEIJING).getUTCFullYear() ? "" : `${d.getUTCFullYear()}年`;
	return `${year}${d.getUTCMonth() + 1}月${d.getUTCDate()}日`;
}

function cn(n: number): string {
	const [t, u] = [Math.floor(n / 10), n % 10];
	return (t > 1 ? (CN[t - 1] as string) : "") + (t ? "十" : "") + (u ? (CN[u - 1] as string) : "");
}

/** 七天前（一个月以内），否则写日期（照 revisit.ts 的 ago）。 */
export function ago(at: Date, now: Date): string {
	const n = localDay(now) - localDay(at);
	return n >= FIRST_VISIT && n < 30 ? `${cn(n)}天前` : dayLabel(at, now);
}

export type { Outcome, Past, Review };

// ---------------------------------------------------------------- 磬声（照 sound.ts，M21-23）

const SOUND = "liuyao:sound";

/** 音效开关与六爻共用一个本机设置。 */
let on = (() => {
	try {
		return localStorage.getItem(SOUND) !== "off";
	} catch {
		return true;
	}
})();
let ac: AudioContext | undefined;

export const soundOn = () => on;

export function setSound(next: boolean) {
	on = next;
	try {
		if (on) localStorage.removeItem(SOUND);
		else localStorage.setItem(SOUND, "off");
	} catch {
		// 存储被禁用：只在本页有效
	}
	unlock();
}

/** 浏览器只许在用户操作里开始放声音：在点按里调。 */
export function unlock() {
	if (!on) return;
	try {
		ac ??= new AudioContext();
		void ac.resume();
	} catch {
		// 没有 Web Audio：不出声
	}
}

const QING = [
	[1, 0.16, 4.5],
	[2.76, 0.07, 2.6],
	[5.4, 0.035, 1.4],
	[8.93, 0.015, 0.7],
] as const;

/** 成卦磬声：几个不成整数倍的分音，低音最长。 */
export function qingSound() {
	const a = ac;
	if (!on || a?.state !== "running") return;
	for (const [ratio, gain, decay] of QING) {
		const t = a.currentTime;
		const o = a.createOscillator();
		const g = a.createGain();
		o.frequency.value = 392 * ratio;
		g.gain.setValueAtTime(0, t);
		g.gain.linearRampToValueAtTime(gain, t + 0.003);
		g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
		o.connect(g).connect(a.destination);
		o.start(t);
		o.stop(t + decay);
	}
}
