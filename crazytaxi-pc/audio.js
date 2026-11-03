/* Audio starts only in a user gesture; PCM comes from the running AICA mixer. */
class DreamcastAudio {
 constructor(){this.context=null;this.node=null;this.gain=null;this.muted=false;this.stats={};this.recording=null;this.received=0;this.nonzero=0;this.initializing=null;}
 async start(){
  if(this.initializing)return this.initializing;
  const AudioContextType=window.AudioContext||window.webkitAudioContext;
  if(!AudioContextType)throw new Error('Web Audio is unavailable in this browser.');
  if(!this.context)this.context=new AudioContextType({latencyHint:'interactive'});
  const resume=this.context.resume();
  this.initializing=(async()=>{
   await resume;
   if(!this.node){await this.context.audioWorklet.addModule('audio-worklet.js');
    this.node=new AudioWorkletNode(this.context,'dreamcast-audio',{numberOfInputs:0,numberOfOutputs:1,outputChannelCount:[2]});
    this.gain=this.context.createGain();this.gain.gain.value=this.muted?0:.75;
    this.node.connect(this.gain).connect(this.context.destination);
    this.node.port.onmessage=event=>{this.stats=event.data;this.update();};
   }
   this.update();
  })();
  try{await this.initializing;}finally{this.initializing=null;}
 }
 update(){const e=document.querySelector('#audio-status');if(e)e.textContent=!this.context?'Sound: off':this.context.state!=='running'?'Sound: paused — tap Enable sound':this.muted?'Sound: muted':'Sound: on';}
 push(samples){
  this.received+=samples.length/2;for(let i=0;i<samples.length;i+=2)if(samples[i]||samples[i+1])this.nonzero++;
  const recording=this.recording;
  if(recording){const n=Math.min(samples.length,recording.remaining);recording.blocks.push(samples.slice(0,n));recording.remaining-=n;if(!recording.remaining)this.finishRecording();}
  if(this.node&&this.context.state==='running')this.node.port.postMessage({samples},[samples.buffer]);
 }
 toggle(){this.muted=!this.muted;if(this.gain)this.gain.gain.setTargetAtTime(this.muted?0:.75,this.context.currentTime,.01);this.update();return this.muted;}
 reset(){if(this.node)this.node.port.postMessage({reset:true});}
 record(){if(this.recording)return;this.recording={remaining:44100*8*2,blocks:[]};document.querySelector('#capture-audio').textContent='Recording game audio…';}
 finishRecording(){const recording=this.recording;if(!recording)return;this.recording=null;
  const count=recording.blocks.reduce((n,b)=>n+b.length,0),buffer=new ArrayBuffer(44+count*2),v=new DataView(buffer);
  const text=(at,s)=>{for(let i=0;i<s.length;i++)v.setUint8(at+i,s.charCodeAt(i));};
  text(0,'RIFF');v.setUint32(4,36+count*2,true);text(8,'WAVEfmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,2,true);v.setUint32(24,44100,true);v.setUint32(28,176400,true);v.setUint16(32,4,true);v.setUint16(34,16,true);text(36,'data');v.setUint32(40,count*2,true);
  let at=44;for(const block of recording.blocks)for(const sample of block){v.setInt16(at,Math.max(-32768,Math.min(32767,Math.round(sample*32767))),true);at+=2;}
  const url=URL.createObjectURL(new Blob([buffer],{type:'audio/wav'})),link=document.createElement('a');link.href=url;link.download='dreamcast-game-audio.wav';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);document.querySelector('#capture-audio').textContent='Capture 8 seconds of game audio';
 }
}
const portAudio=new DreamcastAudio();
document.querySelector('#enable-audio')?.addEventListener('click',()=>portAudio.start().catch(error=>{document.querySelector('#audio-status').textContent='Sound: '+error.message;}));
document.querySelector('#mute-audio')?.addEventListener('click',event=>{event.currentTarget.textContent=portAudio.toggle()?'Unmute':'Mute';});
document.querySelector('#capture-audio')?.addEventListener('click',()=>portAudio.record());
document.addEventListener('visibilitychange',()=>{if(document.hidden)portAudio.reset();});
