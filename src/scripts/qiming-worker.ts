// 字表与排盘依赖一次载入，后续输入只走本机消息，不按姓名取资源。
import data from '../data/quming-zi.json';
import { suggest, type NamingInput } from '../lib/qiming';
import { table, type Data } from '../lib/quming';

const t = table(data as Data);
self.onmessage = (e: MessageEvent<{ id: number; input: NamingInput }>) => {
	try { postMessage({ id: e.data.id, result: suggest(t, e.data.input) }); }
	catch (error) { postMessage({ id: e.data.id, error: error instanceof Error && ['surname','birth','timezone'].includes(error.message) ? error.message : 'failed' }); }
};
postMessage({ ready: true });
