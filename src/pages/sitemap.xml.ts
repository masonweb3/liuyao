import type { APIRoute } from 'astro';
import { GUA, guaPath } from '../data/gua-slugs';

// 可被收录的页面都登记在这里。带所问的解读结果没有自己的网址，也不该进来。
const PATHS = ['/', '/gua/', ...GUA.map(([name]) => guaPath(name))];

export const GET: APIRoute = ({ site }) =>
	new Response(
		`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${PATHS.map((p) => `  <url><loc>${new URL(p, site)}</loc></url>`).join('\n')}\n</urlset>\n`,
		{ headers: { 'Content-Type': 'application/xml; charset=utf-8' } },
	);
