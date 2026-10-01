// 八字排盘在 Web Worker 里算（M19a）：排盘要用 tyme4ts（gzip 约 70 KB），首页按需加载的起卦包也用它。
// 页面脚本一 import 它（或用动态 import()），打包时就会拆出与首页共用的分包，首页入口包跟着变；Worker 单独打包，不共用分包。
// 生辰只在这里算，不发到任何地方。
import { type Birth, bazi, type Options } from "../lib/bazi";

self.onmessage = (e: MessageEvent<{ id: number; birth: Birth; options: Options }>) => {
	const { id, birth, options } = e.data;
	try {
		postMessage({ id, chart: bazi(birth, options) });
	} catch {
		postMessage({ id });
	}
};
