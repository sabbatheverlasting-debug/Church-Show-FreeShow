"use strict";
// Private scope avoids global collisions with WebView window.top and other scripts.
(function quizApp(){
const $ = id => document.getElementById(id);
const app = $("app");
// Android WebView and privacy modes may deny localStorage: never stop startup.
const volatileSettings = {};
const store = (key, value) => {
  volatileSettings[key] = String(value);
  try { localStorage.setItem("quiz-" + key, String(value)); } catch (_ignored) {}
};
const get = (key, fallback="") => {
  try { return localStorage.getItem("quiz-" + key) || volatileSettings[key] || fallback; }
  catch (_ignored) { return volatileSettings[key] || fallback; }
};
const state = { code:get("code"), token:get("token"), hostCode:get("hostCode",get("code")), role:location.pathname==="/tv"?"tv":"home",
  game:null, selected:"", lang:get("lang","sv"), bible:get("bible",""), playMode:get("playMode","standard"), connected:false, polling:0,
  scanText:"", scanFiles:[], scanIndex:0, scanning:false, bibleNames:[], filesAdded:0, panel:null, audioRoom:"", lastAudioSeq:0, ocrFailedFiles:[], photoPreviewUrl:"" };
const words = {
 sv:{title:"Bibel Frågesport",tagline:"20 frågor · Alla spelar tillsammans",host:"Spelledare – mobil",tv:"TV – visa frågor",
 join:"Anslut till spel",code:"Sexsiffrig spelkod",joinBtn:"Anslut",resume:"Fortsätt som spelledare",create:"Skapa nytt spel",
 back:"Till startsidan",players:"Deltagare",add:"Lägg till",remove:"Ta bort",start:"Starta 20 frågor",round:"Fråga",of:"av",
 points:"Poängställning",correctBefore:"Rätt före alternativen: 3 poäng",correctAfter:"Rätt efter alternativen: 1 poäng",
 final:"Utslagsfråga · 5 poäng",options:"Visa alternativ",answer:"Visa facit",next:"Nästa fråga",end:"Avsluta omgång",
 undo:"Ångra poäng",award:"Ge poäng",select:"Tryck på namnet som svarade rätt",winner:"Omgången är avslutad!",
 noOptions:"Spelarna svarar utan alternativ för 3 poäng.",waiting:"Väntar på spelledaren",settings:"Inställningar",
 import:"Importera frågor",language:"Spelspråk",bible:"Vald bibel",bibleUpload:"Importera bibel (JSON / SRB26)",
 note:"TV-vyn visar inte facit förrän spelledaren väljer det.",room:"Spelkod",tvLink:"TV-adress",
 mode:"Samma nätverk krävs om huvudmobilen är server.",reset:"Ny omgång",playerName:"Deltagarens namn",
 scan:"Läs frågor från bilder",files:"Välj flera bilder eller filer",fileGuide:"Bilder: JPG, PNG, WEBP. Filer: JSON, CSV, TXT, MD. Max 3 MB per serverimport.",
 review:"Kontrollera och redigera frågorna före import",saveQuestions:"Importera godkända frågor",autoTranslate:"Översätt importerade frågor (beta)",
 translated:"Svenska och engelska sparas som separata versioner när översättning finns.",export:"Ladda ned säkerhetskopia",
 noBible:"Ingen uppladdad bibel",finalNotice:"Sista frågan är svårare och ger 5 poäng",address:"Öppna på TV eller iPhone",
 passed:"Hoppa vidare utan poäng",noPlayers:"Lägg till minst en deltagare.",already:"Poäng redan tilldelade denna fråga.",
 reference:"Bibelhänvisning",chooseFile:"Välj fil",subtitle:"Hela familjen kan spela tillsammans",
 uploadHelp:"För 400+ foton: importera i grupper, granska tolkad text och spara dina originalbilder."},
 en:{title:"Bible Trivia Game",tagline:"20 questions · Play together",host:"Host – phone",tv:"TV – show questions",
 join:"Join game",code:"Six-digit game code",joinBtn:"Join",resume:"Continue as host",create:"Create new game",
 back:"Home",players:"Players",add:"Add",remove:"Remove",start:"Start 20 questions",round:"Question",of:"of",
 points:"Leaderboard",correctBefore:"Correct before choices: 3 points",correctAfter:"Correct after choices: 1 point",
 final:"Final question · 5 points",options:"Show choices",answer:"Reveal answer",next:"Next question",end:"Finish round",
 undo:"Undo points",award:"Award points",select:"Tap the player who answered correctly",winner:"The round has ended!",
 noOptions:"Players answer without choices for 3 points.",waiting:"Waiting for the host",settings:"Settings",
 import:"Import questions",language:"Game language",bible:"Selected Bible",bibleUpload:"Import Bible (JSON / SRB26)",
 note:"The TV never reveals the correct answer before the host does.",room:"Game code",tvLink:"TV address",
 mode:"Devices must be on the same network if the host phone runs the server.",reset:"New round",
 playerName:"Player name",scan:"Read questions from photos",files:"Choose multiple photos or files",
 fileGuide:"Images: JPG, PNG, WEBP. Files: JSON, CSV, TXT, MD. Max 3MB per server import.",
 review:"Review and correct questions before importing",saveQuestions:"Import verified questions",
 autoTranslate:"Translate imported questions (beta)",translated:"Swedish and English remain separately available when provided.",
 export:"Download backup",noBible:"No Bible imported",finalNotice:"The last question is harder and worth 5 points",
 address:"Open on TV or iPhone",passed:"Continue without points",noPlayers:"Add at least one player.",
 already:"Points already awarded for this question.",reference:"Bible reference",chooseFile:"Choose a file",
 subtitle:"Play Bible trivia with your whole family",uploadHelp:"For 400+ photos: import in batches, review the recognized text, and keep your original photos."}
};
function t(key){return words[state.lang]?.[key] || words.sv[key] || key;}
const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const safeUrl = s => String(s).replace(/"/g,"%22");
function notice(message){const box=$("toast");box.textContent=message;box.classList.add("show");clearTimeout(notice.timer);notice.timer=setTimeout(()=>box.classList.remove("show"),4500)}
async function call(route, method="GET", value, host=false){
 const options={method,headers:{"Accept":"application/json"}};
 if(host)options.headers["X-Host-Token"]=state.token;
 if(value!==undefined){options.headers["Content-Type"]="application/json";options.body=JSON.stringify(value);}
 const res=await fetch(route,options);
 const result=await res.json().catch(()=>({}));
 if(!res.ok) throw Error(result.error || "HTTP "+res.status);
 return result;
}
const api = suffix=>"/api/rooms/"+state.code+(suffix || "");
function renderMasthead(){return '<header class="masthead"><div class="crown">♛ 📖</div><h1>'+t("title")+'</h1><p>'+t("tagline")+'</p></header>'}
function view(content){app.innerHTML='<main class="app-shell">'+renderMasthead()+content+'<footer class="footer">Bible Trivia Game · v1.4.0 · <span id="networkstatus"></span></footer></main>'; document.body.classList.toggle("tv",state.role==="tv"); document.documentElement.dataset.appStarted='true';}
function btn(id,text,type=""){return '<button type="button" id="'+id+'" class="btn '+type+'">'+text+'</button>'}
function translated(q){
 if(!q)return null;
 const extra=q.translations?.[state.lang] || q[state.lang];
 return extra?.question ? {...q,...extra} : q;
}
function headerControls(){
 return '<div class="row between"><span class="pill">🔑 '+t("room")+': <strong>'+esc(state.code)+'</strong></span><div class="row">'
 +btn("settingsBtn","⚙ "+t("settings"),"ghost")+btn("homeBtn","⌂ "+t("back"),"ghost")+'</div></div>';
}
function board(game){
 const players=[...game.players].sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name));
 return '<section class="panel"><h2>🏆 '+t("points")+'</h2>'+
 (players.length?players.map((p,i)=>'<div class="score '+(i===0?"top":"")+'"><span>'+(i===0?"👑 ":i+1+". ")+esc(p.name)+'</span><strong>'+p.score+'</strong></div>').join(""):'<p class="muted">'+t("noPlayers")+'</p>')+'</section>';
}
function progress(n){
 return '<div class="progress" aria-label="'+n+'/20">'+Array.from({length:20},(_,i)=>'<i class="'+(i<n?"done":i===n?"current":"")+'"></i>').join("")+'</div>';
}
let clockKey='',clockBase=0,clockEnd=0,clockPaused=false;
function clockRemaining(game){
 if(!game||!game.started||game.finished||game.optionsShown||game.answerShown)return 0;
 const key=game.code+":"+game.index+":"+game.version;
 if(clockKey!==key){clockKey=key;clockBase=Number(game.countdownRemainingMs)||0;clockPaused=!!game.countdownPaused;clockEnd=Date.now()+clockBase;}
 return clockPaused?clockBase:Math.max(0,clockEnd-Date.now());
}
function clockText(game){const n=clockRemaining(game);return (clockPaused?"⏸ ":"⏳ ")+Math.ceil(n/1000)+" s";}
setInterval(()=>{const el=document.getElementById("quizEarlyClock");if(el&&state.game)el.textContent=clockText(state.game);},150);
function questionPanel(game,host){
 const q=translated(game.question);
 if(!q)return '<div class="panel center"><h2>'+t("waiting")+'</h2><p>'+t("room")+': '+esc(game.code)+'</p></div>';
 const final=game.index===19;
 const answerIdx=q.options.findIndex((_,i)=>String.fromCharCode(65+i)===q.answer);
 const allOptions=game.optionsShown || game.answerShown || host;
 const shown=game.optionsShown || game.answerShown;
 return '<div class="panel glow"><div class="row between"><span class="pill">'+t("round")+' '+(game.index+1)+' '+t("of")+' 20</span><span class="gold">'+(final?t("final"):(shown?t("correctAfter"):t("correctBefore")))+'</span></div>'
 +progress(game.index)+'<div class="question"><strong>'+esc(q.question)+'</strong></div>'+(!shown?'<p id="quizEarlyClock" class="center" style="font:bold clamp(24px,4vw,54px) system-ui;color:#f6d38a">'+clockText(game)+'</p>':'')
 +(shown?'<div class="answer-grid">'+q.options.map((op,i)=>'<div class="answer '+(game.answerShown&&i===answerIdx?"correct":"")+'"><b>'+String.fromCharCode(65+i)+'</b><span>'+esc(op)+'</span></div>').join("")+'</div>':
 '<p class="center muted" style="padding:18px 0">'+t("noOptions")+'</p>')
 +(game.answerShown?'<p class="center success"><strong>✓ '+esc(q.answer)+': '+esc(q.options[answerIdx] || "")+'</strong> · '+esc(q.reference || "")+'</p>':"")
 +(host?'<div class="subtle small">🔒 Host: '+q.options.map((x,i)=>String.fromCharCode(65+i)+') '+esc(x)).join(" · ")+'<p><strong>'+esc(q.answer)+': '+esc(q.reference || "")+'</strong></p></div>':"")
 +'</div>';
}
async function returnToHost(){
  if(!state.token||!state.hostCode)return landing();
  state.code=state.hostCode;
  store("code",state.hostCode);
  state.role="host"; state.panel=null; state.game=null;
  history.replaceState(null,"","/host");
  await load();
}
function landing(){
 view('<div class="menu-grid"><section class="panel stack"><h2>📱 '+t("host")+'</h2><p class="muted">'+t("subtitle")+'</p>'+
 btn("createBtn",t("create"),"gold full")+(state.code&&state.token?btn("resumeBtn",t("resume"),"full"):"")+
 '<p class="muted">'+t("mode")+'</p></section><section class="panel stack"><h2>📺 '+t("tv")+'</h2>'+
 '<label for="joinCode">'+t("code")+'</label><input type="text" inputmode="numeric" maxlength="6" id="joinCode" value="'+esc(state.code)+'" placeholder="123456">'+
 btn("joinBtn",t("joinBtn"),"gold full")+'<p class="muted">'+t("note")+'</p></section></div>'+
 '<div class="row" style="margin-top:18px">'+btn("landingSettings","⚙ "+t("settings"),"ghost")+'</div>');
 $("createBtn").onclick=async()=>{try{const room=await call("/api/rooms","POST",{mode:state.playMode});state.code=room.code;state.hostCode=room.code;try{if(window.parent!==window)window.parent.postMessage({type:"churchshow-quiz-room",code:room.code}, "*");}catch(_){}state.token=room.token;store("code",state.code);store("hostCode",state.hostCode);store("token",state.token);await returnToHost();}catch(e){notice(e.message)}};
 if($("resumeBtn")) $("resumeBtn").onclick=()=>returnToHost();
 $("joinBtn").onclick=()=>{const code=$("joinCode").value.trim();if(!/^\d{6}$/.test(code))return notice(t("code"));if(state.token&&state.hostCode===code)return returnToHost();state.code=code;store("code",code);state.role="tv";history.replaceState(null,"","/tv?code="+encodeURIComponent(code));load()};
 $("landingSettings").onclick=()=>settings();
}
async function load(silent=false){
 if(!state.code)return landing();
 try{
 const room=await call(api(state.role==="host"?"/host":"") ,"GET",undefined,state.role==="host");
 state.game=room;state.connected=true;if(!silent)render();else refreshView();poll();
 }catch(e){state.connected=false;if(!silent){notice(e.message);state.role="home";landing();} }
}
function poll(){
 if(state.polling)return;
 state.polling=setInterval(async()=>{if(!["host","tv"].includes(state.role))return;
 try{const room=await call(api(state.role==="host"?"/host":""),"GET",undefined,state.role==="host");
 if(!state.game || room.version!==state.game.version || room.bankCount!==state.game.bankCount){state.game=room;render();}
 }catch(e){state.connected=false;}
 },1500);
}
function refreshView(){render()}
function render(){
 if(state.role==="home")return landing();
 if(state.role==="host"&&state.panel==="audio")return renderSoundSettings();
 if(!state.game)return;
 if(state.role==="tv")return renderTv(state.game);
 return renderHost(state.game);
}
function renderTv(game){
 const sound=window.QuizAudio;
 const audioBar=!sound?.unlocked
 ? '<section class="panel row between"><p>🔇 '+(state.lang==="sv"?"Tryck en gång på TV:n för att få spelmusik och ljudeffekter.":"Tap once on the TV to allow quiz music and sounds.")+'</p>'+btn("enableTVAudio","🔊 "+(state.lang==="sv"?"Aktivera TV-ljud":"Enable TV sound"),"gold")+'</section>'
 : '<div class="row between"><span class="pill">🔊 '+(state.lang==="sv"?"TV-ljud aktiverat":"TV sound active")+'</span><label style="display:flex;gap:8px;align-items:center">'+(state.lang==="sv"?"Volym":"Volume")+' <input type="range" id="tvVolume" min="0" max="100" value="'+Math.round(sound.volume*100)+'" style="width:150px"></label></div>';
 view((state.token&&state.hostCode?'<section class="panel stack" style="margin-bottom:12px"><p class="muted">'+(state.lang==="sv"?"Den här mobilen har även ett spelledarläge.":"This phone also has a host mode.")+'</p>'+btn("goHostBtn","📱 "+(state.lang==="sv"?"Gå till spelledare":"Return to host"),"gold full")+'</section>':"")+audioBar+'<div class="row between"><span class="pill">🔑 '+t("room")+': '+esc(state.code)+'</span><span class="pill">'+t("correctBefore")+' · '+t("correctAfter")+'</span></div>'+
 '<div class="columns" style="margin-top:18px"><div>'+ (game.finished?finale(game):!game.started?
 '<section class="panel center"><h2>'+t("waiting")+'</h2><p class="muted">'+t("room")+': '+esc(state.code)+'</p></section>':questionPanel(game,false))+
 '</div>'+board(game)+'</div>');
 document.title=t("title")+" – TV";
 if($("goHostBtn"))$("goHostBtn").onclick=()=>returnToHost();
 if($("enableTVAudio"))$("enableTVAudio").onclick=async()=>{try{await window.QuizAudio.enable();render()}catch(e){notice(e.message)}};
 if($("tvVolume"))$("tvVolume").oninput=e=>window.QuizAudio.setVolume(e.target.value/100);
 syncAudio(game);
}
function finale(game){
 const sorted=[...game.players].sort((a,b)=>b.score-a.score);
 const high=sorted[0]?.score;const winners=sorted.filter(p=>p.score===high);
 return '<section class="panel center glow"><div style="font-size:4rem">🏆</div><h1>'+t("winner")+'</h1><h2 style="margin-top:24px">'+winners.map(p=>esc(p.name)).join(" & ")+'</h2><p>'+esc(high)+" "+(state.lang==="sv"?"poäng":"points")+'</p></section>';
}
async function action(type,props={}){
 try{const room=await call(api("/action"),"POST",{type,...props},true);state.game=room;render();}
 catch(e){notice(e.message);}
}

function syncAudio(game){
 const audio=window.QuizAudio;if(!audio||!game)return;
 if(state.audioRoom!==game.code){state.audioRoom=game.code;state.lastAudioSeq=game.audioEvent?.seq||0}
 if(game.audioEvent?.seq && game.audioEvent.seq!==state.lastAudioSeq){
  state.lastAudioSeq=game.audioEvent.seq;
  audio.play(game.audioEvent.cue,game.sounds?.[game.audioEvent.cue]?.url||"");
 }
 audio.setMusic(Boolean(game.musicPlaying),game.sounds?.music?.url||"");
}
function readSoundFile(file){
 return new Promise((resolve,reject)=>{
  const reader=new FileReader();
  reader.onload=()=>resolve(String(reader.result||"").split(",")[1]||"");
  reader.onerror=()=>reject(reader.error||Error("Could not read file"));
  reader.readAsDataURL(file);
 });
}
function renderSoundSettings(){
 const sound=window.QuizAudio;
 const labels=state.lang==="sv"
 ? {correct:"✓ Rätt svar",wrong:"✖ Fel svar",music:"♫ Bakgrundsmusik",win:"🏆 Segerfanfar",start:"♛ Startfanfar",reveal:"◉ Visa alternativ",next:"➜ Nästa fråga"}
 : {correct:"✓ Correct",wrong:"✖ Incorrect",music:"♫ Background music",win:"🏆 Winner fanfare",start:"♛ Intro",reveal:"◉ Reveal choices",next:"➜ Next question"};
 const custom=state.game?.sounds||{};
 view('<section class="panel stack" style="max-width:760px;margin:auto"><h2>🔊 '+(state.lang==="sv"?"Ljud och musik":"Sound & music")+'</h2>'+
 '<p class="muted">'+(state.lang==="sv"
 ? "Egna frågesportsljud ingår. Du kan byta varje effekt mot MP3, Opus, WAV, OGG eller M4A (max 8 MB). Uppladdade ljud hörs även på TV:n."
 : "Original quiz sounds included. Replace each sound with MP3, Opus, WAV, OGG or M4A (max 8 MB). Uploaded sounds also play on TV.")+'</p>'+
 (!sound?.unlocked?btn("enableHostAudio","🔊 "+(state.lang==="sv"?"Aktivera ljud på mobilen":"Enable phone sound"),"gold full"):'<p class="success">✓ '+(state.lang==="sv"?"Mobilens ljud aktiverat":"Phone sound enabled")+'</p>')+
 '<label for="hostVolume">'+(state.lang==="sv"?"Volym på denna enhet":"Volume on this device")+'</label>'+
 '<input id="hostVolume" type="range" min="0" max="100" value="'+Math.round((sound?.volume||.65)*100)+'">'+
 Object.entries(labels).map(([cue,label])=>'<div class="subtle stack"><div class="row between"><strong>'+label+'</strong>'+
 (custom[cue]?'<span class="pill">'+(state.lang==="sv"?"Eget ljud":"Custom sound")+'</span>':'<span class="muted">'+(state.lang==="sv"?"Standardljud":"Default sound")+'</span>')+'</div>'+
 '<input type="file" id="upload-'+cue+'" accept=".mp3,.opus,.wav,.ogg,.m4a,audio/*">'+
 btn("preview-"+cue,"▶ "+(state.lang==="sv"?"Provlyssna":"Preview"),"ghost")+'</div>').join("")+
 '<p class="muted">'+(state.lang==="sv"?"På TV-skärmen måste du trycka Aktivera TV-ljud en gång.":"Tap Enable TV sound once on the TV screen.")+'</p>'+
 btn("soundBack","← "+t("back"),"gold full")+'</section>');
 if($("enableHostAudio"))$("enableHostAudio").onclick=async()=>{try{await sound.enable();renderSoundSettings();syncAudio(state.game)}catch(e){notice(e.message)}};
 $("hostVolume").oninput=e=>sound.setVolume(e.target.value/100);
 $("soundBack").onclick=()=>{sound.stopMusic();state.panel=null;render()};
 for(const cue of Object.keys(labels)){
  $("preview-"+cue).onclick=async()=>{
   try{
    if(!sound.unlocked)await sound.enable();
    if(cue==="music"){sound.setMusic(true,custom.music?.url||"");
     setTimeout(()=>{sound.stopMusic();if(state.game?.musicPlaying)sound.setMusic(true,state.game.sounds?.music?.url||"")},5000);
    }else sound.play(cue,custom[cue]?.url||"");
   }catch(e){notice(e.message)}
  };
  $("upload-"+cue).onchange=async e=>{
   const file=e.target.files?.[0];if(!file)return;
   const ext=file.name.split(".").pop().toLowerCase();
   if(!["mp3","opus","wav","ogg","m4a"].includes(ext))return notice("MP3 / Opus / WAV / OGG / M4A");
   if(file.size>8_000_000)return notice("Max 8 MB");
   try{
    const content=await readSoundFile(file);
    const result=await call(api("/sound"),"POST",{cue,extension:ext,content},true);
    if(!state.game.sounds)state.game.sounds={};
    state.game.sounds[cue]={url:result.url};
    notice("✓ "+file.name);renderSoundSettings();
   }catch(err){notice(err.message)}
  };
 }
}

function hostControls(game){
 const players=game.players;
 const simple=game.mode==="simple";
 if(game.buzz && !game.award)state.selected=game.buzz.playerId;
 const canAward=game.started&&!game.finished&&!game.award;
 const points=game.index===19?5:game.optionsShown?1:3;
 return '<section class="panel"><h2>🎮 '+t("host")+'</h2>'+
 (game.buzz?'<p class="status" style="padding:12px;background:#113669;border:1px solid #f1c16b;border-radius:12px;color:#ffe4aa">⚡ '+(state.lang==="sv"?"Först att svara: ":"First to answer: ")+esc(game.buzz.name)+'</p>':"")+
 (game.lastAttempt&&!game.lastAttempt.correct?'<p class="muted">✖ '+esc(game.lastAttempt.name)+(state.lang==="sv"?" svarade fel. Nästa deltagare kan försöka.":" answered incorrectly. Another player can try.")+'</p>':"")+
 (game.award&&game.lastAttempt&&game.lastAttempt.correct?'<p class="success">✓ '+(state.lang==="sv"?"Automatisk poäng till ":"Automatic point for ")+esc(game.award.name)+'</p>':"")+
 '<p class="muted">'+(simple?(state.lang==="sv"?"3 poäng före alternativen, 1 poäng efteråt. Klicka direkt på namnet som svarade rätt. Fråga 20 ger 5 poäng.":"3 points before choices, 1 afterward. Click the winning name directly. Question 20 gives 5 points."):(game.buzz?(state.lang==="sv"?"Bedöm svaret muntligt och ge poäng eller tryck Fel svar.":"Judge the spoken answer and award points or mark wrong.") : t("select")))+'</p>'+
 '<div class="choice-grid" style="margin:12px 0">'+players.map(p=>'<button type="button" class="btn '+(state.selected===p.id?"selected":"")+'" data-player="'+esc(p.id)+'" '+(simple&&(!game.started||game.finished||!!game.award)?'disabled':'')+'>'+esc(p.name)+'</button>').join("")+'</div>'+
 (game.award?'<p class="success">'+esc(game.award.name)+' +'+game.award.points+'</p>':"")+
 '<label for="quizWaitSelect" class="small" style="font-weight:750;display:block;margin:10px 0 4px">'+(state.lang==="sv"?"Svarstid före alternativen":"Time before choices")+'</label>'+
 '<select id="quizWaitSelect" style="width:100%;padding:12px;border-radius:10px;background:#0a2448;color:#fff;font-size:17px">'+
 [5,10,15].map(n=>'<option value="'+n+'"'+((game.answerWaitSeconds||5)===n?' selected':'')+'>'+n+' '+(state.lang==="sv"?"sekunder":"seconds")+'</option>').join('')+'</select>'+
 '<p class="muted small">'+(state.lang==="sv"?"Gäller från nästa fråga eller omgång.":"Applies from the next question or game.")+'</p>'+
 '<div class="stack">'+(game.started&&!game.finished?(simple?"":btn("awardBtn","⭐ "+t("award")+" +"+points, "gold full"))+
 btn("showOptionsBtn","◉ "+t("options"),"full")+
 btn("showAnswerBtn","✓ "+t("answer"),"ghost full")+
 '<div class="two">'+btn("undoBtn","↶ "+t("undo"),"red full")+btn("nextBtn","➜ "+(game.index===19?t("end"):t("next")),"green full")+'</div>':game.finished?btn("restartBtn","↻ "+t("reset"),"gold full"):btn("startBtn","▶ "+t("start"),"gold full"))+'</div>'+
 (game.started && !game.finished ? '<p class="muted small" style="margin-top:14px">'+(game.index===19?t("final"):game.optionsShown?t("correctAfter"):t("correctBefore"))+'</p>':"")+
 '<hr><div class="row">'+btn("audioSettingsBtn","🔊 "+(state.lang==="sv"?"Ljudinställningar":"Sound settings"),"ghost")+
 (game.started&&!game.finished?btn("wrongBtn","✖ "+(state.lang==="sv"?"Fel svar":"Wrong answer"),"red")+
 btn("musicBtn",game.musicPlaying?"♫ "+(state.lang==="sv"?"Pausa musik":"Pause music"):"♫ "+(state.lang==="sv"?"Spela musik":"Play music"),"ghost"):"")+'</div>'+
 '</section>';
}
function renderHost(game){
 state.playMode=game.mode||"standard";
 view(headerControls()+'<div class="host-grid" style="margin-top:16px"><div class="stack">'+(game.finished?finale(game):game.started?questionPanel(game,true):playerEditor(game))+
 board(game)+'</div><div class="stack">'+hostControls(game)+
 (game.mode==='simple'?'<section class="panel stack"><h2>🖥 Enkelt spelledarläge</h2><p class="muted">Inga mobiltelefoner eller spelarinloggningar. Namnen skrivs in före start. Klicka på en deltagare för att dela ut poäng.</p></section>':
 '<section class="panel stack"><h2>📱 '+(state.lang==="sv"?"Alla deltar med sin mobil":"Everyone plays on their phone")+'</h2>'+
 '<p class="muted">'+(state.lang==="sv"?"Öppna länken i Android eller iPhone, skriv in ditt namn och tryck SVARA före de andra.":"Open this link on Android or iPhone, enter your name and buzz before the others.")+'</p>'+
 '<input id="playerLink" readonly aria-label="Deltagarlänk" style="font-size:16px" value="'+esc(location.origin+"/play?code="+state.code)+'">'+
 btn("copyPlayerBtn","📋 "+(state.lang==="sv"?"Kopiera deltagarlänk":"Copy player link"),"gold full")+
 btn("sharePlayerBtn","↗ "+(state.lang==="sv"?"Dela till spelarna":"Share with players"),"ghost full")+'</section>')+
 '<section class="panel stack"><h2>📺 '+t("address")+'</h2><p class="muted" id="connectAddress"></p><p class="small muted">'+t("mode")+'</p>'+
 btn("copyTVBtn","📋 "+t("tvLink"),"ghost full")+'</section>'+
 '<p class="small muted">'+(state.lang==='sv'?'Frågebank: ':'Question bank: ')+game.bankCount+' · '+(state.lang==='sv'?'Aldrig spelade: ':'Never used: ')+(game.rotation?.unplayed??'—')+' · '+(state.lang==='sv'?'Omgångar: ':'Rounds: ')+(game.rotation?.rounds??0)+(game.pendingCount?' · '+(state.lang==='sv'?'Väntar på facit: ':'Need answer key: ')+game.pendingCount:'')+'</p>'+
 '<div class="row">'+btn("importBtn","📚 "+t("import"),"ghost")+btn("bibleBtn","📖 "+t("bible"),"ghost")+'</div></div></div>');
 $("homeBtn").onclick=()=>{state.role="home";history.replaceState(null,"","/");landing()};
 $("settingsBtn").onclick=()=>settings();
 document.querySelectorAll("[data-player]").forEach(b=>{b.disabled=game.mode==="simple"?(!game.started||game.finished||!!game.award):!!game.buzz&&game.buzz.playerId!==b.dataset.player;b.onclick=()=>{if(game.mode==="simple"){if(!game.started||game.finished||game.award)return;state.selected=b.dataset.player;action("award",{playerId:b.dataset.player});return;}state.selected=b.dataset.player;render()}});
 if($("playerName")){
  $("addPlayer").onclick=()=>{const name=$("playerName").value;action("addPlayer",{name})};
  $("playerName").onkeydown=e=>{if(e.key==="Enter")$("addPlayer").click()};
  document.querySelectorAll("[data-remove]").forEach(b=>b.onclick=()=>action("removePlayer",{playerId:b.dataset.remove}));
 }
 if($("awardBtn")){$("awardBtn").disabled=!state.selected||!!game.award;
  $("awardBtn").onclick=()=>action("award",{playerId:state.selected})}
 if($("quizWaitSelect"))$("quizWaitSelect").onchange=e=>action("setDuration",{seconds:Number(e.target.value)});
 if($("showOptionsBtn")){$("showOptionsBtn").disabled=game.optionsShown;$("showOptionsBtn").onclick=()=>action("showOptions")}
 if($("showAnswerBtn")){$("showAnswerBtn").disabled=game.answerShown;$("showAnswerBtn").onclick=()=>action("showAnswer")}
 if($("undoBtn")){$("undoBtn").disabled=!game.award;$("undoBtn").onclick=()=>action("undo")}
 if($("nextBtn"))$("nextBtn").onclick=()=>{state.selected="";action("next")};
 if($("startBtn"))$("startBtn").onclick=()=>action("start");
 if($("restartBtn"))$("restartBtn").onclick=()=>action("start");
 if($("audioSettingsBtn"))$("audioSettingsBtn").onclick=()=>{state.panel="audio";render()};
 if($("wrongBtn"))$("wrongBtn").onclick=()=>action("wrong");
 if($("musicBtn"))$("musicBtn").onclick=()=>action("music",{playing:!game.musicPlaying});
 $("importBtn").onclick=()=>importPage();$("bibleBtn").onclick=()=>settings();
 syncAudio(game);
 const link=location.origin+"/tv?code="+encodeURIComponent(state.code);
 $("connectAddress").textContent=link;
 $("copyTVBtn").onclick=()=>navigator.clipboard?.writeText(link).then(()=>notice("✓")) || notice(link);
 if(game.mode!=='simple'){
 const fallbackPlayer=location.origin+"/play?code="+encodeURIComponent(state.code);
 let playerJoinLink=fallbackPlayer;
 const playerInput=$("playerLink");
 playerInput.value=playerJoinLink;
 $("copyPlayerBtn").onclick=()=>{if(navigator.clipboard&&navigator.clipboard.writeText)
   navigator.clipboard.writeText(playerJoinLink).then(()=>notice("✓")).catch(()=>notice(playerJoinLink));
   else{playerInput.focus();playerInput.select();notice(playerJoinLink);}
 };
 $("sharePlayerBtn").onclick=()=>{if(navigator.share)
   navigator.share({title:t("title"),text:state.lang==="sv"?"Gå med i bibelfrågesporten!":"Join the Bible Trivia game!",url:playerJoinLink}).catch(()=>{});
   else{playerInput.focus();playerInput.select();notice(playerJoinLink);}
 };

 }
 call("/api/address").then(x=>{if(x.lanUrl){
   const link=x.lanUrl+"/tv?code="+state.code;
   $("connectAddress").textContent=link;
   $("copyTVBtn").onclick=()=>navigator.clipboard?.writeText(link).then(()=>notice("✓")) || notice(link);
   if($("playerLink"))$("playerLink").value=x.lanUrl+"/play?code="+state.code;
 }}).catch(()=>{});
}
function playerEditor(game){
 return '<section class="panel"><h2>👥 '+t("players")+'</h2><div class="row">'+
 '<input id="playerName" style="flex:2;min-width:140px" placeholder="'+t("playerName")+'">'+btn("addPlayer","+ "+t("add"),"gold")+'</div>'+
 '<div class="stack" style="margin-top:14px">'+game.players.map(p=>'<div class="score"><span>'+esc(p.name)+'</span><button class="btn ghost" data-remove="'+esc(p.id)+'">'+t("remove")+'</button></div>').join("")+'</div></section>';
}
function settings(){
 state.role="settings";
 view('<section class="panel stack" style="max-width:650px;margin:auto"><h2>⚙ '+t("settings")+'</h2>'+
 '<label for="quizMode">'+(state.lang==="sv"?"Spelläge":"Game mode")+'</label><select id="quizMode"><option value="standard">'+(state.lang==="sv"?"Vanligt – spelarna använder mobiler":"Standard – players use phones")+'</option><option value="simple">'+(state.lang==="sv"?"Enkelt – endast datorns spelledare":"Simple – computer host only")+'</option></select>'+
 '<p class="muted small">'+(state.lang==="sv"?"Enkelt läge: skriv in namn före start, 3 poäng utan alternativ eller 1 poäng med alternativ. Fråga 20 ger 5 poäng. Ändra spelläget före en omgång.":"Simple mode: enter names before playing, 3 points before options or 1 afterward. Final question is worth 5. Change mode between rounds.")+'</p>'+
 '<label for="langSelect">'+t("language")+'</label><select id="langSelect"><option value="sv">🇸🇪 Svenska</option><option value="en">🇬🇧 English</option></select>'+
 '<label for="bibleSelect">'+t("bible")+'</label><select id="bibleSelect"><option value="">'+t("noBible")+'</option></select>'+
 '<label for="bibleFile">'+t("bibleUpload")+'</label><input id="bibleFile" type="file" accept=".json,.js,application/json,text/javascript">'+
 (window.AndroidBible?'<div class="subtle stack"><strong>'+(state.lang==="sv"?"Stora SQLite3-biblar":"Large SQLite3 Bibles")+'</strong>'+
 '<p class="muted">'+(state.lang==="sv"?
 "Importera .sq3, .sqlite3, .sqlite, .db eller .bblx från mobilens lagring. Även stora filer kopieras i bakgrunden, utan en begränsning på 10 MB. Kräver ledigt lagringsutrymme.":
 "Import .sq3, .sqlite3, .sqlite, .db or .bblx from device storage. Large files are copied in the background, without a 10 MB limit. Requires available device storage.")+'</p>'+
 btn("sqliteBibleButton","📖 "+(state.lang==="sv"?"Välj SQLite-bibel":"Choose SQLite Bible"),"gold")+
 '<p id="bibleImportStatus" class="muted" role="status" aria-live="polite"></p>'+
 '<p id="sqlitePreview" class="small muted"></p></div>':
 '<p class="muted">'+(state.lang==="sv"?"SQLite-import stöds i Android-huvudappen. Här kan du importera JSON.":"SQLite import is available in the Android host app. JSON can be imported here.")+'</p>')+
 '<p class="muted">Bibelpaket: SRB26-bibeldata.js från Church Show eller bibel-JSON med books och chapters.</p>'+
 '<p class="muted">'+(state.lang==="sv"?"Importerade biblar lagras lokalt på huvudenheten, och ingår inte i appen vid installation. Använd bara bibeltexter som du har rätt att använda.":"Imported Bibles are stored only on this host device and are not included with the app. Use only texts you have permission to import.")+'</p>'+
 '<div class="row">'+btn("returnBtn","← "+t("back"),"gold")+'</div></section>');
 $("quizMode").value=state.game?.mode||state.playMode;
 $("quizMode").disabled=!!state.game?.started&&!state.game?.finished;
 $("quizMode").onchange=async e=>{
   const previous=state.game?.mode||state.playMode;
   const next=e.target.value;
   try{
     if(state.game&&state.token){
       state.game=await call(api("/action"),"POST",{type:"setMode",mode:next},true);
     }
     state.playMode=next;store("playMode",next);
     settings();
   }catch(err){e.target.value=previous;notice(err.message);}
 };
 $("langSelect").value=state.lang;
 $("langSelect").onchange=e=>{state.lang=e.target.value;store("lang",state.lang);settings()};
 const selectedBible=$("bibleSelect");
 listBibles().then(names=>{
   names.forEach(n=>{const option=document.createElement("option");option.value=n;option.textContent=n+" (JSON)";selectedBible.append(option)});
   if(window.AndroidBible){
    try{
     const imported=JSON.parse(window.AndroidBible.list());
     imported.forEach(item=>{
      const option=document.createElement("option");
      option.value="sqlite:"+item.id;
      const size=(Number(item.bytes)/1048576).toFixed(1);
      option.textContent=item.name+" (SQLite · "+size+" MB · "+item.verses+" verser)";
      selectedBible.append(option);
     });
    }catch(err){notice(err.message)}
   }
   selectedBible.value=state.bible;
 });
 selectedBible.onchange=e=>{
   state.bible=e.target.value;store("bible",state.bible);
   if(state.bible.startsWith("sqlite:") && window.AndroidBible){
    try{
     const info=JSON.parse(window.AndroidBible.preview(state.bible.slice(7)));
     const preview=$("sqlitePreview");
     if(preview) preview.textContent=info.error||info.example||"";
    }catch(err){notice(err.message)}
   }
   notice(selectedBible.selectedOptions[0]?.textContent||t("noBible"));
 };
 if(window.AndroidBible && $("sqliteBibleButton")){
  $("sqliteBibleButton").onclick=()=>{
   $("bibleImportStatus").textContent=state.lang==="sv"?"Välj bibelfilen på mobilen…":"Select a Bible file…";
   window.AndroidBible.chooseFile();
  };
 }
 $("bibleFile").onchange=async e=>{
  const file=e.target.files?.[0];if(!file)return;
  try{
   const imported=window.BibleTriviaBibleImport.parse(await file.text(),file.name);
   await saveBible(imported.name,imported.data);
   state.bible=imported.name;store('bible',imported.name);settings();notice('✓ '+imported.name+' · '+imported.verses+' verser');
  }catch(err){notice(err.message)}
 };
 $("returnBtn").onclick=()=>{
  state.role=state.code&&state.token?"host":"home";
  if(state.role==="host")load();else landing();
 };
}
window.onAndroidBibleImportProgress = bytes=>{
 const status=$("bibleImportStatus");
 if(status) status.textContent=(state.lang==="sv"?"Kopierar bibel: ":"Copying Bible: ")+(Number(bytes)/1048576).toFixed(1)+" MB";
};
window.onAndroidBibleImport = result=>{
 if(result.error){
  const status=$("bibleImportStatus");if(status)status.textContent="⚠ "+result.error;
  notice(result.error);return;
 }
 state.bible="sqlite:"+result.id;store("bible",state.bible);
 if(state.role==="settings")settings();
 notice("✓ "+result.name+" · "+result.verses+" verser");
};
// Import the Bible explicitly shared by the local parent Church Show.
window.addEventListener('message',async e=>{
 if(window.parent===window||e.source!==window.parent||!['null','file://'].includes(e.origin)||e.data?.type!=='churchshow:bible-import')return;
 try{
  const result=window.BibleTriviaBibleImport.check(e.data.bible,'Church Show');
  await saveBible(result.name,result.data);
  state.bible=result.name;store('bible',result.name);
  if(state.role==='settings')settings();
  window.parent.postMessage({type:'churchshow:bible-imported',name:result.name,verses:result.verses},'*');
 }catch(error){window.parent.postMessage({type:'churchshow:bible-import-error',message:String(error.message||error)},'*');}
});
function bibleDB(){
 return new Promise((resolve,reject)=>{
  const open=indexedDB.open("BibleTriviaLibrary",1);
  open.onupgradeneeded=()=>{if(!open.result.objectStoreNames.contains("bibles"))open.result.createObjectStore("bibles")};
  open.onsuccess=()=>resolve(open.result);open.onerror=()=>reject(open.error);
 });
}
async function listBibles(){
 const db=await bibleDB();
 return new Promise((resolve,reject)=>{const tx=db.transaction("bibles","readonly");const req=tx.objectStore("bibles").getAllKeys();req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);tx.oncomplete=()=>db.close()});
}
async function saveBible(name,bible){
 const db=await bibleDB();
 return new Promise((resolve,reject)=>{const tx=db.transaction("bibles","readwrite");tx.objectStore("bibles").put(bible,name);
 tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>reject(tx.error)});
}
// JSON is the only import route. Complete questions become playable. Incomplete
// source questions are preserved separately, never given invented answers.
async function importJsonFiles(files, status, stats){
 let total=0,ready=0,pending=0,duplicates=0,invalid=0;
 for(let f=0;f<files.length;f++){
   const file=files[f];
   if(!/\.json$/i.test(file.name))throw Error("Välj en JSON-fil (.json).");
   if(file.size>15*1024*1024)throw Error("JSON-filen är för stor (max 15 MB).");
   status.textContent="Läser "+(f+1)+" av "+files.length+": "+file.name+"…";
   const result=window.QuizImport.extractJson(await file.text());
   total+=result.total;
   const incomplete=result.pending||[];
   invalid+=result.rejected.length-incomplete.length;
   if(!result.total)throw Error("JSON-filen innehåller ingen frågelista.");
   for(let i=0;i<Math.max(result.questions.length,incomplete.length);i+=120){
     const complete=result.questions.slice(i,i+120);
     const staging=incomplete.slice(i,i+120);
     status.textContent="Sparar "+(i+complete.length+staging.length)+" / "+result.total+" frågor från "+file.name+"…";
     const saved=await call(api("/import"),"POST",{questions:complete,pending:staging},true);
     ready+=saved.added||0;
     pending+=saved.pendingAdded||0;
     duplicates+=(saved.skipped||0)+(saved.pendingSkipped||0);
     invalid+=(saved.errors||[]).length;
   }
 }
 stats.textContent=total+" frågor lästa · "+ready+" nya spelklara · "+pending+
   " sparade utan facit · "+duplicates+" redan importerade"+
   (invalid?" · "+invalid+" gick inte att tolka":"");
 status.textContent="✓ Importen är klar. Samtliga läsbara frågor har tagits om hand.";
 if(pending)stats.textContent+=". Frågor utan verifierat facit finns sparade men används inte i poängspelet.";
}
function importPage(){
 state.role="import";
 view('<div class="stack" style="max-width:760px;margin:auto">'+
   '<section class="panel stack quiz-json-only">'+
   '<h2>📚 '+(state.lang==="sv"?"Importera bibelfrågor":"Import Bible Trivia Questions")+'</h2>'+
   '<p class="muted">'+(state.lang==="sv"?
     "Välj din JSON-fil. Programmet hittar frågorna och sparar dem automatiskt. Du behöver inte redigera någon kod.":
     "Choose your JSON file. Questions are found and stored automatically; no editing is required.")+'</p>'+
   '<label for="quizJsonFile" class="quiz-json-label">'+(state.lang==="sv"?"Välj JSON-fil":"Choose JSON file")+'</label>'+
   '<input id="quizJsonFile" type="file" accept=".json,application/json" multiple>'+
   '<p id="scanStatus" class="gold" role="status" aria-live="polite">Välj en JSON-fil för att börja.</p>'+
   '<p id="quizImportStats" class="quiz-import-stats" role="status" aria-live="polite"></p>'+
   '<p class="small muted">'+(state.lang==="sv"?
     "Frågor med facit blir spelklara. Frågor utan facit sparas också, men används inte för poäng förrän rätt svar har verifierats.":
     "Questions with verified answers are ready to play. Unanswered questions are retained but excluded from scoring.")+'</p>'+
   '<p><a href="/question-editor.html" style="display:inline-block;padding:13px 18px;background:#edce8b;color:#10273b;border-radius:11px;font-weight:800;text-decoration:none">'+(state.lang==="sv"?"✎ Öppna Frågeverkstaden – granska facit":"✎ Open Question Workshop")+'</a></p>'+
   '<div class="row">'+btn("importBack","← "+t("back"),"ghost")+'</div>'+
   '</section></div>');
 const input=$("quizJsonFile"),status=$("scanStatus"),stats=$("quizImportStats");
 input.onchange=async()=>{
   const files=Array.from(input.files||[]);
   if(!files.length)return;
   input.disabled=true;
   stats.textContent="";
   try{
     await importJsonFiles(files,status,stats);
     notice(state.lang==="sv"?"JSON-filen importerad!":"JSON imported!");
   }catch(error){
     status.textContent="⚠ "+(error?.message||String(error));
     notice(error?.message||String(error));
   }finally{
     input.disabled=false;input.value="";
   }
 };
 $("importBack").onclick=()=>{state.role="host";load();};
 // Existing bank content remains intact; show counts without an extra control.
 call(api("/import"),"GET",undefined,true).then(data=>{
   if(!stats.textContent)stats.textContent="I frågebanken: "+data.bankCount+
     " spelklara och "+data.pendingCount+" sparade utan facit.";
 }).catch(()=>{});
}
function boot(){
 const params=new URLSearchParams(location.search);
 if(params.get("code")&&/^\d{6}$/.test(params.get("code"))){state.code=params.get("code");store("code",state.code)}
 if(location.pathname==="/tv"){state.role="tv";state.code?load():landing();}
 else if(state.hostCode&&state.token){state.code=state.hostCode;store("code",state.code);state.role="host";load();}
 else landing();
}
try { boot(); } catch (error) {
  if (window.showQuizStartupError) window.showQuizStartupError("Startfel: " + (error?.message || String(error)));
  else { app.textContent = "Bibel Frågesport kunde inte starta: " + (error?.message || error); }
}
})();

