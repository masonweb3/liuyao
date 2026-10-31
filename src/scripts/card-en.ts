import { isMoving, isYang, STROKES } from '../lib/flow';
import type { CastResult } from '../lib/liuyao/najia';
import type { GuaText } from '../lib/reading';
import type { HomeRuntime } from '../lib/home-runtime';

/** Same local canvas card, with horizontal English text; question inclusion remains opt-in. */
export async function card(r:CastResult,ben:GuaText,question:string):Promise<string>{
  const ui:HomeRuntime=JSON.parse(document.querySelector<HTMLElement>('main')!.dataset.runtime!);
  const font=getComputedStyle(document.documentElement).getPropertyValue('--font-body');
  await document.fonts.load(`40px ${font}`,ben.name+ben.baihua+question);
  const canvas=document.createElement('canvas');canvas.width=1242;canvas.height=1656;
  const c=canvas.getContext('2d');if(!c)throw new Error('canvas 2d unavailable');
  c.fillStyle='#f8f4ed';c.fillRect(0,0,1242,1656);c.textBaseline='top';
  const pen=(size:number,color='#2d2e36')=>{c.font=`${size}px ${font}`;c.fillStyle=color;};
  function lines(text:string,y:number,size:number,max:number){
    pen(size);const rows:string[]=[];let line='';
    for(const word of text.trim().split(/\s+/)){
      // Split unusually long tokens too, so an entered question cannot overflow the card.
      for(const ch of (line?' ':'')+word){if(c.measureText(line+ch).width>1002){rows.push(line);line='';}line+=ch;}
    }
    if(line)rows.push(line);
    if(rows.length>max){rows.length=max;let last=rows[max-1]!;while(c.measureText(last+'…').width>1002)last=last.slice(0,-1);rows[max-1]=last+'…';}
    rows.forEach((s,i)=>c.fillText(s,120,y+i*size*1.5));return y+rows.length*size*1.5;
  }
  pen(34,'#ab372f');c.fillText('SIXYAO · I CHING',120,100);
  let y=lines(ben.name,190,62,2);
  if(r.bian)y=lines('to '+(ui.names[r.bian.name]??r.bian.name),y+12,30,2);
  const top=y+50;
  r.params.forEach((p,i)=>{const ly=top+(5-i)*55;c.save();c.fillStyle='#2d2e36';c.translate(120,ly);c.scale(2,1.2);for(const d of STROKES[isYang(p)?'yang':'yin'])c.fill(new Path2D(d));c.restore();if(isMoving(p)){pen(32,'#ed5126');c.fillText(isYang(p)?'○':'×',640,ly);}});
  y=top+370;
  if(question)y=lines('Question: '+question.replace(/\s+/g,' '),y,30,2)+25;
  c.fillStyle='#e4dfd7';c.fillRect(120,y,1002,2);
  y=lines('Original English overview',y+28,25,1)+15;
  lines(ben.baihua,y,34,9);
  pen(23,'#6e665e');c.fillText('sixyao.app · For cultural reference and entertainment only',120,1490);
  c.fillText('AI-assisted classification · Not medical, legal or investment advice',120,1530);
  return canvas.toDataURL('image/png');
}
