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
	EarthBranch,
	Ecliptic,
	God,
	HeavenStem,
	LunarDay,
	LunarFestival,
	LunarMonth,
	PengZuEarthBranch,
	PengZuHeavenStem,
	Phenology,
	SolarTerm,
	Sound,
	Taboo,
	TenStar,
	Terrain,
	TwelveStar,
	Week,
	Zodiac,
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
import { ITEMS } from "../lib/zeri-rule.js";
import zeriHant from "./zeri-hant.json" with { type: "json" };
import zeri from "./zeri.json" with { type: "json" };
import { readFileSync } from "node:fs";
import { shenSha } from "../lib/bazi.js";
import { localOffset } from "../lib/bazi-time.js";
import baziHant from "./bazi-hant.json" with { type: "json" };
import baziNamesHant from "./bazi-names-hant.json" with { type: "json" };
import bazi from "./bazi.json" with { type: "json" };
import baziDizhiHant from "./bazi-dizhi-hant.json" with { type: "json" };
import baziDizhi from "./bazi-dizhi.json" with { type: "json" };
import baziPagesHant from "./bazi-pages-hant.json" with { type: "json" };
import baziPages from "./bazi-pages.json" with { type: "json" };
import baziTianganHant from "./bazi-tiangan-hant.json" with { type: "json" };
import baziTiangan from "./bazi-tiangan.json" with { type: "json" };
import cities from "./cities.json" with { type: "json" };
import { compose } from "../lib/meihua-reading.js";

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
	lead?: string;
	/** 节气：三候，候名照录 tyme4ts 的原文，白话原创 */
	hou?: { name: string; text: string }[];
	/** 要接哪一条注：med 医事，law 诉讼 */
	note?: "med" | "law";
}
type Cat = "jieqi" | "duty" | "tianshen" | "yiji";
type Huangli = { note: { med: string; law: string } } & Record<Cat, Record<string, Entry>>;
const HL = huangli as Huangli;
const HL_HANT = huangliHant as unknown as Huangli & { names: Record<string, string> };
const CATS: Cat[] = ["jieqi", "duty", "tianshen", "yiji"];

