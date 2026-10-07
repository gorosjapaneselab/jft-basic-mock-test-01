// Reporting is separate from test progress, grading and PDF generation.
export const COMPLETIONS_KEY='jft-basic:completed-results:v1';
export const OUTBOX_KEY='jft-basic:result-outbox:v1';
export const PREPARED_KEY='jft-basic:result-prepared:v1';
export const LAST_POST_KEY='jft-basic:result-last-post:v1';
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
export async function postResult(endpoint,payload){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);try{await fetch(endpoint,{method:'POST',mode:'no-cors',credentials:'omit',redirect:'follow',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify(payload),signal:controller.signal});}finally{clearTimeout(timer);}}
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export function writeCompletedResult(storage,payload,attemptSnapshot=null){
  let completed={};const raw=storage.getItem(COMPLETIONS_KEY);if(raw)completed=JSON.parse(raw);
  if(!completed||typeof completed!=='object'||Array.isArray(completed))throw Error('Completed result storage is invalid; existing data was not overwritten.');
  const entry={payload:JSON.parse(JSON.stringify(payload)),attempt:attemptSnapshot?JSON.parse(JSON.stringify(attemptSnapshot)):null};
  const previous=completed[payload.attemptId];
  if(previous&&JSON.stringify(previous.payload)!==JSON.stringify(entry.payload))throw Error('The same Attempt ID has different answers; existing completed result was preserved.');
  completed[payload.attemptId]=previous?{payload:previous.payload,attempt:previous.attempt||entry.attempt}:entry;
  storage.setItem(COMPLETIONS_KEY,JSON.stringify(completed));
  const check=JSON.parse(storage.getItem(COMPLETIONS_KEY)||'null');
  if(JSON.stringify(check?.[payload.attemptId])!==JSON.stringify(completed[payload.attemptId]))throw Error('Completed result write could not be verified.');
  return completed[payload.attemptId];
}
export function createResultDelivery({endpoint,storage,post=postResult,checkSaved=checkSavedJsonp,wait=pause,now=Date.now,confirmationDelays=[1200,3000,6000]}={}){
  let records={};try{const stored=JSON.parse(storage.getItem(OUTBOX_KEY)||'{}');if(stored&&typeof stored==='object'&&!Array.isArray(stored))records=stored;}catch{}
  try{const completed=JSON.parse(storage.getItem(COMPLETIONS_KEY)||'{}');for(const [id,entry]of Object.entries(completed||{})){if(entry?.payload?.attemptId===id){if(!records[id])records[id]={status:'pending',payload:entry.payload,retryCount:0,nextRetryAt:0};records[id].attemptSnapshot=entry.attempt;}}}catch(error){console.error('[JFT result delivery] completion restore failed',error);}
  const listeners=new Set(),inFlight=new Map();
  const persist=()=>{try{const latest=JSON.parse(storage.getItem(OUTBOX_KEY)||'{}');if(latest&&typeof latest==='object'&&!Array.isArray(latest))records={...latest,...records};storage.setItem(OUTBOX_KEY,JSON.stringify(records));return true;}catch(error){console.error('[JFT result delivery] outbox storage failed',error);return false;}};
  const trace=(record,phase,details={})=>{record.events=[...(record.events||[]),{at:now(),phase,...details}].slice(-40);persist();notify();};
  const notify=()=>listeners.forEach(fn=>{try{fn();}catch{}});
  const queue=(payload,attemptSnapshot=null)=>{
    if(!records[payload.attemptId])records[payload.attemptId]={status:'pending',retryCount:0,nextRetryAt:0};
    const record=records[payload.attemptId];
    if(record.payload&&JSON.stringify(record.payload)!==JSON.stringify(payload))throw Error('Attempt payload changed; the original completed result was preserved.');
    record.payload=JSON.parse(JSON.stringify(payload));if(attemptSnapshot)record.attemptSnapshot=JSON.parse(JSON.stringify(attemptSnapshot));
    try{writeCompletedResult(storage,record.payload,record.attemptSnapshot||null);record.storageError=null;}catch(error){record.storageError=error.message;record.status='pending';notify();throw error;}
    // Compatibility copy for earlier diagnostic pages; the verified completion is authoritative.
    try{let prepared=JSON.parse(storage.getItem(PREPARED_KEY)||'{}');prepared[payload.attemptId]=record.payload;storage.setItem(PREPARED_KEY,JSON.stringify(prepared));}catch(error){console.warn('[JFT result delivery] diagnostic copy storage failed',error);}
    if(record.status==='sending'&&!inFlight.has(payload.attemptId))record.status='pending';
    trace(record,'completion-write-verified',{answersCount:payload.answers.length,correctAnswers:payload.correctAnswers,mockScore:payload.mockScore});
    return record;
  };
  async function send(id,force=false){
    if(inFlight.has(id))return inFlight.get(id);
    const record=records[id];if(!record)return;if(record.status==='sent'&&!force){trace(record,'skip-local-sent');return;}if(!validWebAppUrl(endpoint)){trace(record,'invalid-endpoint');return;}if(!force&&record.nextRetryAt>now()){trace(record,'retry-scheduled',{nextRetryAt:record.nextRetryAt});return;}
    try{writeCompletedResult(storage,record.payload,record.attemptSnapshot||null);record.storageError=null;}catch(error){record.storageError=error.message;record.status='pending';notify();return;}
    const wasSent=record.status==='sent';
    const task=(async()=>{record.status='sending';record.lastError=null;trace(record,'send-start');try{
      // A previous POST may have succeeded even when its acknowledgement was lost.
      let saved=false;
      const issue=(phase,error)=>{record.lastError={phase,message:String(error?.message||error),at:now()};console.warn('[JFT result delivery]',phase,record.lastError.message);trace(record,phase+'-error',{message:record.lastError.message});};
      // Fresh submissions POST immediately. Only retries check for a lost acknowledgement first.
      if(record.postAttempted||wasSent){trace(record,'retry-check-start');try{saved=await checkSaved(endpoint,id);trace(record,'retry-check-result',{saved});}catch(error){issue('retry-status',error);}}
      if(!saved){
        record.postAttempted=true;record.lastPostAt=now();trace(record,'post-start',{endpoint});
        try{try{storage.setItem(LAST_POST_KEY,JSON.stringify({attemptId:id,postedAt:now(),payload:record.payload}));}catch(error){console.warn('[JFT result delivery] diagnostic storage unavailable',error.message);}await post(endpoint,record.payload);trace(record,'post-returned',{note:'opaque response is not a save acknowledgement'});}catch(error){issue('post',error);}
        for(const delay of confirmationDelays){await wait(delay);trace(record,'confirm-check-start');try{saved=await checkSaved(endpoint,id);trace(record,'confirm-check-result',{saved});}catch(error){issue('confirm-status',error);}if(saved)break;}
      }
      if(!saved)throw Error('Save not confirmed');
      trace(record,'saved-confirmed');records[id]={status:'sent',savedAt:now(),events:record.events,payload:record.payload,attemptSnapshot:record.attemptSnapshot||null,postAttempted:record.postAttempted};persist();
    }catch(error){if(!record.lastError)record.lastError={phase:'confirmation',message:String(error?.message||error),at:now()};record.status='pending';record.retryCount=(record.retryCount||0)+1;record.nextRetryAt=now()+Math.min(300000,30000*2**Math.min(record.retryCount-1,4));trace(record,'pending-retained',{nextRetryAt:record.nextRetryAt});}finally{notify();}})();
    inFlight.set(id,task);try{await task;}finally{inFlight.delete(id);}
  }
  async function flush(force=false){for(const [id,record]of Object.entries(records))if(record.status!=='sent')await send(id,force);}
  return {queue,send,flush,get:id=>records[id],completedAttempt:id=>{try{return JSON.parse(storage.getItem(COMPLETIONS_KEY)||'{}')[id]?.attempt||null;}catch{return null;}},subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},configured:validWebAppUrl(endpoint)};
}
