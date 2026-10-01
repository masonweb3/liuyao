// 八字排盘在 Web Worker 里算（M19a）：排盘要用 tyme4ts（gzip 约 70 KB），首页按需加载的起卦包也用它。
// 页面脚本一 import 它（或用动态 import()），打包时就会拆出与首页共用的分包，首页入口包跟着变；Worker 单独打包，不共用分包。
// 生辰只在这里算，不发到任何地方。白话（M20）也在这里拼（M20-10）：句式与拼句代码不进页面脚本；拼不出来只少白话，盘面照出。
import { type Birth, bazi, type Options } from "../lib/bazi";
import { type Input, plain } from "../lib/bazi-baihua";

type Message = { id: number; birth: Birth; options: Options } & Omit<Input, "chart" | "options">;

self.onmessage = (e: MessageEvent<Message>) => {
	const { id, birth, options, ...rest } = e.data;
	let chart: ReturnType<typeof bazi>;
	try {
		chart = bazi(birth, options);
	} catch {
		postMessage({ id });
		return;
	}
	let text: ReturnType<typeof plain> | undefined;
	try {
		text = plain({ chart, options, ...rest });
	} catch {}
	postMessage({ id, chart, plain: text });
};
