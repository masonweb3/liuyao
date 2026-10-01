/**
 * 梅花页照抄的那几行（meihua-page.ts）与原件逐条比：history.ts 的往卦与判重、flow.ts 的分流、
 * revisit.ts 的回访、sound.ts 的磬声。原件改了，这里会报不一致。
 */
import { afterEach, describe, expect, it } from "vitest";
import { afterJudge, dayLabel as flowDayLabel, FALLBACK as FLOW_FALLBACK, type Judgement } from "./flow.js";
import * as history from "./history.js";
import type { Topic } from "./liuyao/duan.js";
import { byNumbers, lunarTable, moment, yearName } from "./meihua.js";
import * as page from "./meihua-page.js";
import * as revisit from "./revisit.js";
import { YEARS } from "./huangli-days.js";

const memory = (init?: unknown) => {
	const m = new Map<string, string>();
	if (init !== undefined) m.set("liuyao:history", JSON.stringify(init));
	return {
		getItem: (k: string) => m.get(k) ?? null,
		setItem: (k: string, v: string) => void m.set(k, v),
		removeItem: (k: string) => void m.delete(k),
		raw: () => m.get("liuyao:history"),
	};
};

const liuyao = (over: Partial<history.Entry> = {}): history.Entry => ({
	question: "下个月跳槽去新公司，能成吗？",
	ask: { topic: "事业" },
	params: [9, 7, 8, 7, 7, 6],
	at: "2026-09-26T14:00:00.000Z",
	lateZi: "day-stays",
	...over,
});

const meihua = (over: Partial<page.MeihuaEntry> = {}): page.MeihuaEntry => ({
	question: "这周六的面试，能顺利通过吗？",
	ask: page.askOf("事业"),
	params: [7, 8, 9, 8, 8, 7],
	at: "2026-10-01T08:08:00.000Z",
	lateZi: "day-stays",
	meihua: { by: "time" },
	...over,
});

const BAD = [
	null,
	"x",
	{},
	liuyao({ params: [9, 7, 8] as history.Entry["params"] }),
	liuyao({ params: [1, 7, 8, 7, 7, 6] as history.Entry["params"] }),
	liuyao({ ask: { topic: "彩票" } as unknown as history.Entry["ask"] }),
	liuyao({ ask: { topic: "婚恋" } as history.Entry["ask"] }),
	liuyao({ at: "昨天" }),
	liuyao({ lateZi: "x" as history.Entry["lateZi"] }),
];

describe("往卦与判重（照 history.ts）", () => {
	const stores = [
		undefined,
		"{oops",
		{ a: 1 },
		[...BAD, liuyao(), meihua()],
		[meihua({ ask: page.askOf("婚恋") }), liuyao({ ask: { topic: "婚恋", gender: "女" }, review: { outcome: "yes", note: "", at: "2026-10-01T00:00:00Z" } } as history.Entry)],
	];

	it.each(stores.map((s) => [JSON.stringify(s)?.slice(0, 40), s]))("entries() 读出的一样：%s", (_, s) => {
		const a = memory();
		if (typeof s === "string") a.setItem("liuyao:history", s);
		else if (s !== undefined) a.setItem("liuyao:history", JSON.stringify(s));
		expect(page.entries(a)).toEqual(history.entries(a));
	});

	it("record() 写出的一样，梅花字段原样带着", () => {
		const a = memory([...BAD, liuyao()]);
		const b = memory([...BAD, liuyao()]);
		history.record(a, meihua());
		page.record(b, meihua());
		expect(b.raw()).toBe(a.raw());
		expect(JSON.parse(b.raw() as string)[0].meihua).toEqual({ by: "time" });
	});

	it("坏记录只丢它自己：别的六爻、梅花记录与回访都留着", () => {
		const reviewed = { ...liuyao(), review: { outcome: "half", note: "还行", at: "2026-09-30T00:00:00.000Z" } };
		const s = memory([null, reviewed, "坏", meihua({ at: "2026-09-28T02:20:00.000Z", meihua: { by: "num", nums: [8, 2] } })]);
		page.record(s, meihua());
		const all = JSON.parse(s.raw() as string);
		expect(all).toHaveLength(3);
		expect(all[1]).toEqual(reviewed);
		expect(all[2].meihua).toEqual({ by: "num", nums: [8, 2] });
	});

	it("梅花问过的事，六爻那边判重命中；反之亦然（M21-6，共用一份）", () => {
		const s = memory();
		page.record(s, meihua());
		expect(history.asked(history.entries(s), " 这周六的面试，能顺利通过吗?")).toBe(true);
		history.record(s, liuyao());
		expect(page.asked(page.entries(s), "下个月跳槽去新公司，能成吗")).toBe(true);
		// 六爻那边再起一卦（record 整表写回）也不丢梅花记录
		expect(page.entries(s).map((e) => "meihua" in e)).toEqual([false, true]);
	});

	it("asked() 与 history.asked() 逐条一样", () => {
		const past = [liuyao(), meihua(), liuyao({ question: "" }), liuyao({ question: "Offer 能拿到吗？" })];
		for (const q of ["下个月跳槽去新公司，能成吗？", "下个月 跳槽去新公司，能成吗?", "offer能拿到吗", "这周六的面试，能顺利通过吗", "别的事", "", "　"])
			expect(page.asked(past, q)).toBe(history.asked(past, q));
	});

	it("婚恋不问性别：记录写占位的「男」，过得了 valid()", () => {
		const s = memory();
		page.record(s, meihua({ ask: page.askOf("婚恋") }));
		expect(history.entries(s)).toHaveLength(1);
		expect(page.askOf("财")).toEqual({ topic: "财" });
	});

	it("meihua 字段：时间起卦、一两个正整数；别的不认", () => {
		expect(page.meihuaOf(meihua())).toEqual({ by: "time" });
		expect(page.meihuaOf(meihua({ meihua: { by: "num", nums: [3, 5] } }))).toEqual({ by: "num", nums: [3, 5] });
		for (const bad of [{ by: "num", nums: [] }, { by: "num", nums: [0] }, { by: "num", nums: [1, 2, 3] }, { by: "num", nums: [1.5] }, { by: "x" }, null])
			expect(page.meihuaOf(meihua({ meihua: bad as page.By }))).toBeNull();
		expect(page.meihuaOf(liuyao())).toBeNull();
	});
});

