/**
 * 八字的时刻换算（M19-5）。零依赖：/bazi/ 的页面脚本直接用（表单下写出时差与太阳时校正），排盘引擎 bazi.ts 也用。
 * 不 import 任何别的模块：页面脚本引了共用模块，打包时会拆出与首页共用的分包（首页首屏 JS 不能增加）。
 */

/**
 * 均时差（真太阳时减平太阳时，分钟）。NOAA 的近似式，误差在半分钟以内，排时辰够用。
 * @param utcMs 出生时刻（UTC 毫秒）
 */
export function equationOfTime(utcMs: number): number {
	const d = new Date(utcMs);
	const start = Date.UTC(d.getUTCFullYear(), 0, 1);
	const g = ((2 * Math.PI) / 365) * ((utcMs - start) / 86_400_000 - 0.5);
	return (
		229.18 *
		(0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g))
	);
}

const formats = new Map<string, Intl.DateTimeFormat>();

/** 时区 tz 在 UTC 时刻 utcMs 的偏移（分钟，东正西负）。早年的地方平时带秒，结果可带小数。 */
function zoneOffset(tz: string, utcMs: number): number {
	let f = formats.get(tz);
	if (!f) {
		f = new Intl.DateTimeFormat("en-US", {
			timeZone: tz,
			hourCycle: "h23",
			year: "numeric",
			month: "numeric",
			day: "numeric",
			hour: "numeric",
			minute: "numeric",
			second: "numeric",
		});
		formats.set(tz, f);
	}
	const p = Object.fromEntries(f.formatToParts(utcMs).map((x) => [x.type, Number(x.value)]));
	const wall = Date.UTC(p.year!, p.month! - 1, p.day!, p.hour!, p.minute!, p.second!);
	return (wall - Math.floor(utcMs / 1000) * 1000) / 60_000;
}

/**
 * 当地钟表时刻在时区 tz 里的 UTC 偏移（offset，含夏令时）和夏令时拨快了多少（dst），都是分钟。
 * 偏移按浏览器的 IANA 时区库算，历史上的夏令时（大陆 1986–1991、台湾 1945–1979、香港到 1979）都在里面。
 * 标准时取那一年 1 月 1 日与 7 月 1 日偏移里小的那个：南北半球的夏令时都比标准时拨快。
 * 春天拨快时跳过的那一小时（钟表上不存在）按拨快前算，秋天重复的那一小时取先到的一次。
 */
export function localOffset(tz: string, y: number, m: number, d: number, h: number, mi: number): { offset: number; dst: number } {
	const wall = Date.UTC(y, m - 1, d, h, mi);
	const first = zoneOffset(tz, wall);
	const second = zoneOffset(tz, wall - first * 60_000);
	const offset = first === second ? first : zoneOffset(tz, wall - second * 60_000);
	const standard = Math.min(zoneOffset(tz, Date.UTC(y, 0, 1)), zoneOffset(tz, Date.UTC(y, 6, 1)));
	return { offset, dst: Math.max(0, offset - standard) };
}
