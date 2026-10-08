// Uses the v16 authenticated iframe transport; no exam/result dependencies.
export const SCHEDULE_PENDING_KEY='jft-basic:schedules-pending:v1';
const uuid=()=>crypto.randomUUID();
const validId=id=>typeof id==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(id);
// Legacy import reference is optional. Only exact blank representations are unset.
const validLegacyId=id=>id===null||id===undefined||id===''||validId(id);
export function validSchedule(r,schoolId){return r&&validId(r.scheduleId)&&r.schoolId===schoolId&&typeof r.teacherId==='string'&&r.testId==='JFT-MOCK-01'&&typeof r.testName==='string'&&!!r.testName.trim()&&Array.isArray(r.classIds)&&r.classIds.length>0&&r.classIds.every(validId)&&new Set(r.classIds).size===r.classIds.length&&['enabled','disabled'].includes(r.status)&&typeof r.timeZone==='string'&&!!r.timeZone&&Number.isFinite(Date.parse(r.createdAt))&&Number.isFinite(Date.parse(r.updatedAt))&&((r.openAt===null&&r.closeAt===null)||(Number.isFinite(Date.parse(r.openAt))&&Number.isFinite(Date.parse(r.closeAt))&&Date.parse(r.closeAt)>Date.parse(r.openAt)))&&validLegacyId(r.legacyAssessmentId);}
// Report only fixed field names and row numbers, never credentials or response values.
export function validateSchedulesResponse(r,schoolId){
  const fail=detail=>{throw Error('Schedules response is invalid. '+detail);};
  if(r?.schoolId!==schoolId)fail('SCHEDULE_SCOPE: schoolId does not match.');
  if(!Array.isArray(r.schedules))fail(Array.isArray(r.classes)?'SCHEDULE_ROUTE: received Classes data instead of Schedules data.':'SCHEDULE_SHAPE: schedules must be an array.');
  const seen=new Set();
  r.schedules.forEach((s,index)=>{
    if(!validSchedule(s,schoolId)){
      const fields=[];
      if(!s||typeof s!=='object')fields.push('record');
      else{
        if(!validId(s.scheduleId))fields.push('scheduleId');
        if(s.schoolId!==schoolId)fields.push('schoolId');
        if(typeof s.teacherId!=='string')fields.push('teacherId');
        if(s.testId!=='JFT-MOCK-01')fields.push('testId');
        if(typeof s.testName!=='string'||!s.testName.trim())fields.push('testName');
        if(!Array.isArray(s.classIds)||!s.classIds.length||!s.classIds.every(validId)||new Set(s.classIds).size!==s.classIds.length)fields.push('classIds');
        if(!['enabled','disabled'].includes(s.status))fields.push('status');
        if(typeof s.timeZone!=='string'||!s.timeZone)fields.push('timeZone');
        for(const field of ['createdAt','updatedAt'])if(!Number.isFinite(Date.parse(s[field])))fields.push(field);
        if(!((s.openAt===null&&s.closeAt===null)||(Number.isFinite(Date.parse(s.openAt))&&Number.isFinite(Date.parse(s.closeAt))&&Date.parse(s.closeAt)>Date.parse(s.openAt))))fields.push('openAt/closeAt');
        if(!validLegacyId(s.legacyAssessmentId))fields.push('legacyAssessmentId');
      }
      fail('SCHEDULE_RECORD: item '+(index+1)+' has invalid '+fields.join(', ')+'.');
    }
    if(seen.has(s.scheduleId))fail('SCHEDULE_DUPLICATE: duplicate scheduleId at item '+(index+1)+'.');
    seen.add(s.scheduleId);
  });
}
export function createSchedulesClient({identity,credential,storage,transport}){
  const key=SCHEDULE_PENDING_KEY+':'+identity.schoolId+':'+identity.teacherId;let busy=null;
  const persist=operation=>{const raw=JSON.stringify(operation);storage.setItem(key,raw);if(storage.getItem(key)!==raw)throw Error('Schedule could not be saved locally. No new request was sent.');};
  function pending(){const raw=storage.getItem(key);if(!raw)return null;const op=JSON.parse(raw);if(op.schoolId!==identity.schoolId||op.teacherId!==identity.teacherId||!validId(op.scheduleId)||!validId(op.operationId))throw Error('Pending Schedule data is invalid or belongs to another teacher. It was preserved.');return op;}
  async function call(input){const access=credential();if(!access)throw Error('Connect using your Classes access key first.');const r=await transport.request({...input,...identity,api:'schedules',credential:access});if(!r?.ok)throw Object.assign(Error(r?.error||'Schedule request failed.'),{rejectedWithoutWrite:r?.canDiscard===true});return r;}
  async function list(){const r=await call({action:'list'});validateSchedulesResponse(r,identity.schoolId);return r.schedules;}
  async function send(op){op.rejectedWithoutWrite=false;persist(op);let r;try{r=await call(op);}catch(e){if(e.rejectedWithoutWrite){op.rejectedWithoutWrite=true;persist(op);}throw e;}
    if(r.confirmed!==true||r.operationId!==op.operationId||!validSchedule(r.schedule,identity.schoolId)||r.schedule.scheduleId!==op.scheduleId)throw Error('Schedule save was not confirmed.');
    if(['create','update','import'].includes(op.action)){for(const k of ['testId','testName','classIds','openAt','closeAt','timeZone'])if(JSON.stringify(r.schedule[k])!==JSON.stringify(k==='testName'?op[k].trim():op[k]??null))throw Error('Saved Schedule did not match the requested '+k+'.');}
    const status=op.action==='disable'?'disabled':['create','enable','import'].includes(op.action)?'enabled':null;if(status&&r.schedule.status!==status)throw Error('Saved Schedule status did not match.');
    storage.removeItem(key);return r.schedule;
  }
  function mutate(action,input){if(busy)return busy;try{if(!['create','update','disable','enable','import'].includes(action))throw Error('Invalid Schedule action.');if(pending())throw Error('Retry the pending Schedule save first.');const op={...input,action,...identity,operationId:uuid()};if(action==='create')op.scheduleId=uuid();if(!validId(op.scheduleId))throw Error('Schedule ID is missing or invalid.');persist(op);busy=send(op).finally(()=>busy=null);return busy;}catch(e){return Promise.reject(e);}}
  function retry(){if(busy)return busy;try{const op=pending();if(!op)throw Error('No pending Schedule save.');busy=send(op).finally(()=>busy=null);return busy;}catch(e){return Promise.reject(e);}}
  function discardRejected(){if(busy||pending()?.rejectedWithoutWrite!==true)throw Error('Only a server-confirmed rejected change can be discarded. Retry uncertain saves.');storage.removeItem(key);}
  return {list,mutate,retry,pending,discardRejected};
}
