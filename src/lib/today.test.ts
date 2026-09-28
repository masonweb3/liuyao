import { SolarTerm } from "tyme4ts";
import { describe, expect, it } from "vitest";
import { ganzhiFromDate } from "./liuyao/calendar.js";
import { MARGIN, quickGanzhi, sinceLichun, todayText } from "./today.js";

const HOUR = 3_600_000;
const pick = ({ year, month, day }: { year: string; month: string; day: string }) => ({ year, month, day });

/** 2000–2100 年每个「节」的精确时刻（tyme4ts 给的是北京时间）。 */
const jie = (() => {
	const out: Date[] = [];
	for (let y = 2000; y <= 2101; y++) {
		for (let i = 1; i < 24; i += 2) {
			const t = SolarTerm.fromIndex(y, i).getJulianDay().getSolarTime();
			const d = new Date(
				Date.UTC(t.getYear(), t.getMonth() - 1, t.getDay(), t.getHour(), t.getMinute(), t.getSecond()) - 8 * HOUR,
			);
			if (d.getUTCFullYear() >= 2000 && d.getUTCFullYear() <= 2100) out.push(d);
		}
	}
	return out;
})();

describe("首屏今日干支", () => {
	it("公式在每个「节」上的误差远小于 MARGIN", () => {
		let worst = 0;
		for (const d of jie) {
			const deg = sinceLichun(d);
			worst = Math.max(worst, Math.min(deg % 30, 30 - (deg % 30)));
		}
		console.log(`${jie.length} 个节，最大误差 ${worst.toFixed(4)}°（MARGIN ${MARGIN}°）`);
		expect(jie.length).toBeGreaterThan(1200);
		expect(worst).toBeLessThan(MARGIN / 3);
	});

	it("交节前后：要么交给 tyme4ts，要么与 ganzhiFromDate 相同", () => {
		for (const d of jie) {
			for (const h of [-24, -1.5, -1, 1, 1.5, 24]) {
				const t = new Date(d.getTime() + h * HOUR);
				const q = quickGanzhi(t);
				if (q) expect(q, t.toISOString()).toEqual(pick(ganzhiFromDate(t)));
			}
			expect(quickGanzhi(new Date(d.getTime() + 10 * 60_000))).toBeNull();
		}
	});

	it("散布在一百年里的 5000 个时刻与 ganzhiFromDate 相同", () => {
		const from = Date.UTC(2000, 0, 1) - 8 * HOUR;
		const span = Date.UTC(2101, 0, 1) - 8 * HOUR - from;
		let quick = 0;
		for (let i = 0; i < 5000; i++) {
			// 黄金分割步长：确定、均匀，不落在整点上
			const t = new Date(from + Math.floor(((i * 0.618_033_988_75) % 1) * span));
			const q = quickGanzhi(t);
			if (!q) continue;
			quick++;
			expect(q, t.toISOString()).toEqual(pick(ganzhiFromDate(t)));
		}
		expect(quick).toBeGreaterThan(4900);
	});

	it("立春精确时刻前后（临近交节，走 tyme4ts）", async () => {
		expect(await todayText(new Date("2025-02-03T22:00:00+08:00"))).toBe("甲辰年 丁丑月 癸卯日");
		expect(await todayText(new Date("2025-02-03T22:20:00+08:00"))).toBe("乙巳年 戊寅月 癸卯日");
	});

	it("晚子时不换日，按北京时间", async () => {
		const late = await todayText(new Date("2025-06-10T23:30:00+08:00"));
		expect(late).toBe(await todayText(new Date("2025-06-10T12:00:00+08:00")));
		expect(late).toBe(await todayText(new Date("2025-06-10T15:30:00Z")));
	});

	it("一月里未到立春算上一年：小寒前子月，小寒后丑月", async () => {
		expect(await todayText(new Date("2026-01-02T12:00:00+08:00"))).toMatch(/^乙巳年 戊子月/);
		expect(await todayText(new Date("2026-01-20T12:00:00+08:00"))).toMatch(/^乙巳年 己丑月/);
		expect(await todayText(new Date("2026-02-20T12:00:00+08:00"))).toMatch(/^丙午年 庚寅月/);
	});
});
