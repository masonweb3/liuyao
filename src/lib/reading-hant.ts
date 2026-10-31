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

import { compileMessages } from './reading-message';
export const message = compileMessages(messages);
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
