// Adapted from TaoracleHQ/najia @108d13a test/parity.test.ts and
// tools/parity-shape.ts (MIT, see NOTICE). parity.json is copied unchanged.
/**
 * Parity against the Python `najia` reference, across all 4^6 casts.
 *
 * A wrong hexagram throws nothing and looks fine, so equivalence is asserted
 * mechanically. `project()` must stay byte-identical to upstream's: its field
 * order is what the hash covers.
 */
import { describe, expect, it } from "vitest";
import { type CastResult, cast } from "./najia.js";
import fixture from "./parity.json" with { type: "json" };

// Upstream 1 单 / 2 拆 / 3 重 / 4 交 -> coin sums.
const COIN = { 1: 7, 2: 8, 3: 9, 4: 6 } as const;

/** Fixture dates are UTC+8 wall-clock hours. */
function at([y, m, d, h]: readonly number[]): Date {
	return new Date(Date.UTC(y!, m! - 1, d!, h! - 8));
}

function castUpstream(params: readonly number[], date: readonly number[]) {
	return cast(
		params.map((p) => COIN[p as keyof typeof COIN]),
		{ date: at(date) },
	);
}

function allCombinations(): number[][] {
	const out: number[][] = [];
	const walk = (prefix: number[]) => {
		if (prefix.length === 6) {
			out.push(prefix);
			return;
		}
		for (const yao of [1, 2, 3, 4]) walk([...prefix, yao]);
	};
	walk([]);
	return out;
}

function project(result: CastResult): (string | number | null)[] {
	const out: (string | number | null)[] = [
		result.gua.mark,
		result.gua.name,
		result.gua.gong,
		result.shiy.shi,
		result.shiy.ying,
		...result.gua.qin6,
		...result.gua.qinx,
		...result.god6,
		result.dong.join(","),
		result.ganzhi.year,
		result.ganzhi.month,
		result.ganzhi.day,
		result.ganzhi.hour,
		result.ganzhi.xkong,
	];

	if (result.bian === null) out.push(null);
	else {
		out.push(
			result.bian.mark,
			result.bian.name,
			result.bian.gong,
			...result.bian.qin6,
			...result.bian.qinx,
		);
	}

	if (result.hide === null) out.push(null);
	else {
		out.push(
			result.hide.mark,
			result.hide.name,
			...result.hide.qin6,
			...result.hide.qinx,
			result.hide.seat.join(","),
		);
	}

	return out;
}

describe("parity with the Python reference", () => {
	it("matches across the entire 4^6 cast space", async () => {
		const combos = allCombinations();
		expect(combos.length).toBe(fixture.fullSpace.combinations);

		const text = combos
			.map((params, i) => {
				const date = fixture.dates[i % fixture.dates.length]!;
				return `${JSON.stringify(project(castUpstream(params, date)))}\n`;
			})
			.join("");
		const hash = await crypto.subtle.digest(
			"SHA-256",
			new TextEncoder().encode(text),
		);
		const hex = [...new Uint8Array(hash)]
			.map((b) => b.toString(16).padStart(2, "0"))
			.join("");
		expect(hex).toBe(fixture.fullSpace.sha256);
	});

	it("curates enough cases to cover every 卦宫", () => {
		const gongs = new Set(fixture.curated.map(({ expected }) => expected[2]));
		expect(gongs.size).toBe(8);
	});

	for (const { key, expected } of fixture.curated) {
		it(`reproduces ${key}`, () => {
			const [params, date] = key.split("@") as [string, string];
			const result = castUpstream(
				[...params].map(Number),
				date.split("-").map(Number),
			);
			expect(project(result)).toEqual(expected);
		});
	}
});
