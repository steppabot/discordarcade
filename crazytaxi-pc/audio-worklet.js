/* Bounded stereo ring, 44.1 kHz source -> device rate. No game-speed trim. */
class DreamcastAudioProcessor extends AudioWorkletProcessor {
 constructor(){super();this.capacity=16384;this.ring=new Float32Array(this.capacity*2);this.read=0;this.write=0;this.count=0;this.phase=0;this.primed=false;this.underruns=0;this.overruns=0;this.played=0;this.nonzero=0;this.last=0;
  this.port.onmessage=event=>{const d=event.data;if(d.reset){this.read=this.write=this.count=this.phase=0;this.primed=false;return;}
   const a=d.samples;if(!(a instanceof Float32Array)||a.length%2||a.length>this.capacity*2)return;
   const n=a.length/2;if(this.count+n>this.capacity){const drop=this.count+n-this.capacity;this.read=(this.read+drop)%this.capacity;this.count-=drop;this.phase=0;this.overruns++;}
   for(let i=0;i<n;i++){this.ring[this.write*2]=a[i*2];this.ring[this.write*2+1]=a[i*2+1];this.write=(this.write+1)%this.capacity;}this.count+=n;
  };
 }
 process(inputs,outputs){const channels=outputs[0];if(!channels||!channels[0])return true;
  const left=channels[0],right=channels[1]||channels[0];let starving=false;
  if(!this.primed&&this.count>=4096)this.primed=true;
  for(let i=0;i<left.length;i++){
   if(!this.primed||this.count<2){left[i]=right[i]=0;if(this.primed){this.primed=false;this.phase=0;starving=true;}continue;}
   const next=(this.read+1)%this.capacity,p=this.phase;
   const l=this.ring[this.read*2]*(1-p)+this.ring[next*2]*p,r=this.ring[this.read*2+1]*(1-p)+this.ring[next*2+1]*p;
   left[i]=l;right[i]=r;this.played++;if(l||r)this.nonzero++;
   this.phase+=44100/sampleRate;const advance=Math.floor(this.phase);this.phase-=advance;this.read=(this.read+advance)%this.capacity;this.count-=advance;
  }
  if(starving)this.underruns++;
  this.last+=left.length;
  if(this.last>=sampleRate){this.last=0;this.port.postMessage({kind:'audio',queued:this.count,underruns:this.underruns,overruns:this.overruns,played:this.played,nonzero:this.nonzero,deviceRate:sampleRate});}
  return true;
 }
}
registerProcessor('dreamcast-audio',DreamcastAudioProcessor);
