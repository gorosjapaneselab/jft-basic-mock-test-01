// Entire MP3 is fetched and decoded before a one-second settling delay.
// Playback uses an in-memory buffer, so it cannot stall waiting for network chunks.
export class AudioPlayer {
  constructor({contextFactory=()=>new (window.AudioContext||window.webkitAudioContext)(),fetchAudio=(...args)=>fetch(...args),delayMs=1000,timeoutMs=30000}={}) {
    this.contextFactory=contextFactory;this.fetchAudio=fetchAudio;this.delayMs=delayMs;this.timeoutMs=timeoutMs;this.context=null;this.cache=new Map();this.status='idle';this.operation=null;
  }
  cancel(){const op=this.operation;this.operation=null;this.status='idle';if(!op)return;op.abort.abort();clearTimeout(op.timeout);if(op.source){op.source.onended=null;try{op.source.stop();}catch{}op.source.disconnect();}}
  async play(url,callbacks={}){
    if(this.status!=='idle')return false;
    const op={abort:new AbortController(),source:null,timeout:null};this.operation=op;this.status='preparing';
    const current=()=>this.operation===op&&!op.abort.signal.aborted;
    const state=value=>{this.status=value;callbacks.onState?.(value);};
    try{
      state('preparing');
      this.context??=this.contextFactory();
      // Resume during the original tap, before asynchronous loading (important on iOS).
      const resumed=this.context.resume();
      op.timeout=setTimeout(()=>op.abort.abort(),this.timeoutMs);
      const aborted=new Promise((_,reject)=>op.abort.signal.addEventListener('abort',()=>reject(new Error('Audio preparation cancelled or timed out.')),{once:true}));
      const stage=promise=>Promise.race([promise,aborted]);
      await stage(resumed);
      let buffer=this.cache.get(url);
      if(!buffer){const response=await stage(this.fetchAudio(url,{signal:op.abort.signal}));if(!response.ok)throw Error('Audio download failed.');const bytes=await stage(response.arrayBuffer());buffer=await stage(this.context.decodeAudioData(bytes));if(!current())return false;if(!Number.isFinite(buffer.duration)||buffer.duration<=0)throw Error('Invalid audio.');this.cache.set(url,buffer);}
      clearTimeout(op.timeout);
      await new Promise((resolve,reject)=>{const timer=setTimeout(resolve,this.delayMs);op.abort.signal.addEventListener('abort',()=>{clearTimeout(timer);reject(new Error('Cancelled'));},{once:true});});
      if(!current())return false;
      if(this.context.state!=='running')throw Error('Audio could not start. Tap Play Audio again.');
      const source=this.context.createBufferSource();op.source=source;source.buffer=buffer;source.connect(this.context.destination);
      source.onended=()=>{if(!current())return;source.disconnect();this.operation=null;this.status='idle';callbacks.onState?.('idle');callbacks.onEnded?.();};
      source.start(0,0); // Offset zero, using the fully decoded original audio.
      callbacks.onStarted?.(buffer.duration);state('playing');return true;
    }catch(error){clearTimeout(op.timeout);if(this.operation!==op)return false;this.cancel();callbacks.onState?.('idle');callbacks.onError?.(error);return false;}
  }
}
