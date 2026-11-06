/* The original executable, ARM7, hardware, texture decode and GL run here. */
'use strict';
// Legacy compiled disc URLs are rooted at /disc. Scope them to this project's
// worker directory so simultaneous games never read another project's tracks.
// [token] The disc comes from a packed image (disc.json + parts, see ct_compact.py):
// only the sector ranges the game uses, as raw 2352-byte sectors. Each read of
// /disc/<track>?offset=&length= is answered from it, with zeros elsewhere. The
// parts download once and stay in Cache Storage.
let portDisc=null,portDiscReady=null;
const PORT_DISC_CACHE='token-crazytaxi-disc-';
// Game code: fetch, and unpack when gzip-compressed (magic 1f 8b; a server may already have).
async function portLoadWasm(url){
 const response=await fetch(url);
 if(!response.ok)throw new Error('download failed ('+response.status+')');
 const bytes=new Uint8Array(await response.arrayBuffer());
 if(bytes[0]!==0x1f||bytes[1]!==0x8b)return bytes;
 return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
}
// Try each disc location in order (R2 first, then the copy next to the page).
async function portLoadDiscFirst(bases){
 const errors=[];
 for(const base of bases){
  try{await portLoadDisc(base);console.info('[DISC] loaded from '+base);return;}
  catch(error){console.warn('[DISC] '+base+': '+(error.message||error));errors.push(new URL(base).host+': '+(error.message||error));}
 }
 throw new Error('Could not download the game disc ('+errors.join('; ')+').');
}
async function portLoadDisc(base){
 const listing=await fetch(new URL('disc.json',base).href,{cache:'no-cache'});
 if(!listing.ok)throw new Error('The game disc is missing on this site ('+listing.status+').');
 const manifest=await listing.json();
 // One cache per disc image, so a re-packed disc never mixes with old parts.
 const name=PORT_DISC_CACHE+String(manifest.sha256||'v1').slice(0,16);
 let cache=null;try{cache=await caches.open(name);for(const old of await caches.keys())if(old.startsWith(PORT_DISC_CACHE)&&old!==name)caches.delete(old);}catch{}
 const total=manifest.parts.reduce((n,p)=>n+p.bytes,0);let got=0;
 const parts=[];
 for(const part of manifest.parts){
  const url=new URL(part.name,base).href;
  let response=cache&&await cache.match(url);
  if(!response){
   const fresh=await fetch(url);
   if(!fresh.ok)throw new Error('Disc download failed ('+fresh.status+')');
   const reader=fresh.body.getReader(),chunks=[];let n=0;
   for(;;){const {done,value}=await reader.read();if(done)break;chunks.push(value);n+=value.length;postMessage({kind:'disc-progress',got:got+n,total});}
   const bytes=new Uint8Array(n);let at=0;for(const c of chunks){bytes.set(c,at);at+=c.length;}
   if(bytes.length!==part.bytes)throw new Error('Disc part '+part.name+' is the wrong size');
   if(cache)cache.put(url,new Response(bytes,{headers:{'content-type':'application/octet-stream'}})).catch(()=>{});
   parts.push(bytes);
  }else parts.push(new Uint8Array(await response.arrayBuffer()));
  got+=part.bytes;postMessage({kind:'disc-progress',got,total});
 }
 const starts=[];let at=0;for(const p of parts){starts.push(at);at+=p.length;}
 portDisc={manifest,parts,starts};
}
function portDiscCopy(streamAt,out,outAt,count){
 const {parts,starts}=portDisc;
 for(let i=0;i<parts.length&&count>0;i++){
  const end=starts[i]+parts[i].length;
  if(streamAt>=end)continue;
  const from=streamAt-starts[i],n=Math.min(count,parts[i].length-from);
  out.set(parts[i].subarray(from,from+n),outAt);
  streamAt+=n;outAt+=n;count-=n;
 }
}
function portDiscRead(url){
 const m=/^\/disc\/(\d+)\?offset=(\d+)&length=(\d+)/.exec(url);
 if(!m)return new Response('',{status:404});
 const track=+m[1],offset=+m[2],length=+m[3],S=portDisc.manifest.sectorBytes,out=new Uint8Array(length);
 for(const r of portDisc.manifest.regions){
  if(r.track!==track)continue;
  const rs=r.firstSector*S,re=rs+r.sectors*S,a=Math.max(offset,rs),b=Math.min(offset+length,re);
  if(a<b)portDiscCopy(r.at+(a-rs),out,a-offset,b-a);
 }
 return new Response(out);
}
if(typeof self.fetch==='function'&&self.location){
 const originalFetch=self.fetch.bind(self);
 self.fetch=async(resource,options)=>{
  if(typeof resource==='string'&&resource.startsWith('/disc/')){await portDiscReady;return portDiscRead(resource);}
  return originalFetch(resource,options);
 };
}

