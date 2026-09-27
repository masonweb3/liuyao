/**
 * 往卦复盘 —— 回访（后来怎样了）、到时提醒（.ics 日历文件）、个人复盘的计数。
 * Zero DOM; the page side is src/scripts/view.ts, loaded on demand.
 *
 * Not in history.ts: that module ships in the first-screen bundle, and anything
 * added to it would too. Everything here stays in this browser (AGENTS.md §1.5):
 * nothing is uploaded, and the .ics carries no question, verdict or note.
 */
import { dayLabel } from "./flow.js";
import { type Entry, entries, KEY } from "./history.js";

type Store = Parameters<typeof entries>[0];

/** 应了 / 一半 / 没应 / 还没结果 / 不想记. Stored as keys: the labels live in copy.ts, so 繁体 only swaps those. */
export const OUTCOMES = ["yes", "half", "no", "pending", "skip"] as const;
export type Outcome = (typeof OUTCOMES)[number];
/** 附一句, in characters. */
export const NOTE_MAX = 100;
/** 到时提醒: this many days from the day it is set. */
export const DAYS = [3, 7, 30] as const;
export type Days = (typeof DAYS)[number];
/** Without a reminder the 回访卡 shows this many days after the cast. */
const FIRST_VISIT = 3;

export interface Review {
	outcome: Outcome;
	note: string;
	/** 记下时刻, ISO 8601 */
	at: string;
}

export interface Remind {
	days: Days;
	/** When it was set (the .ics downloaded), ISO 8601; the days count from that day. */
	at: string;
}

/** A 往卦 with its M14 fields checked. */
export interface Past extends Entry {
	review?: Review;
	remind?: Remind;
}

const moment = (v: unknown): v is string => typeof v === "string" && !Number.isNaN(Date.parse(v));

function review(v: any): Review | undefined {
	if (!OUTCOMES.includes(v?.outcome) || !moment(v.at)) return undefined;
	// The input stops at NOTE_MAX; a longer one was edited by hand. Keep what fits.
	const note = typeof v.note === "string" ? [...v.note].slice(0, NOTE_MAX).join("") : "";
	return { outcome: v.outcome, note, at: v.at };
}

const remind = (v: any): Remind | undefined =>
	DAYS.includes(v?.days) && moment(v.at) ? { days: v.days, at: v.at } : undefined;

/** 往卦, newest first. A bad review or remind is dropped on its own: the cast stays in the list. */
export const pasts = (s: Store): Past[] =>
	entries(s).map((e) => ({ ...e, review: review((e as Past).review), remind: remind((e as Past).remind) }));

/** Records carry no id; the moment of the cast is unique enough to find one by. */
export const find = (s: Store, at: string) => pasts(s).find((p) => p.at === at);

/** Sets one M14 field of the cast made at `at`. False when there is no such record; throws when storage is full or blocked. */
export function save(s: Store, at: string, field: { review: Review } | { remind: Remind }): boolean {
	const all = pasts(s);
	const i = all.findIndex((p) => p.at === at);
	if (i < 0) return false;
	all[i] = { ...all[i], ...field };
	s.setItem(KEY, JSON.stringify(all));
	return true;
}

/** 你记下的 N 卦里，自认应验 x 卦: 还没结果 and 不想记 are not counted; 一半 is not 应验. */
export function tally(list: readonly Past[]): { n: number; x: number } {
	const told = list.filter((p) => p.review && ["yes", "half", "no"].includes(p.review.outcome));
	return { n: told.length, x: told.filter((p) => p.review?.outcome === "yes").length };
}

/** A calendar day in local time as a whole number, the same across daylight-saving changes. */
export const localDay = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000;

/** The local day the 回访卡 first shows: the reminder's day, or FIRST_VISIT days after the cast. */
export const dueDay = (p: Past) =>
	p.remind ? localDay(new Date(p.remind.at)) + p.remind.days : localDay(new Date(p.at)) + FIRST_VISIT;

/**
 * 回访卡, on a reading opened from 往卦 (never on the one just cast). 手动排盘 has
 * no question to come back to. Once something is recorded it always shows.
 */
export const showCard = (p: Past, now: Date) => p.question !== "" && (p.review !== undefined || localDay(now) >= dueDay(p));

/**
 * 到时提醒我: on the reading just cast; on one opened from 往卦 until a reminder
 * is set or a result recorded (还没结果 is no result yet). Not for 手动排盘: no 回访卡 would follow.
 */
