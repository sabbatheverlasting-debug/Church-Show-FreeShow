/* LG webOS TV legacy renderer, ECMAScript 5 syntax only.
 * Read-only public quiz snapshot over CORS, no remote JavaScript or iframe.
 * Supports older Chromium and WebKit engines in LG TVs. */
(function () {
  "use strict";
  var host="",room="",port=3000,active=false,busy=false,failures=0,lastVersion=null;
  var lastCue=0,firstSnapshot=true,volume=0.45,unlocked=false,lang="sv";
  var pollTimer=null,musicTimer=null,audioCtx=null,musicTrack=null,musicTrackUrl='';
  var audioURLs={};
  function el(id){return document.getElementById(id);}
  function safe(x){return String(x===undefined||x===null?"":x)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;").replace(/'/g,"&#39;");}
  function get(obj,key){return obj&&obj[key]!==undefined?obj[key]:null;}
  function label(sv,en){return lang==="sv"?sv:en;}
  function chosen(q) {
    if(!q)return null;
    var t=q.translations&&q.translations[lang];
    if(!t||!t.question)return q;
    var res={question:t.question,options:t.options||q.options,reference:t.reference||q.reference,
      answer:q.answer,difficulty:q.difficulty,category:q.category};
    return res;
  }
  function setStatus(message,connected){
    var target=el("receiverStatus");
    target.textContent=message;
    target.style.color=connected?"#baf4c5":"#ffdaad";
  }
  function stopMusic(){
    if(musicTimer){clearInterval(musicTimer);musicTimer=null;}
    if(musicTrack){musicTrack.pause();musicTrack.src='';musicTrack=null;}
    musicTrackUrl='';
  }
  function tone(freq,duration,level,delay){
    if(!audioCtx)return;
    try{
      var now=audioCtx.currentTime+(delay||0);
      var osc=audioCtx.createOscillator(),gain=audioCtx.createGain();
      osc.type="sine";osc.frequency.value=freq;
      gain.gain.setValueAtTime(0.001,now);
      gain.gain.linearRampToValueAtTime((level||0.08)*volume,now+0.025);
      gain.gain.exponentialRampToValueAtTime(0.001,now+duration);
      osc.connect(gain);gain.connect(audioCtx.destination);
      osc.start(now);osc.stop(now+duration+0.02);
    }catch(ignore){}
  }
  function sound(cue) {
    if(!unlocked)return;
    var x=audioURLs[cue];
    if(x){
      try{
        var a=new Audio("http://"+host+":"+port+x);
        a.volume=volume;
        a.onerror=function(){soundFallback(cue);};
        var playback=a.play();
        if(playback&&typeof playback.catch==='function')playback.catch(function(){soundFallback(cue);});
        return;
      }catch(ignore){}
    }
    soundFallback(cue);
  }
  function soundFallback(cue){
    if(cue==="correct"){tone(523,.22,.14,0);tone(659,.22,.14,.17);tone(784,.42,.17,.34);}
    if(cue==="wrong"){tone(350,.22,.13,0);tone(246,.40,.14,.21);}
    if(cue==="start"){tone(392,.2,.12,0);tone(523,.2,.12,.15);tone(659,.22,.12,.3);tone(784,.6,.16,.5);}
    if(cue==="win"){tone(523,.2,.14,0);tone(659,.2,.14,.16);tone(784,.2,.14,.32);tone(1047,.9,.20,.55);}
    if(cue==="reveal"){tone(440,.1,.08,0);tone(554,.16,.08,.12);}
    if(cue==="next"){tone(659,.13,.10,0);}
  }
  function startSynthMusic(){
    if(musicTimer)return;
    var seq=[196,261.6,294,261.6,220,261.6,329.6,261.6],i=0;
    musicTimer=setInterval(function(){tone(seq[i%seq.length],.23,.025,0);i++;},430);
  }
  function setMusic(enabled) {
    if(!enabled||!unlocked){stopMusic();return;}
    var wanted=audioURLs.music||'';
    if(wanted&&musicTrack&&musicTrackUrl===wanted)return;
    if(!wanted&&musicTimer)return;
    stopMusic();
    if(wanted){
      try{
        var track=new Audio('http://'+host+':'+port+wanted);
        track.loop=true;track.volume=volume*.55;
        musicTrack=track;musicTrackUrl=wanted;
        var fallback=function(){
          if(musicTrack===track){musicTrack=null;musicTrackUrl='';startSynthMusic();}
        };
        track.onerror=fallback;
        var result=track.play();
        if(result&&typeof result.catch==='function')result.catch(fallback);
        return;
      }catch(ignore){}
    }
    startSynthMusic();
  }
  function enableAudio(){
    try{
      var Ctx=window.AudioContext||window.webkitAudioContext;
      if(Ctx){audioCtx=audioCtx||new Ctx();if(audioCtx.resume)audioCtx.resume();}
      unlocked=true;
      var button=el("enableSoundButton");
      if(button)button.textContent="🔊 "+label("TV-ljud aktiverat","TV sound enabled");
      sound("correct");
    }catch(e){setStatus(label("TV:n stöder inte detta ljudläge","TV audio unsupported"),false);}
  }
  function leaderboard(g){
    var players=(g.players||[]).slice();
    players.sort(function(a,b){return (Number(b.score)||0)-(Number(a.score)||0);});
    var h='<section class="tv-card leaderboard"><h2>🏆 '+label("Poängställning","Leaderboard")+'</h2>';
    if(!players.length)return h+'<p class="tv-muted">'+label("Väntar på deltagare","Waiting for players")+'</p></section>';
    for(var i=0;i<players.length;i++){
      h+='<div class="score-line"><span>'+(i===0?"👑 ":"")+safe(players[i].name)+'</span><strong>'+safe(players[i].score)+'</strong></div>';
    }
    return h+"</section>";
  }
  function question(g){
    if(!g.started){
      return '<section class="tv-card tv-waiting"><h2>📖 '+label("Väntar på spelledaren","Waiting for host")+'</h2>'+
        '<p>'+label("Lägg till deltagare och starta spelet från mobilen.","Add players and start the quiz from your phone.")+'</p></section>';
    }
    if(g.finished){
      var players=(g.players||[]).slice();
      players.sort(function(a,b){return (Number(b.score)||0)-(Number(a.score)||0);});
      var highest=players.length?Number(players[0].score):0,names=[];
      for(var j=0;j<players.length;j++)if(Number(players[j].score)===highest)names.push(players[j].name);
      return '<section class="tv-card tv-waiting"><div class="tv-trophy">🏆</div>'+
        '<h2>'+label("Grattis till vinnaren!","Congratulations to the winner!")+'</h2>'+
        '<p>'+safe(names.join(" & "))+' · '+highest+' '+label("poäng","points")+'</p></section>';
    }
    var q=chosen(g.question);
    if(!q)return '<section class="tv-card"><h2>'+label("Väntar på nästa fråga","Waiting for question")+'</h2></section>';
    var options=q.options||[];
    var h='<section class="tv-card main-question"><div class="tv-question-head"><span>'+
      label("Fråga","Question")+" "+(Number(g.index)+1)+" / "+(g.total||20)+'</span>'+
      '<span>'+(Number(g.index)===19?label("Finalfråga · 5 poäng","Final question · 5 points"):
      g.optionsShown?label("Rätt svar · 1 poäng","Correct answer · 1 point"):
      label("Rätt utan alternativ · 3 poäng","Correct without choices · 3 points"))+
      '</span></div><div class="tv-question-text">'+safe(q.question)+'</div>';
    if(g.optionsShown||g.answerShown){
      h+='<div class="tv-choices">';
      for(var i=0;i<options.length;i++){
        var letter=String.fromCharCode(65+i);
        var isCorrect=g.answerShown&&letter===g.question.answer;
        h+='<div class="tv-choice'+(isCorrect?" correct":"")+'"><strong>'+letter+'</strong><span>'+safe(options[i])+'</span></div>';
      }
      h+='</div>';
    }else{
      h+='<p class="tv-hidden-options">'+label("Svara utan alternativ för 3 poäng","Answer without choices for 3 points")+'</p>'+
 '<p id="quizCountdownTV" style="text-align:center;font:700 clamp(34px,6vw,85px) system-ui;color:#ffe4a6" role="timer">⏳ '+Math.ceil(Math.max(0,Number(g.countdownRemainingMs)||0)/1000)+' s</p>';
    }
    if(g.answerShown){
      var answerText="";
      for(var k=0;k<options.length;k++){
        if(String.fromCharCode(65+k)===g.question.answer){answerText=options[k];break;}
      }
      h+='<p class="tv-answer">✓ '+safe(g.question.answer)+': '+safe(answerText)+
        ' <span>'+safe(q.reference||g.question.reference||"")+'</span></p>';
    }
    return h+"</section>";
  }
  function render(g){
    var main=el("tvStage");
    if(!main)return;
    var html='<div class="tv-stage-meta"><span>🔑 '+label("Spelkod","Game code")+
      ': <strong>'+safe(room)+'</strong></span>';
    html+='<button type="button" id="enableSoundButton">'+(unlocked?"🔊 "+label("TV-ljud aktiverat","TV sound enabled"):
      "🔇 "+label("Aktivera TV-ljud","Enable TV sound"))+"</button></div>";
    if(g.buzz){
      html+='<div style="border:3px solid #ffd078;border-radius:18px;background:#163f76;color:#fff;padding:18px 24px;font:700 32px Georgia,serif;text-align:center;margin:12px 0">⚡ '+
        label("Först att svara: ","First to buzz: ")+safe(g.buzz.name)+'</div>';
    }else if(g.lastAttempt && !g.lastAttempt.correct && !g.award){
      html+='<div style="border:2px solid #bc8c62;border-radius:14px;background:#152d57;padding:12px;text-align:center;font-size:23px;margin:8px 0">'+
        safe(g.lastAttempt.name)+' · '+label("Fel svar – nästa spelare får försöka","Wrong answer – next player may try")+'</div>';
    }
    html+='<div class="tv-layout"><div>'+question(g)+'</div>'+leaderboard(g)+'</div>';
    main.innerHTML=html;
    el("enableSoundButton").onclick=enableAudio;
  }
  var countSnapshot=null,countReceivedAt=0;
  setInterval(function(){
    if(!countSnapshot)return;
    var badge=el("quizCountdownTV");if(!badge)return;
    var remaining=Number(countSnapshot.countdownRemainingMs)||0;
    if(!countSnapshot.countdownPaused)remaining=Math.max(0,remaining-(Date.now()-countReceivedAt));
    badge.textContent=(countSnapshot.countdownPaused?"⏸ ":"⏳ ")+Math.ceil(remaining/1000)+" s";
  },120);
  function receive(g){
    countSnapshot=g;countReceivedAt=Date.now();
    var sounds=g.sounds||{};
    var keys=['correct','wrong','start','win','reveal','next','music'];
    for(var i=0;i<keys.length;i++){
      var c=sounds[keys[i]];
      audioURLs[keys[i]]=c&&c.url?c.url:'';
    }
    var currentVersion=g.version;
    if(firstSnapshot||lastVersion!==currentVersion){
      render(g);lastVersion=currentVersion;
      var event=get(g,"audioEvent");
      if(event&&event.seq!==undefined){
        if(!firstSnapshot&&event.seq!==lastCue)sound(event.cue);
        lastCue=event.seq;
      }
      firstSnapshot=false;
    }
    setMusic(!!g.musicPlaying);
    failures=0;
    el("offline").hidden=true;
    setStatus("● "+label("Ansluten","Connected")+" · "+room,true);
  }
  function poll(){
    if(!active||busy)return;
    busy=true;
    var xhr=new XMLHttpRequest();
    var done=false;
    function finish(ok,g,error){
      if(done)return;
      done=true;busy=false;
      if(!active)return;
      if(ok){receive(g);return;}
      failures++;
      if(failures>=2){
        setStatus("● "+label("Ingen kontakt med huvudmobilen","No connection to host"),false);
        el("offline").hidden=false;
        // Keep the precise endpoint visible: the host may be on port 3001+
        // and older webOS engines did not position the overlay correctly.
        var target="http://"+host+":"+port+"/api/rooms/"+room;
        var detail=target+" — "+(error||label(
          "Kontrollera att mobilappen är öppen, spelkoden stämmer och båda enheterna är på samma Wi-Fi.",
          "Keep the mobile app open, check the code and connect both devices to the same Wi-Fi."));
        var message=el("offlineDetail");
        if(message)message.textContent=detail;
        if(failures===2){
          el("tvStage").innerHTML='<div class="tv-loading">'+label(
            "Ingen kontakt. Kontrollera spelkod och adress via Ändra anslutning.",
            "No connection. Check game code and host address in Connection settings.")+'</div>';
        }
        lastVersion=null;
        stopMusic();
      }
    }
    xhr.onreadystatechange=function(){
      if(xhr.readyState!==4)return;
      if(xhr.status===200){
        try{finish(true,JSON.parse(xhr.responseText),"");}
        catch(e){finish(false,null,"TV:n kunde inte tolka svaret: "+String(e.message||e));}
      }else{
        var message=xhr.status===404?"Spelkoden finns inte på den valda mobiladressen. Kontrollera ny spelkod eller port.":
          xhr.status===0?"Ingen nätverkskontakt med huvudmobilen (eller CORS blockerad).":
          "HTTP "+xhr.status;
        finish(false,null,message);
      }
    };
    xhr.onerror=function(){finish(false,null,"Nätverksfel. Kontrollera att båda enheterna är på samma nätverk.");};
    xhr.ontimeout=function(){finish(false,null,"Huvudmobilen svarar inte. Kontrollera IP-adressen.");};
    try{
      xhr.open("GET","http://"+host+":"+port+"/api/rooms/"+room+"?v="+new Date().getTime(),true);
      xhr.timeout=4500;
      xhr.send(null);
    }catch(e){finish(false,null,String(e.message||e));}
  }
  function stop(){
    active=false;busy=false;
    stopMusic();
    if(pollTimer){clearInterval(pollTimer);pollTimer=null;}
  }
  function start(ip,code,selectedPort){
    stop();
    host=ip;room=code;port=selectedPort||3000;lastVersion=null;firstSnapshot=true;failures=0;lastCue=0;
    active=true;
    el("tvStage").innerHTML='<div class="tv-loading">'+label("Ansluter till huvudmobilen…","Connecting to host phone…")+'</div>';
    el("offline").hidden=true;
    poll();
    pollTimer=setInterval(poll,1600);
  }
  function setLanguage(code){lang=code==="en"?"en":"sv";lastVersion=null;}
  window.BibleTVViewer={start:start,stop:stop,retry:poll,setLanguage:setLanguage};
})();
