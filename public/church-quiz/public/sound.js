"use strict";
// Original, synthesized quiz music. No copyrighted television theme is included.
(function () {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  let ctx = null, master = null, unlocked = false, volume = Number(localStorage.getItem("quiz-volume") || ".65");
  let musicTimer = null, musicTrack = null, musicUrl = "", musicStep = 0, playing = false;
  const MEDIA_TYPES = ["start","correct","wrong","music","win","reveal","next"];
  const notes = {
    C3:130.81, D3:146.83, E3:164.81, F3:174.61, G3:196, A3:220, B3:246.94,
    C4:261.63, D4:293.66, E4:329.63, F4:349.23, G4:392, A4:440, B4:493.88,
    C5:523.25, D5:587.33, E5:659.25, F5:698.46, G5:783.99, A5:880, C6:1046.5
  };
  function validVolume(x) { return Math.min(1, Math.max(0, Number(x) || 0)); }
  function init() {
    if (!AudioContext) return false;
    if (!ctx) {
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = volume;
      master.connect(ctx.destination);
    }
    return true;
  }
  async function enable() {
    if (init()) {
      await ctx.resume();
      unlocked = ctx.state === "running";
    } else {
      // Some older TV browsers can play uploaded MP3 files without Web Audio support.
      unlocked = true;
    }
    return unlocked;
  }
  function tone(freq, offset, duration, opts={}) {
    if (!ctx || ctx.state !== "running") return;
    const start = ctx.currentTime + Math.max(0,offset);
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = opts.type || "triangle";
    oscillator.frequency.setValueAtTime(freq,start);
    if (opts.to) oscillator.frequency.exponentialRampToValueAtTime(opts.to,start+duration);
    const level=(opts.level===undefined?.18:opts.level);
    gain.gain.setValueAtTime(.0001,start);
    gain.gain.exponentialRampToValueAtTime(Math.max(.001,level),start+Math.min(.035,duration/3));
    gain.gain.exponentialRampToValueAtTime(.0001,start+duration);
    oscillator.connect(gain); gain.connect(master);
    oscillator.start(start); oscillator.stop(start+duration+.01);
    oscillator.onended=()=>{oscillator.disconnect();gain.disconnect()};
  }
  function chord(freqs, at, length, level=.12) {
    freqs.forEach((f,i)=>tone(f,at,length,{type:i===0?"triangle":"sine",level}));
  }
  function playSynth(cue) {
    if (!unlocked || !ctx) return;
    const n=notes;
    switch(cue){
      case "correct":
        tone(n.C5,0,.14,{level:.2});tone(n.E5,.15,.16,{level:.2});
        tone(n.G5,.31,.23,{level:.22});chord([n.C5,n.E5,n.G5,n.C6],.54,.56,.15);break;
      case "wrong":
        tone(n.G4,0,.19,{type:"sawtooth",level:.16,to:n.F4});
        tone(n.D4,.21,.3,{type:"sawtooth",level:.17,to:n.C3});
        tone(n.C3,.51,.28,{type:"triangle",level:.15});break;
      case "reveal":
        for(let i=0;i<7;i++)tone(n.C4+i*35,i*.055,.11,{level:.055,type:"sine"});
        chord([n.D4,n.A4],.4,.25,.08);break;
      case "next":
        tone(n.C5,0,.12,{level:.13});tone(n.G5,.15,.18,{level:.1});break;
      case "start":
        [n.C4,n.E4,n.G4,n.C5,n.E5,n.G5].forEach((note,i)=>tone(note,i*.105,.22,{level:.14}));
        chord([n.C4,n.E4,n.G4,n.C5],.72,.85,.13);break;
      case "win":
        [n.C4,n.E4,n.G4,n.C5,n.E5,n.G5,n.C6].forEach((note,i)=>tone(note,i*.135,.3,{level:.18}));
        chord([n.C4,n.G4,n.C5,n.E5,n.G5,n.C6],1.1,1.8,.11);
        [n.C6,n.G5,n.E5,n.C6].forEach((note,i)=>tone(note,1.65+i*.15,.27,{level:.13}));
        break;
    }
  }
  function stopMusic() {
    playing = false;
    if(musicTimer)clearInterval(musicTimer);
    musicTimer=null;
    if(musicTrack){musicTrack.pause();musicTrack.currentTime=0;musicTrack=null}
  }
  function musicPulse(){
    if(!ctx||ctx.state!=="running")return;
    // An original minor-key tension sequence, subtly pulsing like a TV quiz.
    const seq=[notes.C3,notes.G3,notes.E3,notes.G3,notes.C3,notes.G3,notes.F3,notes.G3,
      notes.A3,notes.E3,notes.C4,notes.E3,notes.A3,notes.E3,notes.G3,notes.E3];
    const freq=seq[musicStep%seq.length];
    tone(freq,0,.22,{type:"triangle",level:.055});
    if(musicStep%4===0)chord([notes.C3,notes.G3,notes.C4],0,.77,.025);
    if(musicStep%8===7)tone(notes.G4,0,.25,{type:"sine",level:.04});
    musicStep++;
  }
  function setMusic(on,url){
    if (!on || !unlocked) return stopMusic();
    const desiredUrl=String(url||"");
    if(playing && musicUrl===desiredUrl)return;
    stopMusic();playing=true;musicUrl=desiredUrl;musicStep=0;
    if(desiredUrl) {
      const track=new Audio(desiredUrl);
      track.loop=true;track.volume=validVolume(volume)*.55;
      musicTrack=track;
      track.play().catch(()=>{if(musicTrack===track){musicTrack=null;startSynthMusic()}});
    } else startSynthMusic();
  }
  function startSynthMusic(){
    if(!unlocked||!ctx||ctx.state!=="running"||musicTimer)return;
    musicPulse();musicTimer=setInterval(musicPulse,310);
  }
  function play(cue,url) {
    if(!unlocked)return false;
    if(!MEDIA_TYPES.includes(cue))return false;
    if(cue==="music"){setMusic(true,url);return true}
    if(url){
      const audio=new Audio(url);
      audio.volume=validVolume(volume);
      audio.play().catch(()=>playSynth(cue));
    }else playSynth(cue);
    return true;
  }
  function setVolume(value){
    volume=validVolume(value);
    localStorage.setItem("quiz-volume",String(volume));
    if(master)master.gain.setTargetAtTime(volume,ctx.currentTime,.01);
    if(musicTrack)musicTrack.volume=volume*.55;
  }
  window.QuizAudio={
    enable,play,setMusic,stopMusic,setVolume,get volume(){return volume},
    get unlocked(){return unlocked},get playing(){return playing}
  };
})();

