import {expect,it} from 'vitest';
import {cast,type Yao} from './liuyao/najia';
import {compose as hans} from './reading';
import {compose} from './reading-hant';
import type {Question} from './liuyao/duan';

it('繁体解读覆盖全部 4096 种爻组合，规则与简体一致，依据句式无遗漏',()=>{
	const questions:Question[]=[{topic:'财'},{topic:'事业'},{topic:'父母'},{topic:'子孙'},{topic:'兄弟'},{topic:'自身'},{topic:'婚恋',gender:'男'},{topic:'婚恋',gender:'女'}];
	for(let n=0;n<4096;n++){
		const params=Array.from({length:6},(_,i)=>(6+(n>>2*i&3)) as Yao);
		const r=cast(params,{date:new Date('2026-10-31T04:00:00Z')});
		for(const q of questions){
			const a=hans(r,q),b=compose(r,q);
			expect(b.verdict).toBe(a.verdict);
			expect(b.reasons).toHaveLength(a.reasons.length);
			expect(b.reasons.join('')).not.toMatch(/[财孙临冲动无为两头进静气实暂难飞连续]/);
			expect(b.panel.rows.map(x=>x.god).join('')).not.toMatch(/[龙陈]/);
			expect(b.ben.href).toBe('/zh-hant'+a.ben.href);
			expect(b.ben.ci).toBeTruthy();
			expect(b.panel.rows.map(x=>[x.yang,x.moving,x.yong,x.gz])).toEqual(a.panel.rows.map(x=>[x.yang,x.moving,x.yong,x.gz]));
		}
	}
},60000);
