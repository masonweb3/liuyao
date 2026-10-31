/** 繁体解读：规则仍用同一引擎，文案只取已经校对入库的句式和经文。 */
import guaci from '../data/guaci-hant.json';
import baihua from '../data/baihua-hant.json';
import yao from '../data/yao-baihua-hant.json';
import templates from '../data/templates-hant.json';
import messages from '../data/liuyao-messages-hant.json';
import { guaPath } from '../data/gua-slugs';
import { compose as hans, type Reading } from './reading';
import type { CastResult } from './liuyao/najia';
import type { Question } from './liuyao/duan';

const branch='[子丑寅卯辰巳午未申酉戌亥]';
const element='[金木水火土]';
const position='[初二三四五上]爻';
const patterns:Record<string,string>={
	n:branch+element,bian:branch+element,fei:branch+element,yue:branch,ri:branch,
	qin:'(?:妻财|子孙|官鬼|父母|兄弟)',pos:position,found:`${position}(?:、${position})*`,
	topic:'(?:财|事业|父母|子女|朋友|婚恋|自身)',gender:'[男女]',gong:'[乾坤震巽坎离艮兑]',xing:element,
	gz:'[甲乙丙丁戊己庚辛壬癸]'+branch+element,feiGz:'[甲乙丙丁戊己庚辛壬癸]'+branch+element,mark:'(?: · 用神)?',
};
const formats=messages.formats.map(([from,to])=>{
	const keys:string[]=[];
	const source=from!.replace(/[.*+?^$()|[\]\\]/g,'\\$&').replace(/\{(\w+)\}/g,(_,key)=>{keys.push(key);return `(${patterns[key]??'.+?'})`;});
	return {re:new RegExp(`^${source}$`),keys,to:to!};
});
/** 按完整句式匹配并填空；不做逐字转换，也不接收用户的所问。 */
export function message(text:string):string {
	const exact=(messages.terms as Record<string,string>)[text];
	if(exact!==undefined)return exact;
	for(const {re,keys,to}of formats){
		const match=re.exec(text);if(!match)continue;
		const values=Object.fromEntries(keys.map((key,i)=>[key,['label','why','qin','topic','gong'].includes(key)?message(match[i+1]!):match[i+1]!]));
		return to.replace(/\{(\w+)\}/g,(_,key)=>values[key]!);
	}
	throw new Error(`缺少繁体解读句式：${text}`);
}
export function compose(r:CastResult,q:Question):Reading {
	const out=hans(r,q);
	const gua=(name:string)=>{
		const data=(guaci as Record<string,string>)[name]!.split('\n');
		const title=data[0]!.split(' ')[2]!;
		const variable=`--gua-${guaPath(name).split('/')[2]}`;
		return {name:title,short:title[1]==='為'?title.slice(0,1):title.slice(2),href:guaPath(name,true),font:variable,ciFont:variable,ci:data[1]!,baihua:(baihua as Record<string,string>)[name]!};
	};
	const t=templates.TEMPLATES[q.topic][out.verdict];
	const n=r.dong.length;
	const headings=['靜卦','動爻','動爻 · 兩爻齊動，以上爻為主','動爻 · 三爻齊動','動爻 · 四爻齊動','動爻 · 五爻齊動','動爻 · 六爻皆動'];
	return {...out,conclusion:t.conclusion,advice:t.advice,basis:message(out.basis),note:out.note?templates.SPECIAL.fuCang:'',reasons:out.reasons.map(message),
		ben:gua(r.gua.name),bian:r.bian?gua(r.bian.name):null,
		dong:{...out.dong,heading:headings[n]!,font:gua(r.gua.name).font,
			lines:out.dong.lines.map(l=>({...l,text:(guaci as Record<string,string>)[r.gua.name]!.split('\n').find(s=>s.startsWith(`${l.title}：`))!.slice(l.title.length+1),baihua:(yao as Record<string,Record<string,string>>)[r.gua.name]![l.title]})),
			note:n===0?templates.SPECIAL.jingGua:n===6?r.gua.name==='乾为天'?templates.SPECIAL.yongJiu:r.gua.name==='坤为地'?templates.SPECIAL.yongLiu:templates.SPECIAL.quanDong:''},
		panel:{...out.panel,ben:out.panel.ben.split(' · ').map(message).join(' · '),bian:out.panel.bian?.split(' · ').map(message).join(' · ')??null,
			rows:out.panel.rows.map(row=>({...row,god:message(row.god),qin:message(row.qin),shiYing:row.shiYing==='应'?'應':row.shiYing,
				bian:row.bian?{...row.bian,qin:message(row.bian.qin),hua:row.bian.hua?message(row.bian.hua):''}:null})),fu:out.panel.fu.split('；').map(message).join('；')},
	};
}
