/**
 * 起卦流程 —— which screen follows which, and the words shown while casting.
 * Zero DOM: `src/scripts/ritual.ts` drives the page with it.
 */
import type { Question, Topic } from "./liuyao/duan.js";
import type { Yao } from "./liuyao/najia.js";

/**
 * `/api/judge`'s answer. Flags are independent — a 跳楼 question is both
 * selfHarm and emergency, a lottery question also gets topic 财 — so
 * {@link afterJudge} applies them in a fixed order.
 */
export interface Judgement {
	/** `null`: no confident category; the page asks the user to pick one. */
	topic: Topic | null;
	selfHarm: boolean;
	emergency: boolean;
	gambling: boolean;
	insincere: boolean;
}

/** No Jev (no key, timeout, error): nothing flagged, the user picks the category. */
export const FALLBACK: Judgement = {
	topic: null,
	selfHarm: false,
	emergency: false,
	gambling: false,
	insincere: false,
};

export type Screen =
	| "home"
	| "manual"
	| "ask"
	| "guard"
	| "decline"
	| "emergency"
	| "insincere"
	| "topic"
	| "calm"
	| "cast"
	| "reveal"
	| "reading"
	| "history";

/**
 * Allowed moves. From 静心 on there is no way back (一事一占). 往卦 and the
 * reading lead only to each other: anything else reloads the page.
 */
export const NEXT: Record<Screen, readonly Screen[]> = {
	home: ["ask", "manual", "history"],
	manual: ["home", "topic"],
	ask: ["home", "guard", "decline", "emergency", "insincere", "topic", "calm"],
	guard: ["home"],
	decline: ["ask"],
	emergency: ["home", "insincere", "topic", "calm"],
	insincere: ["ask"],
	// 手动排盘的爻已经有了，择类之后直接解读。
	topic: ["calm", "reading"],
	calm: ["cast"],
	cast: ["reveal"],
	reveal: ["reading"],
	reading: ["history"],
	history: ["reading"],
};

/** The question as Jev settled it, or `null` when the asker must choose: Jev was unsure, or it is 婚恋 and needs a gender. */
export function settled(j: Judgement): Question | null {
	return j.topic === null || j.topic === "婚恋" ? null : { topic: j.topic };
}

/** 自伤（阻断）→ 赌博（婉拒）→ 紧急（提示，确认后可继续）→ 不诚（请重写）→ 择类. */
export function afterJudge(j: Judgement, emergencySeen = false): Screen {
	if (j.selfHarm) return "guard";
	if (j.gambling) return "decline";
	if (j.emergency && !emergencySeen) return "emergency";
	if (j.insincere) return "insincere";
	return settled(j) ? "calm" : "topic";
}

const POS = ["初", "二", "三", "四", "五", "上"];
const NTH = ["一", "二", "三", "四", "五", "六"];

export const YAO_NAME: Record<Yao, string> = { 6: "老阴", 7: "少阳", 8: "少阴", 9: "老阳" };

/** 背 is 3 and 字 is 2, so the sum says how many 背 came up. */
const COINS: Record<Yao, string> = { 6: "三字", 7: "一背两字", 8: "两背一字", 9: "三背" };

export const isYang = (y: Yao) => y % 2 === 1;
export const isMoving = (y: Yao) => y === 6 || y === 9;

/** 0 → 初爻, 5 → 上爻 */
export const posName = (i: number) => `${POS[i]}爻`;

/** 0 → 第一爻: the throw about to be made. */
export const nthThrow = (i: number) => `第${NTH[i]}爻`;

/** 爻题: 初九, 六二, 上六 … */
export function yaoTitle(i: number, yang: boolean): string {
	const n = yang ? "九" : "六";
	return i === 0 || i === 5 ? `${POS[i]}${n}` : `${n}${POS[i]}`;
}

/** 爻的毛笔笔触, viewBox 0 0 240 24: 阳一笔，阴两笔. */
export const STROKES = {
	yang: ["M5 12.5C3 7.5 8 4.5 17 5L122 6.5L229 8.5C236 8.8 239 11.5 236.5 14.5C233 17.8 225 16.8 215 16.8L120 17.6L19 19.5C9 20.2 6.5 16.5 5 12.5Z"],
	yin: [
		"M5 12.5C3 7.5 8 4.5 17 5L100 6.8C106 7 108.5 10 106.5 13.5C104.5 17 99 17.3 94 17.3L19 19.5C9 20.2 6.5 16.5 5 12.5Z",
		"M137 12.5C135.5 8 140 5.5 148 5.8L229 8.5C236 8.8 239 11.5 236.5 14.5C233 17.8 225 16.8 215 16.8L150 18.2C141 18.8 138.3 16.3 137 12.5Z",
	],
};

/** 一爻的毛笔笔触 HTML：阳一笔，阴两笔；动爻加 ○ ×。 */
export function yaoHtml(yang: boolean, moving: boolean, label: string): string {
	const mark = moving ? `<span class="mark" aria-hidden="true">${yang ? "○" : "×"}</span>` : "";
	const paths = STROKES[yang ? "yang" : "yin"].map((d) => `<path d="${d}"/>`).join("");
	return `<div class="yao${moving ? " moving" : ""}"><svg viewBox="0 0 240 24" role="img" aria-label="${label}"><g filter="url(#ink)">${paths}</g></svg>${mark}</div>`;
}

/** 上爻 on top. */
export const stack = (html: string[]) => html.reverse().join("");

/** 本卦六爻，动爻带标记，上爻在上。 */
export const benLines = (params: readonly Yao[]) =>
	stack(
		params.map((y, i) => {
			const title = yaoTitle(i, isYang(y));
			return yaoHtml(isYang(y), isMoving(y), isMoving(y) ? `${title} ${YAO_NAME[y]} 动` : title);
		}),
	);

/** 一背两字 · 少阳 */
export const tossCaption = (y: Yao) => `${COINS[y]} · ${YAO_NAME[y]}`;

/** 手动排盘: six 爻 as 6–9, 初爻 first ("978776"). Full-width digits and spaces are fine; `null` when malformed. */
export function parseYao(input: string): Yao[] | null {
	const s = input.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/\s/g, "");
	return /^[6-9]{6}$/.test(s) ? ([...s].map(Number) as Yao[]) : null;
}

const BEIJING = 8 * 3_600_000;

/** 往卦 dates, in 北京时间: 9月26日, with the year only when it is not this one. */
export function dayLabel(at: Date, now = new Date()): string {
	const d = new Date(at.getTime() + BEIJING);
	const year = d.getUTCFullYear() === new Date(now.getTime() + BEIJING).getUTCFullYear() ? "" : `${d.getUTCFullYear()}年`;
	return `${year}${d.getUTCMonth() + 1}月${d.getUTCDate()}日`;
}

/** A moment as an `<input type="datetime-local">` value in 北京时间. */
export const toBeijingInput = (d: Date) => new Date(d.getTime() + BEIJING).toISOString().slice(0, 16);

/** The moment a 北京时间 `datetime-local` value names, 1900–2100 only; `null` otherwise. */
export function fromBeijingInput(v: string): Date | null {
	if (!/^(19\d\d|20\d\d|2100)-\d\d-\d\dT\d\d:\d\d$/.test(v)) return null;
	const d = new Date(`${v}:00+08:00`);
	return Number.isNaN(d.getTime()) ? null : d;
}
