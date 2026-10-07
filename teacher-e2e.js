// Unlinked teacher-only entry. No alternate grading, payload builder or transport.
export const TEACHER_E2E_HASH='#teacher-e2e-9-75b3cc6d0ea24a30';
export function e2eAllowed(hash,attempt){return hash===TEACHER_E2E_HASH&&attempt?.teacherE2E===true&&!attempt.submittedAt;}
export function completionEvidence(storage,key,attempt,result,record){
  const read=k=>JSON.parse(storage.getItem(k)||'null');
  const saved=read(key),entry=read('jft-basic:completed-results:v1')?.[attempt.attemptId],post=read('jft-basic:result-last-post:v1');
  const p=entry?.payload,selected=new Map(attempt.answers.map(answer=>[answer.questionId,answer.selectedChoiceId]));
  return {attemptId:attempt.attemptId,name:attempt.student.rawName??attempt.student.name,classSection:attempt.student.className,
    correctAnswers:result.correct,mockScore:result.score,elapsedSeconds:Math.floor(result.elapsedMs/1000),answeredQuestions:attempt.answers.length,
    completedAttemptSaved:!!saved?.submittedAt&&saved.attemptId===attempt.attemptId&&saved.student.name===attempt.student.name&&saved.student.className===attempt.student.className&&saved.startedAt===attempt.startedAt&&saved.submittedAt===attempt.submittedAt&&JSON.stringify(saved.answers)===JSON.stringify(attempt.answers),
    payloadSaved:!!p&&p.attemptId===attempt.attemptId&&p.answers?.length===50&&p.answers.every(answer=>answer.selectedChoiceId===(selected.get(answer.questionId)??null))&&p.correctAnswers===result.correct&&p.mockScore===result.score&&p.name===(attempt.student.rawName??attempt.student.name)&&p.classSection===attempt.student.className,
    snapshotSaved:!!entry?.attempt?.submittedAt&&JSON.stringify(entry.attempt.answers)===JSON.stringify(attempt.answers),
    postRecorded:post?.attemptId===attempt.attemptId&&!!p&&JSON.stringify(post.payload)===JSON.stringify(p),
    serverSaveConfirmed:record?.status==='sent'&&record.events?.some(e=>e.phase==='saved-confirmed')===true,
    postAttemptsRecorded:record?.events?.filter(e=>e.phase==='post-start').length||0,
    deliveryStatus:record?.status||'not queued',lastError:record?.lastError||record?.storageError||null};
}
export function setupTeacherE2E({app,storage,storageKey,getAttempt,getResult,getRecord,subscribe,confirmFinish,finish,retrySameAttempt}){
  let inspectCurrent=()=>{};
  const make=(tag,text)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;return node;};
  function render(){
    if(location.hash!==TEACHER_E2E_HASH)return;
    if(document.getElementById('teacher-e2e-controls'))return;
    inspectCurrent=()=>{};
    const a=getAttempt(),panel=make('section');panel.id='teacher-e2e-controls';panel.className='card';
    panel.append(make('h2','Teacher E2E check · v9'));
    const exit=make('a','Return to normal mode');exit.href='index.html';const exitRow=make('p');exitRow.append(exit);
    if(!a){panel.append(make('p','Enter an E2E Name and Class above, then Start Test. Answer 1–3 questions and use Finish E2E check below. The other questions remain unanswered. Scoring is still out of 50 / 250. No answers are filled automatically.'),exitRow);}
    else if(a.teacherE2E!==true){panel.append(make('p','An existing attempt is open. The shortcut is disabled and its data has not been changed. Use another browser profile for a separate E2E attempt, or return to normal mode.'),exitRow);}
    else if(!a.submittedAt){
      panel.append(make('p','Attempt ID: '+a.attemptId));const end=make('button','Finish E2E check');end.type='button';
      end.onclick=()=>{const current=getAttempt();if(!e2eAllowed(location.hash,current))return;confirmFinish('Finish teacher E2E check?',`${current.answers.length} answered; ${50-current.answers.length} unanswered. The normal Submit Test processing will run and save an E2E row to your teacher’s Sheets.`,()=>{if(e2eAllowed(location.hash,getAttempt()))finish();},'Submit Test');};
      panel.append(end,exitRow);
    }else{
      panel.append(make('p','This is the normal Result screen and the normal saved attempt. Check the evidence below, then check the matching Attempt ID in Sheets.'));
      const evidence=make('pre');evidence.style.whiteSpace='pre-wrap';evidence.style.overflowWrap='anywhere';const state=make('p');
      function inspect(){if(!panel.isConnected)return;try{const data=completionEvidence(storage,storageKey,getAttempt(),getResult(),getRecord(a.attemptId));evidence.textContent=JSON.stringify(data,null,2);state.textContent=data.serverSaveConfirmed?'Server save confirmed. Verify this Attempt ID in Sheets.':'Server save not confirmed yet. The Result status and Retry saving use the normal delivery process.';}catch(error){state.textContent='Evidence read failed: '+error.message;}}
      const refresh=make('button','Check local evidence');refresh.type='button';refresh.onclick=inspect;
      const retry=make('button','Recheck / retry same Attempt');retry.type='button';retry.onclick=async()=>{retry.disabled=true;try{await retrySameAttempt();}catch(error){state.textContent='Retry failed: '+error.message;}finally{retry.disabled=false;inspect();}};
      const diagnostic=make('a','Open normal result diagnostic');diagnostic.href='result-send-test.html';
      const refreshRow=make('p'),retryRow=make('p'),diagnosticRow=make('p');refreshRow.append(refresh);retryRow.append(retry);diagnosticRow.append(diagnostic);
      panel.append(state,evidence,refreshRow,retryRow,diagnosticRow,exitRow);inspectCurrent=inspect;
    }
    app.append(panel);inspectCurrent();
  }
  subscribe?.(()=>inspectCurrent());
  new MutationObserver(render).observe(app,{childList:true});render();
}