export function canRemind(question: string, p: Past | undefined, old: boolean): boolean {
	if (!question) return false;
	if (!old) return true;
	return p !== undefined && p.remind === undefined && (p.review === undefined || p.review.outcome === "pending");
}

const CN = "一二三四五六七八九";

/** 3 → 三, 13 → 十三, 29 → 二十九 */
function cn(n: number): string {
	const [t, u] = [Math.floor(n / 10), n % 10];
	return (t > 1 ? CN[t - 1] : "") + (t ? "十" : "") + (u ? CN[u - 1] : "");
}

/** How long ago the cast was, for the 回访卡: 七天前 within a month, otherwise its date (as in the 往卦 list). */
export function ago(at: Date, now: Date): string {
	const n = localDay(now) - localDay(at);
	return n >= FIRST_VISIT && n < 30 ? `${cn(n)}天前` : dayLabel(at, now);
}

/** 10月3日, in local time: the reminder's day as the calendar will show it. */
export const monthDay = (d: Date) => `${d.getMonth() + 1}月${d.getDate()}日`;

/** The reminder goes off `days` after `now`, at 20:00 local time. */
export const remindAt = (now: Date, days: number) =>
	new Date(now.getFullYear(), now.getMonth(), now.getDate() + days, 20);

// ---------------------------------------------------------------- .ics (RFC 5545)

/** TEXT values: backslash, semicolon, comma and line breaks escaped (§3.3.11). */
const text = (s: string) => s.replace(/[\\;,]/g, "\\$&").replace(/\r?\n/g, "\\n");

/** Lines longer than 75 octets are folded (§3.1), counting the leading space, and never inside a UTF-8 character. */
export function fold(line: string): string {
	let out = "";
	let size = 0;
	for (const ch of line) {
		const c = ch.codePointAt(0) as number;
		const n = c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4;
		if (size + n > 75) {
			out += "\r\n ";
			size = 1;
		}
		out += ch;
		size += n;
	}
	return out;
}

/** A fresh UID for each file. getRandomValues, not randomUUID: the latter needs https, and the test server is plain http. */
export const newUid = () =>
	[...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, "0")).join("");

const pad = (n: number) => String(n).padStart(2, "0");
/** Local time without TZID or Z (§3.3.5 form 1): 8 p.m. wherever the phone is on that day. */
const floating = (d: Date) =>
	`${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
const utc = (d: Date) => d.toISOString().replace(/[-:]|\.\d+/g, "");

/** copy.ts REMIND.ics, with the link. `body` has {date} and {gua}. */
export interface IcsCopy {
	summary: string;
	body: string;
	url: string;
}

/**
 * The reminder file for the cast made at `at`: 15 minutes at 20:00 on the day, with
 * an alarm. It names only the day of the cast and the 卦 — calendars sync to the
 * cloud and get shared, so the question, the verdict and the note stay out.
 */
export function reminder(
	past: Pick<Past, "at">,
	gua: string,
	days: Days,
	now: Date,
	uid: string,
	copy: IcsCopy,
): { name: string; text: string; start: Date } {
	const start = remindAt(now, days);
	const end = new Date(start.getTime() + 15 * 60_000);
	const body = copy.body.replace("{date}", dayLabel(new Date(past.at), now)).replace("{gua}", gua);
	const lines = [
		"BEGIN:VCALENDAR",
		"VERSION:2.0",
		"PRODID:-//sixyao.app//liuyao//ZH",
		"CALSCALE:GREGORIAN",
		"METHOD:PUBLISH",
		"BEGIN:VEVENT",
		`UID:${uid}@sixyao.app`,
		`DTSTAMP:${utc(now)}`,
		`DTSTART:${floating(start)}`,
		`DTEND:${floating(end)}`,
		`SUMMARY:${text(copy.summary)}`,
		`DESCRIPTION:${text(`${body}\n${copy.url}`)}`,
		`URL:${copy.url}`,
		// A reminder, not a meeting: it does not make the day look busy.
		"TRANSP:TRANSPARENT",
		"BEGIN:VALARM",
		"ACTION:DISPLAY",
		`DESCRIPTION:${text(copy.summary)}`,
		"TRIGGER:PT0S",
		"END:VALARM",
		"END:VEVENT",
		"END:VCALENDAR",
	];
	const name = `sixyao-${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}.ics`;
	return { name, text: `${lines.map(fold).join("\r\n")}\r\n`, start };
}
