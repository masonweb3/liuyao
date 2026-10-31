import { describe, expect, it } from 'vitest';
import data from '../data/quming-zi.json';
import pool from '../data/qiming-names.json';
import elements from '../data/qiming-wuxing.json';
import { suggest, suitable } from './qiming';
import { lookup, table, type Data } from './quming';

const t = table(data as Data);
const birth = { calendar: 'solar' as const, year: 2025, month: 2, day: 3, hour: 22, minute: 0, gender: '女' as const };

describe('本地起名', () => {
	it('来源摘句包含候选，简繁与自建意象表可用，不用不明字库', () => {
		expect(pool).toHaveLength(34);
		for (const x of pool) {
			expect(x.quote).toContain(x.name);
			expect(x.quoteHant).toContain(x.hant);
			for (const c of x.name + x.hant) expect(lookup(t,c),c).not.toBeNull();
			for (const text of [x.note,x.noteHant]) expect(text).not.toMatch(/改命|改运|改運|转运|轉運|化解|克父|剋父|克母|剋母|寿元|壽元|灾厄|災厄|牢狱|牢獄|保证.*成功|保證.*成功/);
		}
		const classified = Object.values(elements).flatMap(x => [...x.chars]);
		expect(new Set(classified).size).toBe(classified.length);
		for (const x of Object.values(elements)) {
			expect([...x.charsHant]).toHaveLength([...x.chars].length);
			expect(x.reason.length).toBeGreaterThan(15);
			expect(x.reasonHant.length).toBeGreaterThan(15);
			for (const c of x.chars) expect(pool.some(n => n.name.includes(c)),c).toBe(true);
		}
	});
	it('完整姓名逐一经过筛查，多音与英文不雅词不漏过', () => {
		expect(suitable(t,'吴','德')).toBeNull();
		expect(suitable(t,'朱','头')).toBeNull();
		expect(suitable(t,'史','涛')).toBeNull();
		expect(suitable(t,'王','屁')).toBeNull();
		expect(suitable(t,'林','雨涵')).not.toBeNull();
		for (const surname of ['林','王','李','张','陈','刘','黄','杨','吴','周','赵','孙','徐','朱','郭','何','高','罗','郑','梁','谢','宋','唐','许','韩','冯','邓','曹','彭','曾','萧','田','董','袁','潘','于','蒋','蔡','余','杜','司徒','欧阳','陳','歐陽']) for (const hant of [false,true]) {
			const r = suggest(t,{surname,birth,timezone:'Asia/Taipei',hant});
			expect(r.candidates.length,surname).toBeGreaterThan(0);
			for (const c of r.candidates) {
				expect(suitable(t,surname,c.given,hant),surname+c.given).not.toBeNull();
				expect(c.roman.py).toMatch(/\S+ \S+/);
			}
		}
	});
	it('出生时刻按指定时区精确交节，拒绝无效日期与时区', () => {
		const before = suggest(t,{surname:'林',birth,timezone:'Asia/Taipei',hant:false});
		const after = suggest(t,{surname:'林',birth:{...birth,minute:20},timezone:'Asia/Taipei',hant:false});
		expect(before.pillars.slice(0,2)).toEqual(['甲辰','丁丑']);
		expect(after.pillars.slice(0,2)).toEqual(['乙巳','戊寅']);
		expect(Object.values(before.counts).reduce((a,b)=>a+b,0)).toBe(8);
		const utc = suggest(t,{surname:'林',birth:{...birth,hour:14},timezone:'UTC',hant:false});
		expect(utc.pillars.slice(0,2)).toEqual(before.pillars.slice(0,2));
		expect(()=>suggest(t,{surname:'林',birth:{...birth,day:30},timezone:'Asia/Taipei',hant:false})).toThrow('birth');
		expect(()=>suggest(t,{surname:'林',birth,timezone:'no/such',hant:false})).toThrow('timezone');
		expect(()=>suggest(t,{surname:'<林>',birth,timezone:'UTC',hant:false})).toThrow('surname');
		expect(()=>suggest(t,{surname:'𱁬',birth,timezone:'UTC',hant:false})).toThrow('surname');
	});
});
