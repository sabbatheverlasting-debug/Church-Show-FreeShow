"use strict";
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const importFormats=require("./public/import-utils.js");

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const DATA = process.env.CHURCH_SHOW_QUIZ_DATA_DIR || path.join(ROOT, "data");
const BANK_FILE = path.join(DATA, "questions.json");
const PENDING_FILE = path.join(DATA, "pending-questions.json");
const ROOMS_FILE = path.join(DATA, "rooms.json");
const AUDIO_DIR = path.join(DATA, "audio");
fs.mkdirSync(DATA, { recursive: true });

const starter = require("./data/starter-questions.json").map((x, i) => ({
  id: "starter-" + (i + 1),
  question: x[0], options: x[1], answer: x[2],
  reference: x[3], difficulty: x[4], category: x[5] || "Bibeln"
}));
const readJson = (p, fallback) => {
  try { return JSON.parse(fs.readFileSync(p, "utf8")); }
  catch { return fallback; }
};
let bank = readJson(BANK_FILE, starter);
let pending = readJson(PENDING_FILE, []);
if (!Array.isArray(pending)) pending = [];
let rooms = readJson(ROOMS_FILE, {});
const saveBank = () => fs.writeFileSync(BANK_FILE, JSON.stringify(bank, null, 2), "utf8");
const savePending = () => fs.writeFileSync(PENDING_FILE, JSON.stringify(pending, null, 2), "utf8");
const saveRooms = () => fs.writeFileSync(ROOMS_FILE, JSON.stringify(rooms, null, 2), "utf8");
if (!fs.existsSync(BANK_FILE)) saveBank();

const send = (res, code, body) => {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
  res.end(JSON.stringify(body));
};
const error = (res, code, message) => send(res, code, { error: message });
async function receive(req) {
  let buffer = "";
  for await (const chunk of req) {
    buffer += chunk;
    if (buffer.length > 12_000_000) throw new Error("För stor förfrågan (max 12 MB).");
  }
  try { return JSON.parse(buffer || "{}"); }
  catch { throw new Error("Ogiltig JSON."); }
}
const shuffle = (a) => {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
};
// Remember which verified question IDs were played, across rooms and restarts.
// Unplayed questions are preferred, then oldest-played questions. Avoid the
// previous round whenever the bank has enough questions (40+ for 20-question games).
// Repeats are inevitable with a finite bank, so we never promise infinite novelty.
const ROTATION_FILE=path.join(DATA,"question-rotation.json");
let rotation=readJson(ROTATION_FILE,{rounds:0,lastSeen:{},lastRound:[]});
function currentRotation(){
 if(!rotation||typeof rotation!=="object"||!rotation.lastSeen||typeof rotation.lastSeen!=="object"){
   rotation={rounds:0,lastSeen:{},lastRound:[]};
 }
 const known=new Set(bank.map(x=>x.id));
 rotation.lastRound=Array.isArray(rotation.lastRound)?rotation.lastRound.filter(id=>known.has(id)):[];
 rotation.lastSeen=Object.fromEntries(Object.entries(rotation.lastSeen).filter(([id,n])=>known.has(id)&&Number.isSafeInteger(n)&&n>0));
 rotation.rounds=Number.isSafeInteger(rotation.rounds)&&rotation.rounds>=0?rotation.rounds:0;
 return rotation;
}
function rotationStatus(){
 const history=currentRotation();
 return {unplayed:bank.filter(q=>!history.lastSeen[q.id]).length,
   total:bank.length,rounds:history.rounds};
}
function pickQuestions() {
 if(bank.length<20)throw new Error("Frågebanken måste innehålla minst 20 spelklara frågor.");
 const history=currentRotation(),last=new Set(history.lastRound);
 const sortByAge=items=>shuffle(items).sort((a,b)=>{
   const aLast=history.lastSeen[a.id]||0,bLast=history.lastSeen[b.id]||0;
   const aPrev=last.has(a.id)?1:0,bPrev=last.has(b.id)?1:0;
   // New questions first; then older questions that were not in the last round.
   return aPrev-bPrev||aLast-bLast;
 });
 const candidates=sortByAge(bank);
 // Reserve a difficult question for the final, preferring one not used recently.
 const final=candidates.find(q=>q.difficulty==="hard")||candidates[0];
 const selected=[final];
 for(const item of candidates){
   if(selected.length===20)break;
   if(item.id!==final.id)selected.push(item);
 }
 if(selected.length!==20)throw new Error("Det finns för få unika frågor.");
 const ids=[...shuffle(selected.slice(1)).map(q=>q.id),final.id];
 const round=history.rounds+1;
 for(const id of ids)history.lastSeen[id]=round;
 history.lastRound=ids;
 history.rounds=round;
 const rotationTemp=ROTATION_FILE+'.'+process.pid+'.tmp';
 try {
   fs.writeFileSync(rotationTemp,JSON.stringify(history,null,2),'utf8');
   fs.renameSync(rotationTemp,ROTATION_FILE);
 } finally {
   try{fs.unlinkSync(rotationTemp);}catch(_ignored){}
 }
 return ids;
}
function questionFor(room) {
  return bank.find(q => q.id === room.questionIds[room.index]);
}

