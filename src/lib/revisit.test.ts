import { describe, expect, it } from "vitest";
import { REMIND } from "../data/copy.js";
import { dayLabel } from "./flow.js";
import { type Entry, entries, forget, KEY, record } from "./history.js";
import {
	ago,
	canRemind,
	find,
	fold,
	googleUrl,
	type IcsCopy,
	icsPath,
	intent,
	newUid,
	NOTE_MAX,
	type Past,
	pasts,
	remindAt,
	reminder,
	save,
	showCard,
	tally,
} from "./revisit.js";

const memory = () => {
	const m = new Map<string, string>();
	return {
		getItem: (k: string) => m.get(k) ?? null,
		setItem: (k: string, v: string) => void m.set(k, v),
		removeItem: (k: string) => void m.delete(k),
	};
};

// Local times throughout: 回访 counts days on the asker's own calendar.
const day = (d: number, h = 12, min = 0) => new Date(2026, 8, 26 + d, h, min);

const entry = (over: Partial<Past> = {}): Past => ({
	question: "下个月跳槽去新公司，能成吗？",
	ask: { topic: "事业" },
	params: [9, 7, 8, 7, 7, 6],
	at: day(0).toISOString(),
	lateZi: "day-stays",
	...over,
});

const stored = (...list: unknown[]) => {
	const s = memory();
	s.setItem(KEY, JSON.stringify(list));
	return s;
};

describe("往卦的新字段", () => {
	it("旧记录没有 review、remind，照常读", () => {
		const s = stored(entry());
		const [p] = pasts(s);
		expect(p.question).toBe("下个月跳槽去新公司，能成吗？");
		expect(p.review).toBeUndefined();
		expect(p.remind).toBeUndefined();
	});

	it("坏了只丢这个字段，这一卦还在", () => {
		const at = day(1).toISOString();
		const s = stored(
			entry({ review: { outcome: "准了", note: "", at } as never }),
			entry({ review: { outcome: "yes", note: "", at: "昨天" } }),
			entry({ review: "应了" as never, remind: { days: 5, at } as never }),
			entry({ remind: { days: 7, at: 42 } as never }),
			entry({ review: { outcome: "half", note: 3, at } as never }),
		);
		const list = pasts(s);
		expect(list).toHaveLength(5);
		expect(list.slice(0, 4).every((p) => !p.review && !p.remind)).toBe(true);
		expect(list[4].review).toEqual({ outcome: "half", note: "", at });
	});

	it("附言超长只保留前 100 字", () => {
		const at = day(3).toISOString();
		const s = stored(entry({ review: { outcome: "yes", note: "应".repeat(130), at } }));
		expect([...(pasts(s)[0].review?.note ?? "")]).toHaveLength(NOTE_MAX);
	});

	it("JSON 损坏、存储清空：不报错，列表空，复盘为零", () => {
		const s = memory();
		expect(pasts(s)).toEqual([]);
		s.setItem(KEY, "{oops");
		expect(pasts(s)).toEqual([]);
		expect(tally(pasts(s))).toEqual({ n: 0, x: 0 });
	});

	it("按起卦时刻找到那一条，写回后其他记录不动", () => {
		const s = memory();
		record(s, entry({ question: "一", at: day(-5).toISOString() }));
		record(s, entry({ question: "二" }));
		const review = { outcome: "no" as const, note: "没成。", at: day(4).toISOString() };
		expect(save(s, day(0).toISOString(), { review })).toBe(true);
		expect(find(s, day(0).toISOString())?.review).toEqual(review);
		expect(find(s, day(-5).toISOString())?.review).toBeUndefined();
		const remind = { days: 7 as const, at: day(0).toISOString() };
		expect(save(s, day(-5).toISOString(), { remind })).toBe(true);
		expect(pasts(s).map((p) => [p.question, p.remind, p.review])).toEqual([
			["二", undefined, review],
			["一", remind, undefined],
		]);
	});

	it("找不到那一条时不写", () => {
		const s = stored(entry());
		const before = s.getItem(KEY);
		expect(save(s, day(9).toISOString(), { remind: { days: 3, at: day(9).toISOString() } })).toBe(false);
		expect(s.getItem(KEY)).toBe(before);
	});

	it("存储写不进去时照实报错，由界面提示", () => {
		const s = { ...stored(entry()), setItem: () => { throw new Error("QuotaExceededError"); } };
		expect(() => save(s, day(0).toISOString(), { remind: { days: 3, at: day(0).toISOString() } })).toThrow();
	});

	it("起卦流程照旧读写：新起一卦不会冲掉旧卦的回访", () => {
		const s = memory();
		record(s, entry());
		save(s, day(0).toISOString(), { review: { outcome: "yes", note: "", at: day(7).toISOString() } });
		record(s, entry({ question: "另一件事", at: day(8).toISOString() }));
		expect(entries(s)).toHaveLength(2);
		expect(find(s, day(0).toISOString())?.review?.outcome).toBe("yes");
		forget(s);
		expect(pasts(s)).toEqual([]);
	});
});

