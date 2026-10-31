import {expect,it} from 'vitest';
import * as copy from '../data/copy';
import hant from '../data/copy-hant.json';
import runtime from '../data/home-runtime.json';
import runtimeHant from '../data/home-runtime-hant.json';
import {homeText} from './home-text';

const shape=(value:unknown):unknown=>typeof value==='string'?'text':Array.isArray(value)?value.map(shape):Object.fromEntries(Object.entries(value as object).map(([key,item])=>[key,shape(item)]));
it('简繁文案字段和空位一致，缺译文让构建报错',()=>{
	expect(shape(hant)).toEqual(shape(copy));
	expect(shape(runtimeHant)).toEqual(shape(runtime));
	const holes=(value:unknown)=>JSON.stringify(value).match(/\{\w+\}/g)?.sort();
	expect(holes(hant)).toEqual(holes(copy));
	expect(homeText(false)('所问何事')).toBe('所问何事');
	expect(homeText(true)('所问何事')).toBe('所問何事');
	expect(()=>homeText(true)('未登记的文案')).toThrow('首页繁体文案缺少');
	expect(JSON.stringify(hant)).not.toMatch(/[兇矇佔鹹]|這臺|那臺|同一臺|天后/);
});