describe("分流（照 flow.ts 的 afterJudge）", () => {
	it("没有 Jev 时的默认值一样", () => {
		expect(page.FALLBACK).toEqual(FLOW_FALLBACK);
	});

	it("全部组合：六爻去静心的梅花去选起法；唯一的不同是婚恋（梅花不问性别，直接选起法）", () => {
		const topics: (Topic | null)[] = [null, "财", "事业", "父母", "子孙", "兄弟", "婚恋", "自身"];
		for (const topic of topics)
			for (let bits = 0; bits < 16; bits++)
				for (const seen of [false, true]) {
					const j: Judgement = { topic, selfHarm: !!(bits & 1), gambling: !!(bits & 2), emergency: !!(bits & 4), insincere: !!(bits & 8) };
					const six = afterJudge(j, seen);
					const mh = page.route(j, seen);
					if (six === "calm") expect(mh).toBe("method");
					else if (six === "topic" && topic === "婚恋") expect(mh).toBe("method");
					else expect(mh).toBe(six);
				}
	});

	it("成卦之后只有展卷而读，回不到选起法、报数、所问（一事一占）", () => {
		const reach = new Set<page.Screen>(["reveal"]);
		for (let grew = true; grew; ) {
			grew = false;
			for (const s of [...reach])
				for (const n of page.NEXT[s])
					if (!reach.has(n)) {
						reach.add(n);
						grew = true;
					}
		}
		expect([...reach]).toEqual(["reveal", "reading"]);
		// 选起法、报数都在起卦之前，可以来回
		expect(page.NEXT.num).toContain("method");
		expect(page.NEXT.method).toContain("num");
	});
});

describe("报数（M21-17）", () => {
	const ok = (a: string, b = "") => page.parseNums(a, b);
	it("收全角、前导零，一个或两个", () => {
		expect(ok("3", "5")).toEqual({ nums: [3, 5] });
		expect(ok("７")).toEqual({ nums: [7] });
		expect(ok("３", "07")).toEqual({ nums: [3, 7] });
		expect(ok(" 9999 ", "0012")).toEqual({ nums: [9999, 12] });
	});
	it("错的各报各的，按设计稿 41 ③ 的 a–f", () => {
		expect(ok("0")).toEqual({ errors: ["notInt", null] });
		expect(ok("-3", "2.5")).toEqual({ errors: ["notInt", "notInt"] });
		expect(ok("12345")).toEqual({ errors: ["tooLong", null] });
		expect(ok("", "8")).toEqual({ errors: ["secondOnly", null] });
		expect(ok("三")).toEqual({ errors: ["notArabic", null] });
		expect(ok("abc", "5")).toEqual({ errors: ["notArabic", null] });
		expect(ok("1e3")).toEqual({ errors: ["notInt", null] });
		expect(ok("", "")).toEqual({ errors: ["empty", null] });
		expect(ok("3", "x")).toEqual({ errors: [null, "notArabic"] });
	});
	it("收下的数引擎都能起卦", () => {
		const r = ok("9999", "1");
		expect("nums" in r && byNumbers(r.nums, new Date()).ben.name).toBeTruthy();
	});
});

