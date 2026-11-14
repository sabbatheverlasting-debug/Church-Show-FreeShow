"use strict";
// Pure import functions shared by the browser and Node tests.
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.QuizImport = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const clean = value => String(value == null ? "" : value).replace(/\s+/g, " ").trim();


  // Uniform format for different JSON exports. Never invent a correct answer.
  const first=(...xs)=>xs.find(x=>x!==undefined&&x!==null&&x!=="");
  const read=(q,...names)=>first(...names.map(k=>q?.[k]));
  const label=v=>typeof v==="string"||typeof v==="number"?clean(v):clean(read(v,"label","text","option","name","title","answer","value"));
  function normalizeQuestion(raw){
    if(Array.isArray(raw)){
      if(raw.length<3||!Array.isArray(raw[1]))return null;
      raw={question:raw[0],options:raw[1],answer:raw[2],reference:raw[3],difficulty:raw[4],category:raw[5]};
    }
    if(!raw||typeof raw!=="object")return null;
    const question=label(read(raw,"question","fråga","fraga","questionText","question_text","prompt","text"));
    let opts=read(raw,"options","choices","alternativ","alternatives","answerOptions","answer_options","svarsalternativ","responses","answers");
    const keys=["A","B","C","D","E","F"];
    if(opts&&!Array.isArray(opts)&&typeof opts==="object"){
      const values=keys.map(k=>first(opts[k],opts[k.toLowerCase()]));
      if(values.some(v=>v!==undefined))opts=values.slice(0,values.findLastIndex(v=>v!==undefined)+1);
    }
    if(!opts){
      const values=keys.map(k=>first(raw[k],raw[k.toLowerCase()],raw["option"+k],raw["option_"+k.toLowerCase()],raw["choice"+k]));
      if(values.some(v=>v!==undefined))opts=values.slice(0,values.findLastIndex(v=>v!==undefined)+1);
    }
    let answer=read(raw,"answer","correctAnswer","correct_answer","correctIndex","correct_index","answerIndex","correct","svar","rättSvar","rattSvar","facit","solution","correctOption","correct_option");
    if(answer&&typeof answer==="object")answer=read(answer,"index","value","key","label","text");
    if(Array.isArray(opts)){
      const flags=opts.map((o,i)=>o&&typeof o==="object"&&(o.correct===true||o.isCorrect===true||o.is_correct===true)?i:-1).filter(n=>n>=0);
      if(answer===undefined&&flags.length===1)answer=flags[0];
      opts=opts.map(label);
    }
    if(typeof answer==="string"){
      const match=answer.trim().match(/^(?:(?:option|alternativ|answer|svar)\s*)?([A-F])\s*[).:-]?$/i);
      if(match)answer=match[1].toUpperCase();
      else if(Array.isArray(opts)){
        const n=opts.findIndex(x=>x.toLocaleLowerCase()===answer.trim().toLocaleLowerCase());
        if(n>=0)answer=String.fromCharCode(65+n);
      }
    }
    if(typeof answer==="number" && (raw.correctOption===answer||raw.correct_option===answer) && answer>=1 && answer<=6) answer--;
    return {question,options:opts,answer,
      reference:label(read(raw,"reference","scripture","bibeltext","källa","verse")),
      difficulty:label(read(raw,"difficulty","svårighet")),category:label(read(raw,"category","kategori","topic")),
      ...(raw.translations?{translations:raw.translations}:{})};
  }
  function issue(q){
    if(!q||!q.question)return "frågetext saknas";
    if(!Array.isArray(q.options)||q.options.length<2||q.options.length>6||q.options.some(x=>!x||x.length>250))
      return "svarsalternativ saknas eller är ofullständiga";
    let idx=-1;
    if(Number.isInteger(q.answer))idx=q.answer;
    else if(typeof q.answer==="string"){
      const a=q.answer.trim();
      if(/^[A-F]$/i.test(a))idx=a.toUpperCase().charCodeAt(0)-65;
      else if(/^[0-5]$/.test(a))idx=Number(a);
      else idx=q.options.findIndex(x=>x.toLowerCase()===a.toLowerCase());
    }
    if(idx<0||idx>=q.options.length)return "facit saknas eller är otydligt";
    return "";
  }
  function extractJson(text){
    let data;
    try{data=JSON.parse(String(text).replace(/^\uFEFF/,"").trim());}
    catch(e){throw Error("Ogiltig JSON: "+e.message);}
    if(!Array.isArray(data)){
      for(const key of ["questions","frågor","fragor","items","quiz","questionBank","data"]){
        if(data&&data[key]!==undefined){data=data[key];break;}
      }
      if(data&&typeof data==="object"&&!Array.isArray(data)){
        for(const key of ["questions","frågor","fragor","items","quiz"]){
          if(data[key]!==undefined){data=data[key];break;}
        }
      }
    }
    if(!Array.isArray(data))data=[data];
    const questions=[],rejected=[],pending=[];
    data.forEach((raw,i)=>{
      const q=normalizeQuestion(raw),reason=issue(q);
      if(!reason){questions.push(q);return;}
      rejected.push({number:i+1,reason,raw});
      // A question with no verified answer is still valuable material. Keep its
      // actual text, original number and provenance, but don't fake an answer.
      if(q&&q.question&&q.question.length<=1000){
        pending.push({question:q.question,number:raw&&raw.number,
          sourceId:raw&&raw.id,sourceImage:raw&&raw.source_image,
          language:raw&&raw.language,quiz:raw&&raw.quiz,
          reference:q.reference||'',category:q.category||'',
          answer:typeof q.answer==='string'?q.answer:null,
          reason});
      }
    });
    return {questions,pending,rejected,total:data.length};
  }
  function fromJson(text){return extractJson(text).questions;}
  function isJson(text) {
    return /^\s*[\[{]/.test(String(text).replace(/^\uFEFF/, ""));
  }

  // A photograph often places several alternatives on one OCR line:
  // "139. Who...? A) One B) Two C) Three". Split only when multiple
  // ordered option labels are visible, to avoid changing ordinary prose.
  function unfoldInlineOptions(line) {
    const markers=[...String(line).matchAll(/(?:^|\s)([A-F])\s*[\).:]\s+(?=\S)/g)];
    if(markers.length<2 || markers[0][1].toUpperCase()!=="A")return [line];
    const ordered=markers.every((m,i)=>m[1].toUpperCase().charCodeAt(0)===65+i);
    if(!ordered)return [line];
    const result=[];
    const lead=line.slice(0,markers[0].index).trim();
    if(lead)result.push(lead);
    markers.forEach((mark,i)=>{
      const end=i+1<markers.length?markers[i+1].index:line.length;
      result.push(line.slice(mark.index,end).trim());
    });
    return result;
  }

  // OCR often removes blank lines, and some photographs contain several questions.
  function splitQuestionBlocks(text) {
    const rows = String(text).replace(/\r/g, "").replace(/^\uFEFF/, "").split("\n")
      .flatMap(unfoldInlineOptions);
    const groups = [];
    let current = [];
    let hasAnswer = false;
    const flush = () => { if (current.some(x => x.trim())) groups.push(current.join("\n").trim()); current = []; hasAnswer = false; };
    for (const row of rows) {
      const line = row.trim();
      const questionHeader = /^(?:Fråga|Question|Q)\s*(?:nr\.?\s*)?\d*\s*[:.)-]\s*\S/i.test(line);
      const numberedQuestion = /^\d{1,4}\s*[.)]\s+\S/.test(line);
      if ((questionHeader || numberedQuestion) && current.some(x => x.trim())) flush();
      if (!line && hasAnswer) { flush(); continue; }
      if (hasAnswer && line && !/^(?:Bibeltext|Reference|Ref|Källa|Scripture|Svårighet|Difficulty|Kategori|Category)\s*[:.]/i.test(line) &&
          !/^(?:Svar|Answer|Facit|Correct|Rätt svar)\s*[:.]/i.test(line) && !questionHeader && !numberedQuestion) {
        flush();
      }
      current.push(row);
      if (/^(?:Rätt\s*svar|Korrekt\s*svar|Facit|Svar|Answer|Correct(?:\s+answer)?)\s*[:.]\s*\S/i.test(line)) hasAnswer = true;
    }
    flush();
    return groups;
  }
  function parseBlock(block) {
    const entry = { options: [] };
    let last = "";
    for (const original of block.split(/\n/)) {
      const line = original.trim();
      if (!line || /^--- .+ ---$/.test(line)) continue;
      let match;
      if ((match = line.match(/^(?:Fråga|Question|Q)\s*(?:nr\.?\s*)?\d*\s*[:.)-]\s*(.+)$/i)) ||
          (match = line.match(/^\d{1,4}\s*[.)]\s+(.+)$/))) {
        entry.question = clean(match[1]); last = "question";
      } else if ((match = line.match(/^([A-F])\s*[\).:-]\s*(.+)$/i))) {
        const index = match[1].toUpperCase().charCodeAt(0) - 65;
        if (index === entry.options.length) { entry.options.push(clean(match[2])); last = "option"; }
      } else if ((match = line.match(/^(?:Rätt\s*svar|Korrekt\s*svar|Facit|Svar|Answer|Correct(?:\s+answer)?)\s*[:.]\s*(.+)$/i))) {
        entry.answer = clean(match[1]); last = "answer";
      } else if ((match = line.match(/^(?:Bibeltext|Reference|Ref|Källa|Scripture)\s*[:.]\s*(.+)$/i))) {
        entry.reference = clean(match[1]); last = "reference";
      } else if ((match = line.match(/^(?:Svårighet|Difficulty)\s*[:.]\s*(.+)$/i))) {
        entry.difficulty = clean(match[1]); last = "difficulty";
      } else if ((match = line.match(/^(?:Kategori|Category)\s*[:.]\s*(.+)$/i))) {
        entry.category = clean(match[1]); last = "category";
      } else if (!entry.question && !/^\W*$/.test(line)) {
        entry.question = clean(line); last = "question";
      } else if (last === "question" && entry.options.length === 0) {
        entry.question += " " + clean(line);
      } else if (last === "option" && entry.options.length) {
        entry.options[entry.options.length - 1] += " " + clean(line);
      }
    }
    return entry;
  }
  function validDraft(q){return !issue(normalizeQuestion(q));}
  function extractOCR(text) {
    const questions = [], unresolved = [];
    for (const block of splitQuestionBlocks(text)) {
      const q = parseBlock(block);
      if (validDraft(q)) questions.push(q);
      else unresolved.push(block);
    }
    return { questions, unresolved };
  }
  function parseQuestions(text) {
    const value = String(text || "").trim();
    if (!value) return [];
    return isJson(value) ? fromJson(value) : extractOCR(value).questions;
  }
  function mergeDraft(existingText, incoming) {
    const existing = parseQuestions(existingText);
    if (String(existingText || "").trim() && !existing.length)
      throw new Error("The existing review field has no complete questions. Correct or back up its contents before scanning again.");
    const output = [], keys = new Set();
    for (const q of existing.concat(incoming || [])) {
      if (!q || typeof q !== "object") continue;
      const key = clean(q.question || q.fraga || q.fråga).toLocaleLowerCase();
      if (!key || keys.has(key)) continue;
      keys.add(key); output.push(q);
    }
    return JSON.stringify(output, null, 2);
  }
  return { parseQuestions, extractOCR, mergeDraft, validDraft, splitQuestionBlocks, normalizeQuestion, extractJson, issue };
});

