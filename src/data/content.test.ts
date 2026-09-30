/**
 * 内容覆盖与红线检查.
 *
 * guaci.json format, for whoever renders it: one string per 卦, lines split by
 * "\n". Line 0 is the title, line 1 the 卦辞 — which does NOT always start with
 * 「名：」 (履虎尾…、否之匪人…、同人于野…), so show the whole line rather than
 * splitting on the colon. 爻辞 lines start with 初九/六二/…/上六 and a full-width
 * colon, each followed by its 小象; 用九/用六 exist only in 乾 and 坤.
 */
import {
	Duty,
	Phenology,
	SolarTerm,
	Taboo,
	TwelveStar,
} from "tyme4ts";
import { describe, expect, it } from "vitest";
import { yaoTitle } from "../lib/flow.js";
import { parseGua } from "../lib/gua.js";
import { GUA64 } from "../lib/liuyao/const.js";
import baihuaHant from "./baihua-hant.json" with { type: "json" };
import baihua from "./baihua.json" with { type: "json" };
import * as copy from "./copy.js";
import { GUA } from "./gua-slugs.js";
import guaciHant from "./guaci-hant.json" with { type: "json" };
import guaci from "./guaci.json" with { type: "json" };
import huangliHant from "./huangli-hant.json" with { type: "json" };
import huangli from "./huangli.json" with { type: "json" };
import { SPECIAL, TEMPLATES } from "./templates.js";
import yaoBaihuaHant from "./yao-baihua-hant.json" with { type: "json" };
import yaoBaihua from "./yao-baihua.json" with { type: "json" };

const NAMES = Object.values(GUA64).sort();

function strings(value: unknown): string[] {
	if (typeof value === "string") return [value];
	if (value && typeof value === "object") return Object.values(value).flatMap(strings);
	return [];
}

describe("覆盖", () => {
	it("64 卦都有卦辞与白话（简繁各一份）", () => {
		for (const data of [guaci, baihua, guaciHant, baihuaHant]) expect(Object.keys(data).sort()).toEqual(NAMES);
		for (const [name, text] of Object.entries(baihua)) expect(text, name).toMatch(/^.+，是.+。/);
		for (const [name, text] of Object.entries(baihuaHant)) expect(text, name).toMatch(/^.+，是.+。/);
	});

	it("繁体白话开头的卦名与卦页一致（抓 s2twp 把咸转成鹹、复转成覆、遯写成遁这类误转）", () => {
		for (const [name, text] of Object.entries(baihuaHant))
			expect(text.split("，")[0], name).toBe(parseGua((guaciHant as Record<string, string>)[name]!).short);
	});

	it("每个（类别 × 吉凶）都有结论和至少两条建议", () => {
		for (const [topic, cells] of Object.entries(TEMPLATES))
			for (const [verdict, t] of Object.entries(cells)) {
				expect(t.conclusion, `${topic}${verdict}`).not.toBe("");
				expect(t.advice.length, `${topic}${verdict}`).toBeGreaterThanOrEqual(2);
			}
	});

	it("卦辞的爻位与卦码一一对应，可按爻位取爻辞", () => {
		for (const data of [guaci, guaciHant] as Record<string, string>[]) {
			for (const [mark, name] of Object.entries(GUA64)) {
				const lines = data[name]!.split("\n");
				if (data === guaci) expect(lines[0], name).toContain(name);
				const found = lines.flatMap((l) => l.match(/^(初[六九]|[六九][二三四五]|上[六九])：/)?.[1] ?? []);
				expect(found, name).toEqual([...mark].map((bit, i) => yaoTitle(i, bit === "1")));
			}
			const yong = Object.entries(data).flatMap(([name, text]) => (/\n用[九六]：/.test(text) ? [name] : []));
			expect(yong.sort()).toEqual(["乾为天", "坤为地"].sort());
		}
	});
});

