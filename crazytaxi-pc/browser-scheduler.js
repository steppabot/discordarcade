/* Yield a task without chained setTimeout clamping in active browser tabs.
 * This grants the browser an event/rendering opportunity, never a guest tick.
 */
class PortBrowserScheduler {
 constructor(){this.channel=null;this.waiters=[];}
 idle(){
  // Resume through a message task so repeated short timers do not form a
  // clamped nested-timer chain. Keep a two-ms guard before guest VBlank.
  return new Promise(resolve=>setTimeout(()=>this.yield().then(resolve),1));
 }
 yield(){
  if((typeof document!=='undefined'&&document.hidden)||typeof MessageChannel==='undefined')return new Promise(resolve=>setTimeout(resolve,0));
  if(!this.channel){this.channel=new MessageChannel();this.channel.port1.onmessage=()=>{const resolve=this.waiters.shift();if(resolve)resolve();};}
  return new Promise(resolve=>{this.waiters.push(resolve);this.channel.port2.postMessage(0);});
 }
}
const portBrowserScheduler=new PortBrowserScheduler();
