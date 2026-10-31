// 梅花起卦在 Web Worker 里算（M21-7）：要用 tyme4ts 与全部卦爻辞、白话、断语模板（约 120 KB gzip），
// 页面脚本一 import 它们（或用动态 import()），打包就会拆出与首页共用的分包，首页入口包跟着变；Worker 单独打包。
// 写下所问时开始载入，落笔、Jev 那一两秒正好盖住；从往卦点开（?at=）时一进页就载入。所问不发到这里。
import { compose, type Request } from "../lib/meihua-reading";
import ranges from '../fonts/gua-hant/ranges.json';
const urls=import.meta.glob<string>('../fonts/gua-hant/*.woff2',{eager:true,query:'?url',import:'default'});

self.onmessage = (e: MessageEvent<Request & { id: number }>) => {
	const { id, ...req } = e.data;
	try {
		const view=compose(req);
		if(req.hant)view.fonts=[...new Set([view.ben.font,view.bian.font,view.hu.font])].map(variable=>{
			const slug=variable.slice('--gua-'.length);
			const files=[slug,`${slug}-wk`].flatMap(key=>{
				const range=(ranges as Record<string,string>)[key];
				if(!range)return [];
				const url=urls[`../fonts/gua-hant/${key}.woff2`];
				if(!url)throw new Error('Missing hexagram font');
				return [{url,range}];
			});
			if(!files.length)throw new Error('Missing hexagram font range');
			return {variable,family:`Gua-Hant-${slug}`,files};
		});
		postMessage({ id, view });
	} catch {
		postMessage({ id });
	}
};