describe("爻辞白话", () => {
	const written = Object.entries(yaoBaihua as Record<string, Record<string, string>>);
	const hant = yaoBaihuaHant as Record<string, Record<string, string>>;
	const ORDER = GUA.map(([name]) => name);

	it("64 卦按卦序写全：爻题与 guaci.json 逐条对应（乾、坤另有用九、用六），共 386 条", () => {
		expect(written.map(([name]) => name)).toEqual(ORDER);
		for (const [name, lines] of written)
			expect(Object.keys(lines), name).toEqual(parseGua((guaci as Record<string, string>)[name]!).yao.map((y) => y.title));
		expect(strings(yaoBaihua)).toHaveLength(386);
	});

	it("繁体与简体的卦序、爻题完全一致（繁体转写后校对，不单独增删）", () => {
		expect(Object.keys(hant)).toEqual(ORDER);
		for (const [name, lines] of written) expect(Object.keys(hant[name]!), name).toEqual(Object.keys(lines));
	});

	it("每条是一两句完整的话，长短与卦辞白话相当（简繁都查）", () => {
		for (const [name, lines] of [...written, ...Object.entries(hant)])
			for (const [title, s] of Object.entries(lines)) {
				expect(s, `${name}${title}`).toMatch(/^[^\s].*。$/);
				expect(s.length, `${name}${title}`).toBeGreaterThanOrEqual(20);
				expect(s.length, `${name}${title}`).toBeLessThanOrEqual(48);
			}
	});

	it("讲爻义本身：第三人称，不对读者说话；讼卦不给输赢结论", () => {
		for (const s of [...strings(yaoBaihua), ...strings(hant)])
			expect(s).not.toMatch(/你|您|官司|胜诉|勝訴|败诉|敗訴|打赢|打贏|打输|打輸/);
	});

	it("繁体白话没有 s2twp 的常见误转（兇、矇、佔、鹹）", () => {
		for (const s of [...strings(baihuaHant), ...strings(hant)]) expect(s).not.toMatch(/[兇矇佔鹹]/);
	});
});

interface Entry {
	name: string;
	text: string;
	/** 节气：导语一句 */
	intro?: string;
	/** 节气：三候，候名照录 tyme4ts 的原文，白话原创 */
	hou?: { name: string; text: string }[];
	note?: boolean;
}
type Cat = "jieqi" | "duty" | "tianshen" | "yiji";
type Huangli = { note: string } & Record<Cat, Record<string, Entry>>;
const HL = huangli as Huangli;
const HL_HANT = huangliHant as unknown as Huangli & { names: Record<string, string> };
const CATS: Cat[] = ["jieqi", "duty", "tianshen", "yiji"];

/** 本站原创的文字：释义、节气导语、三候白话、注。名称和候名是照录的旧文（如宜忌里的「开光」），不在检查之列。 */
function huangliTexts(data: Huangli): string[] {
	return [
		data.note,
		...CATS.flatMap((cat) =>
			Object.values(data[cat]).flatMap((e) => [e.text, ...(e.intro ? [e.intro] : []), ...(e.hou ?? []).map((h) => h.text)]),
		),
	];
}

