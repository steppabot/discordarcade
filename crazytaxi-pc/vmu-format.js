/* Standard 128 KiB VMU card directory/FAT operations. Never execute save contents. */
'use strict';
const portVmuFormat=(()=>{
 const SIZE=131072,BLOCK=512,FREE=0xfffc,END=0xfffa;
 const view=b=>new DataView(b.buffer,b.byteOffset,b.byteLength);
 const word=(b,o)=>view(b).getUint16(o,true),setWord=(b,o,v)=>view(b).setUint16(o,v,true);
 const text=b=>Array.from(b,c=>c>=32&&c<127?String.fromCharCode(c):' ').join('').trimEnd();
 function bytes(value){const b=new Uint8Array(value);if(b.length!==SIZE)throw Error('A VMU card must contain exactly 128 KiB.');return b;}
 function blank(){
  const b=new Uint8Array(SIZE),r=255*BLOCK;b.fill(0x55,r,r+16);b.set([0x20,0,1,1,0,0,0,6],r+48);
  [255,0,255,254,1,253,13,0,200,31,0,0].forEach((v,i)=>setWord(b,r+64+i*2,v));
  for(let i=0;i<256;i++)setWord(b,254*BLOCK+i*2,i<200?FREE:END);
  for(let i=253;i>241;i--)setWord(b,254*BLOCK+i*2,i-1);
  return b;
 }
 function layout(b){
  const r=255*BLOCK;if(!b.subarray(r,r+16).every(c=>c===0x55))throw Error('Card is unformatted or has an unsupported root block.');
  const fat=word(b,r+70),fatBlocks=word(b,r+72),directory=word(b,r+74),directoryBlocks=word(b,r+76),userBlocks=word(b,r+80);
  if(fat!==254||fatBlocks!==1||directory>=254||directoryBlocks<1||directoryBlocks>13||userBlocks<1||userBlocks>200)throw Error('Unsupported VMU card geometry; existing bytes were preserved.');
  const blocks=[],seen=new Set();let next=directory;
  for(let n=0;n<directoryBlocks;n++){
   if(next<userBlocks||next>=254||seen.has(next))throw Error('Invalid VMU directory chain.');seen.add(next);blocks.push(next);next=word(b,fat*BLOCK+next*2);
  }
  if(next!==END)throw Error('Invalid VMU directory terminator.');
  return {fat,userBlocks,blocks};
 }
 function chain(b,g,start,count){
  const list=[],seen=new Set();let next=start;
  for(let n=0;n<count;n++){
   if(next>=g.userBlocks||seen.has(next))throw Error('Save has an invalid or circular block chain.');seen.add(next);list.push(next);next=word(b,g.fat*BLOCK+next*2);
  }
  if(next!==END)throw Error('Save size does not match its block chain.');return list;
 }
 function directory(b){
  const g=layout(b),entries=[],used=new Set();let index=0;
  for(const block of g.blocks)for(let i=0;i<16;i++,index++){
   const offset=block*BLOCK+i*32,type=b[offset];if(!type)continue;
   const size=word(b,offset+24),blocks=chain(b,g,word(b,offset+2),size);
   if(!size)throw Error('Save has an empty allocation.');
   for(const n of blocks){if(used.has(n))throw Error('Two saves share a block; this card is read-only until repaired.');used.add(n);}
   entries.push({index,offset,type,protected:b[offset+1]===255,name:text(b.subarray(offset+4,offset+16)),blocks,bytes:size*BLOCK,headerBlock:word(b,offset+26)});
  }
  return {g,entries,free:Array.from({length:g.userBlocks},(_,i)=>i).filter(i=>word(b,g.fat*BLOCK+i*2)===FREE)};
 }
 function payload(b,e){const out=new Uint8Array(e.bytes);e.blocks.forEach((n,i)=>out.set(b.subarray(n*BLOCK,(n+1)*BLOCK),i*BLOCK));return out;}
 function inspect(value){
  const b=bytes(value);try{
   const d=directory(b);return {formatted:true,capacity:SIZE,userBlocks:d.g.userBlocks,freeBlocks:d.free.length,files:d.entries.map(e=>{
    const raw=payload(b,e),o=e.headerBlock*BLOCK,header=raw.subarray(o,o+128);
    return {index:e.index,name:e.name,type:e.type===0xcc?'VMU game':e.type===0x33?'Save data':'Unknown',protected:e.protected,blocks:e.blocks.length,bytes:e.bytes,allocation:e.blocks,description:header.length===128?text(header.subarray(0,16)):'',detail:header.length===128?text(header.subarray(16,48)):'',application:header.length===128?text(header.subarray(48,64)):'',hex:Array.from(raw.subarray(0,128),v=>v.toString(16).padStart(2,'0')).join(' ')};
   })};
  }catch(error){return {formatted:false,capacity:SIZE,files:[],error:error.message};}
 }
 function filename(name){if(typeof name!=='string'||!/^[\x20-\x7e]{1,12}$/.test(name)||/[\\/]/.test(name)||!name.trim())throw Error('Use 1–12 printable ASCII characters, without slashes.');return name.trimEnd();}
 function rename(b,e,name,entries){name=filename(name);if(entries.some(other=>other.index!==e.index&&other.name===name))throw Error('A save with that name already exists.');b.fill(0,e.offset+4,e.offset+16);b.set(Array.from(name,c=>c.charCodeAt(0)),e.offset+4);}
 function availableName(entries,name){for(let n=2;n<1000;n++){const suffix='~'+n,result=name.slice(0,12-suffix.length)+suffix;if(!entries.some(e=>e.name===result))return result;}throw Error('No available copy name.');}
 function edit(value,action,index,name){
  const b=bytes(value),d=directory(b),entry=d.entries.find(e=>e.index===index);if(!entry)throw Error('Select an existing save.');
  if(action==='rename')rename(b,entry,name,d.entries);
  else if(action==='delete'){for(const n of entry.blocks)setWord(b,d.g.fat*BLOCK+n*2,FREE);b.fill(0,entry.offset,entry.offset+32);}
  else if(action==='copy'){
   if(d.free.length<entry.blocks.length)throw Error('Not enough free blocks to copy this save.');
   const empty=d.g.blocks.flatMap(block=>Array.from({length:16},(_,i)=>block*BLOCK+i*32)).find(o=>b[o]===0);if(empty===undefined)throw Error('The card directory is full.');
   const blocks=d.free.slice(0,entry.blocks.length),data=payload(b,entry);blocks.forEach((n,i)=>{b.set(data.subarray(i*BLOCK,(i+1)*BLOCK),n*BLOCK);setWord(b,d.g.fat*BLOCK+n*2,blocks[i+1]??END);});
   b.set(b.slice(entry.offset,entry.offset+32),empty);setWord(b,empty+2,blocks[0]);rename(b,{offset:empty,index:-1},name||availableName(d.entries,entry.name),d.entries);
  }else throw Error('Unknown save action.');
  directory(b);return b;
 }
 function exportFile(value,index){const b=bytes(value),e=directory(b).entries.find(e=>e.index===index);if(!e)throw Error('Save no longer exists.');return payload(b,e);}
 return {SIZE,blank,inspect,edit,exportFile,validate:value=>{const b=bytes(value);directory(b);return b;}};
})();
