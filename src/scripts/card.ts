/**
 * 分享卡 —— the design's 08 artboard drawn on a canvas, 1242×1656 (3:4).
 * Returned as a PNG data: URL, because WeChat's long-press save does not
 * pick up blob: images.
 */
import { DISCLAIMER } from "../data/copy.js";
import { isMoving, isYang, STROKES } from "../lib/flow.js";
import type { CastResult } from "../lib/liuyao/najia.js";
import type { GuaText } from "../lib/reading.js";

const W = 1242;
const H = 1656;
const LEFT = 120;
const RIGHT = W - LEFT;
const TOP = 110;
const BOTTOM = H - 100;

/** Never start a line with these. */
const CLOSING = "，。、；：！？）》」』”’…";

/** `question` is empty unless the asker ticked 所问上卡. */
export async function card(r: CastResult, ben: GuaText, question: string): Promise<string> {
	const css = getComputedStyle(document.documentElement);
	const v = (name: string) => css.getPropertyValue(name).trim();
	const display = v("--font-display");
	const body = v("--font-body");
	const paper = v("--paper");
	const ink = v("--ink");
	const ink2 = v("--ink-2");

	const g = r.ganzhi;
	const date = `${g.year}年 ${g.month}月 ${g.day}日`;
	const foot = `${location.hostname} · ${DISCLAIMER[0]}`;
	const name = r.gua.name;
	const zhi = r.bian ? `之${r.bian.name}` : "";
	const asked = question.replace(/\s+/g, " ").trim();

	// The fonts load in unicode-range slices as the page needs them; a 卦 the
	// page has not shown yet would otherwise draw in a fallback font.
	await Promise.all([
		document.fonts.load(`76px ${display}`, `爻${name}${ben.ci}`),
		document.fonts.load(`36px ${body}`, `六爻所问○×…${zhi}${ben.baihua}${date}${foot}${asked}`),
	]);

	const canvas = document.createElement("canvas");
	canvas.width = W;
	canvas.height = H;
	const ctx = canvas.getContext("2d");
	if (!ctx) throw new Error("canvas 2d unavailable");
	const c = ctx;
	c.fillStyle = paper;
	c.fillRect(0, 0, W, H);
	c.textBaseline = "middle";

	const pen = (px: number, family: string, color: string) => {
		c.font = `${px}px ${family}`;
		c.fillStyle = color;
	};
	const advance = (ch: string, spacing: number) => c.measureText(ch).width + spacing;

	// Canvas letterSpacing is not everywhere yet: set text one glyph at a time.
	function wrap(text: string, width: number, spacing: number): string[] {
		const out: string[] = [];
		let line = "";
		let w = 0;
		for (const ch of text) {
			const a = advance(ch, spacing);
			if (line && w + a - spacing > width && !CLOSING.includes(ch)) {
				out.push(line);
				line = "";
				w = 0;
			}
			line += ch;
			w += a;
		}
		if (line) out.push(line);
		return out;
	}
	function row(text: string, x: number, y: number, spacing: number) {
		for (const ch of text) {
			c.fillText(ch, x, y);
			x += advance(ch, spacing);
		}
	}
	function column(text: string, cx: number, top: number, px: number, spacing: number) {
		c.textAlign = "center";
		[...text].forEach((ch, i) => c.fillText(ch, cx, top + i * (px + spacing) + px / 2));
		c.textAlign = "start";
	}
	const lines = (text: string[], x: number, top: number, lh: number, spacing: number) =>
		text.forEach((l, i) => row(l, x, top + i * lh + lh / 2, spacing));

	// Header: 印 + 六爻
	c.fillStyle = v("--seal");
	c.fillRect(LEFT, TOP, 72, 72);
	pen(46, display, paper);
	column("爻", LEFT + 36, TOP + 13, 46, 0);
	pen(36, body, ink);
	row("六爻", LEFT + 96, TOP + 36, 18);

	// Footer: 日辰 and the standing disclaimer
	pen(26, body, ink2);
	row(foot, LEFT, BOTTOM - 18, 3);
	pen(32, body, ink);
	row(date, LEFT, BOTTOM - 70, 10);

	// Main blocks, measured first, then centred between header and footer.
	const textW = RIGHT - LEFT;
	pen(36, body, ink);
	let q = asked ? wrap(asked, textW, 1.5) : [];
	if (q.length > 2) q = [q[0] as string, `${(q[1] as string).slice(0, -1)}…`];
	const qH = q.length ? 36 + 14 + q.length * 61 : 0;

	// 卦辞 steps down until it fits in two lines (坤 keeps three).
	let ciPx = 76;
	let ci: string[] = [];
	for (ciPx of [76, 64, 56, 48]) {
		pen(ciPx, display, ink);
		ci = wrap(ben.ci, textW, ciPx * 0.2);
		if (ci.length <= 2) break;
	}
	const ciLh = ciPx * 1.45;
	pen(36, body, ink2);
	const bh = wrap(ben.baihua, textW, 0);
	const textH = 2 + 60 + ci.length * ciLh + 30 + bh.length * 65;

	// 卦象 at the design's size, shrunk as a whole when a long 所问 needs the room.
	const top = TOP + 72 + 56;
	const room = BOTTOM - 106 - 56 - top;
	const gaps = qH ? 2 : 1;
	const guaAt = (k: number) => {
		const namePx = (name.length > 3 ? 128 : 150) * k;
		const nameH = name.length * namePx * 1.2 - namePx * 0.2;
		const zhiH = namePx + [...zhi].length * 62.4 * k - 14.4 * k;
		return { k, namePx, groupH: Math.max(nameH, zhiH), yaoH: (6 * 56 + 5 * 44) * k };
	};
	const full = guaAt(1);
	const fullH = Math.max(full.yaoH, full.groupH);
	const spare = room - qH - textH - gaps * 64;
	const gua = guaAt(Math.max(0.6, Math.min(1, spare / fullH)));
	const guaH = Math.max(gua.yaoH, gua.groupH);
	const content = qH + guaH + textH;
	const gap = Math.max(32, Math.min(110, (room - content) / gaps));
	let y = top + Math.max(0, (room - content - gap * gaps) / 2);

	if (qH) {
		pen(26, body, ink2);
		row("所问", LEFT, y + 18, 8);
		pen(36, body, ink);
		lines(q, LEFT, y + 50, 61, 1.5);
		y += qH + gap;
	}

	// 卦象: 上爻 on top, 动爻 marked; 卦名 and 之卦 set vertically on the right.
	const { k, namePx } = gua;
	const yaoTop = y + (guaH - gua.yaoH) / 2;
	r.params.forEach((p, i) => {
		const ly = yaoTop + (5 - i) * 100 * k;
		c.save();
		c.translate(LEFT, ly);
		c.scale((560 / 240) * k, (56 / 24) * k);
		c.fillStyle = ink;
		for (const d of STROKES[isYang(p) ? "yang" : "yin"]) c.fill(new Path2D(d));
		c.restore();
		if (isMoving(p)) {
			pen(40 * k, body, v("--vermilion"));
			row(isYang(p) ? "○" : "×", LEFT + 590 * k, ly + 28 * k, 0);
		}
	});
	const groupTop = y + (guaH - gua.groupH) / 2;
	pen(namePx, display, ink);
	column(name, RIGHT - namePx / 2, groupTop, namePx, namePx * 0.2);
	pen(48 * k, body, ink2);
	column(zhi, RIGHT - namePx - 64 * k, groupTop + namePx, 48 * k, 14.4 * k);
	y += guaH + gap;

	// 卦辞 and its 白话
	c.fillStyle = v("--rule");
	c.fillRect(LEFT, y, textW, 2);
	y += 62;
	pen(ciPx, display, ink);
	lines(ci, LEFT, y, ciLh, ciPx * 0.2);
	y += ci.length * ciLh + 30;
	pen(36, body, ink2);
	lines(bh, LEFT, y, 65, 0);

	return canvas.toDataURL("image/png");
}
