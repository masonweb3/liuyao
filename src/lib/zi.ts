// 单字知识页只在构建时查表；测名页只带字页链接表，不带字义、统计或字形路径。
import content from '../data/zi.json';
import meta from '../data/zi-meta.json';
import data from '../data/quming-zi.json';
import { type Data, lookup, splitTone, table } from './quming';

export const ZI = Object.keys(content) as (keyof typeof content)[];
export const ziPath = (c: string, hant = false) => `${hant ? '/zh-hant' : ''}/zi/${c}/`;
const T = table(data as unknown as Data);
export function zi(c: keyof typeof content, hant = false) {
	const text = content[c];
	const ch = hant ? text.hant : c;
	const entry = lookup(T, ch, hant)!;
	const form = hant ? entry.forms.find((x) => x.form === ch)! : entry.forms[0]!;
	return { ch, entry, form, text: hant ? text.yi_hant : text.yi, meta: meta[c], glyph: hant ? meta[c].glyphHant : meta[c].glyph };
}
export const initials = (c: keyof typeof content) => splitTone(lookup(T, c)!.readings[0]!)[0];
export const related = (c: keyof typeof content, by: 'radical' | 'sound') => {
	const a = zi(c);
	return ZI.filter((x) => x !== c && (by === 'radical' ? zi(x).form.rad === a.form.rad : lookup(T, x)!.readings.some((p) => a.entry.readings.includes(p)))).slice(0, 8);
};