const ANSWER_TIMES=new Set([5,10,15]);
const liveTimers=new Map();
function secondsFor(room){return ANSWER_TIMES.has(room.answerWaitSeconds)?room.answerWaitSeconds:5;}
function cancelTimer(room){const old=liveTimers.get(room.code);if(old)clearTimeout(old);liveTimers.delete(room.code);}
function startTimer(room){
  cancelTimer(room);
  room.earlyDeadline=Date.now()+secondsFor(room)*1000;
  room.earlyRemaining=null;
  scheduleTimer(room);
}
function pauseTimer(room){
  if(room.optionsShown||room.answerShown)return;
  room.earlyRemaining=Math.max(0,(room.earlyDeadline||Date.now())-Date.now());
  room.earlyDeadline=null;cancelTimer(room);
}
function resumeTimer(room){
  if(room.optionsShown||room.answerShown||room.award||room.buzz||room.earlyRemaining==null)return;
  room.earlyDeadline=Date.now()+room.earlyRemaining;
  room.earlyRemaining=null;
  scheduleTimer(room);
}
function autoReveal(room){
  if(!room.started||room.finished||room.optionsShown||room.answerShown||room.award||room.buzz||
     !room.earlyDeadline||Date.now()<room.earlyDeadline)return false;
  room.optionsShown=true;room.earlyDeadline=null;room.earlyRemaining=null;
  room.buzz=null;room.lastAttempt=null;room.attempted=[];
  cancelTimer(room);
  emitSound(room,"reveal");
  changed(room);
  return true;
}
function scheduleTimer(room){
  cancelTimer(room);
  if(room.earlyDeadline&&room.started&&!room.finished&&!room.optionsShown){
    const wait=Math.max(1,room.earlyDeadline-Date.now());
    const timeout=setTimeout(()=>{liveTimers.delete(room.code);autoReveal(room);},wait+1);
    timeout.unref?.();liveTimers.set(room.code,timeout);
  }
}
function snapshot(room, host = false) {
  const q = room.started && !room.finished ? questionFor(room) : null;
  return {
    code: room.code, version: room.version || 0,
    rotation:rotationStatus(),pendingCount:pending.length,
    players: room.players.map(({ id, name, score }) => ({ id, name, score })),
    buzz: room.buzz || null, lastAttempt: room.lastAttempt || null, attempted: room.attempted || [],
    started: room.started, finished: room.finished,
    index: room.index, total: 20, bankCount: bank.length,
    mode: room.mode === 'simple' ? 'simple' : 'standard',
    optionsShown: room.optionsShown, answerShown: room.answerShown,
    answerWaitSeconds:secondsFor(room),
    earlyDeadline:room.earlyDeadline||null,
    countdownPaused:room.earlyRemaining!=null,
    countdownRemainingMs:room.earlyRemaining!=null?room.earlyRemaining:Math.max(0,(room.earlyDeadline||0)-Date.now()),
    award: room.award,
    audioEvent: room.audioEvent || null,
    musicPlaying: Boolean(room.musicPlaying),
    sounds: room.sounds || {},
    question: q ? {
      question: q.question,
      options: (room.optionsShown || room.answerShown || host) ? q.options : [],
      difficulty: q.difficulty,
      category: q.category,
      // Never expose hidden choices or the answer through translation metadata.
      ...(q.translations ? {translations: Object.fromEntries(
        Object.entries(q.translations).map(([lang, tr]) => [lang, {
          question: tr.question,
          ...((host || room.optionsShown || room.answerShown) ? {options: tr.options} : {}),
          ...((host || room.answerShown) && tr.reference ? {reference: tr.reference} : {})
        }])
      )} : {}),
      ...(host || room.answerShown ? {
        answer: q.answer, reference: q.reference
      } : {})
    } : null
  };
}
const clients = new Map();
function changed(room) {
  room.version = (room.version || 0) + 1;
  room.updated = Date.now();
  saveRooms();
  const watchers = clients.get(room.code) || new Set();
  for (const watcher of watchers) {
    try { watcher.write('data: {"type":"changed"}\n\n'); }
    catch { watchers.delete(watcher); }
  }
}
for(const r of Object.values(rooms)){if(r.started&&!r.finished&&!r.optionsShown){
  if(r.earlyDeadline){if(!autoReveal(r))scheduleTimer(r);}
  else if(r.earlyRemaining!=null && !r.buzz){resumeTimer(r);}
}}
function authorize(req, room) {
  const supplied = req.headers["x-host-token"];
  return typeof supplied === "string" &&
    supplied.length === room.token.length &&
    crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(room.token));
}
const normalized = s => String(s || "").trim().replace(/\s+/g, " ");
function validateQuestion(q, index) {
  if (!q || typeof q !== "object") throw new Error("Post " + (index + 1) + ": ogiltigt objekt.");
  const canonical=importFormats.normalizeQuestion(q);
  const issue=importFormats.issue(canonical);
  if(issue)throw new Error("Fråga "+(index+1)+": "+issue+".");
  const question=normalized(canonical.question);
  const options=canonical.options.map(normalized);
  if (!question || options.length < 2 || options.length > 6 || options.some(x => x.length > 250))
    throw new Error("Fråga " + (index + 1) + ": kräver text och 2–6 alternativ.");
  const supplied = canonical.answer;
  let answer = -1;
  if (Number.isInteger(supplied)) answer = supplied;
  else if (typeof supplied === "string") {
    const value = supplied.trim();
    if (/^[A-F]$/i.test(value)) answer = value.toUpperCase().charCodeAt(0) - 65;
    else if (/^[0-5]$/.test(value)) answer = Number(value);
    else answer = options.findIndex(x => x.toLowerCase() === value.toLowerCase());
  }
  if (answer < 0 || answer >= options.length)
    throw new Error("Fråga " + (index + 1) + ": facit saknas eller är otydligt.");
  const difficulty = String(q.difficulty || q.svårighet || "medium").toLowerCase();
  // Preserve manually supplied bilingual text; answer index stays identical in every language.
  const translations = {};
  for (const lang of ["sv","en"]) {
    const t = q.translations?.[lang] || q[lang];
    if (!t || typeof t !== "object") continue;
    const tq = normalized(t.question);
    const topts = t.options;
    if (!tq || tq.length > 1000 || !Array.isArray(topts) || topts.length !== options.length) continue;
    const values = topts.map(normalized);
    if (values.some(x => !x || x.length > 250)) continue;
    translations[lang] = { question:tq, options:values, reference: normalized(t.reference).slice(0,250) };
  }
  return {
    id: crypto.randomUUID(), question, options, answer: String.fromCharCode(65 + answer),
    reference: normalized(q.reference || q.scripture || q.bibeltext || q.källa),
    difficulty: ["easy", "medium", "hard"].includes(difficulty) ? difficulty : "medium",
    category: normalized(q.category || q.kategori || "Importerade frågor"),
    ...(Object.keys(translations).length ? {translations} : {})
  };
}
function emitSound(room, cue) {
  room.audioEvent = { seq: (room.audioEvent?.seq || 0) + 1, cue };
}

