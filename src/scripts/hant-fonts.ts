// 每卦复用纸面页的芫荽和文楷子集，等成卦才注册；不同卦用不同字体族，避免 unicode-range 重叠。
import ranges from '../fonts/gua-hant/ranges.json';
import {guaPath} from '../data/gua-slugs';
const urls=import.meta.glob<string>('../fonts/gua-hant/*.woff2',{eager:true,query:'?url',import:'default'});
const ready=new Set<string>();
export function register(name:string):string {
	const slug=guaPath(name).split('/')[2]!;
	const variable=`--gua-${slug}`;
	if(ready.has(slug))return variable;
	const family=`Gua-Hant-${slug}`;
	for(const key of [slug,`${slug}-wk`]){
		const range=(ranges as Record<string,string>)[key];
		if(!range)continue;
		const url=urls[`../fonts/gua-hant/${key}.woff2`];
		if(!url)throw new Error(`缺少卦名字体：${key}`);
		document.fonts.add(new FontFace(family,`url("${url}")`,{unicodeRange:range,display:'swap',weight:'400'}));
	}
	document.documentElement.style.setProperty(variable,`'${family}', 'Noto Serif TC', serif`);
	ready.add(slug);
	return variable;
}
