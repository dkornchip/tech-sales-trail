import { N } from "./core.js";
import { heart, noise, seq, tone } from "./synth.js";
import { fxRandom } from "../../fxrng.js";

/* ---------- presets (prio: 0 ui, 1 ambient info, 2 event, 3 your action, 4 key moment, 5 ending stinger) ---------- */
export var P = {
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
