import {createAttempt,grade} from './core.js';
import {resultPayload} from './result-delivery.js?payload-v=3';
export function createTestPayload(questions,name,className,config,now=Date.now()){
 const a=createAttempt(questions,{name:name.trim(),rawName:name,className:className.trim()},now-90000);
 a.submittedAt=now;
 a.answers=questions.slice(0,40).map((q,i)=>({questionId:q.id,selectedChoiceId:i<30?q.correctChoiceId:q.choices.find(c=>c.id!==q.correctChoiceId).id}));
 return resultPayload(questions,a,grade(questions,a),config);
}
