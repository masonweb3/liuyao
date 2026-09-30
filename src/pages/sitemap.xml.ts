import type { APIRoute } from 'astro';
import { GUA, guaPath, HANT } from '../data/gua-slugs';
import { dayPath, days, JIEQI, jieqiPath } from '../lib/huangli-days';

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
	]),
];

export const GET: APIRoute = ({ site }) =>
	new Response(
		`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${PATHS.map((p) => `  <url><loc>${new URL(p, site)}</loc></url>`).join('\n')}\n</urlset>\n`,
		{ headers: { 'Content-Type': 'application/xml; charset=utf-8' } },
	);
