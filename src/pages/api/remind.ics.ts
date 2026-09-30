/**
 * 到时提醒的 .ics，给 iPhone、iPad 上的「Apple 日历」：Safari 把 text/calendar 的页面
 * 交给日历，浏览器里生成的 blob 却要先过一道下载提示。
 *
 * The file is made from the link alone — the reminder's day, the day of the cast and
 * the 卦, never the question, verdict or note — by the same reminder() the browser
 * uses. Nothing is stored or logged. Each parameter must be one we would have made
 * (64 卦 names, real dates in range), so sixyao.app cannot be made to serve a
 * calendar entry with someone else's text.
 */
import type { APIRoute } from "astro";
import { REMIND } from "../../data/copy.js";
import { GUA } from "../../data/gua-slugs.js";
import { newUid, reminder } from "../../lib/revisit.js";

export const prerender = false;

const NAMES = new Set(GUA.map(([name]) => name));
const DAY = 86_400_000;
/** 本站 2026 年上线，往卦不会更早。 */
const FIRST_CAST = Date.UTC(2026, 0, 1);

/** YYYYMMDD → its UTC midnight, when it is a real date. */
function day(v: string | null): number | null {
	if (!v || !/^\d{8}$/.test(v)) return null;
	const [y, m, d] = [Number(v.slice(0, 4)), Number(v.slice(4, 6)) - 1, Number(v.slice(6))];
	const t = Date.UTC(y, m, d);
	const back = new Date(t);
	return back.getUTCFullYear() === y && back.getUTCMonth() === m && back.getUTCDate() === d ? t : null;
}

/**
 * The reminder a link describes, or null unless every part is one the page would make:
 * `d` within a few days of today (the page offers 3, 7 or 30 days on the asker's own
 * calendar, so UTC is loose on purpose), `c` not before the site nor after `d`, and
 * `g` one 卦 or 本卦之变卦. Each key once; other keys are ignored.
 */
export function parse(q: URLSearchParams, now: Date): { cast: Date; gua: string; start: Date } | null {
	const one = (k: string) => (q.getAll(k).length === 1 ? q.get(k) : null);
	const d = day(one("d"));
	const c = day(one("c"));
	const g = one("g");
	const today = Math.floor(now.getTime() / DAY) * DAY;
	if (d === null || d < today - 2 * DAY || d > today + 40 * DAY) return null;
	if (c === null || c < FIRST_CAST || c > d) return null;
	const names = g?.split("之") ?? [];
	if (names.length < 1 || names.length > 2 || !names.every((n) => NAMES.has(n))) return null;
	const at = new Date(d);
	return {
		// Noon in 北京时间: dayLabel then names the day of the cast, as 往卦 does.
		cast: new Date(c + 4 * 3_600_000),
		gua: g as string,
		// Built and read (floating) in this process's own time zone: 20:00 on day `d`, as in remindAt.
		start: new Date(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate(), 20),
	};
}

const HEADERS = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };

export const GET: APIRoute = ({ url, site }) => {
	const now = new Date();
	const r = parse(url.searchParams, now);
	// Nothing from the request is echoed back.
	if (!r) return new Response("Bad request\n", { status: 400, headers: { ...HEADERS, "Content-Type": "text/plain; charset=utf-8" } });
	// site, not the request's origin: the link is the same as in the file the browser makes.
	const link = new URL("/?history", site ?? url).href;
	const ics = reminder(r.cast, r.gua, r.start, now, newUid(), { ...REMIND.ics, url: link });
	return new Response(ics.text, {
		headers: {
			...HEADERS,
			"Content-Type": "text/calendar; charset=utf-8",
			// inline, not attachment: Safari offers to add it to Calendar instead of asking to download a file.
			"Content-Disposition": `inline; filename="${ics.name}"`,
		},
	});
};
