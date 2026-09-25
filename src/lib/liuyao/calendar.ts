// Copied from TaoracleHQ/najia @108d13a (MIT)
//   Copyright (c) 2026 Taoracle
//   Copyright (c) 2019 najia (bopo)
// License text and list of local changes: see NOTICE.
/**
 * 干支 for a moment in time.
 *
 * The Python reference delegates this to `lunar_python` (`getBaZi()` and
 * `getDayXunKong()`). This port uses `tyme4ts` — same author (6tail), but
 * typed, ESM and dependency-free. `parity.test.ts` pins the two against each
 * other.
 */
import { SolarDay, SolarTime } from "tyme4ts";
import { KONG, type Kong } from "./const.js";

/**
 * How to treat 晚子时 (23:00–24:00) when reporting the 日柱.
 *
 * Both are established conventions, and the two upstream libraries disagree:
 *
 * - `day-stays` — 晚子时 keeps the current day's 日柱. This is what
 *   `lunar_python.getBaZi()` returns, so it is what the Python `najia` produces
 *   and therefore the default here: migrating off Python must not silently
 *   change anyone's reading.
 * - `day-advances` — 晚子时 belongs to the next day's 日柱, which is
 *   `tyme4ts`'s own default.
 *
 * The 时柱 is unaffected: both libraries derive it from the next day's 天干,
 * and all 336 pinned datetimes agree on it.
 */
export type LateZiSect = "day-stays" | "day-advances";

export interface Ganzhi {
	/** 年柱 —— boundary is 立春, not the calendar new year. */
	year: string;
	/** 月柱 —— boundary is the 节气, not the calendar month. */
	month: string;
	/** 日柱 —— see {@link LateZiSect}. */
	day: string;
	/** 时柱 */
	hour: string;
	/** 日旬空, derived from the 日柱. */
	xkong: Kong;
}

export interface GanzhiOptions {
	/** Defaults to `day-stays`, matching the Python reference. */
	lateZi?: LateZiSect;
}

function toKong(name: string): Kong {
	const found = KONG.find((k) => k === name);
	if (found === undefined) throw new Error(`unexpected 旬空 "${name}"`);
	return found;
}

/**
 * 干支 for an instant, read as UTC+8 wall-clock time.
 *
 * 节气 are timed in Beijing time, so the reading must not depend on the host's
 * timezone. Minutes and seconds matter for the 年柱 and 月柱: 立春 2025 falls at
 * 22:10:28, so 22:00 and 22:20 that day are in different years.
 */
export function ganzhiFromDate(
	date: Date,
	options: GanzhiOptions = {},
): Ganzhi {
	const t = new Date(date.getTime() + 8 * 3_600_000);
	const year = t.getUTCFullYear();
	const month = t.getUTCMonth() + 1;
	const day = t.getUTCDate();
	const sect = options.lateZi ?? "day-stays";
	const cycleHour = SolarTime.fromYmdHms(
		year,
		month,
		day,
		t.getUTCHours(),
		t.getUTCMinutes(),
		t.getUTCSeconds(),
	).getSixtyCycleHour();

	const dayCycle =
		sect === "day-advances"
			? cycleHour.getDay()
			: SolarDay.fromYmd(year, month, day).getSixtyCycleDay().getSixtyCycle();

	return {
		year: cycleHour.getYear().getName(),
		month: cycleHour.getMonth().getName(),
		day: dayCycle.getName(),
		hour: cycleHour.getSixtyCycle().getName(),
		xkong: toKong(
			dayCycle
				.getExtraEarthBranches()
				.map((branch) => branch.getName())
				.join(""),
		),
	};
}
