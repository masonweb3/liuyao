import { Taboo } from "tyme4ts";
import { describe, expect, it } from "vitest";
import huangliHant from "../data/huangli-hant.json" with { type: "json" };
import huangliData from "../data/huangli.json" with { type: "json" };
import { type Data, huangliOf, show } from "./huangli.js";
import { monthCards, months } from "./huangli-card.js";
import { days, HANT } from "./huangli-days.js";
import { goodDays, monthNote, monthRows } from "./zeri.js";
import { cardHits, clash, hits, ITEMS, keys, type Slug, zeriPath } from "./zeri-rule.js";

const SLUGS = ITEMS.map((i) => i.slug);
const ZODIAC = "鼠牛虎兔龙蛇马羊猴鸡狗猪";
const ym = (m: string) => m.split("-").map(Number) as [number, number];

describe("事项表", () => {
	it("六个事项，slug 上线后不改", () => {
		expect(SLUGS).toEqual(["banjia", "jiehun", "kaiye", "chuxing", "zhuangxiu", "dinghun"]);
	});

	it("事项词都是 tyme4ts 宜忌里的词，也都有词义", () => {
		for (const w of ITEMS.flatMap((i) => i.words)) {
			expect(Taboo.NAMES).toContain(w);
			expect((huangliData as unknown as Data).yiji[w], w).toBeDefined();
		}
	});

	it("不收投资、就医、诉讼的词（AGENTS.md §1.5）；开业只看开市", () => {
		const words: string[] = ITEMS.flatMap((i) => [...i.words]);
		for (const w of ["置产", "纳财", "求医", "治病", "针灸", "探病", "求医疗病", "词讼", "立券", "交易"]) expect(words).not.toContain(w);
	});
});

describe("命中规则的边界", () => {
	const at = (date: string, slug: Slug) => {
		const h = huangliOf(date);
		return hits(slug, h.yi, h.ji);
	};

	it("命中的宜词按事项表的词序（2026-01-01 宜里先列入宅）", () => {
		expect(huangliOf("2026-01-01").yi.slice(0, 2)).toEqual(["入宅", "移徙"]);
		expect(at("2026-01-01", "banjia")).toEqual(["移徙", "入宅"]);
	});

	it("一个词在宜、另一个在忌，不算", () => {
		expect(huangliOf("2026-04-23").yi).toContain("移徙");
		expect(huangliOf("2026-04-23").ji).toContain("入宅");
		expect(at("2026-04-23", "banjia")).toEqual([]);
		expect(huangliOf("2026-03-20").yi).toContain("修造");
		expect(huangliOf("2026-03-20").ji).toContain("动土");
		expect(at("2026-03-20", "zhuangxiu")).toEqual([]);
		// 同一个词同时在宜忌：窗内没有，规则也排除
		expect(hits("chuxing", ["出行"], ["出行"])).toEqual([]);
	});

	it("宜里有「诸事不宜」，事项词也在宜：不算（2026-05-02、2027-04-27 的订婚）", () => {
		for (const date of ["2026-05-02", "2027-04-27"]) {
			const h = huangliOf(date);
			expect(h.yi).toEqual(expect.arrayContaining(["纳采", "订盟", "诸事不宜"]));
			expect(at(date, "dinghun")).toEqual([]);
		}
	});

	it("忌里有「诸事不宜」，事项词在宜：不算（2026-09-08 的出行）", () => {
		expect(huangliOf("2026-09-08")).toMatchObject({ yi: ["祭祀", "出行", "扫舍", "馀事勿取"], ji: ["诸事不宜"] });
		expect(at("2026-09-08", "chuxing")).toEqual([]);
	});

	it("「诸事不宜」在窗内只改变上面三处", () => {
		const changed: string[] = [];
		const drop = (l: string[]) => l.filter((w) => w !== "诸事不宜");
		for (const date of days()) {
			const h = huangliOf(date);
			for (const slug of SLUGS) if (hits(slug, h.yi, h.ji).length !== hits(slug, drop(h.yi), drop(h.ji)).length) changed.push(`${date} ${slug}`);
		}
		expect(changed).toEqual(["2026-05-02 dinghun", "2026-09-08 chuxing", "2027-04-27 dinghun"]);
	});

	it("只有「馀事勿取」不影响（2027-06-20 宜出行、馀事勿取）", () => {
		expect(huangliOf("2027-06-20").yi).toEqual(["出行", "教牛马", "割蜜", "馀事勿取"]);
		expect(at("2027-06-20", "chuxing")).toEqual(["出行"]);
	});

	it("繁体按月数据的标记词换回简体再比", () => {
		const day = (yi: string[], marks: string[]) => ({ list: yi.map((key) => ({ key })), marks });
		expect(cardHits("chuxing", { yi: day(["出行"], ["餘事勿取"]), ji: day([], ["諸事不宜"]) })).toEqual([]);
		expect(cardHits("chuxing", { yi: day(["出行"], ["餘事勿取"]), ji: day([], []) })).toEqual(["出行"]);
	});
});

describe("生肖避冲", () => {
	it("日支对冲：戊申日冲虎；按月数据的干支串也认得", () => {
		expect(clash("戊申")).toBe(2);
		expect(clash("丙午年 丁酉月 戊申日")).toBe(2);
		expect(clash("甲子")).toBe(6);
	});

	it("窗内每一天，冲的生肖与逐日页的「冲某」一致", () => {
		for (const date of days()) {
			const h = huangliOf(date);
			expect(ZODIAC[clash(h.ganzhi.day)], date).toBe(h.chong.zodiac);
		}
	});

	it("给了生肖，只去掉冲它的日子", () => {
		for (const m of months())
			for (const slug of SLUGS)
				for (let z = 0; z < 12; z++)
					expect(goodDays(...ym(m), slug, z)).toEqual(goodDays(...ym(m), slug).filter((d) => clash(huangliOf(d.date).ganzhi.day) !== z));
	});
});

