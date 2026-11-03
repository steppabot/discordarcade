/* Browser-owned VMU images, atomic revisions and recoverable management edits. */
'use strict';
const portVmuStorage={
 database:null,scopePromise:null,
 scope(){return this.scopePromise??=(async()=>{
  let project=typeof document!=='undefined'?document.body?.dataset?.projectId:null;
  if(!project){try{const response=await fetch('debug/config');if(response.ok)project=(await response.json()).projectId;}catch{}}
  if(!project){try{const response=await fetch('workspace');if(response.ok)project=(await response.json()).selected?.id;}catch{}}
  if(!project){const match=location.pathname.match(/\/projects\/([^/]+)\//);project=match?.[1]||location.pathname.replace(/(?:artifacts\/[^/]+\/)?[^/]*$/,'')||'default';}
  return project+':A1';
 })();},
 db(){return this.database??=new Promise((resolve,reject)=>{
  if(typeof indexedDB==='undefined'){reject(Error('This browser cannot persist VMU cards: IndexedDB is unavailable.'));return;}
  const request=indexedDB.open('dreamcast-port-lab-vmu',1);
  request.onupgradeneeded=()=>{const db=request.result;db.createObjectStore('cards',{keyPath:'id'});db.createObjectStore('backups',{keyPath:'id'}).createIndex('card','card');};
  request.onsuccess=()=>{request.result.onversionchange=()=>request.result.close();resolve(request.result);};request.onerror=()=>reject(request.error);request.onblocked=()=>reject(Error('Close older Port Lab tabs to finish opening VMU storage.'));
 });},
 async transaction(stores,mode,run){
  const db=await this.db();return new Promise((resolve,reject)=>{
   const tx=db.transaction(stores,mode);let result,failure;
   tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(failure||tx.error||Error('VMU storage failed.'));tx.onabort=()=>reject(failure||tx.error||Error('VMU storage was interrupted.'));
   try{run(tx,value=>{result=value;},error=>{failure=error;tx.abort();});}catch(error){failure=error;tx.abort();}
  });
 },
 async ensure(){
  const id=await this.scope();let card=await this.transaction(['cards'],'readonly',(tx,done)=>{const r=tx.objectStore('cards').get(id);r.onsuccess=()=>done(r.result);});if(card)return card;
  let image,source='New browser card';
  try{const response=await fetch('vmu/a1.bin');if(response.ok){const data=new Uint8Array(await response.arrayBuffer());if(data.length!==portVmuFormat.SIZE)throw Error('Existing project VMU has an invalid size; it was not replaced.');image=data;source='Imported project card';}}
  catch(error){if(error.message.includes('invalid size'))throw error;}
  image??=portVmuFormat.blank();
  return this.transaction(['cards'],'readwrite',(tx,done)=>{const store=tx.objectStore('cards'),r=store.get(id);r.onsuccess=()=>{const value=r.result||{id,name:'A1',revision:1,updatedAt:Date.now(),source,bytes:image.buffer};if(!r.result)store.put(value);done(value);};});
 },
 async read(){const card=await this.ensure();return {...card,bytes:new Uint8Array(card.bytes)};},
 async update(expectedRevision,reason,mutate,backup=true){
  const id=await this.scope();return this.transaction(['cards','backups'],'readwrite',(tx,done,fail)=>{
   const store=tx.objectStore('cards'),request=store.get(id);request.onsuccess=()=>{
    try{
     const card=request.result;if(!card||card.revision!==expectedRevision)throw Error('VMU changed in another session. Reload the card before writing; existing saves were preserved.');
     const next=mutate({...card,bytes:new Uint8Array(card.bytes.slice(0))});if(next.bytes.length!==portVmuFormat.SIZE)throw Error('Invalid VMU image size.');
     if(backup){const backups=tx.objectStore('backups');backups.put({...card,id:id+'@'+card.revision,card:id,reason});const list=backups.index('card').getAll(id);list.onsuccess=()=>{const values=list.result.sort((a,b)=>b.revision-a.revision);for(const old of values.slice(10))backups.delete(old.id);};}
     next.bytes=next.bytes.buffer;next.revision=card.revision+1;next.updatedAt=Date.now();store.put(next);done({...next,bytes:new Uint8Array(next.bytes)});
    }catch(error){fail(error);}
   };
  });
 },
 async writePhase(block,phase,bytes,revision){
  if(!Number.isInteger(block)||block<0||block>255||!Number.isInteger(phase)||phase<0||phase>3||bytes.length!==128)throw Error('Invalid VMU write phase.');
  return this.update(revision,'Game write',card=>{card.bytes.set(bytes,block*512+phase*128);return card;},false);
 },
 async edit(action,index,name,revision){return this.update(revision,action+' save',card=>{card.bytes=portVmuFormat.edit(card.bytes,action,index,name);return card;});},
 async replace(bytes,revision){const image=portVmuFormat.validate(bytes);return this.update(revision,'Import card',card=>({...card,bytes:image}));},
 async clear(revision){return this.update(revision,'Clear card',card=>({...card,bytes:portVmuFormat.blank()}));},
 async rename(name,revision){if(typeof name!=='string'||!name.trim()||name.length>60)throw Error('Use a card name of 1–60 characters.');return this.update(revision,'Rename card',card=>({...card,name:name.trim()}));},
 async history(){const id=await this.scope();return this.transaction(['backups'],'readonly',(tx,done)=>{const r=tx.objectStore('backups').index('card').getAll(id);r.onsuccess=()=>done(r.result.sort((a,b)=>b.revision-a.revision).map(({bytes,...meta})=>meta));});},
 async restore(id,revision){
  const cardId=await this.scope(),backup=await this.transaction(['backups'],'readonly',(tx,done)=>{const r=tx.objectStore('backups').get(id);r.onsuccess=()=>done(r.result);});
  if(!backup||backup.card!==cardId)throw Error('Backup no longer exists.');return this.update(revision,'Restore backup',card=>({...card,bytes:new Uint8Array(backup.bytes),name:backup.name}));
 }
};
