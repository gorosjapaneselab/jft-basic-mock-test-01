// Presentation only: no storage, authentication or API dependencies.
export function styleAction(element,label=element.textContent){
 const green=['Take a Test','Restore','Enable Schedule','Login'];
 const orange=['Edit','Rename','Import this draft','Import to Sheets','Discard rejected change'];
 const red=['Logout','Archive','Disable Schedule'];
 const gray=['Cancel Editing','Home','Back','Exit Fullscreen'];
 element.dataset.intent=green.includes(label)?'success':orange.includes(label)?'warning':red.includes(label)?'danger':gray.includes(label)?'neutral':'primary';
 return element;
}
export function installFullscreen({button,status,doc=document}){
 let busy=false;
 const update=()=>{button.textContent=doc.fullscreenElement?'Exit Fullscreen':'Fullscreen';button.setAttribute('aria-pressed',String(!!doc.fullscreenElement));styleAction(button);};
 button.onclick=async()=>{if(busy)return;busy=true;button.disabled=true;status.textContent='';try{if(doc.fullscreenElement){if(typeof doc.exitFullscreen!=='function')throw Error('unsupported');await doc.exitFullscreen();}else{if(typeof doc.documentElement.requestFullscreen!=='function')throw Error('unsupported');await doc.documentElement.requestFullscreen();}}catch{status.textContent='Fullscreen is unavailable in this browser or was blocked. You can continue using this screen normally.';}finally{busy=false;button.disabled=false;update();}};
 doc.addEventListener('fullscreenchange',update);update();
}
