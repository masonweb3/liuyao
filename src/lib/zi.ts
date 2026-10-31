// 单字知识页只在构建时查表；测名页只带字页链接表，不带字义、统计或字形路径。
import content from '../data/zi.json';
import meta from '../data/zi-meta.json';
import data from '../data/quming-zi.json';
import { type Data, lookup, splitTone, table } from './quming';

export const ZI = Object.keys(content) as (keyof typeof content)[];
export const ziPath = (c: string, hant = false) => `${hant ? '/zh-hant' : ''}/zi/${c}/`;
const T = table(data as unknown as Data);
const ENTRIES = new Map(ZI.map(c => [c, lookup(T, c)!]));
export function zi(c: keyof typeof content, hant = false) {
	const text = content[c];
	const ch = hant ? text.hant : c;
	const entry = hant ? lookup(T, ch, true)! : ENTRIES.get(c)!;
	const form = entry.forms.find((x) => x.form === text.hant) ?? entry.forms[0]!;
	return { ch, entry, form, strokes: hant ? meta[c].strokesHant : meta[c].strokes, text: hant ? text.yi_hant : text.yi, meta: meta[c], glyph: hant ? meta[c].glyphHant : meta[c].glyph };
}
export const initials = (c: keyof typeof content) => splitTone(ENTRIES.get(c)!.readings[0]!)[0];
export const related = (c: keyof typeof content, by: 'radical' | 'sound') => {
	const a = zi(c);
	const result: typeof ZI = [];
	for (const x of ZI) {
		if (x !== c && (by === 'radical' ? zi(x).form.rad === a.form.rad : ENTRIES.get(x)!.readings.some((p) => a.entry.readings.includes(p)))) result.push(x);
		if (result.length === 8) break;
	}
	return result;
};
