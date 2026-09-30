// 繁体今日页的按月数据：/zh-hant/huangli/data/2026-10.json
import type { APIRoute } from 'astro';
import { monthCards, months } from '../../../../lib/huangli-card';

export const getStaticPaths = () => months().map((month) => ({ params: { month } }));

export const GET: APIRoute = ({ params }) => Response.json(monthCards(params.month!, true));
