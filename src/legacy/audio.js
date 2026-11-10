import { fxRandom } from "../fxrng.js";
/* ===== Tech Sales Trail v1.14: sound engine (Web Audio synth, no samples) + PA announcer ===== */
(function(root){
  "use strict";
  var HAS_DOM = typeof document !== "undefined";
  var KEY = "tst-audio-v1";
  var A = { ctx:null, master:null, unlocked:false, voices:[], amb:null, hb:null, hbTimer:0, stress:0, lastHydrate:0,
            settings:{ on:true, voice:true, vol:0.6 } };

  /* ---------- settings ---------- */
  try{
    var raw = root.localStorage && root.localStorage.getItem(KEY);
    if(raw){ var v = JSON.parse(raw); if(v && typeof v === "object"){
      if(typeof v.on === "boolean") A.settings.on = v.on;
      if(typeof v.voice === "boolean") A.settings.voice = v.voice;
      if(typeof v.vol === "number" && v.vol >= 0 && v.vol <= 1) A.settings.vol = v.vol;
    } }
  }catch(e){}
  function saveSettings(){ try{ root.localStorage.setItem(KEY,JSON.stringify(A.settings)); }catch(e){} }
  function gainFor(vol){ return Math.pow(vol,1.6)*0.95; }

  /* ---------- notes ---------- */
  var IDX = {C:-9,"C#":-8,Db:-8,D:-7,"D#":-6,Eb:-6,E:-5,F:-4,"F#":-3,Gb:-3,G:-2,"G#":-1,Ab:-1,A:0,"A#":1,Bb:1,B:2};
  function N(n){ var m = /^([A-G](?:#|b)?)(-?\d)$/.exec(n); return 440*Math.pow(2,(IDX[m[1]]+(parseInt(m[2],10)-4)*12)/12); }

  /* ---------- synth primitives: each takes o = {c: context, d: destination, t: start, j: pitch jitter} ---------- */
  function noiseBuf(c){
    if(c._tstNoise) return c._tstNoise;
    var len = Math.floor(c.sampleRate*2), b = c.createBuffer(1,len,c.sampleRate), d = b.getChannelData(0);
    for(var i=0;i<len;i++) d[i] = fxRandom()*2-1;
    c._tstNoise = b; return b;
  }
  function env(c,g,t,v,a,hold,dur){
    v = Math.max(0.0002,v);
    g.gain.value = 0; // a fresh GainNode starts at 1; without this a click can leak in before the first automation event
    g.gain.setValueAtTime(0.0001,t);
    g.gain.exponentialRampToValueAtTime(v,t+a);
    if(hold) g.gain.setValueAtTime(v,t+a+hold);
    g.gain.exponentialRampToValueAtTime(0.0001,t+Math.max(dur,a+(hold||0)+0.01));
  }
  function tone(o,p){
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
  function noise(o,p){
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
  function seq(o,notes,p){
    var e = 0, at = p.at||0;
    for(var i=0;i<notes.length;i++){
      var n = notes[i], f = typeof n[0] === "number" ? n[0] : N(n[0]);
      e = tone(o,{type:p.type,f:f,nj:1,at:at,dur:n[1],v:n[2]==null?p.v:n[2],a:p.a,lp:p.lp,vib:p.vib});
      at += n[3]==null ? (p.gap==null ? n[1] : p.gap) : n[3];
    }
    return e;
  }
  function heart(o,at,k){
    tone(o,{type:"sine",f:82,f2:58,nj:1,at:at,dur:.13,v:.5*k,a:.006});
    tone(o,{type:"triangle",f:164,f2:116,nj:1,at:at,dur:.09,v:.12*k,a:.006});
    noise(o,{ft:"lowpass",f:380,q:.7,nj:1,at:at,dur:.06,v:.12*k});
    tone(o,{type:"sine",f:70,f2:50,nj:1,at:at+.17,dur:.11,v:.36*k,a:.006});
    return tone(o,{type:"triangle",f:140,f2:100,nj:1,at:at+.17,dur:.08,v:.08*k,a:.006});
  }

  /* ---------- presets (prio: 0 ui, 1 ambient info, 2 event, 3 your action, 4 key moment, 5 ending stinger) ---------- */
  var P = {
    click:   {prio:0, fn:function(o){ noise(o,{ft:"highpass",f:2600,q:.7,dur:.028,v:.09}); return tone(o,{type:"sine",f:1500,f2:950,dur:.035,v:.06}); }},
    key:     {prio:0, free:true, fn:function(o){ noise(o,{ft:"bandpass",f:3600,q:1.3,dur:.018,v:.06}); return tone(o,{type:"square",f:170,dur:.02,v:.02,lp:900}); }},
    tick:    {prio:0, free:true, fn:function(o){ return tone(o,{type:"square",f:2100,dur:.016,v:.018,lp:5000}); }},
    step:    {prio:0, free:true, fn:function(o){ noise(o,{ft:"lowpass",f:420,q:.7,dur:.05,v:.07}); return tone(o,{type:"sine",f:95,f2:70,dur:.07,v:.13}); }},
    heartbeat:{prio:1, free:true, fn:function(o){ return heart(o,0,1); }},

    // your actions
    dial:    {prio:3, fn:function(o){ var R=[697,770,852,941], C=[1209,1336,1477], t=0, e=0;
               for(var i=0;i<4;i++){ var r = R[(fxRandom()*4)|0], cl = C[(fxRandom()*3)|0];
                 tone(o,{type:"sine",f:r,nj:1,at:t,dur:.075,v:.07,hold:.05}); e = tone(o,{type:"sine",f:cl,nj:1,at:t,dur:.075,v:.06,hold:.05}); t += .095; }
               return e; }},
    whoosh:  {prio:3, fn:function(o){ noise(o,{ft:"bandpass",f:300,f2:2400,q:.9,dur:.3,v:.16,a:.1}); return noise(o,{ft:"bandpass",f:350,f2:4200,q:1.4,dur:.32,v:.3,a:.1}); }},
    typewriter:{prio:3, fn:function(o){ var t=0;
               for(var i=0;i<5;i++){ noise(o,{ft:"highpass",f:2200,q:.8,at:t,dur:.026,v:.15}); tone(o,{type:"triangle",f:140,at:t,dur:.03,v:.07}); t += .045+fxRandom()*.035; }
               return tone(o,{type:"sine",f:2637,nj:1,at:t+.04,dur:.4,v:.07}); }},
    demo:    {prio:3, fn:function(o){ var n=["C5","E5","G5","B5"], e=0; tone(o,{type:"sine",f:N("C4"),nj:1,dur:.7,v:.07,a:.05});
               for(var i=0;i<4;i++) e = tone(o,{type:"triangle",f:N(n[i]),nj:1,at:i*.055,dur:.6,v:.07,a:.01}); return e; }},
    printer: {prio:3, fn:function(o){ var e=0; for(var i=0;i<3;i++){ tone(o,{type:"square",f:96,at:i*.11,dur:.08,v:.06,lp:700}); e = noise(o,{ft:"bandpass",f:1800,q:2,at:i*.11,dur:.08,v:.08}); } return e; }},
    cash:    {prio:3, fn:function(o){ noise(o,{ft:"highpass",f:1800,q:.7,dur:.04,v:.15});
               tone(o,{type:"square",f:N("B5"),nj:1,at:.03,dur:.07,v:.05,lp:4500}); tone(o,{type:"square",f:N("E6"),nj:1,at:.09,dur:.22,v:.05,lp:4500});
               tone(o,{type:"sine",f:2093,nj:1,at:.05,dur:.62,v:.11}); tone(o,{type:"sine",f:4207,nj:1,at:.05,dur:.35,v:.04});
               return noise(o,{ft:"lowpass",f:650,q:.7,at:.13,dur:.18,v:.12}); }},
    thud:    {prio:3, fn:function(o){ noise(o,{ft:"lowpass",f:320,q:.7,dur:.15,v:.16}); return tone(o,{type:"sine",f:110,f2:55,dur:.24,v:.3}); }},
    nope:    {prio:3, fn:function(o){ tone(o,{type:"square",f:N("E3"),nj:1,dur:.08,v:.06,lp:1300}); return tone(o,{type:"square",f:N("C3"),nj:1,at:.09,dur:.13,v:.06,lp:1300}); }},
    ping:    {prio:3, fn:function(o){ tone(o,{type:"sine",f:N("E6"),dur:.16,v:.11}); tone(o,{type:"sine",f:N("A6"),at:.09,dur:.3,v:.11}); return tone(o,{type:"sine",f:N("A6"),at:.26,dur:.25,v:.03}); }},
    sonar:   {prio:3, fn:function(o){ tone(o,{type:"sine",f:880,f2:830,dur:.6,v:.15}); tone(o,{type:"sine",f:440,f2:415,dur:.4,v:.05}); return tone(o,{type:"sine",f:880,f2:830,at:.45,dur:.5,v:.05}); }},
    airport: {prio:3, fn:function(o){ var n=["F5","A5","C6"], e=0; for(var i=0;i<3;i++){ tone(o,{type:"sine",f:N(n[i]),nj:1,at:i*.2,dur:.9,v:.1}); e = tone(o,{type:"sine",f:N(n[i])*2,nj:1,at:i*.2,dur:.4,v:.022}); } return e+.5; }},
    bowl:    {prio:3, fn:function(o){ var f = 220*o.j; tone(o,{type:"sine",f:f,nj:1,dur:1.5,v:.14,a:.01,vib:[4.5,1.2]}); tone(o,{type:"sine",f:f*2.76,nj:1,dur:1.0,v:.055,a:.01}); return tone(o,{type:"sine",f:f*5.4,nj:1,dur:.6,v:.022,a:.01}); }},
    coffee:  {prio:3, fn:function(o){ var t=0;
               for(var i=0;i<6;i++){ noise(o,{ft:"bandpass",f:1900-i*230,q:3,at:t,dur:.05,v:.11}); t += .055; }
               var e=0; t += .1; for(var k=0;k<3;k++){ e = heart(o,t,.85); t += .34; } return e; }},
    sneaky:  {prio:3, fn:function(o){ seq(o,[["E4",.07],["F4",.07],["F#4",.07],["G4",.07]],{type:"triangle",v:.12,gap:.11}); return tone(o,{type:"triangle",f:N("C4"),nj:1,at:.5,dur:.13,v:.1}); }},
    hailmary:{prio:3, fn:function(o){ noise(o,{ft:"bandpass",f:500,f2:5000,q:1.2,dur:.5,v:.16,a:.2}); return tone(o,{type:"square",f:300,f2:1200,dur:.5,v:.06,vib:[9,25],lp:2600}); }},
    fanfareS:{prio:3, fn:function(o){ return seq(o,[["C5",.08],["E5",.08],["G5",.08],["C6",.35]],{type:"square",v:.055,lp:3200,gap:.07}); }},
    bad:     {prio:3, fn:function(o){ tone(o,{type:"sawtooth",f:110,f2:70,dur:.34,v:.1,lp:900}); return tone(o,{type:"sawtooth",f:116,f2:73,dur:.34,v:.08,lp:900}); }},
    warn:    {prio:2, fn:function(o){ tone(o,{type:"square",f:N("A4"),nj:1,dur:.09,v:.05,lp:1800}); return tone(o,{type:"square",f:N("F4"),nj:1,at:.1,dur:.14,v:.05,lp:1800}); }},

    // money + week
    rent:    {prio:2, fn:function(o){ return seq(o,[["B5",.06],["G5",.06],["E5",.06],["C5",.06],["A4",.1]],{type:"square",v:.045,lp:3500,gap:.05}); }},
    coin:    {prio:1, fn:function(o){ tone(o,{type:"square",f:N("B5"),nj:1,dur:.06,v:.05,lp:4200}); return tone(o,{type:"square",f:N("E6"),nj:1,at:.06,dur:.17,v:.05,lp:4200}); }},
    week:    {prio:1, fn:function(o){ noise(o,{ft:"bandpass",f:2600,f2:1200,q:1.5,dur:.07,v:.1}); noise(o,{ft:"bandpass",f:2400,f2:1000,q:1.5,at:.06,dur:.07,v:.08});
               tone(o,{type:"triangle",f:N("E5"),nj:1,at:.1,dur:.14,v:.08}); return tone(o,{type:"triangle",f:N("A5"),nj:1,at:.2,dur:.26,v:.08}); }},

    // events
    leads:   {prio:2, fn:function(o){ var n=["C5","D5","E5","G5","A5","C6"], e=0; for(var i=0;i<6;i++) e = tone(o,{type:"square",f:N(n[(fxRandom()*6)|0]),nj:1,at:i*.042,dur:.05,v:.04,lp:3500}); return e; }},
    discount:{prio:2, fn:function(o){ noise(o,{ft:"highpass",f:3000,q:.8,dur:.03,v:.12}); noise(o,{ft:"highpass",f:3000,q:.8,at:.08,dur:.03,v:.12}); return tone(o,{type:"sawtooth",f:900,f2:280,at:.12,dur:.22,v:.05,lp:2000}); }},
    fumble:  {prio:2, fn:function(o){ var f=[230,180,140], e=0; for(var i=0;i<3;i++) e = tone(o,{type:"square",f:f[i],at:i*.06,dur:.06,v:.06,lp:1500}); noise(o,{ft:"bandpass",f:900,q:.8,at:.05,dur:.12,v:.08}); return e; }},
    magic:   {prio:2, fn:function(o){ return seq(o,[["C6",.25],["D6",.25],["E6",.25],["G6",.25],["A6",.25],["C7",.25],["E7",.25],["G7",.3]],{type:"sine",v:.045,gap:.035}); }},
    thunder: {prio:2, fn:function(o){ noise(o,{ft:"highpass",f:2000,q:.7,dur:.05,v:.12}); return noise(o,{ft:"lowpass",f:520,f2:70,q:.8,dur:1.1,v:.32,a:.04}); }},
    rise:    {prio:2, fn:function(o){ return seq(o,[["C5",.12],["D5",.12],["E5",.12],["G5",.12],["C6",.22]],{type:"triangle",v:.08,gap:.05}); }},
    chirp:   {prio:2, fn:function(o){ var e=0; for(var i=0;i<3;i++) e = tone(o,{type:"sine",f:2400,f2:4200,at:i*.09,dur:.06,v:.06}); return e; }},
    ice:     {prio:2, fn:function(o){ var f=[2093,2349,2637,3136], e=0; for(var i=0;i<4;i++) e = Math.max(e,tone(o,{type:"sine",f:f[i],at:fxRandom()*.2,dur:.22,v:.04})); noise(o,{ft:"highpass",f:6000,q:.7,dur:.3,v:.03,a:.05}); return e; }},
    sick:    {prio:2, fn:function(o){ return tone(o,{type:"triangle",f:420,f2:190,dur:.42,v:.09,vib:[6,22]}); }},
    shield:  {prio:2, fn:function(o){ tone(o,{type:"square",f:660,dur:.18,v:.035,lp:4000}); tone(o,{type:"square",f:990,dur:.15,v:.028,lp:4000}); tone(o,{type:"sine",f:1480,dur:.38,v:.05}); return noise(o,{ft:"bandpass",f:3200,q:3,dur:.08,v:.08}); }},
    ghost:   {prio:2, fn:function(o){ tone(o,{type:"sine",f:760,f2:330,dur:.62,v:.1,a:.06,vib:[5,22],lin:1}); return tone(o,{type:"triangle",f:510,f2:220,dur:.62,v:.04,a:.06,vib:[5,15],lin:1}); }},
    puzzle:  {prio:2, fn:function(o){ noise(o,{ft:"highpass",f:3000,q:.8,dur:.02,v:.1}); tone(o,{type:"triangle",f:N("G5"),nj:1,at:.03,dur:.12,v:.08}); return tone(o,{type:"triangle",f:N("D6"),nj:1,at:.11,dur:.22,v:.08}); }},
    powerdown:{prio:2, fn:function(o){ return tone(o,{type:"square",f:440,f2:90,dur:.36,v:.05,lp:1800,lp2:300}); }},
    ticktock:{prio:2, fn:function(o){ var e=0; for(var i=0;i<4;i++) e = tone(o,{type:"sine",f:i%2 ? 900 : 1250,at:i*.13,dur:.03,v:.1,a:.002}); return e; }},
    busy:    {prio:2, fn:function(o){ var e=0; for(var i=0;i<2;i++){ tone(o,{type:"sine",f:480,nj:1,at:i*.25,dur:.15,v:.05,hold:.12}); e = tone(o,{type:"sine",f:620,nj:1,at:i*.25,dur:.15,v:.05,hold:.12}); } return e; }},
    suspicion:{prio:2, fn:function(o){ tone(o,{type:"sine",f:N("E6"),nj:1,dur:.12,v:.06}); return tone(o,{type:"triangle",f:N("C3"),nj:1,at:.12,dur:.6,v:.11,a:.08,vib:[3,2]}); }},
    hr:      {prio:4, fn:function(o){ tone(o,{type:"sawtooth",f:55,nj:1,dur:1.9,v:.08,a:.45,hold:.6,lp:320}); tone(o,{type:"sawtooth",f:58.27,nj:1,dur:1.9,v:.07,a:.5,hold:.6,lp:320}); return tone(o,{type:"sine",f:110,nj:1,dur:1.9,v:.06,a:.5,hold:.6}); }},
    hrSoft:  {prio:2, fn:function(o){ tone(o,{type:"sawtooth",f:55,nj:1,dur:1.0,v:.05,a:.3,lp:300}); return tone(o,{type:"sine",f:110,nj:1,dur:1.0,v:.04,a:.3}); }},
    qbr:     {prio:1, fn:function(o){ var e=0; for(var i=0;i<9;i++) e = noise(o,{ft:"highpass",f:1800,q:.7,at:i*.045,dur:.04,v:.03+i*.01}); return noise(o,{ft:"highpass",f:5000,q:.5,at:.42,dur:.5,v:.08}); }},
    achievement:{prio:4, fn:function(o){ seq(o,[["C5",.09],["E5",.09],["G5",.09],["C6",.09]],{type:"square",v:.05,lp:3500,gap:.07});
               var e=0, ch=["C6","E6","G6"]; for(var k=0;k<3;k++) e = tone(o,{type:"triangle",f:N(ch[k]),nj:1,at:.3,dur:.65,v:.06,vib:[6,4]}); return e; }},
    lost:    {prio:4, fn:function(o){ tone(o,{type:"sawtooth",f:N("G3"),nj:1,dur:.2,v:.08,lp:1100}); tone(o,{type:"sawtooth",f:N("E3"),nj:1,at:.22,dur:.2,v:.08,lp:1100});
               return tone(o,{type:"sawtooth",f:N("D3"),f2:N("C#3"),nj:1,at:.44,dur:.62,v:.08,lp:1000,vib:[5.5,4]}); }},
    alarm:   {prio:4, fn:function(o){ var e=0; for(var i=0;i<3;i++){ tone(o,{type:"square",f:880,nj:1,at:i*.16,dur:.07,v:.045,lp:3000}); e = tone(o,{type:"square",f:660,nj:1,at:i*.16+.08,dur:.07,v:.045,lp:3000}); } return e; }},
    modal:   {prio:4, fn:function(o){ tone(o,{type:"triangle",f:N("E5"),nj:1,dur:.26,v:.09}); tone(o,{type:"triangle",f:N("B5"),nj:1,dur:.26,v:.07}); return tone(o,{type:"sine",f:N("C7"),nj:1,at:.08,dur:.32,v:.05}); }},
    newgame: {prio:4, fn:function(o){ return seq(o,[["C5",.09],["G5",.09],["E5",.09],["C6",.3]],{type:"square",v:.05,lp:3200,gap:.08}); }},
    save:    {prio:3, fn:function(o){ for(var i=0;i<3;i++) noise(o,{ft:"bandpass",f:1100,q:4,at:i*.05,dur:.03,v:.1}); return tone(o,{type:"square",f:N("A5"),nj:1,at:.17,dur:.12,v:.04,lp:3000}); }},
    load:    {prio:3, fn:function(o){ tone(o,{type:"square",f:N("A5"),nj:1,dur:.07,v:.04,lp:3000}); tone(o,{type:"square",f:N("E5"),nj:1,at:.07,dur:.1,v:.04,lp:3000}); return noise(o,{ft:"bandpass",f:1100,q:4,at:.18,dur:.04,v:.08}); }},
    pa:      {prio:2, free:true, fn:function(o){ tone(o,{type:"sine",f:N("A5"),nj:1,dur:.7,v:.09}); tone(o,{type:"sine",f:N("A6"),nj:1,dur:.3,v:.018});
               tone(o,{type:"sine",f:N("F5"),nj:1,at:.32,dur:.9,v:.09}); return tone(o,{type:"sine",f:N("F6"),nj:1,at:.32,dur:.35,v:.018}); }},

    // scene cues
    plane:   {prio:4, fn:function(o){ noise(o,{ft:"bandpass",f:380,f2:1500,q:.9,dur:1.0,v:.16,a:.4}); noise(o,{ft:"bandpass",f:1500,f2:300,q:.9,at:1.0,dur:1.0,v:.16,a:.02,slide:1.0});
               return tone(o,{type:"sawtooth",f:560,f2:430,dur:2.0,v:.018,a:.5,lp:1400}); }},
    screech: {prio:3, fn:function(o){ noise(o,{ft:"bandpass",f:3100,q:6,dur:.32,v:.1}); return tone(o,{type:"square",f:1750,f2:1500,dur:.28,v:.015,lp:4000}); }},
    seatbelt:{prio:3, fn:function(o){ tone(o,{type:"sine",f:N("D6"),nj:1,dur:.9,v:.09}); return tone(o,{type:"sine",f:N("D7"),nj:1,dur:.3,v:.02}); }},
    sparkle: {prio:3, fn:function(o){ var n=["C6","E6","G6","A6","C7","D7","E7","G7"], e=0; for(var i=0;i<12;i++) e = tone(o,{type:"sine",f:N(n[(fxRandom()*n.length)|0]),nj:1,at:i*.06,dur:.3,v:.04}); return e; }},
    pop:     {prio:2, fn:function(o){ noise(o,{ft:"bandpass",f:1300,q:.8,dur:.09,v:.22}); var e=0; for(var i=0;i<6;i++) e = Math.max(e,noise(o,{ft:"highpass",f:3000,q:.7,at:.1+fxRandom()*.35,dur:.02,v:.05})); return e; }},
    stingerClub:{prio:5, fn:function(o){
               var chords = [[["C5","E5","G5"],0,.18],[["D5","F5","A5"],.2,.18],[["E5","G5","C6"],.4,.85]], e=0;
               chords.forEach(function(ch){ ch[0].forEach(function(n){ e = Math.max(e,tone(o,{type:"sawtooth",f:N(n),nj:1,at:ch[1],dur:ch[2],v:.045,lp:2400,a:.015,vib:ch[2] > .5 ? [5.5,3] : null})); }); });
               tone(o,{type:"triangle",f:N("C3"),nj:1,dur:.2,v:.14}); tone(o,{type:"triangle",f:N("C3"),nj:1,at:.4,dur:.8,v:.14});
               noise(o,{ft:"highpass",f:6000,q:.5,nj:1,at:.4,dur:.9,v:.07}); return e; }},
    beep:    {prio:3, fn:function(o){ return tone(o,{type:"square",f:1600,nj:1,dur:.09,v:.05,hold:.06,lp:5000}); }},
    denied:  {prio:4, fn:function(o){ tone(o,{type:"square",f:140,nj:1,dur:.4,v:.08,hold:.3,lp:1500}); return tone(o,{type:"square",f:147,nj:1,dur:.4,v:.07,hold:.3,lp:1500}); }},
    drop:    {prio:2, fn:function(o){ tone(o,{type:"triangle",f:900,f2:200,dur:.35,v:.06}); return noise(o,{ft:"lowpass",f:500,q:.7,at:.35,dur:.08,v:.12}); }},
    doors:   {prio:3, fn:function(o){ return noise(o,{ft:"lowpass",f:700,q:.6,dur:.65,v:.1,a:.12,hold:.3}); }},
    elevator:{prio:4, fn:function(o){ tone(o,{type:"sine",f:N("E6"),nj:1,dur:1.0,v:.1}); tone(o,{type:"sine",f:N("E7"),nj:1,dur:.3,v:.02});
               tone(o,{type:"sine",f:N("C6"),nj:1,at:.38,dur:1.2,v:.1}); return tone(o,{type:"sine",f:N("C7"),nj:1,at:.38,dur:.3,v:.02}); }},
    stingerFired:{prio:5, fn:function(o){ var e = seq(o,[["G4",.14],["D4",.14],["Bb3",.14],["G3",.7]],{type:"square",v:.06,lp:1600,gap:.15});
               for(var i=0;i<4;i++) noise(o,{ft:"bandpass",f:600+fxRandom()*2400,q:4,nj:1,at:.45+i*.07,dur:.03,v:.06}); return e; }},
    meltdown:{prio:4, fn:function(o){ return tone(o,{type:"sawtooth",f:320,f2:55,dur:1.4,v:.08,lp:1300,lp2:250,vib:[7,18]}); }},
    fire:    {prio:3, fn:function(o){ var e = noise(o,{ft:"lowpass",f:700,q:.6,dur:1.0,v:.07,a:.2}); for(var i=0;i<14;i++) noise(o,{ft:"highpass",f:2200,q:.7,at:fxRandom()*.9,dur:.015,v:.06}); return e; }},
    glitch:  {prio:4, fn:function(o){ var e=0; for(var i=0;i<7;i++) e = tone(o,{type:"square",f:200+fxRandom()*1800,nj:1,at:i*.032,dur:.026,v:.05}); noise(o,{ft:"bandpass",f:1500,q:.5,dur:.25,v:.06}); return e; }},
    bsod:    {prio:4, fn:function(o){ tone(o,{type:"sine",f:440,nj:1,dur:.16,v:.08}); return tone(o,{type:"square",f:220,nj:1,at:.14,dur:.45,v:.05,lp:800}); }},
    stingerBurnout:{prio:5, fn:function(o){ tone(o,{type:"sawtooth",f:N("C2"),nj:1,dur:1.4,v:.06,lp:400,a:.1});
               return seq(o,[["Eb5",.16],["C5",.16],["Ab4",.16],["F4",.9]],{type:"triangle",v:.09,gap:.17,vib:[5,3]}); }},
    stingerMissed:{prio:5, fn:function(o){ seq(o,[["A4",.14],["C5",.14],["E5",.2]],{type:"triangle",v:.09,gap:.15});
               return tone(o,{type:"triangle",f:N("D5"),f2:N("A4"),nj:1,at:.5,dur:.75,v:.09,slide:.7,vib:[5,3]}); }},
    umbrella:{prio:3, fn:function(o){ noise(o,{ft:"bandpass",f:800,f2:3200,q:1.2,dur:.12,v:.12}); return tone(o,{type:"sine",f:600,f2:950,at:.1,dur:.08,v:.1}); }},
    beeper:  {prio:3, fn:function(o){ return tone(o,{type:"square",f:1050,nj:1,dur:.32,v:.045,hold:.27,lp:3200}); }},
    clank:   {prio:3, fn:function(o){ tone(o,{type:"square",f:420,dur:.15,v:.05,lp:3000}); tone(o,{type:"square",f:633,dur:.12,v:.04,lp:3000}); tone(o,{type:"sine",f:1170,dur:.3,v:.05}); return noise(o,{ft:"bandpass",f:2500,q:4,dur:.1,v:.1}); }},
    engine:  {prio:3, fn:function(o){ tone(o,{type:"sawtooth",f:62,f2:44,nj:1,dur:2.3,v:.12,a:.15,lp:260,trem:[9,.5]}); return tone(o,{type:"square",f:124,f2:88,nj:1,dur:2.3,v:.025,a:.15,lp:500}); }},
    honk:    {prio:3, fn:function(o){ var e=0; for(var i=0;i<2;i++){ tone(o,{type:"square",f:330,nj:1,at:i*.32,dur:.24,v:.05,hold:.18,lp:1600}); e = tone(o,{type:"square",f:415,nj:1,at:i*.32,dur:.24,v:.045,hold:.18,lp:1600}); } return e; }},
    stingerRepo:{prio:5, fn:function(o){ var e = seq(o,[["C6",.05],["B5",.05],["A5",.05],["G5",.05],["F5",.05],["E5",.05],["D5",.05],["C5",.12]],{type:"square",v:.045,lp:3000,gap:.055});
               tone(o,{type:"sine",f:140,f2:70,nj:1,at:.55,dur:.25,v:.25}); noise(o,{ft:"lowpass",f:400,q:.7,nj:1,at:.55,dur:.1,v:.12}); return Math.max(e,o.t+.8); }},
    bootHum: {prio:4, fn:function(o){ tone(o,{type:"sine",f:52,f2:34,nj:1,dur:.45,v:.28}); noise(o,{ft:"lowpass",f:220,q:.7,nj:1,dur:.3,v:.14});
               tone(o,{type:"sine",f:120,nj:1,dur:1.0,v:.025,a:.1}); return tone(o,{type:"sine",f:7400,nj:1,dur:.6,v:.004,a:.1}); }},
    loadStart:{prio:2, fn:function(o){ return tone(o,{type:"square",f:N("A5"),nj:1,dur:.05,v:.03,lp:3000}); }},
    errBeep: {prio:4, fn:function(o){ tone(o,{type:"square",f:880,nj:1,dur:.12,v:.055,hold:.08,lp:3000}); return tone(o,{type:"square",f:880,nj:1,at:.18,dur:.12,v:.055,hold:.08,lp:3000}); }},
    chime:   {prio:4, fn:function(o){ tone(o,{type:"sine",f:N("F3"),nj:1,dur:1.8,v:.08,a:.02}); var n=["F4","A4","C5","E5","A5"], e=0;
               for(var i=0;i<n.length;i++){ tone(o,{type:"triangle",f:N(n[i]),nj:1,at:i*.07,dur:1.7-i*.1,v:.055,a:.01}); e = tone(o,{type:"sine",f:N(n[i])*2,nj:1,at:i*.07,dur:.6,v:.012}); }
               return o.t+1.8; }},
    poweroff:{prio:3, fn:function(o){ noise(o,{ft:"highpass",f:2500,q:.7,nj:1,dur:.03,v:.08}); return tone(o,{type:"sine",f:900,f2:60,nj:1,dur:.24,v:.07}); }}
  };
  // v1.15 mechanics: CRM Cleanup (paper shuffle + trash whoosh) and the caffeine flatline (monitor beeps, then one long tone)
  Object.assign(P,{
    crm:     {prio:3, fn:function(o){ var t=0;
               for(var i=0;i<4;i++){ noise(o,{ft:"bandpass",f:2400+fxRandom()*900,q:1.4,at:t,dur:.05,v:.1,a:.008}); t += .05+fxRandom()*.03; }
               noise(o,{ft:"bandpass",f:2600,f2:260,q:.9,at:t+.05,dur:.34,v:.17,a:.07});
               return tone(o,{type:"sine",f:150,f2:70,at:t+.36,dur:.12,v:.12}); }},
    flatline:{prio:5, fn:function(o){ var e=0;
               for(var i=0;i<2;i++) tone(o,{type:"sine",f:988,nj:1,at:i*.62,dur:.13,v:.08,hold:.09});
               tone(o,{type:"sine",f:988,nj:1,at:1.24,dur:3.0,v:.08,a:.01,hold:2.6});
               e = tone(o,{type:"sine",f:1976,nj:1,at:1.24,dur:3.0,v:.012,a:.01,hold:2.6}); return e; }}
  });

  /* ---------- context + voice management ---------- */
  function ensureCtx(){
    if(A.ctx) return A.ctx;
    var AC = root.AudioContext || root.webkitAudioContext; if(!AC) return null;
    try{ A.ctx = new AC(); }catch(e){ return null; }
    var comp = A.ctx.createDynamicsCompressor();
    try{ comp.threshold.value = -12; comp.knee.value = 10; comp.ratio.value = 5; comp.attack.value = .003; comp.release.value = .18; }catch(e){}
    A.master = A.ctx.createGain(); A.master.gain.value = A.settings.on ? gainFor(A.settings.vol) : 0;
    A.master.connect(comp); comp.connect(A.ctx.destination);
    return A.ctx;
  }
  function jitter(){ return Math.pow(2,(fxRandom()*2-1)*0.035); }
  function play(name,opts){
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
  function kill(v){ try{ var c = A.ctx; v.bus.gain.cancelScheduledValues(c.currentTime); v.bus.gain.setTargetAtTime(0,c.currentTime,0.015); }catch(e){} v.end = 0; }

  /* ---------- ambient loop (rain) ---------- */
  function ambient(name){
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
  function stopAmbient(){
    if(!A.amb) return;
    var a = A.amb; A.amb = null;
    try{ var c = A.ctx; a.g.gain.cancelScheduledValues(c.currentTime); a.g.gain.setTargetAtTime(0,c.currentTime,0.12); a.src.stop(c.currentTime+0.6); }catch(e){}
  }

  /* ---------- stress heartbeat ---------- */
  function setStress(s){
    var prev = A.stress; A.stress = s;
    if(s >= 80 && prev < 80 && prev > 0 && Date.now()-A.lastHydrate > 60000){ A.lastHydrate = Date.now(); say("hydrate"); }
    if(s >= 70){ if(!A.hbTimer) scheduleBeat(); }
    else if(A.hbTimer){ clearTimeout(A.hbTimer); A.hbTimer = 0; }
  }
  function scheduleBeat(){
    var s = A.stress, period = 1050 - (Math.min(100,s)-70)/30*500;
    A.hbTimer = setTimeout(function(){
      A.hbTimer = 0;
      if(A.stress < 70) return;
      if(!(HAS_DOM && document.hidden)) play("heartbeat",{gain:0.45+(Math.min(100,A.stress)-70)/30*0.35});
      scheduleBeat();
    }, period);
  }

  /* ---------- PA announcer (speechSynthesis) ---------- */
  // v1.18: terminations are read by HR, calmly, in a female voice
  var HR_LINES = ["As of today, you're no longer an employee of this organization.","Thanks for coming to this meeting. Today is your last day with Shitcorp.","We've reviewed your performance and decided to part ways."];
  var HR_KEYS = { fired:1, firedOrg:1, firedReview:1, clainkRevoked:1 }; // v1.20: HR offboards the agent, too
  var LINES = {
    boot:["Quota assigned. Good morning."],
    newrun:["New quarter. Same quota."],
    club:["President's Club. Grab your jacket."],
    fired:HR_LINES,
    firedOrg:HR_LINES,
    firedReview:HR_LINES,
    burnout:["Containment failed. Evacuate the pod."],
    missed:["Close. Not closed."],
    repo:["Jacket owner to Collections."],
    week5:["Mid-quarter reviews are in session."],
    week7:["Quarter half over. Coffee too."],
    week12:["One week left. Panic quietly."],
    week13:["Final week. Commit means commit."],
    filler:[
      "Pipeline is not revenue.",
      "Update opportunities before forecast call.",
      "Hydration is a KPI.",
      "Leaderboard updated. Do not look.",
      "Verbal commits are not commits.",
      "Lunch and learn. No lunch.",
      "The CRM is always right.",
      "Mandatory fun begins at four.",
      "Your calendar has been optimized.",
      "Fridge cleanout Friday. Pipeline too."
    ],
    hr:["HR has joined the meeting."],
    meetings:["All meetings are logged. For forecasting."],
    hygiene:["Pipeline hygiene is everyone's job."],
    whale:["Whale on the board."],
    bigClose:["Big deal closed. Ring something."],
    sqlStorm:["Leads delivered. Quality not guaranteed."],
    viral:["We are trending. Legal knows."],
    outage:["The cloud is experiencing weather."],
    freeze:["Budget freeze rumors. Remain calm."],
    rebalance:["Territories realigned. Not in your favor."],
    cash:["Finance would like a word."],
    phones:["Phones are for calling."],
    competitor:["Pricing alert. Competitor panicked."],
    incident:["Security incident. No comment."],
    hydrate:["Wellness reminder. Hydrate."]
  };
  Object.assign(LINES,{ closeOut:["Close that out."], burnoutCaffeine:["Rep has left the atmosphere."] });
  Object.assign(LINES,{ welcome:["Welcome to Shitcorp. Culture is glue."] }); // v1.16 onboarding memo
  // v1.20 clAInk. Six words or fewer, and never "AI" or "clAInk": speech engines spell them out.
  Object.assign(LINES,{ claink:["Agent outperforming staff. Please clap."], sev1:["Sev one. The agent did it."],
    strike:["Governance Council to room B.","Strike logged. The Council is watching."], clainkRevoked:["Your agent has been offboarded."],
    chatgdp:["Always on Chat GDP, huh?"], yoink:["Manager closing your deal. Take notes."], repoClaink:["Collections thanks the agent."] });
  // v1.17: the PA went silent on Windows Chromium/Edge. Three things in that engine bite a naive speak():
  //  - voice objects go stale when the browser reloads its list (voiceschanged fires more than once) and a stale
  //    voice speaks nothing, so the choice is kept by NAME and resolved against the live list at speak time;
  //  - speechSynthesis.speaking can stick at true after an utterance that never ends (Edge's online voices with
  //    no network, our silent primer), which made every non-forced line bail, so busy-ness is tracked here;
  //  - an utterance the page no longer references can be garbage-collected mid-queue, so the current one is held.
  // Edge lists its "Online (Natural)" voices first; they need the network, so a local voice of the same family wins.
  var SAY = { last:0, voiceName:{m:null,f:null}, timer:0, current:null, since:0, primer:null };
  var VOICE_PREFS = {
    m: ["Google UK English Male","Daniel","Microsoft Guy","Microsoft Ryan","Microsoft David","Microsoft Mark","Arthur","Aaron","Alex","Fred","Google US English"],
    f: ["Microsoft Aria","Microsoft Jenny","Microsoft Zira","Microsoft Sonia","Microsoft Michelle","Google UK English Female","Samantha","Karen","Moira","Tessa","Victoria","Fiona","Google US English"]
  };
  function voiceList(){ try{ return root.speechSynthesis.getVoices() || []; }catch(e){ return []; } }
  function pickVoice(kind){
    if(!("speechSynthesis" in root)) return null;
    var vs = voiceList(); if(!vs.length) return null;
    var prefs = VOICE_PREFS[kind || "m"];
    var best = null, bestRank = Infinity;
    for(var k=0;k<vs.length;k++){
      var v = vs[k], rank = Infinity, i;
      for(i=0;i<prefs.length;i++) if(v.name.indexOf(prefs[i]) === 0){ rank = i*2 + (v.localService === false ? 1 : 0); break; }
      if(rank === Infinity && /^en[-_]/i.test(v.lang || "")) rank = 1000 + (v.localService === false ? 1 : 0);
      if(rank < bestRank){ bestRank = rank; best = v; }
    }
    return best || vs[0];
  }
  function rememberVoice(kind){ kind = kind || "m"; var v = pickVoice(kind); SAY.voiceName[kind] = v ? v.name : null; return v; }
  function rememberVoices(){ rememberVoice("m"); rememberVoice("f"); }
  function voiceFor(kind){
    kind = kind || "m";
    var vs = voiceList(); if(!vs.length) return null;
    var name = SAY.voiceName[kind];
    if(name) for(var i=0;i<vs.length;i++) if(vs[i].name === name) return vs[i];
    return rememberVoice(kind);
  }
  if(HAS_DOM && "speechSynthesis" in root){ try{ root.speechSynthesis.onvoiceschanged = rememberVoices; }catch(e){} }
  // true while a line of ours is still going; a browser flag stuck on with nothing of ours in flight is cleared
  function speechBusy(){
    var ss = root.speechSynthesis;
    if(SAY.current && Date.now()-SAY.since < 15000) return true;
    SAY.current = null;
    if(SAY.primer) return false; // the unlock primer is still playing; a queued line simply follows it
    if(ss.speaking || ss.pending){ try{ ss.cancel(); }catch(e){} }
    return false;
  }
  function utter(text,key,voice,isRetry,kind){
    var ss = root.speechSynthesis, u = new root.SpeechSynthesisUtterance(text);
    if(voice){ u.voice = voice; u.lang = voice.lang; } else u.lang = "en-US";
    // HR is measured and level; the PA is a tired baritone
    u.rate = kind === "f" ? 0.95 : 0.97; u.pitch = kind === "f" ? 1.0 : 0.85;
    u.volume = Math.min(1,A.settings.vol*1.15);
    var done = function(){ if(SAY.current === u) SAY.current = null; };
    u.onend = done;
    u.onerror = function(ev){
      done();
      var err = (ev && ev.error) || "error";
      A.lastSpeechError = err;
      // the chosen voice failed (an online voice offline, a voice gone from the list): one retry on the browser default
      if(voice && !isRetry && err !== "interrupted" && err !== "canceled" && err !== "not-allowed"){
        SAY.voiceName[kind || "m"] = null;
        setTimeout(function(){ if(A.settings.on && A.settings.voice){ try{ utter(text,key,null,true,kind); }catch(e){} } },150);
      }
    };
    SAY.current = u; SAY.since = Date.now();
    if(ss.paused) ss.resume();
    ss.speak(u);
    if(A.onSay) A.onSay(text);
  }
  function say(key,opts){
    opts = opts || {};
    if(!A.settings.on || !A.settings.voice || !A.unlocked) return false;
    if(!("speechSynthesis" in root)) return false;
    if(key === "fired" && opts.meta){ if(opts.meta.cause === "org") key = "firedOrg"; else if(opts.meta.cause === "review") key = "firedReview"; }
    if(key === "burnout" && opts.meta && opts.meta.cause === "caffeine") key = "burnoutCaffeine";
    if(key === "repo" && opts.meta && opts.meta.cause === "claink") key = "repoClaink";
    var bank = LINES[key], text = bank ? bank[Math.floor(fxRandom()*bank.length)] : String(key);
    var ss = root.speechSynthesis, now = Date.now();
    if(!opts.force){
      if(now - SAY.last < (opts.cooldown || 12000)) return false;
      if(speechBusy()) return false;
    } else { try{ ss.cancel(); }catch(e){} SAY.current = null; SAY.primer = null; }
    SAY.last = now;
    play("pa");
    clearTimeout(SAY.timer);
    // the chime leads the voice by 720ms, which also keeps speak() clear of a cancel() (back to back they can drop the line)
    SAY.timer = setTimeout(function(){
      SAY.timer = 0;
      if(!A.settings.on || !A.settings.voice) return;
      var kind = HR_KEYS[key] ? "f" : "m";
      try{ utter(text,key,voiceFor(kind),false,kind); }catch(e){ A.lastSpeechError = String(e && e.message || e); }
    }, 720);
    return true;
  }
  // drop a line say() has queued but not spoken yet; unlike hush(), nothing already playing is touched
  function cancelSay(){ var queued = !!SAY.timer; clearTimeout(SAY.timer); SAY.timer = 0; return queued; }
  function hush(){ clearTimeout(SAY.timer); SAY.timer = 0; SAY.current = null; SAY.primer = null; try{ if("speechSynthesis" in root) root.speechSynthesis.cancel(); }catch(e){} stopAmbient(); }

  /* ---------- unlock on the first gesture ---------- */
  function unlock(){
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
  function setOn(on){
    A.settings.on = !!on; saveSettings();
    if(A.master && A.ctx){ var t = A.ctx.currentTime; A.master.gain.cancelScheduledValues(t); A.master.gain.setTargetAtTime(A.settings.on ? gainFor(A.settings.vol) : 0,t,0.03); }
    if(!A.settings.on) hush();
    if(A.onChange) A.onChange(A.settings);
  }
  function setVoice(on){ A.settings.voice = !!on; saveSettings(); if(!on){ clearTimeout(SAY.timer); try{ root.speechSynthesis.cancel(); }catch(e){} } if(A.onChange) A.onChange(A.settings); }
  function setVolume(v){
    A.settings.vol = Math.max(0,Math.min(1,v)); saveSettings();
    if(A.master && A.ctx && A.settings.on){ var t = A.ctx.currentTime; A.master.gain.cancelScheduledValues(t); A.master.gain.setTargetAtTime(gainFor(A.settings.vol),t,0.03); }
    if(A.onChange) A.onChange(A.settings);
  }

  /* ---------- director: turn new log lines into sound + PA lines ---------- */
  function norm(s){ return String(s||"").replace(/️/g,""); }
  var RULES = [
    // prefix (emoji stripped of variation selectors), sound, priority, optional PA line key
    ["📞","dial",3], ["✉","whoosh",3], ["🔎","typewriter",3], ["🖥","demo",3], ["📑","printer",3],
    ["🏟","airport",3], ["🧘","bowl",3], ["⏱","nope",3], ["☕","coffee",3], ["🏛","sneaky",3],
    ["🧪 No late-stage","nope",3], ["🧪","hailmary",3], ["🌪","fanfareS",3], ["🤕","bad",3], ["📛","bad",3], ["😬","warn",3],
    ["🏠","rent",2], ["💸 Salary","coin",1], ["💸 Matched","discount",2], ["🧱","thud",2],
    ["📣","leads",2,"sqlStorm"], ["🛠","fumble",2], ["🧙","magic",2], ["🔦","warn",2], ["🌀","warn",2],
    ["🌩","thunder",2,"outage"], ["🪜","rise",2], ["📘","ping",2], ["🐦","chirp",2,"viral"],
    ["🥶 Budget","ice",2,"freeze"], ["🍂","ice",2], ["🤒","sick",2], ["📉 Territory","bad",3,"rebalance"],
    ["🛡","shield",2], ["👻","ghost",2], ["🧩","puzzle",2], ["🪫","powerdown",2], ["🕑","ticktock",2],
    ["📵","busy",2,"phones"], ["👀","suspicion",3,"meetings"], ["📋","suspicion",3,"hygiene"], ["🧊","hr",4,"hr"],
    ["📆 Recurring","hrSoft",2], ["📆 Week ","week",1], ["📊","qbr",1],
    ["🏅","achievement",4,"whale"], ["💀","lost",4], ["⚠","alarm",4,"cash"]
  ];
  RULES.unshift(["🧹","crm",3,"hygiene"],["🗑","lost",4,"closeOut"],["🫀","heartbeat",2],["🚀","ignition",4],["☢","crack",4],["🏝","airport",3],["🥴","sick",2]);
  // v1.20 clAInk: specific prefixes first ("🤖 clAInk: N signed, $X" already plays cash through the close regex in ruleFor).
  // A strike is stamped; one with real damage glitches; strike 3 blue-screens and HR offboards the agent.
  RULES.unshift(["🤖 clAInk seat","chime",3],["🤖","beep",2],["✨","sparkle",4,"claink"],["⚖","stamp",3,"strike"],["💥","glitch",4,"sev1"],
    ["🧾","printer",2],["🔒","bsod",5,"clainkRevoked"],["💔","lost",4],["🔌","poweroff",3],["🙅","whoosh",2],["⏳","nope",2],
    ["👔 Boss took","lost",4],["👔","suspicion",3,"chatgdp"]);
  function ruleFor(msg){
    var m = norm(msg);
    if(/\d+ signed, \$/.test(m)) return {sfx:"cash", prio:4, close:true};
    if(/nobody signed/.test(m)) return {sfx:"thud", prio:3};
    if(/nothing to close|no late-stage deals/.test(m)) return {sfx:"nope", prio:3};
    if(m.indexOf("🧑") === 0 && /🐋/.test(m)) return {sfx:"sonar", prio:3};
    if(m.indexOf("🧑") === 0) return {sfx:"ping", prio:3};
    for(var i=0;i<RULES.length;i++){ var r = RULES[i]; if(m.indexOf(norm(r[0])) === 0) return {sfx:r[1], prio:r[2], say:r[3]}; }
    return null;
  }
  // v1.20: a clAInk run's report is voiced by the agent workspace as each beat lands (see ClainkConsole), so the director
  // leaves those lines alone; installs, invoices, cancels and the rest still sound here. ruleFor still maps them (tests).
  var CLAINK_RUN = ["🤖 clAInk run","🤖 clAInk:","✨","⚖","💥","🔒","💔","👔"];
  function isClainkRun(msg){ var m = norm(msg); for(var i=0;i<CLAINK_RUN.length;i++){ if(m.indexOf(norm(CLAINK_RUN[i])) === 0) return true; } return false; }
  function onLogs(entries,info){
    info = info || {};
    if(info.over || !entries || !entries.length) return;
    var picks = [], speech = null, runBatch = false;
    for(var k=0;k<entries.length;k++){ if(isClainkRun(entries[k].msg)){ runBatch = true; break; } }
    for(var i=0;i<entries.length;i++){
      // a run owns its whole batch: its "Cash under -$1,000" warning sounds when the strike card lands, and the PA line is the run's
      if(isClainkRun(entries[i].msg) || (runBatch && norm(entries[i].msg).indexOf("⚠") === 0)) continue;
      var e = entries[i], r = ruleFor(e.msg);
      if(r && r.close){ var mm = /signed, \$([\d,]+)/.exec(e.msg); var amt = mm ? parseInt(mm[1].replace(/,/g,""),10) : 0; if(amt >= 45000) r.say = "bigClose"; }
      if(r && r.sfx === "week"){ var wm = /📆 Week (\d+)/.exec(e.msg); if(wm){ var w = ((parseInt(wm[1],10)-1)%13)+1;
        r.say = w === 5 ? "week5" : w === 7 ? "week7" : w === 12 ? "week12" : w === 13 ? "week13" : (fxRandom() < .3 ? "filler" : null); } }
      if(r){ r.i = i; picks.push(r); if(r.say && (!speech || r.prio > speech.prio)) speech = r; }
    }
    // the week flip always plays (it is the End Week confirmation); the two most important others join it,
    // all in the order they happened
    var seen = {}, week = null;
    picks = picks.filter(function(p){ if(p.sfx === "week"){ week = p; return false; } return true; });
    picks = picks.sort(function(a,b){ return b.prio-a.prio || a.i-b.i; }).filter(function(p){ if(seen[p.sfx]) return false; seen[p.sfx] = 1; return true; }).slice(0,week ? 2 : 3);
    if(week) picks.push(week);
    picks.sort(function(a,b){ return a.i-b.i; });
    picks.forEach(function(p,k){ play(p.sfx,{delay:k*0.17,prio:p.sfx === "week" ? 3 : undefined}); });
    if(speech && !runBatch) say(speech.say,{cooldown: speech.sfx === "week" ? 9000 : 6000});
  }
  function onModal(title){
    play("modal");
    var t = norm(title);
    if(t.indexOf("🧨") === 0) say("competitor",{cooldown:4000});
    else if(t.indexOf("🔐") === 0) say("incident",{cooldown:4000});
    else if(t.indexOf("👔") === 0) say(/chatgdp/i.test(t) ? "chatgdp" : "yoink",{cooldown:4000}); // v1.21: the warning; v1.19: the Writing Lesson
  }

  // v1.15 scene cuts: whip pan, slash cut, impact frame
  Object.assign(P,{
    fwip:  {prio:3, free:true, fn:function(o){ noise(o,{ft:"bandpass",f:500,f2:4800,q:1.1,dur:.13,v:.5,a:.03}); return noise(o,{ft:"bandpass",f:4200,f2:900,q:1.3,at:.11,dur:.12,v:.3,a:.01}); }},
    shing: {prio:3, free:true, fn:function(o){ noise(o,{ft:"highpass",f:5200,q:.7,dur:.07,v:.12}); tone(o,{type:"sine",f:2960,f2:3320,dur:.42,v:.05,vib:[11,18]}); return tone(o,{type:"sine",f:4440,f2:4980,dur:.3,v:.025}); }},
    thwack:{prio:3, free:true, fn:function(o){ noise(o,{ft:"lowpass",f:900,q:.8,dur:.09,v:.22}); noise(o,{ft:"highpass",f:2600,q:.7,dur:.03,v:.1}); return tone(o,{type:"sine",f:130,f2:46,dur:.22,v:.34}); }}
  });
  // v1.18 endings: ASCENSION (rumble, ignition, liftoff roar, ceiling tiles, stinger) and MELTDOWN (geiger, glass
  // crack, slag hiss, stinger). No sirens anywhere: the dread is in the low end.
  Object.assign(P,{
    rumble:  {prio:3, fn:function(o){ tone(o,{type:"sawtooth",f:44,nj:1,dur:2.6,v:.14,a:.5,hold:1.4,lp:220,trem:[6,.5]}); tone(o,{type:"sawtooth",f:46.5,nj:1,dur:2.6,v:.1,a:.5,hold:1.4,lp:220});
               return noise(o,{ft:"lowpass",f:160,q:.7,nj:1,dur:2.6,v:.12,a:.6,hold:1.2}); }},
    ignition:{prio:4, fn:function(o){ noise(o,{ft:"lowpass",f:900,f2:120,q:.8,dur:.9,v:.4,a:.005}); tone(o,{type:"sine",f:90,f2:28,dur:.8,v:.4});
               for(var i=0;i<14;i++) noise(o,{ft:"highpass",f:2500,q:.7,at:.05+fxRandom()*.7,dur:.02,v:.12});
               return tone(o,{type:"sawtooth",f:60,f2:140,dur:.9,v:.06,lp:600,a:.2}); }},
    liftoff: {prio:4, fn:function(o){ noise(o,{ft:"bandpass",f:180,f2:2200,q:.8,dur:2.6,v:.34,a:.3,hold:1.6,slide:2.2}); tone(o,{type:"sawtooth",f:50,f2:130,dur:2.6,v:.07,a:.3,hold:1.6,lp:500,slide:2.2});
               return tone(o,{type:"sine",f:38,f2:70,dur:2.6,v:.2,a:.2,hold:1.6,slide:2.2}); }},
    ceiling: {prio:3, fn:function(o){ var e=0; for(var i=0;i<3;i++){ noise(o,{ft:"lowpass",f:700,q:.8,at:i*.09,dur:.12,v:.26}); e = tone(o,{type:"sine",f:130,f2:55,at:i*.09,dur:.2,v:.28}); }
               for(var k=0;k<8;k++) noise(o,{ft:"bandpass",f:1400+fxRandom()*2200,q:3,at:.05+fxRandom()*.4,dur:.03,v:.1}); return e; }},
    geiger:  {prio:2, free:true, fn:function(o){ var e=0,t=0,n=0; while(t<2.2 && n<60){ e = noise(o,{ft:"bandpass",f:3200,q:6,at:t,dur:.012,v:.16}); t += .03+fxRandom()*(.3-.12*t/2.2); n++; } return e; }},
    crack:   {prio:4, fn:function(o){ noise(o,{ft:"highpass",f:4500,q:.7,dur:.05,v:.22}); tone(o,{type:"square",f:3400,f2:700,dur:.12,v:.06,lp:6000});
               for(var i=0;i<6;i++) noise(o,{ft:"bandpass",f:2000+fxRandom()*4000,q:4,at:.06+fxRandom()*.3,dur:.025,v:.1}); return tone(o,{type:"sine",f:110,f2:48,at:.02,dur:.3,v:.3}); }},
    slag:    {prio:3, fn:function(o){ noise(o,{ft:"lowpass",f:900,f2:220,q:.6,dur:2.4,v:.14,a:.4,hold:1.2}); for(var i=0;i<10;i++) noise(o,{ft:"bandpass",f:600+fxRandom()*900,q:2,at:fxRandom()*2,dur:.08,v:.06});
               return tone(o,{type:"sawtooth",f:95,f2:58,dur:2.2,v:.05,lp:400,a:.3,vib:[4,6]}); }},
    stingerAscend:{prio:5, fn:function(o){ seq(o,[["E3",.14],["G3",.14],["B3",.14],["E4",.9]],{type:"square",v:.05,lp:2400,gap:.15}); tone(o,{type:"sawtooth",f:N("E2"),nj:1,dur:1.6,v:.07,lp:500,a:.1});
               noise(o,{ft:"bandpass",f:300,f2:5000,q:.8,dur:1.2,v:.12,a:.5}); return tone(o,{type:"triangle",f:N("B4"),nj:1,at:.45,dur:1.2,v:.06,vib:[5.5,4]}); }},
    stingerMelt:{prio:5, fn:function(o){ var e = seq(o,[["C4",.16],["Ab3",.16],["F3",.16],["C3",1.0]],{type:"sawtooth",v:.06,lp:1400,gap:.17}); tone(o,{type:"sine",f:N("C2"),nj:1,at:.5,dur:1.4,v:.2});
               noise(o,{ft:"lowpass",f:300,q:.7,at:.5,dur:.3,v:.2}); return e; }}
  });
  // v1.16 onboarding memo (Rules): a party horn that deflates, and HR's rubber stamp
  Object.assign(P,{
    sadHorn:{prio:3, fn:function(o){ noise(o,{ft:"bandpass",f:1800,q:.9,dur:.07,v:.1});
               tone(o,{type:"sawtooth",f:N("A4"),f2:N("D4"),at:.05,dur:.6,v:.1,a:.03,lp:1800,vib:[7,12]});
               return tone(o,{type:"square",f:N("A3"),f2:N("D3"),at:.05,dur:.6,v:.04,a:.03,lp:1100}); }},
    stamp:  {prio:3, fn:function(o){ noise(o,{ft:"highpass",f:2400,q:.7,dur:.03,v:.12}); noise(o,{ft:"lowpass",f:700,q:.8,dur:.09,v:.24});
               return tone(o,{type:"sine",f:115,f2:52,dur:.2,v:.3}); }}
  });
  root.TST_AUDIO = {
    play:play, say:say, cancelSay:cancelSay, hush:hush, ambient:ambient, stopAmbient:stopAmbient, setStress:setStress,
    onLogs:onLogs, onModal:onModal, ruleFor:ruleFor, setOn:setOn, setVoice:setVoice, setVolume:setVolume, unlock:unlock,
    get settings(){ return A.settings; }, get unlocked(){ return A.unlocked; },
    get lastSpeechError(){ return A.lastSpeechError || null; }, get voiceName(){ return SAY.voiceName.m; }, get voiceNames(){ return SAY.voiceName; },
    set onChange(fn){ A.onChange = fn; },
    presets:P, _A:A, LINES:LINES,
    // render a preset into an offline context (tests)
    renderInto:function(c,name){ var p = P[name]; return p.fn({c:c,d:c.destination,t:0.01,j:1}); }
  };
})(typeof window !== "undefined" ? window : globalThis);