/** 本站原创的文字：释义、节气导语、三候白话、注。名称和候名是照录的旧文（如宜忌里的「开光」），不在检查之列。 */
function huangliTexts(data: Huangli): string[] {
	return [
		data.note.med,
		data.note.law,
		...CATS.flatMap((cat) =>
			Object.values(data[cat]).flatMap((e) => [e.text, ...(e.lead ? [e.lead] : []), ...(e.hou ?? []).map((h) => h.text)]),
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
		expect(Object.keys(HL_HANT.note)).toEqual(Object.keys(HL.note));
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

	it("简体显示名就是原名；节气的三候候名照 tyme4ts 的原文（逐日页按下标取同一个候名）", () => {
		for (const cat of CATS) for (const [key, e] of Object.entries(HL[cat])) expect(e.name, key).toBe(key);
		// 唯一的例外：tyme4ts 作「大雨行时」，字序倒了；《逸周书》《礼记·月令》《月令七十二候集解》都作「大雨时行」
		const HOU = Phenology.NAMES.map((n) => (n === "大雨行时" ? "大雨时行" : n));
		expect(HOU).not.toEqual(Phenology.NAMES);
		for (const [key, e] of Object.entries(HL.jieqi)) {
			const i = SolarTerm.NAMES.indexOf(key);
			expect(e.hou?.map((h) => h.name), key).toEqual(HOU.slice(3 * i, 3 * i + 3));
		}
	});

	it("天神的黄道、黑道由页面标注；释义里提到的与 tyme4ts 一致", () => {
		for (const [key, e] of Object.entries(HL.tianshen)) {
			const other = TwelveStar.fromName(key).getEcliptic().getName() === "黄道" ? "黑道" : "黄道";
			expect(e.text, key).not.toContain(other);
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
					within(e.lead!, [20, 40], `${key}导语`);
					for (const h of e.hou!) within(h.text, [20, 40], `${key}${h.name}`);
				}
	});

	it("求医、词讼一类（AGENTS.md §1.5）正好这 6 个词接注，医、讼各接各的；说到医事、诉讼的释义都在其中", () => {
		const noted = Object.fromEntries(
			CATS.flatMap((cat) => Object.entries(HL[cat]).flatMap(([key, e]) => (e.note ? [[key, e.note]] : []))),
		);
		expect(noted).toEqual({ 求医: "med", 治病: "med", 针灸: "med", 探病: "med", 求医疗病: "med", 词讼: "law" });
		// 择日不给就医、诉讼选日（§1.5），注里要说出来
		expect(HL.note.med).toMatch(/本站不为就医/);
		expect(HL.note.law).toMatch(/本站不为诉讼/);
		for (const cat of CATS)
			for (const [key, e] of Object.entries(HL[cat]))
				if (!e.note)
					for (const s of [e.text, e.lead ?? "", ...(e.hou ?? []).map((h) => h.text)])
						expect(s, `${cat}${key}`).not.toMatch(/医|诊|疗|针刺|药|讼|官司/);
	});

	it("讲词义和旧说，不对读者说话", () => {
		for (const s of [...huangliTexts(HL), ...huangliTexts(HL_HANT)]) expect(s).not.toMatch(/你|您/);
	});

	it("繁体没有 s2twp 的常见误转（兇、矇、佔、鹹；三候的征、咸，「北回歸線」）；沖统一不写衝，历书统称農民曆", () => {
		for (const s of strings(huangliHant)) expect(s).not.toMatch(/[兇矇佔鹹衝]|徵鳥|迴歸線|黃曆|轉幹/);
	});

	describe("繁体页显示的 tyme4ts 名字（huangli-hant.json 的 names）", () => {
		const { names } = HL_HANT;
		// 页面把 tyme4ts 输出的简体原文按这张表换成繁体；每类取 tyme4ts 的全集，不手写清单。
		const GROUPS: Record<string, string[]> = {
			宜忌: Taboo.NAMES,
			神煞: God.NAMES,
			建除: Duty.NAMES,
			天神: TwelveStar.NAMES,
			黄道黑道: Ecliptic.NAMES,
			纳音: Sound.NAMES,
			彭祖百忌: [...PengZuHeavenStem.NAMES, ...PengZuEarthBranch.NAMES],
			节气: SolarTerm.NAMES,
			生肖: Zodiac.NAMES,
			煞方: EarthBranch.NAMES.map((b) => EarthBranch.fromName(b).getOminous().getName()),
			农历月: [...LunarMonth.NAMES, ...LunarMonth.NAMES.map((m) => `闰${m}`), "冬月", "腊月"],
			农历日: LunarDay.NAMES,
			星期: Week.NAMES,
			农历节日: LunarFestival.NAMES,
		};

		it("覆盖每一类的全集，逐字一一对应", () => {
			for (const [group, all] of Object.entries(GROUPS))
				for (const n of all) {
					expect(names[n], `${group}${n}`).toBeTruthy();
					expect([...names[n]!].length, n).toBe([...n].length);
				}
			const known = new Set(Object.values(GROUPS).flat());
			expect(Object.keys(names).filter((n) => !known.has(n))).toEqual([]);
		});

		it("干支字简繁相同，names 里出现时原样保留（抓 s2twp 把丑转成醜）", () => {
			const ganzhi = new Set([...HeavenStem.NAMES, ...EarthBranch.NAMES]);
			for (const [n, t] of Object.entries(names))
				[...n].forEach((c, i) => ganzhi.has(c) && expect([...t][i], n).toBe(c));
		});

		it("释义条目上的繁体显示名与 names 一致", () => {
			for (const cat of CATS) for (const [key, e] of Object.entries(HL_HANT[cat])) expect(e.name, key).toBe(names[key]);
		});
	});
});

describe("择日的事项说明（M18）", () => {
	type Zeri = { intro: string; how: string[]; items: Record<string, { card: string; words: string; tips: string }> };
	const [hans, hant] = [zeri, zeriHant] as Zeri[];
	const SLUGS = ITEMS.map((i) => i.slug);

	it("六件事都写了，简繁逐项对应；每段是完整的话", () => {
		for (const data of [hans!, hant!]) {
			expect(Object.keys(data)).toEqual(["intro", "how", "items"]);
			expect(Object.keys(data.items)).toEqual(SLUGS);
			for (const v of Object.values(data.items)) expect(Object.keys(v)).toEqual(["card", "words", "tips"]);
			for (const s of strings(data)) expect(s).toMatch(/^[^\s].*。$/);
		}
		expect(hant!.how.length).toBe(hans!.how.length);
	});

	it("不写凶；结婚、订婚不写婚姻结局，不写冲、克、犯、不吉（M18-5）", () => {
		for (const s of [...strings(hans), ...strings(hant)]) expect(s).not.toMatch(/凶|兇/);
		for (const data of [hans!, hant!])
			for (const slug of ["jiehun", "dinghun"])
				for (const s of strings(data.items[slug]))
					expect(s, slug).not.toMatch(/美满|美滿|白头偕老|白頭偕老|旺夫|长久|長久|幸福|冲|沖|克|剋|犯|不吉/);
	});

	it("繁体：台湾用语（農民曆、臺灣時間），事项名「裝潢」「入厝」照负责人定稿（M18-7）；没有 s2twp 的常见误转", () => {
		for (const s of strings(hant)) expect(s).not.toMatch(/[兇矇佔鹹衝]|黃曆|北京/);
		expect(hant!.intro).toContain("裝潢");
		expect(hant!.items.banjia!.words).toContain("入厝");
		expect(hant!.items.zhuangxiu!.words).toContain("裝修");
	});
});

describe("八字（M19a）", () => {
	type Terms = { intro: string; terms: { term: string; text: string }[] };
	const [hans, hant] = [bazi, baziHant] as Terms[];
	// 页面上的文字：组件里写定的界面文字与脚本写进盘面的字，注释不算
	const page = readFileSync(new URL("../components/Bazi.astro", import.meta.url), "utf8").replace(
		/\{\/\*[\s\S]*?\*\/\}|\/\*[\s\S]*?\*\/|\/\/.*$/gm,
		"",
	);

	it("盘面上的词：导语加 14 条，简繁逐条对应，每条是完整的话", () => {
		for (const d of [hans!, hant!]) {
			expect(Object.keys(d)).toEqual(["intro", "terms"]);
			expect(d.terms).toHaveLength(14);
			for (const x of d.terms) expect(Object.keys(x)).toEqual(["term", "text"]);
			for (const s of [d.intro, ...d.terms.map((x) => x.text)]) expect(s).toMatch(/^[^\s].*。$/);
		}
	});

	it("只排盘面，不下断语（§1.5）：词语说明和页面文字里没有寿元、疾病、灾厄、牢狱、克夫克妻、婚变、吉凶", () => {
		for (const s of [...strings(bazi), ...strings(baziHant), page])
			expect(s).not.toMatch(/寿元|壽元|疾病|灾厄|災厄|牢狱|牢獄|克夫|剋夫|克妻|剋妻|婚变|婚變|凶|兇|改运|改運/);
	});

	it("繁体：台湾用语（生克义用「剋」、注解义用「註」，臺灣時間），没有 s2twp 的常见误转", () => {
		for (const s of strings(baziHant)) expect(s).not.toMatch(/[兇矇佔鹹衝]|北京|默認/);
		expect(strings(baziHant).join("")).toMatch(/剋/);
	});

	it("繁体名称表：十神、十二长生、十三种神煞全有，逐字对应，干支字不变", () => {
		const names = baziNamesHant as Record<string, string>;
		const SHA = ["天乙贵人", "太极贵人", "文昌贵人", "天德贵人", "月德贵人", "禄神", "羊刃", "金舆", "驿马", "桃花", "华盖", "将星", "魁罡"];
		expect(Object.keys(names).sort()).toEqual([...TenStar.NAMES, ...Terrain.NAMES, ...SHA].sort());
		for (const [n, t] of Object.entries(names)) expect([...t].length, n).toBe([...n].length);
		// 引擎能出的神煞正好是这十三种：随便排几盘，名字都在表里
		const seen = new Set(["甲子 丙寅 戊辰 庚午", "庚辰 戊子 壬辰 丙午", "癸亥 乙丑 戊辰 丁巳"].flatMap((g) => g.split(" ").flatMap((_, k, gz) => shenSha(gz, k))));
		for (const n of seen) expect(SHA).toContain(n);
	});

	it("出生地名单：显示的写法不重复，时区浏览器认得，大陆一律北京时间，经度与时区大致相符", () => {
		const data = cities as { regions: [string, string][]; zones: string[]; cities: [string, string, number, number, number][] };
		expect(data.cities.length).toBeGreaterThan(400);
		for (const k of [0, 1]) {
			const labels = data.cities.map((c) => (c[k] === data.regions[c[2]]![k] ? c[k] : `${c[k]} · ${data.regions[c[2]]![k]}`));
			expect(new Set(labels).size, k ? "繁体" : "简体").toBe(labels.length);
		}
		for (const tz of data.zones) expect(() => new Intl.DateTimeFormat("en", { timeZone: tz }), tz).not.toThrow();
		const province = new Set(data.regions.slice(0, data.regions.findIndex((r) => r[0] === "台湾")).map((r) => r[0]));
		expect(province.size).toBe(31);
		for (const [name, , r, lon, z] of data.cities) {
			const tz = data.zones[z]!;
			if (province.has(data.regions[r]![0])) expect(tz, name).toBe("Asia/Shanghai");
			// 标准时比经度算出的地方时差不出 3.5 小时（新疆按北京时间差得最多）：抓经度或时区填错
			const { offset, dst } = localOffset(tz, 2024, 1, 15, 12, 0);
			expect(Math.abs((offset - dst) / 60 - lon / 15), name).toBeLessThan(3.5);
		}
		// 台湾的城市名、所属照台湾写法
		expect(data.cities.filter((c) => data.regions[c[2]]![0] === "台湾").map((c) => c[1])).toEqual(expect.arrayContaining(["臺北", "臺中", "臺南", "臺東"]));
	});
});

describe("八字知识页（M19b）", () => {
	const kb = [baziTiangan, baziDizhi, baziPages];
	const kbHant = [baziTianganHant, baziDizhiHant, baziPagesHant];
	// 字段路径（键保持简体，繁体只转值）
	const paths = (v: unknown, p = ""): string[] =>
		typeof v === "string" ? [p] : v && typeof v === "object" ? Object.entries(v).flatMap(([k, x]) => paths(x, `${p}/${k}`)) : [];
	// 知识页组件写在页面上的字（注释不算）；十二长生的步名不在源码里，构建时取 Terrain.NAMES
	const page = readFileSync(new URL("../components/BaziKb.astro", import.meta.url), "utf8").replace(
		/\{\/\*[\s\S]*?\*\/\}|\/\*[\s\S]*?\*\/|\/\/.*$/gm,
		"",
	);

	it("结构：十天干、十二地支各导语一句加「怎么读」三段，十神页十个名目，目录页各一句；繁体逐项对应", () => {
		expect(Object.keys(baziTiangan.items)).toEqual(["jia", "yi", "bing", "ding", "wu", "ji", "geng", "xin", "ren", "gui"]);
		expect(Object.keys(baziDizhi.items)).toEqual(["zi", "chou", "yin", "mao", "chen", "si", "wu", "wei", "shen", "you", "xu", "hai"]);
		for (const x of [...Object.values(baziTiangan.items), ...Object.values(baziDizhi.items)]) expect(x.read).toHaveLength(3);
		expect(Object.keys(baziPages.shishen.names).sort()).toEqual([...TenStar.NAMES].sort());
		expect(baziPages.shishen.read).toHaveLength(2);
		for (const k of ["nayin", "changsheng"] as const) expect(baziPages[k].read.length).toBeGreaterThanOrEqual(2);
		kb.forEach((d, i) => expect(paths(kbHant[i])).toEqual(paths(d)));
		for (const s of [...kb, ...kbHant].flatMap(strings)) expect(s).toMatch(/^[^\s].*。$/);
	});

	it("只讲构成与名目（§1.5）：不写寿元、疾病、婚变、吉凶、贵贱、性格，步名「病死墓绝」只在表里，不用方位词", () => {
		for (const s of [...kb, ...kbHant].flatMap(strings).concat(page)) {
			expect(s).not.toMatch(/寿元|壽元|疾病|灾厄|災厄|牢狱|牢獄|克夫|剋夫|克妻|剋妻|婚变|婚變|吉|凶|兇|贵|貴|贱|賤|性格|性情|改命|改运|改運|转运|轉運|化解/);
			expect(s).not.toMatch(/[病死墓绝絕]/);
		}
		for (const s of [...kb, ...kbHant].flatMap(strings)) expect(s).not.toMatch(/上面|下面|左右|左邊|右邊/);
	});

	it("繁体：生克用「剋」、冲用「沖」、臺灣時間，没有 s2twp 的常见误转", () => {
		const hant = kbHant.flatMap(strings);
		for (const s of hant) expect(s).not.toMatch(/[兇矇佔鹹衝克]|北京|默認|藏幹/);
		expect(hant.join("")).toMatch(/剋/);
	});
});

describe("红线（简繁都查）", () => {
	const all = [
		...strings(bazi),
		...strings(baziHant),
		...[baziTiangan, baziDizhi, baziPages, baziTianganHant, baziDizhiHant, baziPagesHant].flatMap(strings),
		...strings(zeri),
		...strings(zeriHant),
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

	// 梅花页（M21）：说明区、各屏的字写在组件里，依据与算式由 Worker 拼（meihua-reading.ts），384 种起法全拼一遍
	it("梅花页的说明、界面与依据句也守这两条", () => {
		const page = ["Meihua", "MeihuaHome", "MeihuaMethod", "MeihuaReading", "MeihuaReveal", "MeihuaTopic"].map((f) =>
			readFileSync(new URL(`../components/${f}.astro`, import.meta.url), "utf8").replace(/<!--[\s\S]*?-->|\{\/\*[\s\S]*?\*\/\}|\/\*[\s\S]*?\*\/|\/\/.*$/gm, ""),
		);
		const said: string[] = [];
		for (let a = 1; a <= 8; a++)
			for (let b = 1; b <= 8; b++)
				for (let h = 0; h < 12; h += 2) {
					const v = compose({ by: { by: "num", nums: [a, b] }, at: `2026-10-01T${String(h).padStart(2, "0")}:30:00+08:00`, topic: "自身", lateZi: "day-stays" });
					said.push(...v.reasons, v.hu.say);
				}
		for (const s of [...page, ...said]) {
			expect(s).not.toMatch(/改命|转运|化解|算命|消灾|开光|大师|血光|大凶/);
			expect(s).not.toMatch(/一定|必定|必然|保证|之内/);
		}
	});
});