describe("个人复盘", () => {
	const told = (outcome: string) => entry({ review: { outcome, note: "", at: day(7).toISOString() } as never });
	it("N 算应了、一半、没应；x 只算应了", () => {
		const list = pasts(stored(told("yes"), told("half"), told("no"), told("yes"), told("pending"), told("skip"), entry()));
		expect(tally(list)).toEqual({ n: 4, x: 2 });
	});
	it("只记了还没结果、不想记：N = 0", () => {
		expect(tally(pasts(stored(told("pending"), told("skip"), entry())))).toEqual({ n: 0, x: 0 });
	});
});

describe("回访卡何时出现", () => {
	it("没设提醒：按本地日期，起卦满 3 天", () => {
		const p = entry({ at: day(0, 23, 50).toISOString() });
		expect(showCard(p, day(2, 23, 59))).toBe(false);
		expect(showCard(p, day(3, 0, 1))).toBe(true);
		expect(showCard(p, day(40))).toBe(true);
	});

	it("设了提醒：从提醒那天起，不按 3 天", () => {
		const p = entry({ remind: { days: 7, at: day(0, 12, 5).toISOString() } });
		expect(showCard(p, day(3))).toBe(false);
		expect(showCard(p, day(6, 23))).toBe(false);
		expect(showCard(p, day(7, 0, 5))).toBe(true);
		// 从往卦补设：天数从设的那天算
		const late = entry({ remind: { days: 3, at: day(5).toISOString() } });
		expect(showCard(late, day(7))).toBe(false);
		expect(showCard(late, day(8))).toBe(true);
	});

	it("记下过的，以后每次都出（已填状态）", () => {
		const p = entry({ remind: { days: 30, at: day(0).toISOString() }, review: { outcome: "skip", note: "", at: day(1).toISOString() } });
		expect(showCard(p, day(2))).toBe(true);
	});

	it("手动排盘没有所问，不出", () => {
		expect(showCard(entry({ question: "" }), day(30))).toBe(false);
		expect(showCard(entry({ question: "", review: { outcome: "yes", note: "", at: day(3).toISOString() } }), day(30))).toBe(false);
	});
});

describe("到时提醒我", () => {
	it("刚起完卦的解读页能设；手动排盘不设", () => {
		expect(canRemind("能成吗？", undefined, false)).toBe(true);
		expect(canRemind("", undefined, false)).toBe(false);
	});
	it("往卦点开的：没设过提醒、也没记下结果才能补设", () => {
		const at = day(4).toISOString();
		expect(canRemind("能成吗？", entry(), true)).toBe(true);
		expect(canRemind("能成吗？", entry({ remind: { days: 3, at } }), true)).toBe(false);
		expect(canRemind("能成吗？", entry({ review: { outcome: "no", note: "", at } }), true)).toBe(false);
		expect(canRemind("能成吗？", entry({ review: { outcome: "skip", note: "", at } }), true)).toBe(false);
		expect(canRemind("能成吗？", entry({ review: { outcome: "pending", note: "", at } }), true)).toBe(true);
		expect(canRemind("能成吗？", undefined, true)).toBe(false);
	});
});

describe("时间短语", () => {
	it("3–29 天用中文数字，30 天起写日期", () => {
		const at = day(0);
		expect(ago(at, day(3))).toBe("三天前");
		expect(ago(at, day(7))).toBe("七天前");
		expect(ago(at, day(10))).toBe("十天前");
		expect(ago(at, day(13))).toBe("十三天前");
		expect(ago(at, day(20))).toBe("二十天前");
		expect(ago(at, day(29))).toBe("二十九天前");
		expect(ago(at, day(30))).toBe(dayLabel(at, day(30)));
		expect(ago(at, day(400))).toMatch(/^2026年/);
	});
});

