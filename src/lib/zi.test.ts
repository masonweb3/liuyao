import { describe, expect, it } from 'vitest';
import content from '../data/zi.json';
import { initials, related, ZI, zi, ziPath } from './zi';

describe('单字页', () => {
	it('1092 字简繁一对一、路径完整、每页标题都是非空轮廓', () => {
		expect(ZI).toHaveLength(1092);
		expect(new Set(ZI.map(c => content[c].hant)).size).toBe(1092);
		for (const c of ZI) for (const hant of [false, true]) {
			const x = zi(c,hant);
			expect(x.form, c).toBeDefined();
			expect(x.text.length, c).toBeGreaterThan(30);
			expect(x.text.includes(x.ch), c).toBe(true);
			expect(x.glyph.d, c).toMatch(/^[Mm]/);
			expect(x.glyph.box.split(' ').map(Number).every(Number.isFinite),c).toBe(true);
			expect(ziPath(x.ch,hant)).toBe(`${hant ? '/zh-hant' : ''}/zi/${x.ch}/`);
			expect(initials(c)).toMatch(/^[a-züê]+$/);
		}
	});
	it('已核笔画和公开统计样例正确，相关字只链已发布的页面', () => {
		expect(zi('曹').form).toMatchObject({kx:10,page:502,today:11});
		expect(zi('琳').meta).toMatchObject({given:225,surname:0,pos:[30,161,34],tgh:2502});
		expect(zi('乐',true).ch).toBe('樂');
		expect([zi('乐').strokes, zi('乐',true).strokes, zi('乐').form.kx]).toEqual([5,15,15]);
		expect(zi('荣').strokes).toBe(10); // Unihan 18 的总画数，不冒称规范笔顺的笔画。
		expect(zi('怀',true).ch).toBe('懷');
		expect(zi('儿',true).ch).toBe('兒');
		expect(zi('致',true).ch).toBe('致');
		expect(zi('涂',true).ch).toBe('涂');
		expect(zi('采',true).ch).toBe('采');
		expect(zi('台',true).ch).toBe('台');
		expect(zi('征',true).ch).toBe('征');
		expect(zi('里',true).ch).toBe('里');
		expect([zi('艳').form.kx,zi('艳',true).form.kx]).toEqual([24,28]);
		for (const hant of [false,true]) {
			expect(zi('干',hant).form).toMatchObject({form:'干',kx:3});
			expect(zi('干',hant).meta[hant ? 'bookHant' : 'book']).toEqual(zi('干',hant).meta.bookHant);
		}
		for (const c of ZI) for (const by of ['radical','sound'] as const) {
			const list = related(c,by);
			expect(list.length).toBeLessThanOrEqual(8);
			expect(list).not.toContain(c);
			expect(list.every(x => ZI.includes(x))).toBe(true);
			expect(list.every(x => by === 'radical' ? zi(x).form.rad === zi(c).form.rad : zi(x).entry.readings.some(p => zi(c).entry.readings.includes(p)))).toBe(true);
		}
	});
	it('字义只讲本义与用法，不作命运、家人或健康预测', () => {
		for (const x of Object.values(content)) for (const s of [x.yi,x.yi_hant]) {
			expect(s).not.toMatch(/改命|改运|改運|转运|轉運|化解|克父|剋父|克母|剋母|克夫|剋夫|克妻|剋妻|婚变|婚變|寿元|壽元|灾厄|災厄|牢狱|牢獄|[人者]会|[人者]會|带来|帶來|运势|運勢|喜用|五行属|五行屬/);
		}
	});
});
