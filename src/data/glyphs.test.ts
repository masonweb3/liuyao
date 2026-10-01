/**
 * 卦页、目录页的正文（宋体）用到的每个字都要有字形：在 fontsource 的 400 字重切片里，或者在
 * tools/subset-fonts.py 生成的补字里（src/styles/paper-fonts.css）。不然浏览器回退到系统字体，一段宋体里
 * 混进黑体。加了白话却没重跑子集，这里会报错。
 *
 * 读的是切片文件的实际 cmap，不是 CSS 的 unicode-range：fontsource 的 range 比切片里实际有的字多
 * （Noto Serif TC 多四千多个），落在 range 里却没有字形的字照样回退。
 */
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { brotliDecompressSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import baihuaHant from "./baihua-hant.json" with { type: "json" };
import baihua from "./baihua.json" with { type: "json" };
import { COLUMNS } from "./columns";
import guaciHant from "./guaci-hant.json" with { type: "json" };
import guaci from "./guaci.json" with { type: "json" };
import { type Data, huangliOf, show } from "../lib/huangli.js";
import { days } from "../lib/huangli-days.js";
import huangliHant from "./huangli-hant.json" with { type: "json" };
import huangliData from "./huangli.json" with { type: "json" };
import yaoBaihuaHant from "./yao-baihua-hant.json" with { type: "json" };
import yaoBaihua from "./yao-baihua.json" with { type: "json" };
import { ITEMS } from "../lib/zeri-rule.js";
import zeriHant from "./zeri-hant.json" with { type: "json" };
import zeri from "./zeri.json" with { type: "json" };
import { TenStar, Terrain } from "tyme4ts";
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

/** WOFF2 文件里 cmap 表映射到非零字形的码位。只处理 cmap 格式 4 和 12，够读这几个字体。 */
function woff2Chars(buf: Buffer): Set<number> {
	const numTables = buf.readUInt16BE(12);
	const compressed = buf.readUInt32BE(20);
	let p = 48; // WOFF2 头
	const base128 = () => {
		let v = 0;
		for (let i = 0; i < 5; i++) {
			const b = buf[p++] as number;
			v = v * 128 + (b & 0x7f);
			if (!(b & 0x80)) return v;
		}
		throw new Error("UIntBase128 太长");
	};
	// 表目录：表在解压后的数据里按目录顺序首尾相接；glyf、loca（标签号 10、11）版本 0 才是变换过的
	let offset = 0;
	let cmap: [number, number] | undefined;
	for (let i = 0; i < numTables; i++) {
		const flags = buf[p++] as number;
		const tag = flags & 0x3f;
		if (tag === 63) p += 4;
		const version = flags >> 6;
		const origLength = base128();
		const transformed = tag === 10 || tag === 11 ? version === 0 : version !== 0;
		const length = transformed ? base128() : origLength;
		if (tag === 0) cmap = [offset, length];
		offset += length;
	}
	if (!cmap) throw new Error("没有 cmap 表");
	const data = brotliDecompressSync(buf.subarray(p, p + compressed));
	const c = data.subarray(cmap[0], cmap[0] + cmap[1]);
	let sub = -1;
	let format = 0;
	for (let i = 0; i < c.readUInt16BE(2); i++) {
		const platform = c.readUInt16BE(4 + i * 8);
		const at = c.readUInt32BE(8 + i * 8);
		const f = c.readUInt16BE(at);
		if ((platform === 0 || platform === 3) && (f === 4 || f === 12) && f > format) [sub, format] = [at, f];
	}
	const out = new Set<number>();
	if (format === 12) {
		for (let g = 0, n = c.readUInt32BE(sub + 12); g < n; g++) {
			const at = sub + 16 + g * 12;
			for (let ch = c.readUInt32BE(at); ch <= c.readUInt32BE(at + 4); ch++) out.add(ch);
		}
		return out;
	}
	const segs = c.readUInt16BE(sub + 6) / 2;
	const ends = sub + 14;
	const starts = ends + segs * 2 + 2;
	const deltas = starts + segs * 2;
	const rangeOffsets = deltas + segs * 2;
	for (let s = 0; s < segs; s++) {
		const end = c.readUInt16BE(ends + s * 2);
		const start = c.readUInt16BE(starts + s * 2);
		const delta = c.readUInt16BE(deltas + s * 2);
		const ro = c.readUInt16BE(rangeOffsets + s * 2);
		for (let ch = start; ch <= end && ch !== 0xffff; ch++) {
			const raw = ro === 0 ? ch : c.readUInt16BE(rangeOffsets + s * 2 + ro + (ch - start) * 2);
			if (ro !== 0 && raw === 0) continue;
			if (((raw + delta) & 0xffff) !== 0) out.add(ch);
		}
	}
	return out;
}

const require = createRequire(import.meta.url);

/** fontsource 某包 400.css 引用的全部 woff2 切片实际有的字 */
function fontsourceChars(pkg: string): Set<number> {
	const css = require.resolve(`@fontsource/${pkg}/400.css`);
	const out = new Set<number>();
	for (const [, file] of readFileSync(css, "utf8").matchAll(/url\(\.\/files\/([^)]+\.woff2)\)/g))
		for (const ch of woff2Chars(readFileSync(join(dirname(css), "files", file as string)))) out.add(ch);
	return out;
}