describe(".ics", () => {
	const copy = { ...REMIND.ics, url: "https://sixyao.app/?history" };
	const now = day(1, 21, 30);
	const unfold = (s: string) => s.replace(/\r\n /g, "");
	const make = (p: Past, gua: string, days: number, uid = newUid(), c: IcsCopy = copy) =>
		reminder(new Date(p.at), gua, remindAt(now, days), now, uid, c);

	it("CRLF 换行，结尾也是 CRLF；必填字段齐全", () => {
		const { text, name } = make(entry(), "兑为泽之天水讼", 7, "abc");
		expect(text.endsWith("\r\n")).toBe(true);
		expect(text.replace(/\r\n/g, "")).not.toMatch(/[\r\n]/);
		const lines = unfold(text).split("\r\n");
		expect(lines[0]).toBe("BEGIN:VCALENDAR");
		expect(lines.at(-2)).toBe("END:VCALENDAR");
		for (const l of ["VERSION:2.0", "METHOD:PUBLISH", "BEGIN:VEVENT", "UID:abc@sixyao.app", "BEGIN:VALARM", "ACTION:DISPLAY", "TRIGGER:PT0S", "END:VALARM", "END:VEVENT"])
			expect(lines).toContain(l);
		expect(lines.some((l) => l.startsWith("PRODID:-//"))).toBe(true);
		expect(lines.find((l) => l.startsWith("DTSTAMP:"))).toMatch(/^DTSTAMP:\d{8}T\d{6}Z$/);
		// 到期日本地晚上 8 点，不带时区：浮动时间
		expect(lines).toContain("DTSTART:20261004T200000");
		expect(lines).toContain("DTEND:20261004T201500");
		expect(lines.filter((l) => l.startsWith("DESCRIPTION:"))).toHaveLength(2);
		expect(remindAt(now, 7)).toEqual(new Date(2026, 9, 4, 20));
		expect(name).toBe("sixyao-2026-10-04.ics");
	});

	/** 文件里的每个物理行：不超过 75 字节，单独拿出来也是完整的 UTF-8（没有一个字被折行拆开）。 */
	const physical = (text: string) => {
		const utf8 = new TextEncoder();
		const strict = new TextDecoder("utf-8", { fatal: true });
		for (const line of text.split("\r\n")) {
			const bytes = utf8.encode(line);
			expect(bytes.length).toBeLessThanOrEqual(75);
			// 拆开的四字节字会成为孤立的代理项，编码时被换成替换字符，解回来就对不上
			expect(strict.decode(bytes)).toBe(line);
		}
	};

	it("描述是起卦日期、卦名、「用同一台设备打开」和链接：没有所问、吉凶、附言", () => {
		const p = entry({ review: { outcome: "no", note: "对方爽约，心里难过。", at: day(1).toISOString() } });
		const { text } = make(p, "兑为泽之天水讼", 3);
		const desc =
			`${dayLabel(new Date(p.at), now)}起的一卦：兑为泽之天水讼。过些日子了，回来看看后来怎样。` +
			"往卦只保存在起卦那台设备的浏览器里，请用同一台设备打开。\\nhttps://sixyao.app/?history";
		expect(unfold(text).split("\r\n")).toContain(`DESCRIPTION:${desc}`);
		// 这段中文按字节折了好几行
		const lines = text.split("\r\n");
		const at = lines.findIndex((l) => l.startsWith("DESCRIPTION:"));
		expect(lines.slice(at + 1, at + 3).every((l) => l.startsWith(" "))).toBe(true);
		physical(text);
		const plain = unfold(text);
		for (const leak of [p.question, "跳槽", "爽约", "吉", "凶", "应了", "没应"]) expect(plain).not.toContain(leak);
	});

	it("每行不超过 75 字节，折行不切断中文，展开后一字不差", () => {
		const long = "一卦".repeat(60) + "𝌆，a;b\\c";
		const { text } = make(entry(), long, 30, newUid(), { ...copy, summary: long });
		physical(text);
		// 确实折了好几行
		expect(text.split("\r\n").filter((l) => l.startsWith(" ")).length).toBeGreaterThan(2);
		const summary = unfold(text).split("\r\n").find((l) => l.startsWith("SUMMARY:"));
		expect(summary).toBe(`SUMMARY:${"一卦".repeat(60)}𝌆，a\\;b\\\\c`);
		expect(fold("a".repeat(75))).toBe("a".repeat(75));
		expect(fold("a".repeat(76))).toBe(`${"a".repeat(75)}\r\n a`);
	});

	it("UID 每次不同", () => {
		const a = newUid();
		expect(a).toMatch(/^[0-9a-f]{32}$/);
		expect(newUid()).not.toBe(a);
	});
});

