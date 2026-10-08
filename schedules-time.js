// Display-side date handling only; the established API still receives UTC ISO timestamps.
export const DEFAULT_SCHEDULE_ZONE='Asia/Manila';
function partsAt(value,timeZone){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone,calendar:'gregory',numberingSystem:'latn',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(value));
  return Object.fromEntries(parts.filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
}
export function minuteFields(value,timeZone){if(!value)return {date:'',time:''};const p=partsAt(value,timeZone);return {date:p.year+'-'+p.month+'-'+p.day,time:p.hour+':'+p.minute};}
export function newScheduleDraft(testId){return {testName:'',testId,classIds:[],period:false,timeZone:DEFAULT_SCHEDULE_ZONE,sameDay:true,openDate:'',openTime:'',closeDate:'',closeTime:'',original:null};}
export function editScheduleDraft(record){const open=minuteFields(record.openAt,record.timeZone),close=minuteFields(record.closeAt,record.timeZone);return {testName:record.testName,testId:record.testId,classIds:[...record.classIds],period:!!record.openAt,timeZone:record.timeZone,sameDay:open.date===close.date,openDate:open.date,openTime:open.time,closeDate:close.date,closeTime:close.time,original:{openAt:record.openAt,closeAt:record.closeAt,timeZone:record.timeZone,openDate:open.date,openTime:open.time,closeDate:close.date,closeTime:close.time}};}
export function alignClosingDate(draft){if(draft.sameDay)draft.closeDate=draft.openDate;}
export function wallMinuteToISO(date,time,timeZone){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))throw Error('Enter a valid date and time (hours and minutes).');
  const [year,month,day]=date.split('-').map(Number),[hour,minute]=time.split(':').map(Number),target=Date.UTC(year,month-1,day,hour,minute);
  if(new Date(target).toISOString().slice(0,10)!==date)throw Error('Enter a valid date.');
  let instant=target;
  for(let i=0;i<4;i++){const p=partsAt(instant,timeZone);const wall=Date.UTC(Number(p.year),Number(p.month)-1,Number(p.day),Number(p.hour),Number(p.minute),Number(p.second));const next=target-(wall-instant);if(next===instant)break;instant=next;}
  const actual=minuteFields(instant,timeZone);if(actual.date!==date||actual.time!==time)throw Error('This local time does not exist in the selected time zone. Choose another time.');
  return new Date(instant).toISOString();
}
export function scheduleWindow(draft){
  if(!draft.period)return {openAt:null,closeAt:null,timeZone:draft.timeZone};
  const keep=(side)=>{const original=draft.original;return original&&original.timeZone===draft.timeZone&&original[side+'Date']===draft[side+'Date']&&original[side+'Time']===draft[side+'Time']?original[side+'At']:wallMinuteToISO(draft[side+'Date'],draft[side+'Time'],draft.timeZone);};
  const openAt=keep('open'),closeAt=keep('close');if(Date.parse(closeAt)<=Date.parse(openAt))throw Error('Closing time must be after opening time.');
  return {openAt,closeAt,timeZone:draft.timeZone};
}
