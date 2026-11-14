"use strict";
(function(){
  var root=document.getElementById("playerApp");
  var params=new URLSearchParams(location.search);
  var code=params.get("code")||"";
  function readStore(key){try{return localStorage.getItem(key);}catch(e){return null;}}
  function writeStore(key,val){try{localStorage.setItem(key,val);}catch(e){}}
  function deleteStore(key){try{localStorage.removeItem(key);}catch(e){}}
  var lang=readStore("bq-player-lang")==="en"?"en":"sv";
  var own=null,room=null,lastVersion=null,busy=false,polling=false;
  var savedKey="bq-player-"+code;
  try{own=JSON.parse(readStore(savedKey)||"null");}catch(e){}
  var messages={
    sv:{title:"Bibel Frågesport",join:"Gå med i spelet",name:"Ditt namn",game:"Spelkod",joinButton:"Gå med",
      wait:"Väntar på spelledaren",ready:"Alla är redo att spela!",early:"Tryck först för att få svara!",
      buzz:"SVARA!",options:"Välj rätt alternativ – snabbast rätt svar får poäng!",
      first:"Svarsrätten går till",yourTurn:"Du var först! Säg ditt svar till spelledaren.",
      locked:"En annan spelare var först.",failed:"Du har redan svarat. Vänta på nästa fråga.",
      next:"Väntar på nästa fråga",ended:"Spelomgången är avslutad",scores:"Poängställning",
      winner:"Rätt svar registrerat!",round:"Fråga",of:"av",offline:"Anslutningen avbröts. Försöker igen…",
      myName:"Du spelar som",change:"Byt språk",newGame:"Anslut till ett nytt spel",points:"poäng"},
    en:{title:"Bible Trivia",join:"Join game",name:"Your name",game:"Game code",joinButton:"Join",
      wait:"Waiting for the host",ready:"Get ready to play!",early:"Buzz first to answer!",
      buzz:"BUZZ!",options:"Choose the correct option – fastest correct answer wins points!",
      first:"First to buzz",yourTurn:"You were first! Tell the host your answer.",
      locked:"Another player buzzed first.",failed:"You already answered. Wait for the next question.",
      next:"Waiting for next question",ended:"The round has ended",scores:"Leaderboard",
      winner:"Correct answer registered!",round:"Question",of:"of",offline:"Connection lost. Reconnecting…",
      myName:"Playing as",change:"Switch language",newGame:"Join a new game",points:"points"}
  };
  function t(k){return messages[lang][k]||k;}
  function esc(v){return String(v===null||v===undefined?"":v).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});}
  function top(){return '<div class="brand"><div class="symbol">♛ 📖</div><h1>'+t("title")+'</h1><button id="language" class="small" style="max-width:170px;margin:12px auto">🌐 '+(lang==="sv"?"English":"Svenska")+'</button></div>';}
  function message(text,isError){var box=document.getElementById("status");if(box){box.textContent=text;box.className="status"+(isError?" error":"");box.style.display="block";}}
  async function req(target,data){
    var opts={headers:{"Accept":"application/json"}};
    if(data!==undefined){opts.method="POST";opts.headers["Content-Type"]="application/json";opts.body=JSON.stringify(data);}
    var response=await fetch(target,opts);
    var json=await response.json().catch(function(){return {};});
    if(!response.ok)throw Error(json.error||"HTTP "+response.status);
    return json;
  }
  function translated(q){
    if(!q)return q;
    var tr=q.translations&&q.translations[lang];
    return tr&&tr.question?Object.assign({},q,tr):q;
  }
  function scoreView(){
    if(!room)return "";
    return '<section class="panel"><h2>🏆 '+t("scores")+'</h2>'+
      (room.players||[]).slice().sort(function(a,b){return b.score-a.score;}).map(function(p){
        return '<div class="scoreline"><span>'+(p.id===own.id?"⭐ ":"")+esc(p.name)+'</span><b>'+p.score+'</b></div>';
      }).join("")+'</section>';
  }
  function joinView(){
    root.innerHTML=top()+'<section class="panel"><h2>'+t("join")+'</h2>'+
      '<label>'+t("game")+'<input id="roomCode" maxlength="6" inputmode="numeric" value="'+esc(code)+'"></label>'+
      '<label>'+t("name")+'<input id="playerName" maxlength="30" autocomplete="name" placeholder="'+t("name")+'"></label>'+
      '<button class="primary" id="joinButton">'+t("joinButton")+'</button><p class="status" id="status"></p></section>';
    document.getElementById("joinButton").onclick=async function(){
      var c=document.getElementById("roomCode").value.trim();
      var name=document.getElementById("playerName").value.trim();
      if(!/^\d{6}$/.test(c))return message(t("game")+": 6 siffror",true);
      if(!name)return message(t("name"),true);
      var button=this;button.disabled=true;
      try{
        var result=await req("/api/rooms/"+c+"/join",{name:name});
        code=c;savedKey="bq-player-"+code;own=result.player;room=result.room;
        writeStore(savedKey,JSON.stringify(own));
        history.replaceState(null,"","/play?code="+code);
        lastVersion=room.version;show();
      }catch(e){message(e.message,true);button.disabled=false;}
    };
    wireLanguage();
  }
  function wireLanguage(){
    var button=document.getElementById("language");
    if(button)button.onclick=function(){lang=lang==="sv"?"en":"sv";writeStore("bq-player-lang",lang);show();};
  }
  function show(){
    if(!own){joinView();return;}
    var topLine=top()+'<div class="topline"><span class="pill">'+t("myName")+': '+esc(own.name)+'</span>'+
      '<span class="pill">🔑 '+esc(code)+'</span></div>';
    if(!room){root.innerHTML=topLine+'<section class="panel"><p class="status" id="status">'+t("wait")+'</p></section>';wireLanguage();return;}
    var html=topLine+'<section class="panel">';
    if(room.finished)html+='<h2>🏆 '+t("ended")+'</h2>';
    else if(!room.started)html+='<h2 class="center">'+t("wait")+'</h2><p class="status">'+t("ready")+'</p>';
    else{
      var q=translated(room.question),hasAnswered=(room.attempted||[]).indexOf(own.id)>=0 || (room.lastAttempt&&room.lastAttempt.playerId===own.id);
      var gotPoint=room.award&&room.award.playerId===own.id;
      html+='<p class="center"><span class="pill">'+t("round")+' '+(Number(room.index)+1)+' '+t("of")+' 20</span></p>';
      html+='<div class="question">'+esc(q?q.question:"")+'</div>';
      if(room.answerShown){
        html+='<p class="status">'+(room.award?"🏆 "+esc(room.award.name)+" +"+room.award.points+" "+t("points"):t("next"))+'</p>';
      }else if(gotPoint){
        html+='<p class="status success">✓ '+t("winner")+' +'+room.award.points+'</p>';
      }else if(room.buzz){
        if(room.buzz.playerId===own.id)html+='<p class="status success">'+t("yourTurn")+'</p>';
        else html+='<p class="status">⚡ '+t("first")+': <strong>'+esc(room.buzz.name)+'</strong></p>';
      }else if(hasAnswered){
        html+='<p class="status">'+t("failed")+'</p>';
      }else if(!room.optionsShown){
        html+='<p class="center muted">'+t("early")+'</p><button class="buzz" id="buzzButton">⚡ '+t("buzz")+'</button>';
      }else{
        html+='<p class="center muted">'+t("options")+'</p><div class="answerChoices">'+
          (q&&q.options||[]).map(function(op,i){
            return '<button data-choice="'+String.fromCharCode(65+i)+'"><b>'+String.fromCharCode(65+i)+'.</b>'+esc(op)+'</button>';
          }).join("")+'</div>';
      }
    }
    html+='<p class="status" id="status" style="display:none"></p></section>'+scoreView();
    root.innerHTML=html;wireLanguage();
    var b=document.getElementById("buzzButton");
    if(b)b.onclick=function(){respond({type:"buzz"});};
    Array.prototype.forEach.call(document.querySelectorAll("[data-choice]"),function(button){
      button.onclick=function(){respond({type:"choose",choice:button.getAttribute("data-choice")});};
    });
  }
  async function respond(action){
    if(busy||!own)return;
    busy=true;
    var buttons=document.querySelectorAll("#buzzButton,[data-choice]");
    Array.prototype.forEach.call(buttons,function(b){b.disabled=true;});
    try{
      room=await req("/api/rooms/"+code+"/respond",Object.assign({playerId:own.id,playerKey:own.playerKey},action));
      lastVersion=room.version;show();
    }catch(e){
      message(e.message,true);
      // Another player may have won the race: refresh authoritative game state.
      try{room=await req("/api/rooms/"+code);lastVersion=room.version;show();message(e.message,true);}catch(ignore){}
    }finally{busy=false;}
  }
  async function poll(){
    if(polling||!code||!own)return;
    polling=true;
    try{
      var r=await req("/api/rooms/"+code);
      if(!r.players.some(function(p){return p.id===own.id;})){
        own=null;deleteStore(savedKey);joinView();return;
      }
      if(lastVersion!==r.version){room=r;lastVersion=r.version;show();}
      else room=r;
    }catch(e){message(t("offline"),true);}
    finally{polling=false;}
  }
  function boot(){
    if(!/^\d{6}$/.test(code)){own=null;}
    if(own&&own.id&&own.playerKey){show();poll();}
    else{own=null;joinView();}
    setInterval(poll,750);
  }
  boot();
})();

