import { describe, expect, it } from 'vitest';
import { bearing, DIRECTIONS, house, imageType, minggua, rotatedSize } from './fengshui';

describe('本地八宅与方位',()=>{
	it('三元甲子起例及五寄宫与古籍表一致',()=>{
		for(const [year,male,female] of [[1864,1,8],[1924,4,2],[1984,7,8],[2044,1,8],[2000,9,6]]){
			expect(minggua(year!,'男').number).toBe(male);
			expect(minggua(year!,'女').number).toBe(female);
		}
		expect(minggua(1968,'男')).toMatchObject({raw:5,number:2,gua:'坤'});
		expect(minggua(1999,'女')).toMatchObject({raw:5,number:8,gua:'艮'});
		for(let year=1800;year<=2199;year++)for(const gender of ['男','女'] as const){
			const x=minggua(year,gender);
			expect(DIRECTIONS.some(g=>g.number===x.number)).toBe(true);
			expect(minggua(year+180,gender).number).toBe(x.number);
		}
		expect(()=>minggua(NaN,'男')).toThrow('birth');
	});
	it('按坐山取宅卦，边界与北向环绕准确',()=>{
		expect(house(0)).toMatchObject({facing:{gua:'坎'},sitting:{gua:'离'}});
		expect(house(90).sitting.gua).toBe('兑');
		expect(house(360)).toEqual(house(0));
		for(const x of DIRECTIONS)expect(house(x.degree).facing).toEqual(x);
		expect(house(22.499).facing.gua).toBe('坎');
		expect(house(22.5).facing.gua).toBe('艮');
		expect(house(337.499).facing.gua).toBe('乾');
		expect(house(337.5).facing.gua).toBe('坎');
		for(const n of [-1,361,NaN,Infinity])expect(()=>bearing(n)).toThrow('bearing');
	});
	it('本地图片旋转不裁切，异常尺寸有界',()=>{
		expect(rotatedSize(1000,800,0)).toEqual({width:1000,height:800});
		const quarter=rotatedSize(1000,800,90);
		expect(quarter.width).toBeCloseTo(800);
		expect(quarter.height).toBeCloseTo(1000);
		const diagonal=rotatedSize(1000,800,45);
		expect(diagonal.width).toBeCloseTo(1800/Math.sqrt(2));
		expect(diagonal.height).toBeCloseTo(diagonal.width);
		expect(()=>rotatedSize(10000,10000,0)).toThrow('image');
		expect(()=>rotatedSize(0,800,0)).toThrow('image');
	});
	it('格式签名不凭扩展名，拒绝SVG与空文件',()=>{
		expect(imageType(new Uint8Array([137,80,78,71,13,10,26,10]))).toBe('png');
		expect(imageType(new Uint8Array([255,216,255,224]))).toBe('jpeg');
		expect(imageType(new Uint8Array([82,73,70,70,0,0,0,0,87,69,66,80]))).toBe('webp');
		expect(imageType(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull();
		expect(imageType(new Uint8Array())).toBeNull();
	});
});