/** paper-fonts.css 里某字体族 400 字重补字的 unicode-range */
function patchChars(family: string): Set<number> {
	const css = readFileSync(new URL("../styles/paper-fonts.css", import.meta.url), "utf8");
	const out = new Set<number>();
	for (const [, body] of css.matchAll(/@font-face\s*\{([^}]*)\}/g)) {
		if (!body?.includes(`'${family}'`) || !/font-weight:\s*400\b/.test(body)) continue;
		for (const part of body.match(/unicode-range:\s*([^;]*);/)?.[1]?.split(",") ?? []) {
			const [a, b = a] = part.trim().slice(2).split("-") as [string, string?];
			for (let ch = Number.parseInt(a, 16); ch <= Number.parseInt(b, 16); ch++) out.add(ch);
		}
	}
	return out;
}

const strings = (v: unknown): string[] =>
	typeof v === "string" ? [v] : v && typeof v === "object" ? Object.values(v).flatMap(strings) : [];

function chars(...data: unknown[]): string[] {
	return [...new Set([...data.flatMap(strings).join("")])].filter((ch) => !/\s/.test(ch));
}

/** 黄历页上显示的全部文字：释义数据，加时间窗里每一天由 tyme4ts 算出的宜忌、神煞、彭祖百忌等（key 之类是简体的键，不显示） */
const shown = (data: unknown) => [
	data,
	...days().map((d) => {
		const { yi, ji, gua: _, termKey: __, next, ...rest } = show(huangliOf(d), data as Data);
		return [rest, next.text, ...[yi, ji].flatMap((w) => [w.mark ?? "", ...w.list.map((x) => x.name)])];
	}),
];

/**
 * 择日两页、今日黄历与八字排盘的组件里写在页面上的字（含脚本在浏览器里写进去的）：t('简', '繁') 成对的取本语言那一边，
 * 其余的字（宜、月份、星期……）简繁页都显示；注释不算。
 */
