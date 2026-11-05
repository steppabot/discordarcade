/* DOM stays responsive while WebAssembly and OffscreenCanvas run in a worker. */
class PortWorkerRuntime {
 constructor(canvas,callbacks){this.canvas=canvas;this.callbacks=callbacks;this.worker=null;this.ready=false;this.bits=0;this.values=[0,0,0,0,0];this.lastSent='';this.inputQueue=[];this.inputSequence=0;this.inputInFlight=null;this.inputCoalesced=0;this.inputDropped=0;}
 start(){
  if(this.worker)return;
  if(typeof Worker==='undefined'||typeof this.canvas.transferControlToOffscreen!=='function')throw new Error('This build requires Web Workers and WebGL OffscreenCanvas (Safari 17 or newer).');
  this.worker=new Worker('runtime-worker.js?v=5');   // ?v: a new release never mixes with cached files
  this.worker.onmessage=event=>{const data=event.data;
   if(data.kind==='ready'){if(data.build)this.callbacks.build?.(data.build);this.ready=true;this.canvas.dataset.runtime='ready';this.callbacks.ready();this.flush(true);}
   else if(data.kind==='input-applied'){this.canvas.dataset.inputApplied=String(data.bits);if(data.bits)this.canvas.dataset.lastPressed=String(data.bits);if(data.sequence===this.inputInFlight){this.inputInFlight=null;this.sendInput();}}
   else if(data.kind==='logs'){for(const line of data.lines)this.callbacks.log(line);}
   else if(data.kind==='benchmark')this.callbacks.benchmark?.(data.result);
   else if(data.kind==='vram')this.callbacks.vram?.(data.bytes);
   else if(data.kind==='snapshot')this.callbacks.snapshot?.(data.bytes);
   else if(data.kind==='frame')this.callbacks.frame?.(data.bytes);
   else if(data.kind==='vmu-status'||data.kind==='vmu-lcd')this.callbacks.vmu?.(data);
   else if(data.kind==='audio')this.callbacks.audio(data.samples);
   else if(data.kind==='error')this.callbacks.error(data.message);
   else if(data.kind==='disc-progress')this.callbacks.discProgress?.(data);
   else if(data.kind==='disc-ready')this.callbacks.discReady?.();
  };
  this.worker.onerror=event=>this.callbacks.error(event.message||'Worker failed to load.');
  this.worker.onmessageerror=()=>this.callbacks.error('A worker message could not be decoded.');
  const canvas=this.canvas.transferControlToOffscreen();this.worker.postMessage({kind:'start',canvas,discBase:this.callbacks.discBase},[canvas]);
 }
 button(bit,pressed){this.bits=pressed?this.bits|bit:this.bits&~bit;}
 axes(left,right,x,y){this.values=[this.bits,left,right,x,y];this.flush();}
 flush(force=false){
  const signature=this.values.join(',');if(!this.ready||(!force&&signature===this.lastSent))return;this.lastSent=signature;
  const values=this.values.slice(),tail=this.inputQueue.at(-1);
  // Keep digital edges during normal play; replace redundant analog samples.
  if(tail&&tail[0]===values[0]){this.inputQueue[this.inputQueue.length-1]=values;this.inputCoalesced++;}
  else{if(this.inputQueue.length===16){this.inputQueue.shift();this.inputDropped++;}this.inputQueue.push(values);}
  this.sendInput();
 }
 sendInput(){if(this.inputInFlight!==null||!this.inputQueue.length)return;const sequence=++this.inputSequence;this.inputInFlight=sequence;this.worker.postMessage({kind:'input',values:this.inputQueue.shift(),sequence});}
 pause(value){if(this.ready)this.worker.postMessage({kind:'pause',value});}
 replay(steps){if(this.ready)this.worker.postMessage({kind:'replay',steps});}
 measure(){if(this.ready)this.worker.postMessage({kind:'benchmark'});}
 pulse(values,duration){if(this.ready)this.worker.postMessage({kind:'pulse',values,duration});}
 mode(value){if(this.ready)this.worker.postMessage({kind:'render-mode',value});}
 snapshot(){if(this.ready)this.worker.postMessage({kind:'capture-snapshot'});}
 vram(){if(this.ready)this.worker.postMessage({kind:'capture-vram'});}
 frame(){if(this.ready)this.worker.postMessage({kind:'capture-frame'});}
 capture(){if(this.worker&&this.ready)this.worker.postMessage({kind:'capture-render'});}
}
