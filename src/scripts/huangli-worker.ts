// 今日页在时间窗外的回退（M17-1）：每年加一年的 PR 没按时合并时，今日页在这里用引擎现算当天的黄历。
// 放进 Web Worker 是为了单独打包：今日页脚本里有动态 import 的话，Vite 的预加载助手会被拆成和首页共用的分包。
import huangliHant from "../data/huangli-hant.json";
import huangliData from "../data/huangli.json";
import { type Data, huangliOf, show } from "../lib/huangli";

self.onmessage = (e: MessageEvent<{ date: string; hant: boolean }>) => {
	const { gua: _, ...card } = show(huangliOf(e.data.date), (e.data.hant ? huangliHant : huangliData) as unknown as Data);
	postMessage(card);
};
