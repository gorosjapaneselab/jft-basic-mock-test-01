import {TEST} from './core.js';
import {STUDENT_FIELDS,PART_NAMES,RESULT_TIME_ZONE} from './config.js';
export function resultDate(attempt){return new Intl.DateTimeFormat('en-GB',{timeZone:RESULT_TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(new Date(attempt.startedAt))+` (${RESULT_TIME_ZONE}, UTC+08:00)`;}
export function elapsedText(ms){const seconds=Math.floor(ms/1000);return `${Math.floor(seconds/60)} min ${String(seconds%60).padStart(2,'0')} sec`;}
export async function createResultPdf(attempt,result){
  await document.fonts.ready;
  const {PDFDocument}=window.PDFLib,pdf=await PDFDocument.create();pdf.setTitle(`${TEST.title} - Result`);pdf.setSubject('Practice test result');
  const width=1240,height=1754,margin=90,font='Arial, "Yu Gothic", "Meiryo", sans-serif';let canvas,ctx,y,pages=[];
  function newPage(){canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,width,height);ctx.textBaseline='top';y=90;pages.push(canvas);}
  function wrap(text,size,bold=false){ctx.font=`${bold?'bold ':''}${size}px ${font}`;const lines=[];let line='';for(const ch of Array.from(String(text))){if(ch==='\n'){lines.push(line);line='';continue;}if(line&&ctx.measureText(line+ch).width>width-margin*2){lines.push(line);line='';}line+=ch;}lines.push(line);return lines;}
  function text(value,size=34,bold=false,color='#19263b',gap=16){const lines=wrap(value,size,bold);for(const line of lines){if(y+size*1.55>height-110)newPage();ctx.font=`${bold?'bold ':''}${size}px ${font}`;ctx.fillStyle=color;ctx.fillText(line,margin,y);y+=size*1.5;}y+=gap;}
  function field(label,value){text(label,27,false,'#56657b',0);text(value,36,true,'#19263b',22);}
  newPage();text('TEST RESULT',28,true,'#1c4ea0');text(TEST.title,46,true,'#19263b',34);
  for(const fieldDef of STUDENT_FIELDS)field(fieldDef.label,attempt.student[fieldDef.key]||'');
  field('Test started',resultDate(attempt));
  field('Correct Answers',`${result.correct} / 50`);field('Mock Score',`${result.score} / 250`);
  text('Part results',34,true,'#1c4ea0',16);
  for(const section of result.sections)text(`Part ${section.section}: ${PART_NAMES[section.section-1]} - ${section.percent}%`,31,false,'#19263b',10);
  field('Time taken',elapsedText(result.elapsedMs));
  text('Mock score - not an official JFT-Basic scaled score.',27,false,'#56657b',0);
  for(let i=0;i<pages.length;i++){const c=pages[i],cctx=c.getContext('2d');cctx.font=`24px ${font}`;cctx.fillStyle='#56657b';cctx.fillText(`Page ${i+1} / ${pages.length}`,margin,height-70);const png=await pdf.embedPng(c.toDataURL('image/png'));const page=pdf.addPage([595.28,841.89]);page.drawImage(png,{x:0,y:0,width:595.28,height:841.89});}
  return new Blob([await pdf.save()],{type:'application/pdf'});
}
