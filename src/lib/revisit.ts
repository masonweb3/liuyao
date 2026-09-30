/**
 * 往卦复盘 —— 回访（后来怎样了）、到时提醒（.ics 日历文件、Google 日历链接）、个人复盘的计数。
 * Zero DOM; the page side is src/scripts/view.ts, loaded on demand.
 *
 * Not in history.ts: that module ships in the first-screen bundle, and anything
 * added to it would too. 往卦 stay in this browser (AGENTS.md §1.5). A reminder
 * carries only the two dates and the 卦, never the question, verdict or note:
 * made here, by Google from a link, or by /api/remind.ics for an iPhone.
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

/** The description and the end, the same in the .ics and the Google 日历 link. */
function event(cast: Date, gua: string, start: Date, now: Date, copy: IcsCopy) {
	const body = copy.body.replace("{date}", dayLabel(cast, now)).replace("{gua}", gua);
	return { end: new Date(start.getTime() + 15 * 60_000), details: `${body}\n${copy.url}` };
}

/**
 * The reminder file for the cast made at `cast`: 15 minutes from `start` (remindAt),
 * with an alarm. It names only the day of the cast and the 卦 — calendars sync to the
 * cloud and get shared, so the question, the verdict and the note stay out.
 * /api/remind.ics serves the same file from this function.
 */
export function reminder(
	cast: Date,
	gua: string,
	start: Date,
	now: Date,
	uid: string,
	copy: IcsCopy,
): { name: string; text: string } {
	const { end, details } = event(cast, gua, start, now, copy);
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
		`DESCRIPTION:${text(details)}`,
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
	return { name, text: `${lines.map(fold).join("\r\n")}\r\n` };
}

/**
 * Google 日历's prefilled new-event page. Floating times like the .ics (no Z, no ctz):
 * Google reads them in the user's own calendar time zone. A link cannot set the
 * alarm, so the user's default notification applies. crm=AVAILABLE, trp=false: shown
 * as free, not busy, like TRANSP:TRANSPARENT in the .ics.
 */
export function googleUrl(cast: Date, gua: string, start: Date, now: Date, copy: IcsCopy): string {
	const { end, details } = event(cast, gua, start, now, copy);
	const dates = `${floating(start)}/${floating(end)}`;
	const q = { action: "TEMPLATE", text: copy.summary, dates, details, crm: "AVAILABLE", trp: "false" };
	const query = Object.entries(q).map(([k, v]) => `${k}=${encodeURIComponent(v)}`);
	return `https://calendar.google.com/calendar/render?${query.join("&")}`;
}

/** Chrome on Android: opens the Google Calendar app, or `url` on the web when the app is not installed. */
export const intent = (url: string) =>
	`intent://${url.replace(/^https:\/\//, "")}#Intent;scheme=https;package=com.google.android.calendar;S.browser_fallback_url=${encodeURIComponent(url)};end`;

/** 北京时间的日期 YYYYMMDD: all the server needs for 「9月26日」 (dayLabel), not the moment of the cast. */
const beijingDay = (d: Date) => new Date(d.getTime() + 8 * 3_600_000).toISOString().slice(0, 10).replace(/-/g, "");

/**
 * The same file from /api/remind.ics, for iPhone and iPad: Safari hands a text/calendar
 * page to the Calendar app, where a downloaded blob stops at a download prompt.
 * `d` is the local day of `start` (the server fixes 20:00), `c` the day of the cast, `g` the 卦.
 */
export const icsPath = (cast: Date, gua: string, start: Date) =>
	`/api/remind.ics?d=${floating(start).slice(0, 8)}&c=${beijingDay(cast)}&g=${encodeURIComponent(gua)}`;