describe("此刻：时辰与农历（北京时间）", () => {
	const table = lunarTable(YEARS[0]! - 1, YEARS[YEARS.length - 1]! + 1);

	it("时辰与引擎相同，按北京时间", () => {
		for (let h = 0; h < 24; h++) {
			const d = new Date(`2026-10-01T${String(h).padStart(2, "0")}:30:00+08:00`);
			const mh = page.hourOf(d);
			expect(mh.name).toBe(moment(d).hour);
			expect(mh.num).toBe("子丑寅卯辰巳午未申酉戌亥".indexOf(mh.name) + 1);
		}
	});

	it("农历表逐日与 moment() 相同（含闰月、春节前后、晚子时不换日）", () => {
		const from = Date.UTC(YEARS[0]! - 1, 1, 1);
		const to = Date.UTC(YEARS[YEARS.length - 1]! + 1, 11, 31);
		let leap = 0;
		for (let t = from; t <= to; t += 86_400_000) {
			for (const hhmm of ["00:10", "23:30"]) {
				const d = new Date(`${new Date(t).toISOString().slice(0, 10)}T${hhmm}:00+08:00`);
				const l = page.lunarOf(table, d);
				const m = moment(d);
				expect(l, d.toISOString()).not.toBeNull();
				expect([l?.year[1], l?.month, l?.leap, l?.day]).toEqual([m.year, m.month, m.leap, m.day]);
				expect(l?.year).toBe(yearName(d));
				if (m.leap) leap++;
			}
		}
		expect(leap).toBeGreaterThan(0);
	});

	it("表外只写时辰", () => {
		const d = new Date("2040-05-01T12:00:00+08:00");
		expect(page.lunarOf(table, d)).toBeNull();
		expect(page.nowText(table, d)).toBe("午时");
	});

	it("此刻一行：设计稿的例子", () => {
		const d = new Date("2026-10-01T16:08:00+08:00");
		expect(page.nowText(table, d)).toBe("丙午年 八月廿一 申时");
		expect(page.nowText(table, d, "　")).toBe("丙午年　八月廿一　申时");
		expect(page.monthName(6, true)).toBe("闰六月");
		expect([1, 10, 11, 20, 21, 30].map(page.dayName)).toEqual(["初一", "初十", "十一", "二十", "廿一", "三十"]);
	});

	describe("海外访客（M21-12，照黄历 M17-11）", () => {
		const tz = process.env.TZ;
		afterEach(() => {
			process.env.TZ = tz;
		});
		it("温哥华 9月30日 15:08 ＝ 北京 10月1日 06:08：加一句", () => {
			process.env.TZ = "America/Vancouver";
			expect(page.localNote(new Date("2026-10-01T06:08:00+08:00"))).toEqual({
				local: "9月30日 15:08",
				localHour: "申",
				beijing: "10月1日",
				beijingHour: "卯",
			});
		});
		it("和北京同一天同一时辰：不加", () => {
			process.env.TZ = "Asia/Shanghai";
			expect(page.localNote(new Date("2026-10-01T06:08:00+08:00"))).toBeNull();
			// 东京比北京快一小时，同一天同一时辰（午）也不加
			process.env.TZ = "Asia/Tokyo";
			expect(page.localNote(new Date("2026-10-01T11:10:00+08:00"))).toBeNull();
		});

		// 验收建议 1：16:59:50 进选起法、17:00:10 起卦，卡片不能还写申时。刷新排在交界那一刻，不轮询
		it("「此刻」在下一个时辰交界刷新：北京整点；当地整点（半小时时区）；当地那一句显示时每分钟", () => {
			const at = (s: string) => new Date(`2026-10-01T${s}+08:00`);
			process.env.TZ = "Asia/Shanghai";
			const before = at("16:59:50");
			const next = new Date(before.getTime() + page.untilNext(before, false));
			expect(next.toISOString()).toBe(at("17:00:00").toISOString());
			expect(page.hourOf(next).name).not.toBe(page.hourOf(before).name);
			expect(page.hourOf(new Date(next.getTime() - 1)).name).toBe(page.hourOf(before).name);
			// 子夜换日也在整点；正在整点上就排到下一个整点，不空转
			expect(page.untilNext(at("23:59:59.500"), false)).toBe(500);
			expect(page.untilNext(at("17:00:00"), false)).toBe(3_600_000);
			// 阿德莱德（UTC+9:30）：当地 17:00 是北京 15:30，当地时辰在这里变
			process.env.TZ = "Australia/Adelaide";
			expect(page.untilNext(at("15:20:00"), false)).toBe(600_000);
			// 那一句写到分钟：每分钟
			process.env.TZ = "America/Vancouver";
			expect(page.untilNext(at("06:08:20"), true)).toBe(40_000);
		});
	});
});

