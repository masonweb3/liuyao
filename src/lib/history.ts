/**
 * 往卦 —— casts kept in this browser's localStorage, newest first. Only the
 * inputs are stored and the page casts them again, so the list and the
 * reading can never disagree. Zero DOM: ritual.ts hands in the Storage.
 *
 * This module is in the first-screen bundle. 回访、提醒 (M14) live in revisit.ts,
 * loaded on demand; their fields ride along here untouched, since valid() only
 * checks what it needs and record() writes the parsed records back whole.
 */
import type { LateZiSect } from "./liuyao/calendar.js";
import type { Question } from "./liuyao/duan.js";
import type { Yao } from "./liuyao/najia.js";

export interface Entry {
	/** 所问; empty for 手动排盘. */
	question: string;
	ask: Question;
	/** 初爻 first */
	params: Yao[];
	/** 起卦时刻, ISO 8601 */
	at: string;
	lateZi: LateZiSect;
}

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export const KEY = "liuyao:history";
const TOPICS = ["财", "事业", "父母", "子孙", "兄弟", "婚恋", "自身"];

/** Hand edits or a future format are dropped, not trusted: a bad entry must not break the page. */
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
export const record = (s: Store, e: Entry) => s.setItem(KEY, JSON.stringify([e, ...entries(s)]));

export const forget = (s: Store) => s.removeItem(KEY);

/** The same words, give or take spaces, width, case and closing punctuation. */
const words = (q: string) =>
	q
		.normalize("NFKC")
		.replace(/\s/g, "")
		.replace(/[?!.,。~…]+$/u, "")
		.toLowerCase();

/** 一事一占: has this question been cast before? */
export const asked = (past: Entry[], q: string) => past.some((e) => e.question && words(e.question) === words(q));
