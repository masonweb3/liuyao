import type { APIRoute } from 'astro';

// 由 site 生成，改域名时不必再改这里。
export const GET: APIRoute = ({ site }) =>
	new Response(`User-agent: *\nDisallow: /api/\n\nSitemap: ${new URL('/sitemap.xml', site)}\n`, {
		headers: { 'Content-Type': 'text/plain; charset=utf-8' },
	});
