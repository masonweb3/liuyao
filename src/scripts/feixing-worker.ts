// 所有住房参数只在本机消息里流转；依赖一次载入后不再取网络资源。
import notes from '../data/feixing.json';
import notesHant from '../data/feixing-hant.json';
import { calendarStars, GRID, houseStars } from '../lib/feixing';

export interface FeixingResult {
	chart: ReturnType<typeof houseStars>;
	calendar: ReturnType<typeof calendarStars>;
	notes: Record<number,string>;
}

self.onmessage = (e: MessageEvent<{id:number;year:number;degrees:number;at:string;hant:boolean}>) => {
	const {id,year,degrees,at,hant}=e.data;
	try {
		const chart=houseStars(year,degrees);
		const dictionary=(hant?notesHant:notes) as Record<string,string>;
		const result:FeixingResult={chart,calendar:calendarStars(at),notes:Object.fromEntries(GRID.map(p=>[p,dictionary[`${chart.mountain[p]}-${chart.face[p]}`]!]))};
		postMessage({id,result});
	} catch(error) {
		postMessage({id,error:error instanceof Error&&['edge','bearing','year','date'].includes(error.message)?error.message:'failed'});
	}
};
postMessage({ready:true});
