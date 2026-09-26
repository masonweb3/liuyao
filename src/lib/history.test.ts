import { describe, expect, it } from "vitest";
import { asked, type Entry, entries, forget, record } from "./history.js";

const memory = () => {
	const m = new Map<string, string>();
	return {
		getItem: (k: string) => m.get(k) ?? null,
		setItem: (k: string, v: string) => void m.set(k, v),
		removeItem: (k: string) => void m.delete(k),
	};
};

const entry = (over: Partial<Entry> = {}): Entry => ({
	question: "下个月跳槽去新公司，能成吗？",
	ask: { topic: "事业" },
	params: [9, 7, 8, 7, 7, 6],
	at: "2026-09-26T14:00:00.000Z",
	lateZi: "day-stays",
	...over,
});

describe("往卦", () => {
	it("新的在前", () => {
		const s = memory();
		record(s, entry({ question: "一" }));
		record(s, entry({ question: "二" }));
		expect(entries(s).map((e) => e.question)).toEqual(["二", "一"]);
		forget(s);
		expect(entries(s)).toEqual([]);
	});

	it("存储里是坏数据也不报错，只丢掉坏的", () => {
		const s = memory();
		expect(entries(s)).toEqual([]);
		s.setItem("liuyao:history", "{oops");
		expect(entries(s)).toEqual([]);
		s.setItem("liuyao:history", '{"a":1}');
		expect(entries(s)).toEqual([]);
		const bad = [
			null,
			entry({ params: [9, 7, 8] as Entry["params"] }),
			entry({ params: [1, 7, 8, 7, 7, 6] as Entry["params"] }),
			entry({ ask: { topic: "彩票" } as unknown as Entry["ask"] }),
			entry({ ask: { topic: "婚恋" } as Entry["ask"] }),
			entry({ at: "昨天" }),
		];
		s.setItem("liuyao:history", JSON.stringify([...bad, entry({ ask: { topic: "婚恋", gender: "女" } })]));
		expect(entries(s)).toHaveLength(1);
	});
});

describe("一事一占", () => {
	const past = [entry(), entry({ question: "" })];
	it("空格、全半角、大小写、句末标点不算另一件事", () => {
		expect(asked(past, "下个月跳槽去新公司，能成吗？")).toBe(true);
		expect(asked(past, " 下个月 跳槽去新公司，能成吗?")).toBe(true);
		expect(asked(past, "下个月跳槽去新公司，能成吗")).toBe(true);
		expect(asked([entry({ question: "Offer 能拿到吗？" })], "offer能拿到吗")).toBe(true);
	});
	it("换一件事可以问；手动排盘没有所问，不拦任何问题", () => {
		expect(asked(past, "下个月跳槽去新公司，能谈到好薪水吗？")).toBe(false);
		expect(asked([entry({ question: "" })], "")).toBe(false);
	});
});