describe("Google 日历与 iPhone 的地址", () => {
	const copy = { ...REMIND.ics, url: "https://sixyao.app/?history" };
	const now = day(1, 21, 30);
	const p = entry({ review: { outcome: "no", note: "对方爽约，心里难过。", at: day(1).toISOString() } });
	const url = googleUrl(new Date(p.at), "兑为泽之天水讼", remindAt(now, 7), now, copy);
	const q = new URL(url).searchParams;

	it("预填新建日程：标题、浮动时间（没有 Z、没有 ctz）、描述与 .ics 同一套", () => {
		expect(url.startsWith("https://calendar.google.com/calendar/render?action=TEMPLATE&")).toBe(true);
		expect(q.get("text")).toBe(REMIND.ics.summary);
		expect(q.get("dates")).toBe("20261004T200000/20261004T201500");
		expect(q.has("ctz")).toBe(false);
		expect(url).not.toMatch(/\d{8}T\d{6}Z/);
		expect(q.get("details")).toBe(
			`${dayLabel(new Date(p.at), now)}起的一卦：兑为泽之天水讼。过些日子了，回来看看后来怎样。` +
				"往卦只保存在起卦那台设备的浏览器里，请用同一台设备打开。\nhttps://sixyao.app/?history",
		);
	});

	it("中文、换行、斜杠都编码过，地址里没有裸的空格和换行", () => {
		expect(url).not.toMatch(/[\s一-鿿]/);
		expect(url).toContain("dates=20261004T200000%2F20261004T201500");
		expect(url).toContain("%0Ahttps%3A%2F%2Fsixyao.app%2F%3Fhistory");
	});

	it("没有所问、吉凶、附言", () => {
		const plain = decodeURIComponent(url);
		for (const leak of [p.question, "跳槽", "爽约", "吉", "凶", "应了", "没应"]) expect(plain).not.toContain(leak);
	});

	it("安卓 intent：拉起 Google 日历 App，没装就回到同一个网页地址", () => {
		const link = intent(url);
		expect(link.startsWith("intent://calendar.google.com/calendar/render?action=TEMPLATE&")).toBe(true);
		expect(link).toContain("#Intent;scheme=https;package=com.google.android.calendar;");
		expect(link.endsWith(";end")).toBe(true);
		const fallback = /;S\.browser_fallback_url=([^;]*);/.exec(link)?.[1] ?? "";
		expect(decodeURIComponent(fallback)).toBe(url);
		// 查询串原样搬进 intent，不多一层编码
		expect(link.slice("intent://".length, link.indexOf("#"))).toBe(url.slice("https://".length));
	});

	it("iPhone 的服务端地址只带提醒那天、起卦那天（北京时间）和卦名", () => {
		// 北京时间 9月27日 01:00 起的卦，算作 27 日
		const late = new Date(Date.UTC(2026, 8, 26, 17));
		const path = icsPath(late, "兑为泽之天水讼", new Date(2026, 9, 4, 20));
		expect(path).toBe(`/api/remind.ics?d=20261004&c=20260927&g=${encodeURIComponent("兑为泽之天水讼")}`);
		expect(new URL(path, "https://sixyao.app").searchParams.get("g")).toBe("兑为泽之天水讼");
	});
});

// The new fields ride through the first-screen code paths untouched.
it("history.ts 的 entries、record 不认识新字段，也不丢", () => {
	const s = memory();
	const review = { outcome: "yes", note: "", at: day(7).toISOString() };
	s.setItem(KEY, JSON.stringify([{ ...entry(), review }]));
	record(s, entry({ question: "再一事", at: day(8).toISOString() }) as Entry);
	expect(JSON.parse(s.getItem(KEY) ?? "")[1].review).toEqual(review);
});