describe("回访（照 revisit.ts）", () => {
	const now = new Date("2026-10-08T12:00:00+08:00");
	const cases: revisit.Past[] = [
		{ ...meihua(), review: undefined, remind: undefined },
		{ ...meihua({ at: "2026-10-07T01:00:00.000Z" }), review: undefined, remind: undefined },
		{ ...meihua(), review: { outcome: "yes", note: "", at: "2026-10-02T00:00:00.000Z" }, remind: undefined },
		{ ...liuyao(), remind: { days: 30, at: "2026-09-26T14:00:00.000Z" }, review: undefined },
		{ ...liuyao({ question: "" }), review: undefined, remind: undefined },
	];
	it("回访卡什么时候出、几天前怎么写，都一样", () => {
		for (const p of cases)
			for (const d of [now, new Date("2026-12-01T00:00:00Z"), new Date("2026-10-02T00:00:00Z")]) {
				expect(page.showCard(p, d)).toBe(revisit.showCard(p, d));
				expect(page.ago(new Date(p.at), d)).toBe(revisit.ago(new Date(p.at), d));
			}
		for (const t of ["2026-01-01T00:00:00Z", "2025-12-31T17:00:00Z", "2026-10-01T15:59:00Z"])
			expect(page.dayLabel(new Date(t), now)).toBe(flowDayLabel(new Date(t), now));
	});

	it("记下回访：写回的整表与 revisit.save 逐字相同，梅花字段、别的记录的提醒都留着", () => {
		const init = [
			meihua(),
			{ ...liuyao(), remind: { days: 7, at: "2026-09-26T14:00:00.000Z" }, review: { outcome: "bad" } },
			"坏",
		];
		const a = memory(init);
		const b = memory(init);
		const review = { outcome: "half" as const, note: "一半一半", at: "2026-10-08T04:00:00.000Z" };
		expect(revisit.save(a, meihua().at, { review })).toBe(true);
		expect(page.save(b, meihua().at, { review })).toBe(true);
		expect(b.raw()).toBe(a.raw());
		expect(page.find(b, meihua().at)?.review).toEqual(review);
		expect((page.find(b, meihua().at) as page.MeihuaEntry).meihua).toEqual({ by: "time" });
		expect(page.save(b, "2000-01-01T00:00:00.000Z", { review })).toBe(false);
	});
});

describe("磬声（照 sound.ts）", () => {
	/** 记下 Web Audio 的每一次调用 */
	function fake() {
		const log: unknown[] = [];
		const param = (name: string) => ({
			set value(v: number) {
				log.push([name, v]);
			},
			setValueAtTime: (...a: number[]) => log.push([`${name}.set`, ...a]),
			linearRampToValueAtTime: (...a: number[]) => log.push([`${name}.lin`, ...a]),
			exponentialRampToValueAtTime: (...a: number[]) => log.push([`${name}.exp`, ...a]),
		});
		class AudioContext {
			state = "running";
			currentTime = 1;
			destination = {};
			resume() {}
			createOscillator() {
				return { frequency: param("freq"), connect: (g: { connect: () => void }) => g, start: (t: number) => log.push(["start", t]), stop: (t: number) => log.push(["stop", t]) };
			}
			createGain() {
				return { gain: param("gain"), connect: () => log.push(["out"]) };
			}
		}
		return { log, AudioContext };
	}

	it("成卦磬声的分音、音量、衰减与 sound.ts 一样，开关是同一个本机设置", async () => {
		const g = globalThis as Record<string, unknown>;
		const kept = { AudioContext: g.AudioContext, localStorage: g.localStorage };
		const store = new Map<string, string>();
		g.localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v), removeItem: (k: string) => store.delete(k) };
		try {
			const a = fake();
			g.AudioContext = a.AudioContext;
			const sound = await import("../scripts/sound.js");
			sound.unlock();
			sound.qingSound();
			const b = fake();
			g.AudioContext = b.AudioContext;
			page.unlock();
			page.qingSound();
			expect(b.log.length).toBeGreaterThan(0);
			expect(b.log).toEqual(a.log);
			page.setSound(false);
			expect(store.get("liuyao:sound")).toBe("off");
			expect(page.soundOn()).toBe(false);
		} finally {
			g.AudioContext = kept.AudioContext;
			g.localStorage = kept.localStorage;
		}
	});
});
