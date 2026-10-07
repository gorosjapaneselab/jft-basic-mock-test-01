// Diagnostic controls bind before loading any optional modules or starting network requests.
const OUTBOX_KEY='jft-basic:result-outbox:v1',LAST_POST_KEY='jft-basic:result-last-post:v1',COMPLETIONS_KEY='jft-basic:completed-results:v1',ATTEMPT_KEY='jft-basic-01:attempt:v1';
const status=document.querySelector('#status'),logs=[];let payload=null,depsPromise=null,postResult,checkSavedJsonp,sending=false;
function log(message){logs.push(new Date().toISOString()+' '+message);status.textContent=logs.join('\n');}
function read(key){const value=localStorage.getItem(key);return value?JSON.parse(value):null;}
function showPayload(p){document.querySelector('#payload').textContent=JSON.stringify(p,null,2);document.querySelector('#expected').textContent=JSON.stringify({attemptId:p.attemptId,name:p.name,classSection:p.classSection,correctAnswers:p.correctAnswers,mockScore:p.mockScore,elapsedSeconds:p.elapsedSeconds,parts:p.parts,answersCount:p.answers?.length},null,2);}
async function deps(){if(!depsPromise)depsPromise=Promise.all([import('./core.js'),import('./result-delivery.js?durable-v=8'),import('./result-delivery-config.js?send-v=2')]).then(([core,delivery,config])=>{postResult=delivery.postResult;checkSavedJsonp=delivery.checkSavedJsonp;return {core,delivery,config:config.RESULT_DELIVERY};}).catch(error=>{depsPromise=null;throw error;});return depsPromise;}
function bind(id,action){const button=document.getElementById(id);if(!button)return;button.disabled=false;button.onclick=()=>{log('Click: '+id);Promise.resolve().then(action).catch(error=>log('Error ['+id+']: '+error.name+' '+error.message));};}
function localCurrent(){const a=read(ATTEMPT_KEY);if(!a?.submittedAt)throw Error('本番の保存キー '+ATTEMPT_KEY+' に完了済み受験結果がありません。Result表示だけではローカル保存成功を意味しません。');const completed=read(COMPLETIONS_KEY)||{};return {attempt:completed[a.attemptId]?.attempt||a,entry:completed[a.attemptId]||null};}
async function current(){const {attempt:a,entry}=localCurrent();if(entry?.payload){payload=entry.payload;showPayload(payload);log('完了記録から読み取り: '+payload.attemptId);return payload;}log('元の受験データを読み取りました。採点データを読み込んでいます。');const d=await deps(),questions=await(await fetch(d.core.TEST.dataUrl)).json();if(!d.core.validAttempt(a,questions))throw Error('保存済み受験データが不正です。データは変更していません。');const result=d.core.grade(questions,a);if(!a.attemptId){payload=null;document.querySelector('#expected').textContent=JSON.stringify({name:a.student.name,classSection:a.student.className,correctAnswers:result.correct,mockScore:result.score,elapsedSeconds:Math.floor(result.elapsedMs/1000),attemptId:null},null,2);document.querySelector('#payload').textContent=JSON.stringify(a,null,2);throw Error('元データにAttempt IDがありません。診断ページでは新しいIDを作りません。');}payload=d.delivery.resultPayload(questions,JSON.parse(JSON.stringify(a)),result,d.config);showPayload(payload);log('通常受験のデータ読み取り完了: '+payload.attemptId);return payload;}
async function sendCaptured(p){if(sending){log('送信処理は既に実行中です。確認・コピーは引き続き使えます。');return;}sending=true;const buttons=['send','retry','replay-posted','replay-current'].map(id=>document.getElementById(id)).filter(Boolean);buttons.forEach(b=>b.disabled=true);try{const d=await deps(),immutable=JSON.parse(JSON.stringify(p));const r=await replayStoredPost({storage:{getItem:key=>key===LAST_POST_KEY?JSON.stringify({payload:immutable}):null},endpoint:d.config.webAppUrl,onPayload:body=>{showPayload(body);log('POST payload: '+JSON.stringify(body));},onState:message=>{log(message);const node=document.getElementById('replay-status');if(node)node.textContent=message;}});if(r.postError)log('POST error: '+r.postError);if(r.confirmationError)log('Confirmation error: '+r.confirmationError);}finally{sending=false;buttons.forEach(b=>b.disabled=false);}}
window.addEventListener('error',event=>log('Runtime error: '+event.message));window.addEventListener('unhandledrejection',event=>log('Unhandled error: '+String(event.reason?.message||event.reason)));
bind('actual',current);
bind('posted',()=>{const capture=read(LAST_POST_KEY);if(!capture?.payload)throw Error('通常POST記録がありません。受験完了記録の有無は「実際の受験結果を確認」で確認できます。');payload=capture.payload;showPayload(payload);log('POST記録: '+payload.attemptId);});
bind('current-diagnosis',()=>{const a=read(ATTEMPT_KEY),complete=read(COMPLETIONS_KEY)||{},box=read(OUTBOX_KEY)||{};const record=a?.attemptId?box[a.attemptId]:null;const info={origin:location.origin,attemptKey:ATTEMPT_KEY,attemptExists:!!a,submittedAt:a?.submittedAt||null,attemptId:a?.attemptId||null,completedIds:Object.keys(complete),completedCurrent:!!complete[a?.attemptId],status:record?.status||null,storageError:record?.storageError||null,lastError:record?.lastError||null,events:record?.events||[]};const node=document.getElementById('diagnosis');if(node)node.textContent=JSON.stringify(info,null,2);log(JSON.stringify(info));});
bind('replay-posted',async()=>{const capture=read(LAST_POST_KEY);if(!capture?.payload)throw Error('保存済みPOSTデータがありません。');await sendCaptured(capture.payload);});
bind('replay-current',async()=>sendCaptured(await current()));
bind('preview',async()=>{const name=document.getElementById('name').value,className=document.getElementById('class').value;if(!name.trim()||!className.trim())throw Error('NameとClassを入力してください。');const d=await deps(),questions=await(await fetch(d.core.TEST.dataUrl)).json(),helper=await import('./result-test-data.js?payload-v=3');payload=helper.createTestPayload(questions,name,className,d.config);showPayload(payload);log('開発用payloadを作成しました。通常受験の保存データは変更していません。');});
bind('send',()=>{if(!payload)throw Error('送信対象payloadがありません。');return sendCaptured(payload);});bind('retry',()=>{if(!payload)throw Error('再送対象payloadがありません。');return sendCaptured(payload);});
bind('copy',async()=>{try{await navigator.clipboard.writeText(status.textContent+'\n'+document.querySelector('#payload').textContent);log('診断ログをコピーしました。');}catch{log('コピーできません。表示ログを選択してコピーしてください。');}});
document.getElementById('config').textContent='Build: durable-v8 | Storage origin: '+location.origin;
log('Diagnostic handlers bound / Ready (network not required)');
export async function replayStoredPost({storage,endpoint,post=postResult,check=checkSavedJsonp,wait=ms=>new Promise(r=>setTimeout(r,ms)),onPayload=()=>{},onState=()=>{}}){
 const capture=JSON.parse(storage.getItem(LAST_POST_KEY)||'null');
 if(!capture?.payload)throw Error('直近の通常受験POSTデータがありません。受験した同じブラウザで開いてください。');
 const original=capture.payload;
 if(typeof original.attemptId!=='string'||!original.attemptId||!Array.isArray(original.answers)||original.answers.length!==50)throw Error('保存されたPOSTデータの形式を確認できません。内容を変更せず、再送を中止しました。');
 onPayload(original);onState('POST送信中（元のAttempt IDを維持）…');
 let postError=null,confirmationError=null;
 try{await post(endpoint,original);}catch(error){postError=error;}
 // Always issue POST, even if a previous local sent marker exists.
 // An opaque fetch response alone is not proof of a saved row.
 for(const delay of [1200,2500,5000]){
  await wait(delay);onState('Apps Scriptの保存確認を待っています…');
  try{if(await check(endpoint,original.attemptId)){onState('保存確認成功（Saved confirmed）。同じAttempt IDの行をSheetsで確認してください。既存行がある場合は重複追加しません。');return {saved:true,payload:original};}}catch(error){confirmationError=error;}
 }
 const message=postError?'POST通信失敗。保存確認も取得できませんでした。':'POST処理は完了しましたが、保存確認を取得できませんでした。';
 onState(message+' 保存データはそのまま保持されています。');
 return {saved:false,payload:original,postError:postError?.message||null,confirmationError:confirmationError?.message||null};
}
