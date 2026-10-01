// 梅花起卦在 Web Worker 里算（M21-7）：要用 tyme4ts 与全部卦爻辞、白话、断语模板（约 120 KB gzip），
// 页面脚本一 import 它们（或用动态 import()），打包就会拆出与首页共用的分包，首页入口包跟着变；Worker 单独打包。
// 写下所问时开始载入，落笔、Jev 那一两秒正好盖住；从往卦点开（?at=）时一进页就载入。所问不发到这里。
import { compose, type Request } from "../lib/meihua-reading";

self.onmessage = (e: MessageEvent<Request & { id: number }>) => {
	const { id, ...req } = e.data;
	try {
		postMessage({ id, view: compose(req) });
	} catch {
		postMessage({ id });
	}
};