var Module;let ready=false,started=false,lastInput=null,logs=[],paused=false,resumeWorker=null;
function flushLogs(){if(logs.length){postMessage({kind:'logs',lines:logs});logs=[];}}
function log(...parts){if(logs.length<512)logs.push(parts.join(' '));}
function fail(reason){flushLogs();postMessage({kind:'error',message:reason?.stack||String(reason)});}
let pulseTimer=null,replayTimers=[],benchmarkTimer=null;
function cancelReplay(){for(const timer of replayTimers)clearTimeout(timer);replayTimers=[];}
function endPulse(){if(pulseTimer!==null){clearTimeout(pulseTimer);pulseTimer=null;}lastInput=[0,0,0,0,0];applyInput();}
function applyInput(sequence){if(ready&&lastInput&&Module._port_input){const bits=Module._port_input(...lastInput);postMessage({kind:"input-applied",bits,values:lastInput,sequence});}}
self.onmessage=event=>{
 const data=event.data;
 if(data.kind==='start'){
  if(started)return;started=true;
  portDiscReady=portLoadDiscFirst((Array.isArray(data.discBase)?data.discBase:[data.discBase||'disc/']).map(b=>new URL(b,self.location.href).href));
  portDiscReady.then(()=>postMessage({kind:'disc-ready'}),fail);
  try{
   if(!(data.canvas instanceof OffscreenCanvas))throw new Error('A transferred OffscreenCanvas is required.');
   Module={canvas:data.canvas,
    preRun:[()=>{GL.offscreenCanvases.canvas=Module.canvas;}],
    print:log,printErr:log,
    onRuntimeInitialized:()=>{ready=true;postMessage({kind:'ready',build:typeof portSelectedBuild==='undefined'?null:portSelectedBuild});applyInput();},
    onAbort:fail,onExit:code=>{if(code)fail('Worker runtime exited with code '+code);},
    portAudioPush:samples=>postMessage({kind:'audio',samples},[samples.buffer]),
    portBrowserYield:async(delay=0)=>{flushLogs();if(paused)await new Promise(resolve=>resumeWorker=resolve);return delay>0?portBrowserScheduler.idle():portBrowserScheduler.yield();},
    // The game code is fetched here (runtime-loader.js names the file); it ships gzip-compressed (11-25 MB -> 3-4 MB).
    instantiateWasm:(imports,receive)=>{
     const file=typeof portSelectedBuild!=='undefined'&&portSelectedBuild.wasmFile;
     if(!file){fail('runtime-loader.js names no wasmFile for this build.');return {};}
     portLoadWasm(new URL(file,self.location.href).href).then(bytes=>WebAssembly.instantiate(bytes,imports)).then(r=>receive(r.instance,r.module)).catch(error=>fail('Could not load the game code: '+(error.message||error)));
     return {};
    }
   };
   importScripts(...['vmu-format.js','vmu-storage.js','vmu-transport.js','browser-scheduler.js','runtime-loader.js'].map(f=>f+self.location.search));
  }catch(error){fail(error.stack||error.message||error);}
 }else if(data.kind==='pause'&&ready){
  paused=!!data.value;if(paused){cancelReplay();endPulse();if(benchmarkTimer!==null){clearTimeout(benchmarkTimer);benchmarkTimer=null;log('[BENCHMARK] cancelled by pause');}}else if(resumeWorker){const resume=resumeWorker;resumeWorker=null;resume();}log('[RUNTIME] '+(paused?'paused':'resumed'));
 }else if(data.kind==='replay'&&ready&&!paused){
  const steps=data.steps;
  if(!Array.isArray(steps)||steps.length>128||!steps.every(s=>s&&Number.isFinite(s.atMs)&&s.atMs>=0&&s.atMs<=180000&&Array.isArray(s.values)&&s.values.length===5&&s.values.every(Number.isInteger)&&s.values[0]>=0&&s.values[0]<=65535&&s.values[1]>=0&&s.values[1]<=255&&s.values[2]>=0&&s.values[2]<=255&&s.values[3]>=-128&&s.values[3]<=127&&s.values[4]>=-128&&s.values[4]<=127)||steps.some((s,i)=>i&&s.atMs<steps[i-1].atMs)){log('[INPUT-REPLAY] Invalid replay');return;}
  cancelReplay();endPulse();const start=performance.now();
  for(const step of steps)replayTimers.push(setTimeout(()=>{lastInput=step.values.slice();applyInput();log('[INPUT-REPLAY] at='+Math.round(performance.now()-start)+' values='+lastInput.join(','));},step.atMs));
  const last=steps.length?steps[steps.length-1].atMs:0;replayTimers.push(setTimeout(()=>{replayTimers=[];lastInput=[0,0,0,0,0];applyInput();log('[INPUT-REPLAY] complete');},last+1000));
 }else if(data.kind==='benchmark'&&ready&&!paused&&benchmarkTimer===null&&Module._port_frame_count){
  const start=performance.now(),frame=Module._port_frame_count();log('[BENCHMARK] started 30-second presentation count');
  benchmarkTimer=setTimeout(()=>{benchmarkTimer=null;const durationMs=performance.now()-start,frames=Module._port_frame_count()-frame;postMessage({kind:'benchmark',result:{durationMs,frames,fps:frames*1000/durationMs,metric:'platform presentations',execution:'dedicated-worker',gpuCompletionMeasured:false}});},30000);
 }else if(data.kind==='pulse'&&ready){
  cancelReplay();
  if(!Array.isArray(data.values)||data.values.length!==5||!data.values.every(Number.isFinite)||!Number.isFinite(data.duration)||data.duration<16||data.duration>60000)return;
  endPulse();const v=data.values;lastInput=[v[0]&0xffff,Math.max(0,Math.min(255,v[1]|0)),Math.max(0,Math.min(255,v[2]|0)),Math.max(-128,Math.min(127,v[3]|0)),Math.max(-128,Math.min(127,v[4]|0))];applyInput();
  log('[INPUT-REPLAY] hold '+lastInput.join(',')+' for '+data.duration+'ms');pulseTimer=setTimeout(()=>{pulseTimer=null;lastInput=[0,0,0,0,0];applyInput();log('[INPUT-REPLAY] released');},data.duration);
 }else if(data.kind==='render-mode'&&ready&&Module._port_render_mode&&Number.isInteger(data.value))Module._port_render_mode(data.value&15);
 else if(data.kind==='capture-snapshot'&&ready&&Module._port_render_snapshot)Module._port_render_snapshot();
 else if(data.kind==='capture-vram'&&ready&&Module._port_vram_capture)Module._port_vram_capture();
 else if(data.kind==='capture-frame'&&ready&&Module._port_frame_capture)Module._port_frame_capture();
 else if(data.kind==='rc-verify'&&ready&&Module._port_set_rc_verify)Module._port_set_rc_verify(data.value?1:0);
 else if(data.kind==='input'){
  if(!Array.isArray(data.values)||data.values.length!==5||!data.values.every(Number.isFinite))return;
  cancelReplay();if(pulseTimer!==null)endPulse();
  const v=data.values;lastInput=[v[0]&0xffff,Math.max(0,Math.min(255,v[1]|0)),Math.max(0,Math.min(255,v[2]|0)),Math.max(-128,Math.min(127,v[3]|0)),Math.max(-128,Math.min(127,v[4]|0))];applyInput(data.sequence);
 }else if(data.kind==='capture-render'&&ready&&Module._port_render_capture)Module._port_render_capture();
};
self.addEventListener('error',event=>fail(event.message||'Worker script error'));
self.addEventListener('unhandledrejection',event=>fail(event.reason));
