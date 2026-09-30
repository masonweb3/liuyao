// 今日页的按月数据（M17-1，见 src/lib/huangli-card.ts）。预渲染成静态文件：/huangli/data/2026-10.json
import type { APIRoute } from 'astro';
import { monthCards, months } from '../../../lib/huangli-card';

export const getStaticPaths = () => months().map((month) => ({ params: { month } }));

export const GET: APIRoute = ({ params }) => Response.json(monthCards(params.month!, false));
