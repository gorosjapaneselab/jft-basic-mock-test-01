export const RESULTS_TIME_ZONE='Asia/Manila';
export function resultsDateParts(value){
 const date=new Date(value),day=new Intl.DateTimeFormat('en-GB',{timeZone:RESULTS_TIME_ZONE,day:'2-digit',month:'short',year:'numeric'}).format(date),time=new Intl.DateTimeFormat('en-GB',{timeZone:RESULTS_TIME_ZONE,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(date);
 return {day,time};
}
export function resultsRange(r){return r.summary.totalAttempts?`${(r.page-1)*r.pageSize+1}–${Math.min(r.page*r.pageSize,r.summary.totalAttempts)} of ${r.summary.totalAttempts} attempts`:'0 attempts';}
