/**
 * 今日页的按月数据（M17-1）：构建时每月生成一份 JSON（/huangli/data/2026-10.json），今日页的小脚本按北京时间取当天那条填进卡片，
 * 这样今日页不用加载 tyme4ts（gzip 约 70 KB）。只挑卡片用得到的字段，文字已按简繁写好。
 */
import guaciHant from "../data/guaci-hant.json" with { type: "json" };
import huangliHant from "../data/huangli-hant.json" with { type: "json" };
import huangliData from "../data/huangli.json" with { type: "json" };
import { markOf, parseGua } from "./gua.js";
import { type Data, huangliOf, type Show, show } from "./huangli.js";
import { days, YEARS } from "./huangli-days.js";

export type Card = Pick<
	Show,
	"week" | "festival" | "lunar" | "ganzhi" | "yi" | "ji" | "notes" | "markNotes" | "chong" | "duty" | "star" | "nayin" | "gods" | "pengzu" | "pengzuNotes" | "today" | "termKey"
> & {
	/** 读一卦：显示的卦名（繁体取维基文库页名，如遯）、slug、爻画（上爻在前，1 阳 0 阴） */
	gua: { name: string; slug: string; lines: string };
};

export function card(date: string, hant: boolean): Card {
	const s = show(huangliOf(date), (hant ? huangliHant : huangliData) as unknown as Data);
	const { week, festival, lunar, ganzhi, yi, ji, notes, markNotes, chong, duty, star, nayin, gods, pengzu, pengzuNotes, today, termKey } = s;
	const name = hant ? parseGua((guaciHant as Record<string, string>)[s.gua.name]!).name : s.gua.name;
	const lines = [...markOf(s.gua.name)].reverse().join("");
	return { week, ...(festival && { festival }), lunar, ganzhi, yi, ji, notes, markNotes, chong, duty, star, nayin, gods, pengzu, pengzuNotes, today, termKey, gua: { name, slug: s.gua.slug, lines } };
}

/** 时间窗里的每个月「2026-01」… */
export const months = () => YEARS.flatMap((y) => Array.from({ length: 12 }, (_, i) => `${y}-${String(i + 1).padStart(2, "0")}`));

export function monthCards(month: string, hant: boolean): Record<string, Card> {
	return Object.fromEntries(days().filter((d) => d.startsWith(month)).map((d) => [d, card(d, hant)]));
}
