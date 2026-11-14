import { A, HAS_DOM, gainFor, saveSettings } from "./core.js";
import { onLogs, onModal, ruleFor } from "./director.js";
import { ambient, ensureCtx, play, scheduleBeat, setStress, stopAmbient } from "./mixer.js";
import { P } from "./presets.js";
import { LINES, SAY, cancelSay, hush, rememberVoices, say } from "./voice.js";
import { root } from "../root.js";

/* ---------- unlock on the first gesture ---------- */
export function unlock(){
  var c = ensureCtx(); if(!c) return;
  if(c.state !== "running"){ try{ var pr = c.resume(); if(pr && pr.catch) pr.catch(function(){}); }catch(e){} }
  if(!A.unlocked){
    A.unlocked = true;
    try{ var b = c.createBuffer(1,1,22050), s = c.createBufferSource(); s.buffer = b; s.connect(c.destination); s.start(0); }catch(e){}
    // a silent utterance inside the gesture is what lets later lines speak on iOS; it is watched so a primer
    // that never ends (seen with Edge's online voices) cannot leave the engine reporting "speaking" forever
    try{ if("speechSynthesis" in root){
      var ss = root.speechSynthesis, u = new root.SpeechSynthesisUtterance(" "); u.volume = 0;
      u.onend = u.onerror = function(){ if(SAY.primer === u) SAY.primer = null; };
      SAY.primer = u; ss.speak(u);
      setTimeout(function(){ if(SAY.primer === u){ SAY.primer = null; if(!SAY.current){ try{ ss.cancel(); }catch(e){} } } },1500);
      rememberVoices();
    } }catch(e){}
    if(A.stress >= 70 && !A.hbTimer) scheduleBeat();
  }
}
if(HAS_DOM){
  ["pointerdown","touchend","keydown","click"].forEach(function(ev){ document.addEventListener(ev,unlock,{capture:true,passive:true}); });
  document.addEventListener("click",function(e){
    var b = e.target && e.target.closest ? e.target.closest("button") : null;
    if(b && !b.disabled && !b.hasAttribute("data-nosfx")) play("click");
  },true);
}

/* ---------- settings API ---------- */
export function setOn(on){
  A.settings.on = !!on; saveSettings();
  if(A.master && A.ctx){ var t = A.ctx.currentTime; A.master.gain.cancelScheduledValues(t); A.master.gain.setTargetAtTime(A.settings.on ? gainFor(A.settings.vol) : 0,t,0.03); }
  if(!A.settings.on) hush();
  if(A.onChange) A.onChange(A.settings);
}
export function setVoice(on){ A.settings.voice = !!on; saveSettings(); if(!on){ clearTimeout(SAY.timer); try{ root.speechSynthesis.cancel(); }catch(e){} } if(A.onChange) A.onChange(A.settings); }
export function setVolume(v){
  A.settings.vol = Math.max(0,Math.min(1,v)); saveSettings();
  if(A.master && A.ctx && A.settings.on){ var t = A.ctx.currentTime; A.master.gain.cancelScheduledValues(t); A.master.gain.setTargetAtTime(gainFor(A.settings.vol),t,0.03); }
  if(A.onChange) A.onChange(A.settings);
}

export function setCaptions(on){ A.settings.captions = !!on; saveSettings(); if(A.onChange) A.onChange(A.settings); }

var API = {
  play:play, say:say, cancelSay:cancelSay, hush:hush, ambient:ambient, stopAmbient:stopAmbient, setStress:setStress,
  onLogs:onLogs, onModal:onModal, setOn:setOn, setVoice:setVoice, setVolume:setVolume, setCaptions:setCaptions, unlock:unlock,
  get settings(){ return A.settings; },
  set onChange(fn){ A.onChange = fn; }, set onCaption(fn){ A.onCaption = fn; }
};
// What only the tests read: the engine's insides. A release build leaves this out.
if(typeof __TST_TEST__ === "undefined" || __TST_TEST__){
  Object.defineProperties(API, {
    unlocked:{ get:function(){ return A.unlocked; }, enumerable:true },
    lastSpeechError:{ get:function(){ return A.lastSpeechError || null; }, enumerable:true },
    voiceName:{ get:function(){ return SAY.voiceName.m; }, enumerable:true },
    voiceNames:{ get:function(){ return SAY.voiceName; }, enumerable:true }
  });
  API.ruleFor = ruleFor; API.presets = P; API._A = A; API.LINES = LINES;
  // render a preset into an offline context
  API.renderInto = function(c,name){ var p = P[name]; return p.fn({c:c,d:c.destination,t:0.01,j:1}); };
}
root.TST_AUDIO = API;