function componentText(hant: boolean): string[] {
	const pair = /t\(\s*(['`])((?:(?!\1).)*)\1,\s*(['`])((?:(?!\3).)*)\3\s*,?\s*\)/g;
	return ["Zeri", "ZeriMonth", "HuangliToday", "Bazi", "BaziKb"].map((f) =>
		readFileSync(new URL(`../components/${f}.astro`, import.meta.url), "utf8")
			.replace(/\{\/\*[\s\S]*?\*\/\}|\/\*[\s\S]*?\*\/|\/\/.*$/gm, "")
			.replace(pair, (...m: string[]) => (hant ? m[4]! : m[2]!)),
	);
}

/** 出生地名单里一种写法的城市名与所属（输入框、盘面上用正文宋体显示） */
const cityText = (k: 0 | 1) => {
	const data = cities as { regions: string[][]; cities: (string | number)[][] };
	return [...data.cities.map((c) => c[k] as string), ...data.regions.map((r) => r[k]!)];
};

describe("正文字体覆盖（fontsource 切片加补字）", () => {
	it("WOFF2 读得对：语言切换补字文件正好是这三个字", () => {
		const file = readFileSync(new URL("../fonts/lang-400.woff2", import.meta.url));
		expect([...woff2Chars(file)].map((ch) => String.fromCodePoint(ch)).join("")).toBe("体简體");
	});

	it.each([
		["简体", "noto-serif-sc", "Noto Serif SC", chars(guaci, baihua, yaoBaihua, ...shown(huangliData), zeri, ITEMS.map((i) => i.name), componentText(false), bazi, baziTiangan, baziDizhi, baziPages, TenStar.NAMES, Terrain.NAMES, Object.keys(baziNamesHant), cityText(0))],
		["繁体", "noto-serif-tc", "Noto Serif TC", chars(guaciHant, baihuaHant, yaoBaihuaHant, ...shown(huangliHant), zeriHant, ITEMS.map((i) => i.hant), componentText(true), baziHant, baziTianganHant, baziDizhiHant, baziPagesHant, baziNamesHant, cityText(1))],
	])("%s：卦爻辞、两种白话、黄历、择日、八字的说明与页面文字、出生地名单的每个字都有字形", (_, pkg, family, text) => {
		const have = fontsourceChars(pkg as string);
		for (const ch of patchChars(family as string)) have.add(ch);
		const missing = (text as string[]).filter((ch) => !have.has(ch.codePointAt(0) as number));
		expect(missing.join(""), "缺这些字：重跑 tools/subset-fonts.py").toBe("");
	});
});

// 首页的栏目导航在首屏：栏目名的字要在预加载的首屏子集里，不然回退 fontsource 切片，多下几十 KB，换字体时文字跳动。
it.each(["home", "meihua"])("首屏子集 %s-body 有栏目导航的每个字", (name) => {
	const have = woff2Chars(readFileSync(new URL(`../fonts/${name}-body.woff2`, import.meta.url)));
	const missing = [...COLUMNS.map((c) => c.hans).join("")].filter((ch) => !have.has(ch.codePointAt(0) as number));
	expect(missing.join(""), "加了栏目要重跑 tools/subset-fonts.py").toBe("");
});

// 梅花页（M21）不引 paper-fonts.css：页面上的字（组件、页面脚本写进去的、Worker 拼的依据与算式）只能靠 fontsource 切片，不算补字。
// 卦爻辞原文另算（六爻解读页同样没有补字，见 AGENTS.md「正文补字」）。
it("梅花页的说明、界面与依据、算式的每个字都在 Noto Serif SC 切片里", () => {
	const files = ["Meihua", "MeihuaAsk", "MeihuaBar", "MeihuaHome", "MeihuaMethod", "MeihuaNotice", "MeihuaReading", "MeihuaReveal", "MeihuaTopic"]
		.map((f) => `../components/${f}.astro`)
		.concat("../scripts/meihua.ts", "../lib/meihua-page.ts", "../lib/meihua-reading.ts");
	const source = files.map((f) =>
		readFileSync(new URL(f, import.meta.url), "utf8").replace(/<!--[\s\S]*?-->|\{\/\*[\s\S]*?\*\/\}|\/\*[\s\S]*?\*\/|\/\/.*$/gm, ""),
	);
	const views: unknown[] = [];
	for (let a = 1; a <= 8; a++)
		for (let b = 1; b <= 8; b++)
			for (let h = 0; h < 12; h += 2) {
				const v = compose({ by: { by: "num", nums: [a, b] }, at: `2026-10-01T${String(h).padStart(2, "0")}:30:00+08:00`, topic: "自身", lateZi: "day-stays" });
				views.push(v.reasons, v.rows, v.formula, v.hu.say, v.when);
			}
	const t = compose({ by: { by: "time" }, at: "2025-08-01T12:00:00+08:00", topic: "自身", lateZi: "day-stays" });
	const have = fontsourceChars("noto-serif-sc");
	const missing = chars(source, views, t.formula, t.when).filter((ch) => (ch.codePointAt(0) as number) > 0x7f && !have.has(ch.codePointAt(0) as number));
	expect(missing.join(""), "梅花页不带补字：换个说法，或给梅花页加补字").toBe("");
});

// 梅花页首屏（M21）：此刻的农历与时辰（北京时间）由脚本填，干支、月日、时辰的字也要在预加载的子集里。
it("梅花首屏子集有此刻一行可能用到的字", () => {
	const have = woff2Chars(readFileSync(new URL("../fonts/meihua-body.woff2", import.meta.url)));
	const text = "此刻（北京时间）甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥年时正二三四五六七八九十冬腊闰月初廿　";
	const missing = [...text].filter((ch) => !have.has(ch.codePointAt(0) as number));
	expect(missing.join(""), "改了梅花首屏要重跑 tools/subset-fonts.py").toBe("");
});

// 择日首页与月页的标题字体（M18）：标题、事项名、公历日期都要在 zeri 子集里（繁体芫荽缺的字在 -wk 补字里）。
// subset-fonts.py 对小薇缺字的块整块不收，事项名一旦缺字，月页标题会混进宋体。
it.each([
	["huangli", "择日吉日年月日0123456789" + ITEMS.map((i) => i.name).join("")],
	["huangli-hant", "擇日吉日年月日0123456789" + ITEMS.map((i) => i.hant).join("")],
])("择日标题子集 %s/zeri 有标题、事项名与日期用字", (dir, text) => {
	const have = new Set<number>();
	for (const f of ["zeri", "zeri-wk"]) {
		const url = new URL(`../fonts/${dir}/${f}.woff2`, import.meta.url);
		if (existsSync(url)) for (const ch of woff2Chars(readFileSync(url))) have.add(ch);
	}
	expect([...text].filter((ch) => !have.has(ch.codePointAt(0) as number)).join(""), "改了事项名要重跑 tools/subset-fonts.py").toBe("");
});

// 八字排盘与知识页的标题字体（M19a、M19b-3 共用一份）：h1、干支、五行个数、乾造坤造，知识页的十神、纳音、十二长生、十天干、十二地支。
// 简体不收「己」：小薇的「己」画得和「巳」一样，按缺字处理（gua.ts 的 fontOf），己页的 h1 用宋体。
it("简体八字标题子集不收「己」", () => {
	const have = woff2Chars(readFileSync(new URL("../fonts/bazi/index.woff2", import.meta.url)));
	expect(have.has("己".codePointAt(0) as number)).toBe(false);
});
it.each([
	["bazi", "八字甲乙丙丁戊庚辛壬癸子丑寅卯辰巳午未申酉戌亥0123456789乾造坤造十神纳音十二长生十天干十二地支"],
	["bazi-hant", "八字甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥0123456789乾造坤造十神納音十二長生十天干十二地支"],
])("八字标题子集 %s/index 有干支、数字、乾造坤造与知识页标题", (dir, text) => {
	const have = new Set<number>();
	for (const f of ["index", "index-wk"]) {
		const url = new URL(`../fonts/${dir}/${f}.woff2`, import.meta.url);
		if (existsSync(url)) for (const ch of woff2Chars(readFileSync(url))) have.add(ch);
	}
	expect([...text].filter((ch) => !have.has(ch.codePointAt(0) as number)).join(""), "重跑 tools/subset-fonts.py").toBe("");
});
