// Reporting is separate from test progress, grading and PDF generation.
export const OUTBOX_KEY='jft-basic:result-outbox:v1';
export function newAttemptId(){return crypto.randomUUID?crypto.randomUUID():'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const n=crypto.getRandomValues(new Uint8Array(1))[0]&15;return(c==='x'?n:(n&3)|8).toString(16);});}
export function ensureAttemptId(attempt){if(!attempt.attemptId)attempt.attemptId=newAttemptId();return attempt.attemptId;}
export function normalizeName(name){return name.trim().replace(/\s+/gu,' ').toLowerCase();}
export function resultPayload(questions,attempt,result,config){
  const selected=new Map(attempt.answers.map(a=>[a.questionId,a.selectedChoiceId]));
  const name=attempt.student.rawName??attempt.student.name;
  return {schemaVersion:1,attemptId:ensureAttemptId(attempt),testId:config.reportTestId,name,normalizedName:normalizeName(name),classSection:attempt.student.className,
    startedAt:new Date(attempt.startedAt).toISOString(),endedAt:new Date(attempt.submittedAt).toISOString(),timeZone:config.timeZone,
    elapsedSeconds:Math.floor(result.elapsedMs/1000),autoSubmitted:!!attempt.autoSubmitted,correctAnswers:result.correct,mockScore:result.score,
    parts:result.sections.map(s=>({part:s.section,correct:s.correct,total:s.total,percent:s.percent})),
    answers:questions.map(q=>({questionId:q.id,selectedChoiceId:selected.get(q.id)??null,isCorrect:selected.get(q.id)===q.correctChoiceId}))};
}
export function validWebAppUrl(url){return /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url);}
export function checkSavedJsonp(endpoint,attemptId,timeoutMs=8000){return new Promise((resolve,reject)=>{
  const callback='jftResult_'+newAttemptId().replaceAll('-','');const script=document.createElement('script');let timer;
  const cleanup=()=>{clearTimeout(timer);script.remove();window[callback]=()=>{};setTimeout(()=>delete window[callback],60000);};
  window[callback]=data=>{cleanup();if(data?.attemptId===attemptId&&typeof data.saved==='boolean')resolve(data.saved);else reject(Error('Invalid acknowledgement'));};
  script.onerror=()=>{cleanup();reject(Error('No acknowledgement'));};
  timer=setTimeout(()=>{cleanup();reject(Error('Acknowledgement timeout'));},timeoutMs);
  const url=new URL(endpoint);url.searchParams.set('action','status');url.searchParams.set('attemptId',attemptId);url.searchParams.set('callback',callback);url.searchParams.set('_',Date.now());script.src=url.href;document.head.append(script);
});}
async function postResult(endpoint,payload){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);try{await fetch(endpoint,{method:'POST',mode:'no-cors',credentials:'omit',redirect:'follow',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify(payload),signal:controller.signal});}finally{clearTimeout(timer);}}
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export function createResultDelivery({endpoint,storage,post=postResult,checkSaved=checkSavedJsonp,wait=pause,now=Date.now,confirmationDelays=[1200,3000,6000]}={}){
  let records={};try{const stored=JSON.parse(storage.getItem(OUTBOX_KEY)||'{}');if(stored&&typeof stored==='object'&&!Array.isArray(stored))records=stored;}catch{}
  const listeners=new Set(),inFlight=new Map();
  const persist=()=>{try{const latest=JSON.parse(storage.getItem(OUTBOX_KEY)||'{}');if(latest&&typeof latest==='object'&&!Array.isArray(latest))records={...latest,...records};storage.setItem(OUTBOX_KEY,JSON.stringify(records));return true;}catch{return false;}};
  const notify=()=>listeners.forEach(fn=>{try{fn();}catch{}});
  const queue=payload=>{if(!records[payload.attemptId]){records[payload.attemptId]={status:'pending',payload,retryCount:0,nextRetryAt:0};persist();notify();}return records[payload.attemptId];};
  async function send(id,force=false){
    if(inFlight.has(id))return inFlight.get(id);
    const record=records[id];if(!record||record.status==='sent'||!validWebAppUrl(endpoint)||(!force&&record.nextRetryAt>now()))return;
    const task=(async()=>{record.status='sending';notify();try{
      // A previous POST may have succeeded even when its acknowledgement was lost.
      let saved=false;try{saved=await checkSaved(endpoint,id);}catch{}
      if(!saved){try{await post(endpoint,record.payload);}catch{}for(const delay of confirmationDelays){await wait(delay);try{saved=await checkSaved(endpoint,id);}catch{}if(saved)break;}}
      if(!saved)throw Error('Save not confirmed');
      records[id]={status:'sent',savedAt:now()};persist();
    }catch{record.status='pending';record.retryCount=(record.retryCount||0)+1;record.nextRetryAt=now()+Math.min(300000,30000*2**Math.min(record.retryCount-1,4));persist();}finally{notify();}})();
    inFlight.set(id,task);try{await task;}finally{inFlight.delete(id);}
  }
  async function flush(force=false){for(const [id,record]of Object.entries(records))if(record.status!=='sent')await send(id,force);}
  return {queue,send,flush,get:id=>records[id],subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},configured:validWebAppUrl(endpoint)};
}
