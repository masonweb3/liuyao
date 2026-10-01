import type { APIRoute } from 'astro';
import { GUA, guaPath, HANT } from '../data/gua-slugs';
import { KB_PAGES, kbPath } from '../lib/bazi-kb';
import { months } from '../lib/huangli-card';
import { dayPath, days, JIEQI, jieqiPath } from '../lib/huangli-days';
import { ITEMS, zeriPath } from '../lib/zeri-rule';

// 可被收录的页面都登记在这里。带所问的解读结果没有自己的网址，也不该进来。
// 简繁互指的 hreflang 只写在各页 <head> 里，这里不重复写 xhtml:link：Google 说三种写法等价，同时写没有额外好处，
// 两处都写反而要保证永远一致。
const PATHS = [
	'/',
	'/gua/',
	...GUA.map(([name]) => guaPath(name)),
	`${HANT}/gua/`,
	...GUA.map(([name]) => guaPath(name, true)),
	...[false, true].flatMap((hant) => [
		`${hant ? HANT : ''}/huangli/`,
		...days().map((d) => dayPath(d, hant)),
		`${hant ? HANT : ''}/jieqi/`,
		...JIEQI.map(([name]) => jieqiPath(name, hant)),
		// 择日（M18）：首页与 6 个事项 × 时间窗每个月的月页
		zeriPath(undefined, undefined, hant),
		...months().flatMap((m) => ITEMS.map((i) => zeriPath(i.slug, m, hant))),
		// 八字排盘（M19a）：只有栏目首页，盘面在浏览器里算、不进网址
		`${hant ? HANT : ''}/bazi/`,
		// 八字知识页（M19b）：十天干、十二地支（各带目录）、十神、纳音、十二长生，27 页
		...KB_PAGES.map((p) => kbPath(p.path, hant)),
	]),
	// 梅花易数（M21）：先只有简体（M21-20）；起出的卦不进网址
	'/meihua/',
];

export const GET: APIRoute = ({ site }) =>
	new Response(
		`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${PATHS.map((p) => `  <url><loc>${new URL(p, site)}</loc></url>`).join('\n')}\n</urlset>\n`,
		{ headers: { 'Content-Type': 'application/xml; charset=utf-8' } },
	);