function joinPlayer(room, body) {
  if (room.mode === 'simple') throw new Error('Det enkla läget sköts helt av spelledaren på datorn.');
  if (room.started && !room.finished) throw new Error("Spelomgången har börjat. Be spelledaren starta ett nytt spel.");
  const name = normalized(body.name).slice(0, 30);
  if (!name) throw new Error("Skriv ditt namn.");
  if (room.players.length >= 40) throw new Error("Högst 40 deltagare.");
  const existing = room.players.find(p => p.name.toLowerCase() === name.toLowerCase());
  if (existing) throw new Error("Namnet används redan. Välj ett annat namn.");
  const player = {id:crypto.randomUUID(),name,score:0,playerKey:crypto.randomBytes(24).toString("hex")};
  room.players.push(player);
  return {id:player.id,name:player.name,playerKey:player.playerKey};
}
function respondPlayer(room, body) {
  if (room.mode === 'simple') throw new Error('Det enkla läget använder inte mobilanslutna spelare.');
  const player = room.players.find(p => p.id === body.playerId);
  if (!player || !player.playerKey || body.playerKey !== player.playerKey)
    throw new Error("Din spelaranslutning har gått ut. Anslut igen.");
  if (!room.started || room.finished || room.answerShown)
    throw new Error("Vänta på en aktiv fråga.");
  if (room.award) throw new Error("Frågan har redan fått en vinnare.");
  if (room.buzz) throw new Error("En annan spelare svarade först.");
  if ((room.attempted || []).includes(player.id)) throw new Error("Du har redan svarat på den här frågan.");
  if (!room.optionsShown) {
    if (body.type !== "buzz") throw new Error("Tryck på SVARA innan alternativen visas.");
    pauseTimer(room);
    room.buzz = {playerId:player.id,name:player.name,phase:"early"};
  } else {
    if (body.type !== "choose") throw new Error("Välj ett svarsalternativ.");
    const question=questionFor(room);
    const choice=String(body.choice||"").toUpperCase();
    if (!/^[A-F]$/.test(choice) || choice.charCodeAt(0)-65>=question.options.length)
      throw new Error("Ogiltigt svarsalternativ.");
    const correct=choice===question.answer;
    room.lastAttempt={playerId:player.id,name:player.name,choice,correct};
    if (correct) {
      const points=room.index===19?5:1;
      player.score+=points;
      room.award={playerId:player.id,name:player.name,points};
      room.buzz={playerId:player.id,name:player.name,phase:"options",choice};
      emitSound(room,"correct");
    } else {
      room.attempted ||= [];
      room.attempted.push(player.id);
      emitSound(room,"wrong");
    }
  }
}
function act(room, body) {
  switch (body.type) {
    case "setMode": {
      if (room.started && !room.finished) throw new Error('Byt spelläge före start eller efter avslutad omgång.');
      if (!['standard','simple'].includes(body.mode)) throw new Error('Ogiltigt spelläge.');
      room.mode = body.mode;
      break;
    }
    case "addPlayer": {
      if (room.started && !room.finished) throw new Error("Lägg till spelare före omgången.");
      const name = normalized(body.name).slice(0, 30);
      if (!name) throw new Error("Ange ett namn.");
      if (room.players.length >= 40) throw new Error("Högst 40 spelare.");
      if (room.players.some(p => p.name.toLowerCase() === name.toLowerCase()))
        throw new Error("Namnet finns redan.");
      room.players.push({ id: crypto.randomUUID(), name, score: 0 });
      break;
    }
    case "removePlayer": {
      if (room.started && !room.finished) throw new Error("Spelarlistan är låst under omgången.");
      room.players = room.players.filter(p => p.id !== body.playerId);
      break;
    }
    case "setDuration": {
      const value=Number(body.seconds);
      if(!ANSWER_TIMES.has(value))throw new Error("Välj 5, 10 eller 15 sekunder.");
      room.answerWaitSeconds=value;
      break;
    }
    case "start": {
      if (room.started && !room.finished) throw new Error("Omgången pågår.");
      if (!room.players.length) throw new Error("Lägg till minst en spelare.");
      room.questionIds = pickQuestions();
      room.players.forEach(p => p.score = 0);
      room.index = 0; room.started = true; room.finished = false;
      room.optionsShown = false; room.answerShown = false; room.award = null;
      room.buzz = null; room.lastAttempt = null; room.attempted = [];
      room.musicPlaying = true;
      startTimer(room);
      emitSound(room, "start");
      break;
    }
    case "showOptions": {
      if (!room.started || room.finished) throw new Error("Ingen aktiv fråga.");
      cancelTimer(room);room.earlyDeadline=null;room.earlyRemaining=null;
      room.optionsShown = true;
      room.buzz = null; room.lastAttempt = null; room.attempted = [];
      emitSound(room, "reveal");
      break;
    }
    case "showAnswer": {
      if (!room.started || room.finished) throw new Error("Ingen aktiv fråga.");
      cancelTimer(room);room.earlyDeadline=null;room.earlyRemaining=null;
      room.answerShown = true;
      break;
    }
    case "award": {
      if (!room.started || room.finished) throw new Error("Ingen aktiv fråga.");
      if (room.award) throw new Error("Poängen för frågan har redan delats ut. Använd Ångra.");
      if (room.mode !== 'simple' && room.buzz && room.buzz.playerId !== body.playerId)
        throw new Error("Det är bara den som svarade först som kan få poäng.");
      const player = room.players.find(p => p.id === body.playerId);
      if (!player) throw new Error("Välj en spelare.");
      const points = room.index === 19 ? 5 : room.optionsShown ? 1 : 3;
      player.score += points;
      room.award = { playerId: player.id, name: player.name, points };
      emitSound(room, "correct");
      break;
    }
    case "undo": {
      if (!room.award) throw new Error("Inga poäng att ångra på denna fråga.");
      const player = room.players.find(p => p.id === room.award.playerId);
      if (player) player.score = Math.max(0, player.score - room.award.points);
      room.award = null;
      room.buzz = null;
      break;
    }
    case "next": {
      if (!room.started || room.finished) throw new Error("Ingen aktiv omgång.");
      if (room.index === 19) {
        cancelTimer(room);room.earlyDeadline=null;room.earlyRemaining=null;
        room.finished = true;
        room.musicPlaying = false;
        emitSound(room, "win");
      } else {
        room.index++;
        room.optionsShown = false;
        room.answerShown = false; room.award = null;
        room.buzz = null; room.lastAttempt = null; room.attempted = [];
        startTimer(room);
        emitSound(room, "next");
      }
      break;
    }
    case "wrong": {
      if (!room.started || room.finished) throw new Error("Ingen aktiv fråga.");
      if (room.buzz && !room.award) {
        room.attempted ||= [];
        room.attempted.push(room.buzz.playerId);
        room.lastAttempt={...room.buzz,correct:false};
        room.buzz=null;
        resumeTimer(room);
      }
      emitSound(room, "wrong");
      break;
    }
    case "music": {
      room.musicPlaying = Boolean(body.playing);
      break;
    }
    case "sound": {
      if (!["start","correct","wrong","reveal","win","next"].includes(body.cue))
        throw new Error("Ogiltig ljudeffekt.");
      emitSound(room, body.cue);
      break;
    }
    default: throw new Error("Okänt kommando.");
  }
}
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".svg": "image/svg+xml", ".png": "image/png", ".mp4": "video/mp4", ".webmanifest": "application/manifest+json" };
function serveStatic(req, res, route) {
  const requested = route === "/tv" ? "/tv.html" : (route === "/play" ? "/player.html" : (route === "/" || route === "/host" ? "/index.html" : route));
  const full = path.resolve(ROOT, "public", "." + requested);
  const publicDir = path.join(ROOT, "public") + path.sep;
  if (!full.startsWith(publicDir)) return error(res, 403, "Förbjuden sökväg.");
  fs.readFile(full, (e, data) => {
    if (e) return error(res, 404, "Sidan finns inte.");
    res.writeHead(200, { "Content-Type": (TYPES[path.extname(full)] || "application/octet-stream") + "; charset=utf-8",
      "Cache-Control": "no-cache", "X-Content-Type-Options": "nosniff" });
    res.end(data);
  });
}
const server = http.createServer(async (req, res) => {
  const route = new URL(req.url, "http://localhost").pathname;
  const method = req.method;
  try {
    const soundFileMatch = route.match(/^\/api\/sounds\/(\d{6})\/(start|correct|wrong|music|win|reveal|next)$/);
    if (soundFileMatch && method === "GET") {
      const room = rooms[soundFileMatch[1]], cue = soundFileMatch[2];
      const sound = room?.sounds?.[cue];
      if (!sound || !/^[a-z0-9]+\.(mp3|wav|ogg|m4a|opus)$/.test(sound.filename))
        return error(res, 404, "Ljudfilen finns inte.");
      const filename = path.join(AUDIO_DIR, room.code, sound.filename);
      return fs.readFile(filename, (err, bytes) => {
        if (err) return error(res, 404, "Ljudfilen finns inte.");
        res.writeHead(200, { "Content-Type": sound.mime, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Access-Control-Allow-Origin":"*" });
        res.end(bytes);
      });
    }
    if (route === "/api/rooms" && method === "POST") {
      const settings = await receive(req);
      const mode = settings.mode === "simple" ? "simple" : "standard";
      let code;
      do { code = String(crypto.randomInt(100000, 1000000)); } while (rooms[code]);
      const room = { code, token: crypto.randomBytes(32).toString("hex"), mode, players: [],
        questionIds: [], started: false, finished: false, index: 0,
        optionsShown: false, answerShown: false, award: null,
        answerWaitSeconds:5,earlyDeadline:null,earlyRemaining:null,
        buzz:null, lastAttempt:null, attempted:[],
        version: 0, updated: Date.now(), musicPlaying: false, sounds: {}, audioEvent: null };
      rooms[code] = room; saveRooms();
      return send(res, 201, { code, token: room.token });
    }
    const match = route.match(/^\/api\/rooms\/(\d{6})(?:\/(host|action|events|import|sound|join|respond))?$/);
    if (match) {
      const [, code, kind] = match;
      const room = rooms[code];
      if (!room) return error(res, 404, "Spelkoden finns inte. Skapa ett nytt spel.");
      autoReveal(room);
      if (kind === "events" && method === "GET") {
        res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache",
          "Connection": "keep-alive", "X-Accel-Buffering": "no" });
        res.write('data: {"type":"connected"}\n\n');
        if (!clients.has(code)) clients.set(code, new Set());
        clients.get(code).add(res);
        const heartbeat = setInterval(() => { try { res.write(": heartbeat\n\n"); } catch {} }, 25000);
        req.on("close", () => { clearInterval(heartbeat); clients.get(code)?.delete(res); });
        return;
      }
      if (kind === "import" && method === "GET") {
        if (!authorize(req, room)) return error(res, 403, "Endast spelledaren får se frågebanken.");
        return send(res,200,{bankCount:bank.length,pendingCount:pending.length});
      }
      if (kind === "host" && method === "GET") {
        if (!authorize(req, room)) return error(res, 403, "Felaktig spelledarnyckel.");
        return send(res, 200, snapshot(room, true));
      }
      if (!kind && method === "GET") { res.setHeader("Access-Control-Allow-Origin","*"); return send(res, 200, snapshot(room)); }
      
      if ((kind === "join" || kind === "respond") && method === "POST") {
        const body = await receive(req);
        if (kind === "join") {
          const player = joinPlayer(room,body);
          changed(room);
          return send(res,201,{player,room:snapshot(room,false)});
        }
        respondPlayer(room,body);
        changed(room);
        return send(res,200,snapshot(room,false));
      }
      if ((kind === "action" || kind === "import" || kind === "sound") && method === "POST") {
        if (!authorize(req, room)) return error(res, 403, "Endast spelledaren får ändra.");
        const body = await receive(req);
        if (kind === "action") {
          act(room, body); changed(room);
          return send(res, 200, snapshot(room, true));
        }
        if (kind === "sound") {
          const cue = String(body.cue || "");
          const ext = String(body.extension || "").toLowerCase();
          const types = { mp3:"audio/mpeg", wav:"audio/wav", ogg:"audio/ogg", m4a:"audio/mp4", opus:"audio/ogg; codecs=opus" };
          if (!["start","correct","wrong","music","win","reveal","next"].includes(cue) || !types[ext])
            return error(res, 400, "Använd MP3, Opus, WAV, OGG eller M4A.");
          const encoded = String(body.content || "");
          if (encoded.length > 10_700_000 || !/^[a-zA-Z0-9+/]*={0,2}$/.test(encoded))
            return error(res, 400, "Ljudfilen är för stor eller ogiltig (max ca 8 MB).");
          const bytes = Buffer.from(encoded, "base64");
          if (!bytes.length || bytes.length > 8_000_000)
            return error(res, 400, "Ljudfilen är för stor eller tom.");
          const folder = path.join(AUDIO_DIR, room.code);
          fs.mkdirSync(folder, { recursive:true });
          for (const name of fs.readdirSync(folder))
            if (name.startsWith(cue+".")) fs.unlinkSync(path.join(folder,name));
          const filename = cue+"."+ext;
          fs.writeFileSync(path.join(folder,filename), bytes);
          room.sounds ||= {};
          room.sounds[cue] = { filename, mime:types[ext], url:"/api/sounds/"+room.code+"/"+cue+"?v="+Date.now() };
          changed(room);
          return send(res, 200, { cue, url:room.sounds[cue].url });
        }
        if (!Array.isArray(body.questions) || body.questions.length > 500 ||
            (body.pending!==undefined && (!Array.isArray(body.pending)||body.pending.length>500)))
          return error(res, 400, "Skicka högst 500 färdiga och 500 ofullständiga frågor åt gången.");
        let added=0,skipped=0,pendingAdded=0,pendingSkipped=0;
        const errors=[];
        const keyOf=value=>String(value||"").trim().replace(/\s+/g," ").toLocaleLowerCase();
        const readyKnown=new Set(bank.map(q=>keyOf(q.question)));
        const pendingKnown=new Set(pending.map(q=>keyOf(q.question)));
        body.questions.forEach((raw,i)=>{
          try{
            const q=validateQuestion(raw,i),key=keyOf(q.question);
            if(readyKnown.has(key)){skipped++;return;}
            readyKnown.add(key);bank.push(q);added++;
          }catch(e){errors.push(e.message);}
        });
        // A later, verified version automatically replaces the staged one.
        const formerlyPending=pending.length;
        pending=pending.filter(q=>!readyKnown.has(keyOf(q.question)));
        for(const raw of body.pending||[]){
          const text=String(raw?.question||"").trim().replace(/\s+/g," ").slice(0,1000);
          if(!text){errors.push("En fråga utan text kunde inte sparas.");continue;}
          const key=keyOf(text);
          if(readyKnown.has(key)||pendingKnown.has(key)){pendingSkipped++;continue;}
          const answer=typeof raw.answer==="string"?raw.answer.trim().slice(0,250):null;
          pending.push({
            id:crypto.randomUUID(),question:text,number:Number.isInteger(raw.number)?raw.number:null,
            sourceId:String(raw.sourceId||"").slice(0,100),
            sourceImage:String(raw.sourceImage||"").slice(0,180),
            language:String(raw.language||"").slice(0,20),
            quiz:String(raw.quiz||"").slice(0,80),
            reference:String(raw.reference||"").slice(0,250),
            category:String(raw.category||"").slice(0,120),
            answer,reason:String(raw.reason||"facit eller alternativ saknas").slice(0,150),
            status:"waiting-for-verified-answer"
          });
          pendingKnown.add(key);pendingAdded++;
        }
        if(added)saveBank();
        if(pendingAdded||pending.length!==formerlyPending)savePending();
        if(added||pendingAdded)changed(room);
        return send(res,200,{added,skipped,pendingAdded,pendingSkipped,errors,
          bankCount:bank.length,pendingCount:pending.length});
      }
    }
    if (route.startsWith("/api/")) return error(res, 404, "Okänd API-adress.");
    if (method !== "GET" && method !== "HEAD") return error(res, 405, "Metoden stöds inte.");
    return serveStatic(req, res, route);
  } catch (e) {
    console.error("Request error:", e.message);
    return error(res, 400, e.message || "Något gick fel.");
  }
});
if (require.main === module) server.listen(PORT, "0.0.0.0", () => {
  console.log("Bibel Frågesport: http://localhost:" + PORT);
});
module.exports = { server, validateQuestion, pickQuestions, snapshot, act, joinPlayer, respondPlayer };