describe("黄历释义", () => {
	// 键是 tyme4ts 输出的原名，页面按原名取释义；对照全集，时间窗往前滚也不会冒出没有释义的词。
	// 「馀事勿取」「诸事不宜」是标记词，页面照录、不写词义（设计 M17-12）。
	const MARKERS = ["馀事勿取", "诸事不宜"];
	const FULL: Record<Cat, string[]> = {
		jieqi: SolarTerm.NAMES,
		duty: Duty.NAMES,
		tianshen: TwelveStar.NAMES,
		yiji: Taboo.NAMES.filter((n) => !MARKERS.includes(n)),
	};
	const LEN: Record<Cat, [number, number]> = { jieqi: [180, 300], duty: [40, 90], tianshen: [40, 90], yiji: [20, 50] };

	it("每类的键与 tyme4ts 的名字全集一致（宜忌除去两个标记词）", () => {
		expect(Object.keys(huangli).sort()).toEqual(["note", ...CATS].sort());
		for (const cat of CATS) expect(Object.keys(HL[cat]).sort(), cat).toEqual([...FULL[cat]].sort());
		expect(Taboo.NAMES).toEqual(expect.arrayContaining(MARKERS));
	});

	it("繁体与简体逐项对应（键、字段、三候、加注标记都一样）", () => {
		expect(Object.keys(huangliHant).filter((k) => k !== "names")).toEqual(Object.keys(huangli));
		for (const cat of CATS) {
			expect(Object.keys(HL_HANT[cat]), cat).toEqual(Object.keys(HL[cat]));
			for (const [key, e] of Object.entries(HL[cat])) {
				const t = HL_HANT[cat][key]!;
				expect(Object.keys(t), key).toEqual(Object.keys(e));
				expect(t.hou?.length, key).toBe(e.hou?.length);
				expect(t.note, key).toBe(e.note);
			}
		}
	});

	it("简体显示名就是原名；节气的三候候名照 tyme4ts 的原文", () => {
		for (const cat of CATS) for (const [key, e] of Object.entries(HL[cat])) expect(e.name, key).toBe(key);
		for (const [key, e] of Object.entries(HL.jieqi)) {
			const i = SolarTerm.NAMES.indexOf(key);
			expect(e.hou?.map((h) => h.name), key).toEqual(Phenology.NAMES.slice(3 * i, 3 * i + 3));
		}
	});

	it("天神释义开头写明黄道、黑道，与 tyme4ts 一致", () => {
		for (const [key, e] of Object.entries(HL.tianshen)) {
			const ecliptic = TwelveStar.fromName(key).getEcliptic().getName();
			expect(e.text, key).toMatch(new RegExp(`^${key}，${ecliptic}`));
			expect(HL_HANT.tianshen[key]!.text, key).toMatch(ecliptic === "黄道" ? /^.+，黃道/ : /^.+，黑道/);
		}
	});

	it("每条是完整的话，长短在各类的范围内；节气导语、三候白话各一句 20–40 字（简繁都查）", () => {
		const within = (s: string, [min, max]: [number, number], where: string) => {
			expect(s, where).toMatch(/^[^\s].*。$/);
			expect([...s].length, where).toBeGreaterThanOrEqual(min);
			expect([...s].length, where).toBeLessThanOrEqual(max);
		};
		for (const data of [HL, HL_HANT])
			for (const cat of CATS)
				for (const [key, e] of Object.entries(data[cat])) {
					within(e.text, LEN[cat], `${cat}${key}`);
					if (cat !== "jieqi") continue;
					within(e.intro!, [20, 40], `${key}导语`);
					for (const h of e.hou!) within(h.text, [20, 40], `${key}${h.name}`);
				}
	});

	it("求医、词讼一类（AGENTS.md §1.5）正好这 6 个词接注；说到医事、诉讼的释义都在其中", () => {
		const noted = CATS.flatMap((cat) => Object.entries(HL[cat]).flatMap(([key, e]) => (e.note ? [key] : [])));
		expect(noted.sort()).toEqual(["求医", "治病", "针灸", "探病", "求医疗病", "词讼"].sort());
		for (const cat of CATS)
			for (const [key, e] of Object.entries(HL[cat]))
				if (!e.note)
					for (const s of [e.text, e.intro ?? "", ...(e.hou ?? []).map((h) => h.text)])
						expect(s, `${cat}${key}`).not.toMatch(/医|诊|疗|针刺|药|讼|官司/);
	});

	it("讲词义和旧说，不对读者说话", () => {
		for (const s of [...huangliTexts(HL), ...huangliTexts(HL_HANT)]) expect(s).not.toMatch(/你|您/);
	});

	it("繁体没有 s2twp 的常见误转（兇、矇、佔、鹹；三候的征、咸，「北回歸線」）", () => {
		for (const s of strings(huangliHant)) expect(s).not.toMatch(/[兇矇佔鹹]|徵鳥|迴歸線/);
	});
});

describe("红线（简繁都查）", () => {
	const all = [
		...huangliTexts(HL),
		...huangliTexts(HL_HANT),
		...strings(baihua),
		...strings(baihuaHant),
		...strings(yaoBaihua),
		...strings(yaoBaihuaHant),
		...strings(TEMPLATES),
		...strings(SPECIAL),
		...strings(copy),
	];

	it("不出现改命、转运、化解之类的字样", () => {
		expect(strings(copy).length).toBeGreaterThan(10);
		for (const s of all) expect(s).not.toMatch(/改命|转运|轉運|化解|算命|消灾|消災|开光|開光|大师|大師|血光|大凶|大兇/);
	});

	it("不打包票，不给应期", () => {
		for (const s of all) expect(s).not.toMatch(/一定|必定|必然|保证|保證|之内|之內/);
	});
});
