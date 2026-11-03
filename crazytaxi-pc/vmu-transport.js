/* A phase is acknowledged only after the browser's IndexedDB transaction commits. */
'use strict';
const portVmu={revision:null,
 async load(){
  const card=await portVmuStorage.read();this.revision=card.revision;
  postMessage({kind:'vmu-status',connected:true,message:'A1 connected · saved in this browser'});return card.bytes;
 },
 async write(block,phase,bytes){
  const card=await portVmuStorage.writePhase(block,phase,bytes,this.revision);this.revision=card.revision;
  postMessage({kind:'vmu-status',connected:true,saved:true,message:'A1 save written to this browser'});
 }
};
