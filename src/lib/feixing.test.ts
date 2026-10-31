import { describe, expect, it } from 'vitest';
import { calendarStars, flight, houseStars, period, yearStars } from './feixing';
import notes from '../data/feixing.json';
import notesHant from '../data/feixing-hant.json';
import kb from '../data/fengshui.json';
import kbHant from '../data/fengshui-hant.json';

describe('沈氏正向下卦与年月飞星',()=>{
	it('洛书飞布与卷四子山午向九运中心数、顺逆逐条一致',()=>{
		expect(flight(5)).toEqual({1:1,2:2,3:3,4:4,5:5,6:6,7:7,8:8,9:9});
		expect(flight(1,false)).toEqual({1:5,2:4,3:3,4:2,5:1,6:9,7:8,8:7,9:6});
		// 《沈氏玄空学》卷四子山午向下卦：运、到山数、到向数、山顺、向顺。
		const cases = [[1,6,5,true,false],[2,7,6,false,true],[3,8,7,true,false],[4,9,8,false,true],[5,1,9,false,false],[6,2,1,true,false],[7,3,2,false,true],[8,4,3,true,false],[9,5,4,false,true]] as const;
		for(const [p,m,f,mf,ff] of cases){
			const x=houseStars(1864+(p-1)*20,180);
			expect(x.period).toBe(p);
			expect(x.sitting).toBe('子');
			expect(x.facing).toBe('午');
			expect([x.mountain[5],x.face[5],x.mountainForward,x.facingForward]).toEqual([m,f,mf,ff]);
		}
		// 地元不能照抄天元的顺逆，五的阴阳按原山向。
		const earth=houseStars(1864,165); // 壬山丙向。
		expect([earth.mountain[5],earth.face[5],earth.mountainForward,earth.facingForward]).toEqual([6,5,false,true]);
	});
	it('九运二十四正向全盘不重不漏，拒绝兼向和临界线',()=>{
		for(let p=1;p<=9;p++)for(let i=0;i<24;i++){
			const x=houseStars(1864+(p-1)*20,i*15);
			for(const grid of [x.base,x.mountain,x.face])expect(Object.values(grid).sort((a,b)=>a-b)).toEqual([1,2,3,4,5,6,7,8,9]);
		}
		expect(houseStars(2024,360)).toEqual(houseStars(2024,0));
		expect(()=>houseStars(2024,4.49)).not.toThrow();
		for(const a of [4.5,7.5,10.5,355.5,-1,361,NaN])expect(()=>houseStars(2024,a)).toThrow();
		expect(period(2004)).toBe(8);expect(period(2024)).toBe(9);expect(period(2044)).toBe(1);
	});
	it('年、月星按干支历精确换节，不按春节或机器时区',()=>{
		expect(yearStars(2024).centre).toBe(3);
		expect(yearStars(2026).centre).toBe(1);
		expect(yearStars(2027).centre).toBe(9);
		const before=calendarStars('2025-02-03T22:00');
		const after=calendarStars('2025-02-03T22:20');
		expect([before.annual.year,before.annual.centre,before.month]).toEqual([2024,3,'丁丑月']);
		expect([after.annual.year,after.annual.centre,after.month]).toEqual([2025,2,'戊寅月']);
		for(const bad of ['2025-02-30T12:00','2025-13-01T12:00','2025-02-03T25:00','<script>'])expect(()=>calendarStars(bad)).toThrow('date');
	});
	it('81组合与九种编号简繁齐全，原创说明只谈意象及可恢复的空间调整',()=>{
		const keys=Array.from({length:9},(_,m)=>Array.from({length:9},(_,f)=>`${m+1}-${f+1}`)).flat();
		expect(new Set(Object.keys(notes))).toEqual(new Set(keys));
		expect(Object.keys(notesHant)).toEqual(Object.keys(notes));
		expect(Object.keys(kbHant)).toEqual(Object.keys(kb));
		expect(Object.keys(kb)).toEqual(['1','2','3','4','5','6','7','8','9']);
		for(const text of [...Object.values(notes),...Object.values(notesHant)]){
			expect(text.length).toBeGreaterThan(30);
			expect(text).toMatch(/。$/);
		}
		const strings=(x:unknown):string[]=>typeof x==='string'?[x]:x&&typeof x==='object'?Object.values(x).flatMap(strings):[];
		for(const text of [notes,notesHant,kb,kbHant].flatMap(strings))expect(text).not.toMatch(/改命|改运|改運|转运|轉運|化解|招财|招財|发财|發財|寿元|壽元|疾病|灾厄|災厄|牢狱|牢獄|克[父母夫妻]|剋[父母夫妻]|婚变|婚變|绝命|絕命|五鬼|凶宅|兇宅|吉宅|一定会|一定會/);
	});
});
