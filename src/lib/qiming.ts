// 起名只在页面的 Worker 里运行；候选与意象表为本站自建，不按五行个数推喜用。
import pool from '../data/qiming-names.json';
import elements from '../data/qiming-wuxing.json';
import { bazi, type Birth } from './bazi';
import { localOffset } from './bazi-time';
import { check, lookup, measure, splitTone, type Pick, type Result, type Table } from './quming';

export type Element = keyof typeof elements;
export const ELEMENTS = Object.keys(elements) as Element[];
// 自建的普通话不宜连读词；只作有限词表检查，不声称覆盖所有方言及语境。
const BAD = ['si wang','si qu','si guang','sha ren','sha gua','chun huo','gou shi','zhu tou','dao mei','wu neng','wu yong','wu de','wu li','wu cai','you bing','fa feng','liu mang','hun dan','wang ba','bai chi','jian ren','e xin','yin xian','pian zi','xiao tou','zuo lao','zao yang','ku nan','zai nan'].map(s => s.replaceAll(' ', '|'));
const ECHO: Record<string, string> = { lin: 'Lynn', lan: 'Lana', an: 'Anne', shan: 'Shannon', min: 'Mina', jia: 'Gia', kai: 'Kai', li: 'Lee', lu: 'Lou', mei: 'May' };

/** 所有已收录普通话读音都通过中英文筛查才保留；姓氏沿用测名字表的专门读音。 */
export function suitable(t: Table, surname: string, given: string, hant = false): Result | null {
	if (check(surname, given)) return null;
	if (/[屎尿屁贱賤傻蠢]/u.test(surname + given)) return null;
	const base = measure(t, surname, given, {}, hant);
	if ('missing' in base || base.chars.some(c => !c.read || !c.jyut)) return null;
	const safe = (i: number, picks: Record<number, Pick>): boolean => {
		if (i === base.chars.length) {
			const r = measure(t, surname, given, picks, hant);
			if ('missing' in r || r.hits.length) return false;
			const py = r.chars.map(c => splitTone(c.read)[0]).join('|');
			return !BAD.some(s => `|${py}|`.includes(`|${s}|`));
		}
		const c = base.chars[i]!;
		const readings = c.fixed ? [c.read] : [...new Set([c.read, ...c.zi.readings])];
		return readings.every(read => safe(i + 1, { ...picks, [i]: { read } }));
	};
	return safe(0, {}) ? base : null;
}

export interface NamingInput { surname: string; birth: Birth; timezone: string; hant: boolean }

export function suggest(t: Table, input: NamingInput) {
	const { surname, birth, timezone, hant } = input;
	if (typeof surname !== 'string' || check(surname, '安') || [...surname].some(c => !lookup(t,c))) throw new Error('surname');
	const values = [birth.year, birth.month, birth.day, birth.hour, birth.minute];
	if (birth.calendar !== 'solar' || !values.every(Number.isInteger) || birth.year < 1901 || birth.year > 2100 || birth.month < 1 || birth.month > 12 || birth.day < 1 || birth.day > 31 || birth.hour! < 0 || birth.hour! > 23 || birth.minute! < 0 || birth.minute! > 59 || !['男','女'].includes(birth.gender)) throw new Error('birth');
	const date = new Date(Date.UTC(birth.year, birth.month - 1, birth.day));
	if (date.getUTCMonth() !== birth.month - 1 || date.getUTCDate() !== birth.day) throw new Error('birth');
	let offset: ReturnType<typeof localOffset>;
	try { offset = localOffset(timezone, birth.year, birth.month, birth.day, birth.hour!, birth.minute!); }
	catch { throw new Error('timezone'); }
	const chart = bazi(birth, offset);
	const candidates = pool.flatMap(source => {
		const given = hant ? source.hant : source.name;
		const result = suitable(t, surname, given, hant);
		if (!result) return [];
		const tags = ELEMENTS.filter(el => [...source.name].some(c => elements[el].chars.includes(c)));
		const echo = [...new Set(result.chars.slice(result.surLen).flatMap(c => ECHO[splitTone(c.read)[0]] ?? []))];
		return [{ source, given, tags, roman: result.roman, read: result.chars.map(c => c.read).join(' '), echo }];
	});
	return { pillars: chart.pillars.map(p => p.ganZhi), counts: chart.wuXing, candidates };
}

export type NamingResult = ReturnType<typeof suggest>;
