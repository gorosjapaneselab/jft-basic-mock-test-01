import {STUDENT_FIELDS} from './config.js';
export const TEST = Object.freeze({id:'jft-basic-01', title:'JFT-Basic Mock Test 01', durationMs:3600000, maxPlays:2, dataUrl:'data/questions.json', audioManifestUrl:'data/audio.json', sections:['Script and Vocabulary','Conversation and Expression','Listening Comprehension','Reading Comprehension']});
export function validateQuestions(qs) {
  const errors=[];
  if (!Array.isArray(qs) || qs.length!==50) return ['Exactly 50 questions are required.'];
  qs.forEach((q,i)=>{
    const id=`Q${String(i+1).padStart(2,'0')}`,section=i<12?1:i<25?2:i<38?3:4;
    if(q.id!==id||q.section!==section) errors.push(`${id}: invalid ID or section.`);
    for(const key of ['instruction','question','category','difficulty','source','explanation']) if(typeof q[key]!=='string') errors.push(`${id}: invalid ${key}.`);
    if(!q.question?.trim()) errors.push(`${id}: empty question.`);
    for(const key of ['material','audioScript']) if(q[key]!==null&&typeof q[key]!=='string') errors.push(`${id}: invalid ${key}.`);
    if(!Array.isArray(q.choices)||q.choices.length!==4||q.choices.map(c=>c.id).sort().join(',')!=='c1,c2,c3,c4'||q.choices.some(c=>typeof c.text!=='string'||!c.text.trim())||!q.choices.some(c=>c.id===q.correctChoiceId)) errors.push(`${id}: invalid choices or correctChoiceId.`);
  });return errors;
}
export function shuffle(ids) {const a=[...ids];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
export function createAttempt(questions,student,now=Date.now()) {return {version:1,testId:TEST.id,student,startedAt:now,lastSeenAt:now,submittedAt:null,section:1,index:0,answers:[],choiceOrders:Object.fromEntries(questions.map(q=>[q.id,shuffle(q.choices.map(c=>c.id))])),listening:Object.fromEntries(questions.filter(q=>q.section===3).map(q=>[q.id,{audioFile:null,playCount:0,maxPlays:TEST.maxPlays}]))};}
export function remaining(attempt,now=Date.now()){return Math.max(0,TEST.durationMs-(Math.max(now,attempt.lastSeenAt)-attempt.startedAt));}
export function grade(questions,attempt){const selected=new Map(attempt.answers.map(a=>[a.questionId,a.selectedChoiceId]));const sections=TEST.sections.map((name,i)=>{const qs=questions.filter(q=>q.section===i+1),correct=qs.filter(q=>selected.get(q.id)===q.correctChoiceId).length;return {section:i+1,name,correct,total:qs.length,percent:Math.round(correct/qs.length*100)};});const correct=sections.reduce((n,s)=>n+s.correct,0);return {correct,score:Math.round(correct/50*250),sections,elapsedMs:Math.min(TEST.durationMs,Math.max(0,attempt.submittedAt-attempt.startedAt))};}
export function validAttempt(a,qs){if(!a||a.version!==1||a.testId!==TEST.id||!Number.isFinite(a.startedAt)||!Number.isFinite(a.lastSeenAt)||a.lastSeenAt<a.startedAt||!(a.submittedAt===null||Number.isFinite(a.submittedAt))||![1,2,3,4].includes(a.section)||!Number.isInteger(a.index)||a.index<0||a.index>=qs.length||qs[a.index].section!==a.section||!STUDENT_FIELDS.filter(f=>f.required).map(f=>f.key).every(k=>typeof a.student?.[k]==='string'&&a.student[k].trim())||!Array.isArray(a.answers))return false;return new Set(a.answers.map(x=>x.questionId)).size===a.answers.length&&a.answers.every(x=>qs.some(q=>q.id===x.questionId&&q.choices.some(c=>c.id===x.selectedChoiceId)))&&qs.every(q=>Array.isArray(a.choiceOrders?.[q.id])&&[...a.choiceOrders[q.id]].sort().join(',')==='c1,c2,c3,c4')&&qs.filter(q=>q.section===3).every(q=>Number.isInteger(a.listening?.[q.id]?.playCount)&&a.listening[q.id].playCount>=0&&a.listening[q.id].maxPlays===2);}
