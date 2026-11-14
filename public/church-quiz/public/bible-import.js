/* Import SRB26-bibeldata.js and compatible JSON without executing imported JS. */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.BibleTriviaBibleImport=api;})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const MAX_BYTES=60*1024*1024;
 function check(data,filename){
  if(!data||typeof data!=='object'||!Array.isArray(data.books)||data.books.length<1||data.books.length>100)
   throw Error('Bibelfilen måste innehålla 1–100 bibelböcker.');
  let chapters=0,verses=0;
  for(const b of data.books){
   if(!b||typeof b.name!=='string'||!b.name.trim()||!Array.isArray(b.chapters)||b.chapters.length>200)throw Error('En bibelbok saknar namn eller kapitel.');
   for(const c of b.chapters){
    if(!Array.isArray(c)||c.length>300)throw Error('Ogiltigt kapitel i '+b.name);
    chapters++;
    for(const v of c){
     if(!(typeof v==='string'||(Array.isArray(v)&&v.length>=2&&Number.isInteger(Number(v[0]))&&typeof v[1]==='string')||(v&&typeof v==='object'&&typeof v.text==='string')))
       throw Error('Ogiltig vers i '+b.name);
     verses++;
    }
   }
  }
  if(chapters>3000||verses>100000)throw Error('Bibelpaketet är för stort.');
  const name=String(data.name||data.metadata?.name||filename||'Importerad bibel').replace(/\.(js|json)$/i,'').slice(0,90).trim();
  if(!name)throw Error('Bibelpaketet saknar namn.');
  return {name,data:{...data,name},books:data.books.length,chapters,verses};
 }
 function parse(raw,filename){
  if(typeof raw!=='string'||raw.length>MAX_BYTES)throw Error('Bibelfilen är för stor.');
  let text=raw.replace(/^\uFEFF/,'').trim();
  if(!text.startsWith('{')){
   const marker='window.SRB26DATA=',at=text.indexOf(marker);
   if(at<0||(at!==0&&!text.startsWith('/* SRB26:')))throw Error('Välj SRB26-bibeldata.js eller bibel-JSON.');
   text=text.slice(at+marker.length).trim().replace(/;\s*$/,'');
  }
  let data;try{data=JSON.parse(text)}catch(e){throw Error('Bibelfilen är inte giltig JSON eller SRB26-bibeldata.js.');}
  return check(data,filename);
 }
 return Object.freeze({MAX_BYTES,check,parse});
});