describe("单一来源：构建时与浏览器逐日相同（2026-01-01 至 2027-12-31）", () => {
	it("goodDays（tyme4ts）与按月数据（简体、繁体）筛出的吉日、命中词、冲的生肖完全相同", () => {
		for (const m of months()) {
			const cards = [monthCards(m, false), monthCards(m, true)];
			for (const c of cards) {
				for (const [date, card] of Object.entries(c)) {
					const h = huangliOf(date);
					// 按月数据换回的原词与引擎的宜忌同一个集合（标记词在 show() 里排到词后，次序可能不同）
					expect(new Set(keys(card.yi)), date).toEqual(new Set(h.yi));
					expect(new Set(keys(card.ji)), date).toEqual(new Set(h.ji));
					expect(clash(card.ganzhi), date).toBe(clash(h.ganzhi.day));
				}
				for (const slug of SLUGS) {
					const browser = Object.entries(c)
						.map(([date, card]) => ({ date, hits: cardHits(slug, card) }))
						.filter((d) => d.hits.length);
					expect(browser, `${m} ${slug}`).toEqual(goodDays(...ym(m), slug));
				}
			}
		}
	});
});

describe("事项月页", () => {
	it("窗内每个事项每个月都有吉日（最少 4 天；没有吉日的月份要另做版式）", () => {
		for (const m of months()) for (const slug of SLUGS) expect(goodDays(...ym(m), slug).length, `${m} ${slug}`).toBeGreaterThan(0);
	});
});

describe("吉日与逐日页一致", () => {
	it("窗内每一天：逐日页上宜里有事项词、忌里没有、也没写「诸事不宜」，就是吉日；反之不是", () => {
		const good = new Map(SLUGS.map((slug) => [slug, new Map(months().flatMap((m) => goodDays(...ym(m), slug).map((d) => [d.date, d.hits])))]));
		for (const date of days()) {
			const s = show(huangliOf(date), huangliData as unknown as Data);
			const yi = s.yi.list.map((w) => w.key);
			const ji = s.ji.list.map((w) => w.key);
			const none = [...(s.yi.marks ?? []), ...(s.ji.marks ?? [])].includes("诸事不宜");
			for (const { slug, words } of ITEMS) {
				const expected = !none && words.some((w) => yi.includes(w)) && !words.some((w) => ji.includes(w));
				const got = good.get(slug)!.get(date);
				expect(!!got, `${date} ${slug}`).toBe(expected);
				if (got) expect(yi).toEqual(expect.arrayContaining(got));
			}
		}
	});
});

describe("事项月页的数据（月页列出的日子、命中的词与逐日页一致）", () => {
	it("窗内每个事项每个月、简繁：月页逐日一行就是 goodDays 的那几天；命中的词是逐日页宜里的同一个词，冲煞、建除、值神也照逐日页", () => {
		for (const hant of [false, true]) {
			const data = (hant ? huangliHant : huangliData) as unknown as Data;
			for (const m of months())
				for (const slug of SLUGS) {
					const good = goodDays(...ym(m), slug);
					const rows = monthRows(slug, m, hant);
					expect(rows.map((r) => r.date), `${m} ${slug}`).toEqual(good.map((d) => d.date));
					rows.forEach((r, i) => {
						const s = show(huangliOf(r.date), data);
						expect(r.hits.map((w) => w.key), r.date).toEqual(good[i]!.hits);
						expect(s.yi.list, r.date).toEqual(expect.arrayContaining(r.hits));
						expect([r.md, r.week, r.lunar, r.chong, r.duty, r.star], r.date).toEqual([s.md, s.week, s.lunar, s.chong, s.duty, s.star]);
						expect(s.ganzhi.endsWith(r.gz), r.date).toBe(true);
					});
				}
		}
	});

	it("说明里按当月数据写的一句（设计稿 26 的两个例子）", () => {
		expect(monthNote("banjia", "2026-11", false)).toBe("11月的 11 天里，10 天两个词都宜；25日只宜移徙。");
		expect(monthNote("banjia", "2026-11", true)).toBe("11月的 11 天裡，10 天兩個詞都宜；25日只宜移徙。");
		expect(monthNote("jiehun", "2026-12", false)).toBe("12月合用的有 4 天；11月有 12 天，明年1月有 11 天。");
		// 时间窗两端只写窗里的那一个邻月
		expect(monthNote("kaiye", "2026-01", false)).toMatch(/^1月合用的有 \d+ 天；2月有 \d+ 天。$/);
		expect(monthNote("kaiye", "2027-12", true)).toMatch(/^12月合用的有 \d+ 天；11月有 \d+ 天。$/);
	});

	it("网址带尾斜杠，繁体前缀同 huangli-days.ts 的 HANT", () => {
		expect(zeriPath()).toBe("/zeri/");
		expect(zeriPath("banjia", "2026-11")).toBe("/zeri/banjia/2026-11/");
		expect(zeriPath("zhuangxiu", "2027-05", true)).toBe(`${HANT}/zeri/zhuangxiu/2027-05/`);
		expect(zeriPath(undefined, undefined, true)).toBe(`${HANT}/zeri/`);
	});
});
