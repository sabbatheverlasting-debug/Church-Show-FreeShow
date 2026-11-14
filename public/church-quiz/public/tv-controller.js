/* Native TV pairer for webOS 1.x through recent versions.
   Classic ECMAScript 5 syntax: no arrow functions, optional chaining or Promise. */
(function(){
  "use strict";
  var DEFAULT_IP=(window.location&&window.location.hostname)||"";
  var DEFAULT_CODE="";
  var DEFAULT_PORT=Number((window.location && window.location.port) || 3000);
  var host="",code="",port=DEFAULT_PORT,lang="sv";
  function addressWithPort(ip,number){return ip ? ip+":"+(number||3000) : "";}
  function rememberedAddress(){
    var ip=saved("host")||host||DEFAULT_IP;
    var number=Number(saved("port"))||port||DEFAULT_PORT;
    return addressWithPort(ip,number);
  }
  // Muted full-screen motion video, as in Church-Show / 3 Angels Hymnal.
  function keepTVVideoPlaying(){
    var video=el("ambientVideo");
    if(!video || document.hidden) return;
    try{
      video.muted=true;
      if(video.paused){
        var result=video.play();
        if(result && typeof result.catch==="function")result.catch(function(){});
      }
    }catch(ignore){}
  }
  function el(id){return document.getElementById(id);}
  function saved(key){try{return localStorage.getItem("bqtv-"+key)||"";}catch(e){return "";}}
  function save(key,value){try{localStorage.setItem("bqtv-"+key,value);}catch(e){}}
  function message(s){el("status").textContent=s;}
  function showSetup(){
    if(window.BibleTVViewer)window.BibleTVViewer.stop();
    el("receiver").hidden=true;
    el("setup").hidden=false;
    el("offline").hidden=true;
    el("address").value=rememberedAddress();
    el("code").value=saved("code")||code||DEFAULT_CODE;
    message("");
    try{el("address").focus();}catch(e){}
  }
  function showReceiver(){
    el("setup").hidden=true;
    el("receiver").hidden=false;
    el("offline").hidden=true;
  }
  function parseHost(raw){
    var value=String(raw||"").replace(/^\s+|\s+$/g,"");
    // Full link from the host app, an IP:port pair, or bare local IP.
    var match=value.match(/^(?:http:\/\/)?(\d{1,3}(?:\.\d{1,3}){3})(?::(\d{2,5}))?(?:\/tv\?code=(\d{6}))?\/?$/i);
    if(!match)return null;
    var parts=match[1].split(".");
    for(var i=0;i<parts.length;i++)if(Number(parts[i])>255)return null;
    var first=Number(parts[0]),second=Number(parts[1]);
    if(!(first===10 || (first===172&&second>=16&&second<=31) ||
      (first===192&&second===168) || first===127))return null;
    var selected=match[2] ? Number(match[2]) : DEFAULT_PORT;
    if(selected<1||selected>65535)return null;
    return {host:parts.join("."),port:selected,code:match[3]||""};
  }
  function validate(){
    var parsed=parseHost(el("address").value);
    if(!parsed){message("Ange mobilens lokala IP-adress, t.ex. 192.168.50.78.");return null;}
    var c=(parsed.code||el("code").value).replace(/[^0-9]/g,"");
    if(!/^\d{6}$/.test(c)){message("Spelkoden måste vara sex siffror.");return null;}
    return {host:parsed.host,code:c,port:parsed.port};
  }
  function connect(){
    var value=validate();
    if(!value)return;
    host=value.host;code=value.code;port=value.port;
    save("host",host);save("code",code);save("port",String(port));
    el("address").value=addressWithPort(host,port);el("code").value=code;
    showReceiver();
    el("receiverStatus").textContent="● Ansluter till "+host+":"+port+"…";
    window.BibleTVViewer.start(host,code,port);
    keepTVVideoPlaying();
  }
  function restart(){
    if(host&&code)window.BibleTVViewer.start(host,code,port);
    else showSetup();
  }
  el("connect").onclick=connect;
  document.addEventListener("visibilitychange",keepTVVideoPlaying,false);
  window.addEventListener("focus",keepTVVideoPlaying,false);
  setInterval(keepTVVideoPlaying,15000);
  keepTVVideoPlaying();
  el("forceConnect").onclick=connect;
  el("retry").onclick=restart;
  el("offlineRetry").onclick=restart;
  el("settings").onclick=showSetup;
  el("offlineSettings").onclick=showSetup;
  el("direct").onclick=function(){
    lang=lang==="sv"?"en":"sv";
    window.BibleTVViewer.setLanguage(lang);
  };
  el("address").onkeydown=function(e){
    if((e.keyCode||e.which)===13){e.preventDefault();el("code").focus();}
  };
  el("code").onkeydown=function(e){
    if((e.keyCode||e.which)===13){e.preventDefault();connect();}
  };
  document.addEventListener("keydown",function(e){
    if((e.keyCode||e.which)===461 && !el("receiver").hidden){
      e.preventDefault();showSetup();
    }
  },false);
  var requested=(window.location.search||"").match(/[?&]code=(\d{6})(?:&|$)/);
  if(requested && DEFAULT_IP){
    // Always use the live URL's host AND port, never a previously saved game.
    el("address").value=addressWithPort(DEFAULT_IP,DEFAULT_PORT);
    el("code").value=requested[1];
    connect();
  }else showSetup();
})();

