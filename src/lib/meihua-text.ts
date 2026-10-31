// Astro 构建时按整句取已校对的繁体，不在浏览器运行文字转换。
import words from '../data/meihua-ui-hant.json';
export const meihuaText=(hant:boolean)=>(text:string)=>{
	if(!hant)return text;
	const result=(words as Record<string,string>)[text];
	if(result===undefined)throw new Error(`缺少梅花繁体文案：${text}`);
	return result;
};
