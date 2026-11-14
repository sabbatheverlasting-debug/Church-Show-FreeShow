"use strict";
// Photo OCR helper. No source images leave the user's device except for
// the one-time download of the OCR engine/language models.
(function(root,factory){
  const api=factory();
  if(typeof module!=="undefined" && module.exports)module.exports=api;
  if(root)root.QuizPhotoOCR=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  const clamp=n=>Math.max(0,Math.min(255,n));
  const questionCount=text=>{
    try{return (typeof QuizImport!=="undefined"?QuizImport:globalThis.QuizImport).extractOCR(text).questions.length;}
    catch(e){return 0;}
  };
  function quality(result){
    const text=String(result?.data?.text||"").trim();
    const confidence=Number(result?.data?.confidence)||0;
    const questions=questionCount(text);
    const letters=(text.match(/[A-Za-zÀ-ÿÅÄÖåäö]/g)||[]).length;
    const symbols=(text.match(/[^\w\sÀ-ÿÅÄÖåäö.,!?;:'"()\-–—/#]/g)||[]).length;
    // The parser's complete Q/A pairs count more than general OCR confidence.
    const score=questions*250+confidence+Math.min(letters,150)/15-
       (letters?symbols/letters*90:150);
    return {text,confidence,questions,score};
  }
  function retryRecommended(read){
    return !read.questions || read.confidence<62 ||
      (read.text.length>100 && read.questions<2 && read.confidence<74);
  }
  function chooseReadings(first,second){
    if(!first)return second;
    if(!second)return first;
    if(second.questions!==first.questions)
      return second.questions>first.questions?second:first;
    return second.score>first.score+3?second:first;
  }
  async function loadPixels(file){
    if(typeof createImageBitmap==="function"){
      const image=await createImageBitmap(file);
      return {image,width:image.width,height:image.height,dispose:()=>image.close()};
    }
    const source=URL.createObjectURL(file);
    try{
      const image=new Image();
      await new Promise((resolve,reject)=>{
        image.onload=resolve;image.onerror=()=>reject(Error("Kunde inte öppna bilden"));
        image.src=source;
      });
      return {image,width:image.naturalWidth,height:image.naturalHeight,dispose:()=>{}};
    }finally{URL.revokeObjectURL(source);}
  }
  function blobFromCanvas(canvas){
    return new Promise((resolve,reject)=>
      canvas.toBlob(blob=>blob?resolve(blob):reject(Error("Bilden kunde inte bearbetas")), "image/png"));
  }
  async function enhancedPhoto(file, region="full"){
    const img=await loadPixels(file);
    try{
      let cropX=0,cropWidth=img.width;
      if(region==="left"){cropWidth=Math.ceil(img.width*.53);}
      if(region==="right"){cropX=Math.floor(img.width*.47);cropWidth=img.width-cropX;}
      const maxDim=2600;
      const ratio=Math.min(2, maxDim/Math.max(cropWidth,img.height));
      const width=Math.max(1,Math.round(cropWidth*ratio));
      const height=Math.max(1,Math.round(img.height*ratio));
      const canvas=document.createElement("canvas");
      canvas.width=width;canvas.height=height;
      const ctx=canvas.getContext("2d",{willReadFrequently:true});
      if(!ctx)throw Error("Bilden kunde inte bearbetas");
      ctx.fillStyle="#ffffff";ctx.fillRect(0,0,width,height);
      ctx.drawImage(img.image,cropX,0,cropWidth,img.height,0,0,width,height);
      const pixels=ctx.getImageData(0,0,width,height);
      const data=pixels.data;
      const histogram=new Uint32Array(256);
      for(let i=0;i<data.length;i+=16){
        const gray=Math.round(.299*data[i]+.587*data[i+1]+.114*data[i+2]);
        histogram[gray]++;
      }
      const count=Math.ceil(data.length/16);
      let bottom=0,top=255,sum=0;
      for(let i=0;i<256;i++){sum+=histogram[i];if(sum>=count*.04){bottom=i;break;}}
      sum=0;
      for(let i=255;i>=0;i--){sum+=histogram[i];if(sum>=count*.04){top=i;break;}}
      if(top-bottom<65){bottom=Math.max(0,bottom-30);top=Math.min(255,top+30);}
      const spread=Math.max(60,top-bottom);
      for(let i=0;i<data.length;i+=4){
        const gray=.299*data[i]+.587*data[i+1]+.114*data[i+2];
        const value=clamp(Math.round((gray-bottom)*255/spread));
        data[i]=data[i+1]=data[i+2]=value;
        data[i+3]=255;
      }
      ctx.putImageData(pixels,0,0);
      const blob=await blobFromCanvas(canvas);
      canvas.width=1;canvas.height=1;
      return {blob,width,height};
    }finally{img.dispose();}
  }
  // One normal pass. If incomplete, re-read a normalized higher-contrast image.
  // When text appears to be laid out in columns, a last resort reads each side
  // separately, so columns are not interleaved in reading order.
  async function recognize(file,worker,notify=()=>{}){
    notify("original");
    const first=quality(await worker.recognize(file));
    let best=first,attempts=1,mode="original";
    if(retryRecommended(best)){
      try{
        notify("enhanced");
        const prepared=await enhancedPhoto(file);
        await worker.setParameters({tessedit_pageseg_mode:"6"});
        const second=quality(await worker.recognize(prepared.blob));
        best=chooseReadings(best,second);
        attempts++;
        if(best===second)mode="enhanced";
        // Avoid extra work on 400-photo batches unless both passes struggled.
        if(retryRecommended(best) && prepared.width>1100 && prepared.width/prepared.height>.55){
          notify("columns");
          const left=await enhancedPhoto(file,"left");
          const right=await enhancedPhoto(file,"right");
          const a=quality(await worker.recognize(left.blob));
          const b=quality(await worker.recognize(right.blob));
          const combined=quality({data:{
            text:a.text+"\n\n"+b.text,confidence:(a.confidence+b.confidence)/2
          }});
          attempts+=2;
          if(combined.questions>best.questions ||
              (combined.questions===best.questions && combined.score>best.score+8)){
            best=combined;mode="columns";
          }
        }
      }catch(err){
        // Keep the first OCR reading available for manual correction.
        best.warning=String(err?.message||err);
      }finally{
        try{await worker.setParameters({tessedit_pageseg_mode:"3"});}catch(e){}
      }
    }
    return {...best,attempts,mode,lowQuality:!best.questions||best.confidence<55};
  }
  return {recognize,quality,chooseReadings,retryRecommended,enhancedPhoto};
});

