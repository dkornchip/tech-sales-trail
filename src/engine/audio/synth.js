import { N } from "./core.js";
import { fxRandom } from "../../fxrng.js";

/* ---------- synth primitives: each takes o = {c: context, d: destination, t: start, j: pitch jitter} ---------- */
export function noiseBuf(c){
  if(c._tstNoise) return c._tstNoise;
  var len = Math.floor(c.sampleRate*2), b = c.createBuffer(1,len,c.sampleRate), d = b.getChannelData(0);
  for(var i=0;i<len;i++) d[i] = fxRandom()*2-1;
  c._tstNoise = b; return b;
}
export function env(c,g,t,v,a,hold,dur){
  v = Math.max(0.0002,v);
  g.gain.value = 0; // a fresh GainNode starts at 1; without this a click can leak in before the first automation event
  g.gain.setValueAtTime(0.0001,t);
  g.gain.exponentialRampToValueAtTime(v,t+a);
  if(hold) g.gain.setValueAtTime(v,t+a+hold);
  g.gain.exponentialRampToValueAtTime(0.0001,t+Math.max(dur,a+(hold||0)+0.01));
}
export function tone(o,p){
  var c = o.c, t = o.t+(p.at||0), dur = p.dur||0.12, jj = p.nj ? 1 : o.j;
  var osc = c.createOscillator(); osc.type = p.type||"square";
  osc.frequency.setValueAtTime(p.f*jj,t);
  if(p.f2){ var f2 = Math.max(20,p.f2*jj), te = t+(p.slide||dur); if(p.lin) osc.frequency.linearRampToValueAtTime(f2,te); else osc.frequency.exponentialRampToValueAtTime(f2,te); }
  var node = osc;
  if(p.lp || p.hp || p.bp){
    var fl = c.createBiquadFilter(); fl.type = p.lp ? "lowpass" : p.hp ? "highpass" : "bandpass";
    fl.frequency.setValueAtTime(p.lp||p.hp||p.bp,t); if(p.lp2) fl.frequency.exponentialRampToValueAtTime(p.lp2,t+dur);
    fl.Q.value = p.q||0.8; node.connect(fl); node = fl;
  }
  if(p.vib){ var l = c.createOscillator(), lg = c.createGain(); l.frequency.value = p.vib[0]; lg.gain.value = p.vib[1]; l.connect(lg); lg.connect(osc.frequency); l.start(t); l.stop(t+dur+0.05); }
  var g = c.createGain(); env(c,g,t,p.v==null?0.2:p.v,p.a||0.004,p.hold||0,dur);
  if(p.trem){ var l2 = c.createOscillator(), lg2 = c.createGain(), tg = c.createGain(); l2.frequency.value = p.trem[0]; lg2.gain.value = p.trem[1]; tg.gain.value = 1-p.trem[1]; l2.connect(lg2); lg2.connect(tg.gain); node.connect(tg); node = tg; l2.start(t); l2.stop(t+dur+0.05); }
  node.connect(g); g.connect(o.d);
  osc.start(t); osc.stop(t+dur+0.05);
  return t+dur;
}
export function noise(o,p){
  var c = o.c, t = o.t+(p.at||0), dur = p.dur||0.1, jj = p.nj ? 1 : o.j;
  var src = c.createBufferSource(); src.buffer = noiseBuf(c); src.loop = true;
  var fl = c.createBiquadFilter(); fl.type = p.ft||"bandpass";
  fl.frequency.setValueAtTime((p.f||1200)*jj,t);
  if(p.f2) fl.frequency.exponentialRampToValueAtTime(Math.max(20,p.f2*jj),t+(p.slide||dur));
  fl.Q.value = p.q==null ? 1 : p.q;
  var g = c.createGain(); env(c,g,t,p.v==null?0.2:p.v,p.a||0.002,p.hold||0,dur);
  src.connect(fl); fl.connect(g); g.connect(o.d);
  src.start(t,fxRandom()*1.5); src.stop(t+dur+0.05);
  return t+dur;
}
export function seq(o,notes,p){
  var e = 0, at = p.at||0;
  for(var i=0;i<notes.length;i++){
    var n = notes[i], f = typeof n[0] === "number" ? n[0] : N(n[0]);
    e = tone(o,{type:p.type,f:f,nj:1,at:at,dur:n[1],v:n[2]==null?p.v:n[2],a:p.a,lp:p.lp,vib:p.vib});
    at += n[3]==null ? (p.gap==null ? n[1] : p.gap) : n[3];
  }
  return e;
}
export function heart(o,at,k){
  tone(o,{type:"sine",f:82,f2:58,nj:1,at:at,dur:.13,v:.5*k,a:.006});
  tone(o,{type:"triangle",f:164,f2:116,nj:1,at:at,dur:.09,v:.12*k,a:.006});
  noise(o,{ft:"lowpass",f:380,q:.7,nj:1,at:at,dur:.06,v:.12*k});
  tone(o,{type:"sine",f:70,f2:50,nj:1,at:at+.17,dur:.11,v:.36*k,a:.006});
  return tone(o,{type:"triangle",f:140,f2:100,nj:1,at:at+.17,dur:.08,v:.08*k,a:.006});
}
