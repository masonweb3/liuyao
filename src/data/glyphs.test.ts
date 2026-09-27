/**
 * 卦页、目录页的正文（宋体）用到的每个字都要有字形：在 fontsource 的 400 字重切片里，或者在
 * tools/subset-fonts.py 生成的补字里（src/styles/paper-fonts.css）。不然浏览器回退到系统字体，一段宋体里
 * 混进黑体。加了白话却没重跑子集，这里会报错。
 *
 * 读的是切片文件的实际 cmap，不是 CSS 的 unicode-range：fontsource 的 range 比切片里实际有的字多
 * （Noto Serif TC 多四千多个），落在 range 里却没有字形的字照样回退。
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { brotliDecompressSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import baihuaHant from "./baihua-hant.json" with { type: "json" };
import baihua from "./baihua.json" with { type: "json" };
import guaciHant from "./guaci-hant.json" with { type: "json" };
import guaci from "./guaci.json" with { type: "json" };
import yaoBaihuaHant from "./yao-baihua-hant.json" with { type: "json" };
import yaoBaihua from "./yao-baihua.json" with { type: "json" };

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

function chars(...data: object[]): string[] {
	const text = data.flatMap((d) => Object.values(d)).flatMap((v) => (typeof v === "string" ? v : Object.values(v)));
	return [...new Set([...text.join("")])].filter((ch) => !/\s/.test(ch));
}

describe("正文字体覆盖（fontsource 切片加补字）", () => {
	it("WOFF2 读得对：语言切换补字文件正好是这三个字", () => {
		const file = readFileSync(new URL("../fonts/lang-400.woff2", import.meta.url));
		expect([...woff2Chars(file)].map((ch) => String.fromCodePoint(ch)).join("")).toBe("体简體");
	});

	it.each([
		["简体", "noto-serif-sc", "Noto Serif SC", chars(guaci, baihua, yaoBaihua)],
		["繁体", "noto-serif-tc", "Noto Serif TC", chars(guaciHant, baihuaHant, yaoBaihuaHant)],
	])("%s：卦爻辞、卦辞白话、爻辞白话的每个字都有字形", (_, pkg, family, text) => {
		const have = fontsourceChars(pkg as string);
		for (const ch of patchChars(family as string)) have.add(ch);
		const missing = (text as string[]).filter((ch) => !have.has(ch.codePointAt(0) as number));
		expect(missing.join(""), "缺这些字：重跑 tools/subset-fonts.py").toBe("");
	});
});
