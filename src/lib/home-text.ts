// 仅供 Astro 构建：繁体文字已经入库，浏览器不做转换。
import words from '../data/home-ui-hant.json';
export const homeText = (hant: boolean) => (text: string) => {
	if (!hant) return text;
	const result = (words as Record<string,string>)[text];
	if (result === undefined) throw new Error(`首页繁体文案缺少：${text}`);
	return result;
};
