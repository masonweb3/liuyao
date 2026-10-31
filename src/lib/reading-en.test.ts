import {expect,it} from 'vitest';
import {cast,type Yao} from './liuyao/najia';
import {compose as chinese} from './reading';
import {compose} from './reading-en';
import type {Question} from './liuyao/duan';
import {GUA} from '../data/gua-slugs';
import english from '../data/gua-en.json';
import ui from '../data/home-ui-en.json';
import hantUi from '../data/home-ui-hant.json';
import {homeText} from './home-text';
import {ago,monthDay,reminder} from './revisit';
import copy from '../data/copy-en.json';
import {todayText} from './today';
import hansRuntime from '../data/home-runtime.json';
import hantRuntime from '../data/home-runtime-hant.json';
import {posName,nthThrow,yaoTitle} from './flow';

it('moving labels to page data preserves all existing Chinese positions and titles',()=>{
 for(const data of [hansRuntime,hantRuntime])for(let i=0;i<6;i++){
  expect(data.positions[i]).toBe(posName(i));
  expect(data.throws[i]).toBe(nthThrow(i));
  expect(data.titles[0]![i]).toBe(yaoTitle(i,false));
  expect(data.titles[1]![i]).toBe(yaoTitle(i,true));
 }
});

it('all 64 original English entries and all interface labels are present',()=>{
 expect(Object.keys(english)).toEqual(GUA.map(([n])=>n));
 expect(Object.keys(ui).sort()).toEqual(Object.keys(hantUi).sort());
 expect(new Set(Object.values(english).map(g=>g.name)).size).toBe(64);
 for(const g of Object.values(english)){expect(g.text.length).toBeGreaterThan(150);expect(g.text).not.toMatch(/Wilhelm|[\u3400-\u9fff]/);}
 expect(homeText(false,true)('往卦')).toBe('History');
 expect(()=>homeText(false,true)('missing')).toThrow();
});

it('English covers all 4096 line combinations and eight topic rules without changing the chart',()=>{
 const questions:Question[]=[{topic:'财'},{topic:'事业'},{topic:'父母'},{topic:'子孙'},{topic:'兄弟'},{topic:'自身'},{topic:'婚恋',gender:'男'},{topic:'婚恋',gender:'女'}];
 for(let n=0;n<4096;n++){
  const params=Array.from({length:6},(_,i)=>(6+(n>>2*i&3)) as Yao);
  // Two seasons exercise different strength, void, clash and hidden-line sentence branches.
  const r=cast(params,{date:new Date(n%2?'2026-10-31T04:00:00Z':'2025-02-03T14:20:00Z')});
  for(const q of questions){
   const a=chinese(r,q),b=compose(r,q);
   expect(b.verdict).toBe(a.verdict);
   expect(b.reasons).toHaveLength(a.reasons.length);
   expect(b.ben.href).toBe('/en'+a.ben.href);
   expect(b.ben.baihua).toBe((english as Record<string,{text:string}>)[r.gua.name]!.text);
   expect(b.dong.lines.map(l=>[l.text,l.main])).toEqual(a.dong.lines.map(l=>[l.text,l.main]));
   expect(b.panel.rows.map(l=>[l.gz,l.yang,l.moving,l.yong])).toEqual(a.panel.rows.map(l=>[l.gz,l.yang,l.moving,l.yong]));
   expect([b.basis,...b.reasons,b.panel.fu].join(' ')).not.toMatch(/[临冲动化旺衰用神伏飞进退初爻上爻]/);
  }
 }
},60000);

it('English dates respect the original time zones and calendar files contain no question',async()=>{
 const at=new Date('2026-10-28T04:00:00Z'),now=new Date('2026-10-31T04:00:00Z');
 expect(ago(at,now,true)).toBe('3 days ago');
 expect(monthDay(now,true)).toBe('Oct 31');
 expect(await todayText(new Date('2025-02-03T14:20:00Z'),'en')).toBe('UTC+8 · Year 乙巳 · Month 戊寅 · Day 癸卯');
 const text=reminder(at,'Heaven',now,now,'x',{...copy.REMIND.ics,en:true,url:'https://sixyao.app/en/?history'}).text.replace(/\r\n /g,'');
 expect(text).toContain('Cast on Oct 28\\, 2026: Heaven.');
 expect(text).toContain('/en/?history');
 expect(text).not.toContain('年月日');
});
