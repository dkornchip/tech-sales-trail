import { A, HAS_DOM, gainFor } from "./core.js";
import { P } from "./presets.js";
import { noiseBuf } from "./synth.js";
import { say } from "./voice.js";
import { root } from "../root.js";
import { fxRandom } from "../../fxrng.js";

/* ---------- context + voice management ---------- */
export function ensureCtx(){
  if(A.ctx) return A.ctx;
  var AC = root.AudioContext || root.webkitAudioContext; if(!AC) return null;
  try{ A.ctx = new AC(); }catch(e){ return null; }
  var comp = A.ctx.createDynamicsCompressor();
  try{ comp.threshold.value = -12; comp.knee.value = 10; comp.ratio.value = 5; comp.attack.value = .003; comp.release.value = .18; }catch(e){}
  A.master = A.ctx.createGain(); A.master.gain.value = A.settings.on ? gainFor(A.settings.vol) : 0;
  A.master.connect(comp); comp.connect(A.ctx.destination);
  return A.ctx;
}
export function jitter(){ return Math.pow(2,(fxRandom()*2-1)*0.035); }
export function play(name,opts){
  opts = opts || {};
  if(!A.settings.on || !A.unlocked) return null;
  var p = P[name]; if(!p) return null;
  var c = ensureCtx(); if(!c || c.state === "closed") return null;
  if(c.state !== "running"){ try{ var pr = c.resume(); if(pr && pr.catch) pr.catch(function(){}); }catch(e){} }
  var now = c.currentTime, prio = opts.prio != null ? opts.prio : p.prio;
  A.voices = A.voices.filter(function(v){ return v.end > now; });
  if(!p.free){
    if(A.voices.length >= 3){
      var low = null;
      A.voices.forEach(function(v){ if(!low || v.prio < low.prio || (v.prio === low.prio && v.start < low.start)) low = v; });
      if(low && low.prio < prio){ kill(low); A.voices.splice(A.voices.indexOf(low),1); }
      else return null;
    }
  }
  var bus = c.createGain(); bus.gain.value = opts.gain || 1; bus.connect(A.master);
  var t = now + 0.01 + (opts.delay || 0), end;
  try{ end = p.fn({c:c,d:bus,t:t,j:jitter()}); }catch(e){ try{ bus.disconnect(); }catch(_){} return null; }
  if(!(end > t)) end = t + 0.4;
  var voice = {bus:bus, end:end, prio:prio, start:now, name:name};
  if(!p.free) A.voices.push(voice);
  setTimeout(function(){ try{ bus.disconnect(); }catch(e){} }, (end-now+0.4)*1000);
  if(A.onPlay) try{ A.onPlay(name); }catch(e){}
  return voice;
}
export function kill(v){ try{ var c = A.ctx; v.bus.gain.cancelScheduledValues(c.currentTime); v.bus.gain.setTargetAtTime(0,c.currentTime,0.015); }catch(e){} v.end = 0; }

/* ---------- ambient loop (rain) ---------- */
export function ambient(name){
  stopAmbient();
  if(!A.settings.on || !A.unlocked || name !== "rain") return;
  var c = ensureCtx(); if(!c) return;
  var src = c.createBufferSource(); src.buffer = noiseBuf(c); src.loop = true;
  var hp = c.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 1400;
  var lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 7000;
  var g = c.createGain(); g.gain.value = 0; g.gain.setValueAtTime(0.0001,c.currentTime); g.gain.exponentialRampToValueAtTime(0.05,c.currentTime+0.8);
  // fade out after ~9s so it doesn't hiss for the whole time the modal is open
  g.gain.setValueAtTime(0.05,c.currentTime+8); g.gain.exponentialRampToValueAtTime(0.0001,c.currentTime+11);
  src.connect(hp); hp.connect(lp); lp.connect(g); g.connect(A.master);
  src.start(); src.stop(c.currentTime+11.2);
  A.amb = {src:src, g:g};
}
export function stopAmbient(){
  if(!A.amb) return;
  var a = A.amb; A.amb = null;
  try{ var c = A.ctx; a.g.gain.cancelScheduledValues(c.currentTime); a.g.gain.setTargetAtTime(0,c.currentTime,0.12); a.src.stop(c.currentTime+0.6); }catch(e){}
}

/* ---------- stress heartbeat ---------- */
export function setStress(s){
  var prev = A.stress; A.stress = s;
  if(s >= 80 && prev < 80 && prev > 0 && Date.now()-A.lastHydrate > 60000){ A.lastHydrate = Date.now(); say("hydrate"); }
  if(s >= 70){ if(!A.hbTimer) scheduleBeat(); }
  else if(A.hbTimer){ clearTimeout(A.hbTimer); A.hbTimer = 0; }
}
export function scheduleBeat(){
  var s = A.stress, period = 1050 - (Math.min(100,s)-70)/30*500;
  A.hbTimer = setTimeout(function(){
    A.hbTimer = 0;
    if(A.stress < 70) return;
    if(!(HAS_DOM && document.hidden)) play("heartbeat",{gain:0.45+(Math.min(100,A.stress)-70)/30*0.35});
    scheduleBeat();
  }, period);
}
