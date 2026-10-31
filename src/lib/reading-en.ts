/** Original English presentation; the traditional rules and stored data are unchanged. */
import guaci from '../data/guaci.json';
import english from '../data/gua-en.json';
import templates from '../data/templates-en.json';
import messages from '../data/liuyao-messages-en.json';
import { guaPath } from '../data/gua-slugs';
import { compose as chinese, type Reading } from './reading';
import { compileMessages } from './reading-message';
import type { CastResult } from './liuyao/najia';
import type { Question } from './liuyao/duan';

const terms:Record<string,string>={金:'Metal',木:'Wood',水:'Water',火:'Fire',土:'Earth',男:'male',女:'female',初爻:'line 1',二爻:'line 2',三爻:'line 3',四爻:'line 4',五爻:'line 5',上爻:'line 6',' · 用神':' · focal line'};
export const message=compileMessages(messages,s=>terms[s]??s.split('、').map(v=>terms[v]??v).join(', '));
const names:Record<string,{name:string;text:string}>=english;
const text:Record<string,string>=guaci;
const lineTitle=(s:string)=>s==='用九'?'Using the nines':s==='用六'?'Using the sixes':s==='初九'?'Nine at line 1':s==='初六'?'Six at line 1':s==='上九'?'Nine at line 6':s==='上六'?'Six at line 6':`${s[0]==='九'?'Nine':'Six'} at line ${'一二三四五六'.indexOf(s[1]!)+1}`;
export function compose(r:CastResult,q:Question):Reading{
  const out=chinese(r,q);
  const gua=(name:string)=>({name:names[name]!.name,short:names[name]!.name,href:'/en'+guaPath(name),font:'--font-body',ciFont:'--font-body',ci:text[name]!.split('\n')[1]!,baihua:names[name]!.text});
  const t=templates.TEMPLATES[q.topic][out.verdict];
  const headings=['No moving lines','Moving line','Two moving lines · read the upper one first','Three moving lines','Four moving lines','Five moving lines','All six lines moving'];
  return {...out,conclusion:t.conclusion,advice:t.advice,basis:message(out.basis),note:out.note?templates.SPECIAL.fuCang:'',reasons:out.reasons.map(message),ben:gua(r.gua.name),bian:r.bian?gua(r.bian.name):null,
    dong:{...out.dong,heading:headings[r.dong.length]!,font:'--font-body',lines:out.dong.lines.map(l=>({...l,title:lineTitle(l.title),baihua:undefined})),note:r.dong.length===0?templates.SPECIAL.jingGua:r.dong.length===6?r.gua.name==='乾为天'?templates.SPECIAL.yongJiu:r.gua.name==='坤为地'?templates.SPECIAL.yongLiu:templates.SPECIAL.quanDong:''},
    panel:{...out.panel,ben:out.panel.ben.split(' · ').map(message).join(' · '),bian:out.panel.bian?.split(' · ').map(message).join(' · ')??null,
      rows:out.panel.rows.map(row=>({...row,title:lineTitle(row.title),god:message(row.god),qin:message(row.qin),shiYing:row.shiYing==='世'?'Self':row.shiYing==='应'?'Other':'',bian:row.bian?{...row.bian,qin:message(row.bian.qin),hua:row.bian.hua?message(row.bian.hua):''}:null})),fu:out.panel.fu.split('；').map(message).join('; ')}
  };
}
