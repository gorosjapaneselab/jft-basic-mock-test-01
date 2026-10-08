// Presentation only. Does not read or modify attempt data, timer or delivery.
const app=document.querySelector('#app'),home=document.querySelector('#exam-home-bar');
function updateHome(){home.hidden=!app.querySelector('.start, .results-student');const eyebrow=app.querySelector('.start .eyebrow');if(eyebrow?.textContent==='PRACTICE TEST 01')eyebrow.textContent='MOCK TEST 01';}
new MutationObserver(updateHome).observe(app,{childList:true,subtree:true});updateHome();
