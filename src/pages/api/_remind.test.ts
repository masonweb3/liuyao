// `_` prefix keeps Astro from routing this file.
import { describe, expect, it } from "vitest";
import { REMIND } from "../../data/copy.js";
import { icsPath, remindAt, reminder } from "../../lib/revisit.js";
import { GET, parse } from "./remind.ics.js";

const site = new URL("https://sixyao.app");
const call = (path: string) =>
	GET({ url: new URL(path, "http://x"), site } as Parameters<typeof GET>[0]) as Promise<Response>;

const DAY = 86_400_000;
const GUA = "兑为泽之天水讼";
/** YYYYMMDD of the UTC day `n` days from now. */
const ymd = (n: number) => new Date(Date.now() + n * DAY).toISOString().slice(0, 10).replace(/-/g, "");
const query = (o: Record<string, string>) => `/api/remind.ics?${new URLSearchParams(o)}`;
const good = { d: ymd(7), c: ymd(-1), g: GUA };

describe("GET /api/remind.ics", () => {
	it("和浏览器里生成的 .ics 除 UID、DTSTAMP 外逐字相同，文件名也相同", async () => {
		const now = new Date();
		const start = remindAt(now, 7);
		const cast = new Date(now.getTime() - 2 * DAY);
		const res = await call(icsPath(cast, GUA, start));
		expect(res.status).toBe(200);
		const mine = reminder(cast, GUA, start, now, "x", { ...REMIND.ics, url: "https://sixyao.app/?history" });
		const strip = (s: string) => s.replace(/^(UID|DTSTAMP):.*\r\n/gm, "");
		const text = await res.text();
		expect(strip(text)).toBe(strip(mine.text));
		expect(text).toMatch(/^UID:[0-9a-f]{32}@sixyao\.app\r$/m);
		expect(res.headers.get("content-disposition")).toBe(`inline; filename="${mine.name}"`);
	});

	it("响应头：text/calendar、inline、不缓存、不收录", async () => {
		const res = await call(query(good));
		expect(res.headers.get("content-type")).toBe("text/calendar; charset=utf-8");
		expect(res.headers.get("content-disposition")).toMatch(/^inline; filename="sixyao-\d{4}-\d{2}-\d{2}\.ics"$/);
		expect(res.headers.get("cache-control")).toBe("no-store");
		expect(res.headers.get("x-robots-tag")).toBe("noindex");
	});

	it("单卦、本卦之变卦都行；别的键不理", async () => {
		expect((await call(query({ ...good, g: "乾为天" }))).status).toBe(200);
		expect((await call(query({ ...good, g: "火雷噬嗑之山火贲" }))).status).toBe(200);
		expect((await call(`${query(good)}&utm_source=x`)).status).toBe(200);
	});

	const bad: [string, Record<string, string> | string][] = [
		["不是卦名", { ...good, g: "明天发财" }],
		["卦名简称", { ...good, g: "兑之讼" }],
		["三个卦", { ...good, g: "兑为泽之天水讼之乾为天" }],
		["结尾多一个之", { ...good, g: "兑为泽之" }],
		["注入换行", { ...good, g: "兑为泽\r\nSUMMARY:中奖了" }],
		["注入逗号、分号", { ...good, g: "兑为泽,天水讼;X" }],
		["没有卦名", { d: good.d, c: good.c }],
		["日期不存在", { ...good, d: "20270230" }],
		["日期格式", { ...good, d: "2026-10-04" }],
		["日期太远", { ...good, d: ymd(41) }],
		["日期已过", { ...good, d: ymd(-3) }],
		["起卦在提醒之后", { ...good, c: ymd(8) }],
		["起卦早于本站", { ...good, c: "20251231" }],
		["起卦日期不存在", { ...good, c: "20260931" }],
		["键重复", `${query(good)}&d=${ymd(3)}`],
	];
	for (const [name, q] of bad)
		it(`400：${name}`, async () => {
			const res = await call(typeof q === "string" ? q : query(q));
			expect(res.status).toBe(400);
			expect(res.headers.get("content-type")).toBe("text/plain; charset=utf-8");
			expect(res.headers.get("cache-control")).toBe("no-store");
			expect(res.headers.get("x-robots-tag")).toBe("noindex");
			// 不回显任何输入
			expect(await res.text()).toBe("Bad request\n");
		});

	it("边界：提醒日前后留两天、四十天的余地", () => {
		const now = new Date();
		for (const n of [-2, 0, 3, 30, 40]) expect(parse(new URLSearchParams({ ...good, d: ymd(n), c: ymd(-5) }), now)).not.toBeNull();
		expect(parse(new URLSearchParams({ ...good, c: good.d }), now)).not.toBeNull();
	});

	it("起始时间是那天 20:00（本进程时区，浮动时间照这个时区读）", () => {
		const r = parse(new URLSearchParams({ ...good, d: ymd(7) }), new Date());
		const d = ymd(7);
		expect(r?.start).toEqual(new Date(Number(d.slice(0, 4)), Number(d.slice(4, 6)) - 1, Number(d.slice(6)), 20));
	});
});
