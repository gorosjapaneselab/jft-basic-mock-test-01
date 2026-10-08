// Read-only Results client. Credentials travel only in authenticated bridge RPC.
const messages={RESULTS_AUTH:'The Classes access key is missing or incorrect. Enter the correct key and reconnect.',RESULTS_SCOPE:'This access key does not match the current school or teacher.',RESULTS_REQUEST:'The Results filter request is invalid. Check the date range and retry.',RESULTS_SETUP:'Results sheet or its 121-column headers could not be verified. Check the existing Sheet setup.',RESULTS_READ:'Google Sheets could not be read. Please retry.',RESULTS_SNAPSHOT:'The previous Results snapshot is no longer available. Press Refresh.'};
const failure=(code,message)=>Object.assign(Error(message),{code});
export function validateResultsResponse(r,schoolId){
 const validSummary=r?.summary&&Number.isInteger(r.summary.totalAttempts)&&r.summary.totalAttempts>=0&&((r.summary.totalAttempts===0&&r.summary.averageScore===null&&r.summary.highestScore===null)||(r.summary.totalAttempts>0&&Number.isFinite(r.summary.averageScore)&&r.summary.averageScore>=0&&r.summary.averageScore<=250&&Number.isInteger(r.summary.highestScore)&&r.summary.highestScore>=0&&r.summary.highestScore<=250));
 const validRecord=x=>x&&typeof x.attemptId==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(x.attemptId)&&['name','classSection','testId'].every(k=>typeof x[k]==='string'&&!!x[k].trim())&&typeof x.startedAt==='string'&&Number.isFinite(Date.parse(x.startedAt))&&Number.isInteger(x.correctAnswers)&&x.correctAnswers>=0&&x.correctAnswers<=50&&Number.isInteger(x.mockScore)&&x.mockScore>=0&&x.mockScore<=250&&x.percentage===Math.round(x.correctAnswers/50*100);
 if(r?.schoolId!==schoolId||r.readOnly!==true||r.timeZone!=='Asia/Manila'||!validSummary||!Number.isInteger(r.snapshotLastRow)||r.snapshotLastRow<1||!Number.isInteger(r.page)||r.page<1||!Number.isInteger(r.pageSize)||r.pageSize<1||r.pageSize>50||r.totalPages!==Math.max(1,Math.ceil(r.summary.totalAttempts/r.pageSize))||r.page>r.totalPages||!Array.isArray(r.records)||r.records.length!==Math.min(r.pageSize,Math.max(0,r.summary.totalAttempts-(r.page-1)*r.pageSize))||!r.records.every(validRecord)||!['classes','tests'].every(k=>Array.isArray(r.options?.[k])&&r.options[k].every(v=>typeof v==='string'))||!['incompleteRows','invalidRows'].every(k=>Number.isInteger(r[k])&&r[k]>=0))throw failure('RESULTS_INVALID','Results response is invalid. Verify that TeacherResults.gs and the Results bridge update are deployed.');
 return r;
}
export function createResultsClient({identity,credential,transport}){
 return {async list({filters={},page=1,snapshotLastRow=null}={}){
   const access=credential();if(!access)throw failure('RESULTS_AUTH',messages.RESULTS_AUTH);
   let r;try{r=await transport.request({api:'results',action:'list',...identity,credential:access,filters,page,pageSize:25,snapshotLastRow});}catch{throw failure('RESULTS_CONNECTION','Results connection failed or timed out. Check your internet connection and the existing Apps Script deployment, then retry.');}
   if(r?.ok!==true)throw failure(messages[r?.code]?r.code:'RESULTS_DEPLOYMENT',messages[r?.code]||'Results API is unavailable. Add TeacherResults.gs and update the existing Apps Script deployment.');
   return validateResultsResponse(r,identity.schoolId);
 }};
}
