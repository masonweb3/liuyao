type Messages={terms:Record<string,string>;formats:string[][]};
export function compileMessages(messages:Messages,value=(s:string)=>s){
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
function message(text:string):string {
	const exact=(messages.terms as Record<string,string>)[text];
	if(exact!==undefined)return exact;
	for(const {re,keys,to}of formats){
		const match=re.exec(text);if(!match)continue;
		const values=Object.fromEntries(keys.map((key,i)=>[key,['label','why','qin','topic','gong'].includes(key)?message(match[i+1]!):value(match[i+1]!)]));
		return to.replace(/\{(\w+)\}/g,(_,key)=>values[key]!);
	}
	throw new Error(`Missing reading sentence: ${text}`);
}
return message;
}
