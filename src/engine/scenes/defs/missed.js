import { ART, COLS, blink, clamp, easeOut, pick, prog, rep, rnd, stepParts } from "../core.js";
import { SCENES } from "../registry.js";
import { SPR } from "../sprites.js";
import { fxRandom } from "../../../fxrng.js";

/* ---------------- BARELY MISSED: the bar stalls, then a long walk under a personal rain cloud ---------------- */
SCENES.missed = {
  dur: 7400,
  cap: { title:"BARELY MISSED", a:["70\u201399% to quota.","Badge kept. Ego not."], b:["Manager shrugs.","HR forgets your name."], tTitle:200, tA:900, tB:4800, k:"k-c", rule:"k-c-d" },
  cues: [
    {t:0, amb:"rain"},
    {t:2100, zoom:1.12, ms:520},
    {t:2150, sfx:"stingerMissed", key:true}, {t:2150, card:"MISSED", ms:1300},
    {t:2300, say:"missed", key:true},
    {t:3260, whip:"r", ms:380}, {t:3260, sfx:"fwip"},
    {t:6000, sfx:"umbrella"}, {t:6000, zoom:1.1, ms:650, fx:25, fy:6}
  ],
  cam: [
    {t:0,    x:-0.5, y:-1, z:1.06, r:0},       // cols 7-55 (QUOTA to the 100% goal) survive the 2100 punch-in
    {t:2100, x:-0.5, y:-1, z:1.1,  r:0, e:"l"},
    {t:3450, x:0,  y:0.5, z:1.1,  r:0, e:"cut"},
    {t:5900, x:1,  y:0.5, z:1.14, r:0, e:"l"},
    {t:6900, x:-1, y:0,   z:1.16, r:0}
  ],
  drift: {x:1, z:.015, p:8000},
  summary: "The quota bar stalls short, then a rain cloud follows you home.",
  draw: function(g,c){
    var t = c.t, st = c.st, pct = clamp(c.meta.pct || 0.85,0,1);
    if(t < 3450){
      // shot 1: the quota bar, close up, in a drizzle
      var w = 40, shown = pct*prog(t,300,2100), f = Math.floor(w*shown);
      if(t > 300 && t < 2100){ var tk = Math.floor((t-300)/120); if(tk !== st.tk){ st.tk = tk; if(!c.idle) c.sfx("tick"); } }
      st.dz = st.dz || [];
      if(fxRandom() < .9) st.dz.push({x:rnd(0,COLS+6),y:-0.5,vx:-3,vy:rnd(10,13),life:2500,ch:pick(["'","'",","]),k:"k-b-d"});
      stepParts(st.dz,c.dt,g,ART);
      var stalled = t > 2100;
      g.text(7,3,"QUOTA","k-d");
      g.text(13,3,Math.round(shown*100)+"%",stalled ? "k-c k-bold" : "k-w");
      g.text(7,5,"["+rep("\u2588",f)+rep("\u2591",w-f)+"]",stalled ? "k-c" : "k-b");
      g.text(50,3,"|>","k-g"); g.set(50,4,"|","k-d"); g.set(50,5,"|","k-d"); g.text(50,6,"| 100%","k-d");
      if(stalled && blink(t,260)) g.text(7,7,"STALLED","k-c-d");
      return;
    }
    // shot 2: tracking shot down the street; rep and cloud stay framed, the street slides by
    var tau = (t-3450)/1000, v = 14, T = 2.45, q = clamp((tau-T)/.6,0,1);
    var ox = tau < T ? v*tau : v*T + v*.6*(q - q*q/2), O = Math.round(ox);
    // shop signs on the far side of the street (slower layer)
    var so = ox*.6, signs = [[2,"CLOSED"],[27,Math.round(pct*100)+"% OFF"],[52,"LOANS"],[76,"CLOSED"]];
    for(var s2=0;s2<signs.length;s2++){
      var gx = Math.round(signs[s2][0]-so), lab = signs[s2][1], bw = lab.length+4;
      if(gx >= COLS || gx+bw < 0) continue;
      g.text(gx,1,"."+rep("-",bw-2)+".","k-d"); g.text(gx,2,"| "+lab+" |",s2 === 1 ? "k-p" : "k-d"); g.text(gx,3,"'"+rep("-",bw-2)+"'","k-d");
    }
    // lamp posts on the near curb
    var lamps = [12,44,76];
    for(var li=0;li<lamps.length;li++){
      var lx = lamps[li]-O; if(lx < -2 || lx > COLS+1) continue;
      g.text(lx-1,4,"(_)","k-y");
      for(var ly=5;ly<=9;ly++) g.set(lx,ly,"|","k-d");
      g.text(lx-1,10,"_|_","k-d");
    }
    // street + puddles
    g.text(0,11,rep("_",COLS),"k-d");
    g.tile(12,"     ~~        ~~~      ~~           ~~~~       ~~         ~~~   ",ox,"k-b-d");
    // the rep (catching up to the camera at first), the cloud tails him
    var rx = Math.round(18 + 6*easeOut(prog(tau,0,1.2)));
    var walking = tau < T+.45;
    var legA = walking ? Math.floor(t/260)%2 === 0 : true;
    var umbrella = t >= 6000;
    st.cx = st.cx === undefined ? rx-6 : st.cx + ((rx-3) - st.cx)*Math.min(1,c.dt/420);
    var cx = st.cx, cy = umbrella ? 3 : 4;
    // rain falls in world space, so it trails behind the moving cloud
    st.drops = st.drops || [];
    for(var k=0;k<3;k++) if(fxRandom() < .85) st.drops.push({x:cx+rnd(1,10)+ox,y:cy+3,vy:rnd(9,13),ch:pick(["'","|","'",","]),k:"k-c"});
    var stopY = 10.6;
    for(var i=st.drops.length-1;i>=0;i--){
      var d = st.drops[i], dx = d.x-ox;
      d.y += d.vy*c.dt/1000;
      if(dx < -2){ st.drops.splice(i,1); continue; }
      var hitUmb = umbrella && d.y >= 6 && dx >= rx-2 && dx <= rx+4.5;
      if(hitUmb){ st.drops.splice(i,1); if(fxRandom() < .5) g.set(dx,5,pick([".","'","`"]),"k-w"); continue; }
      if(d.y >= stopY){ st.drops.splice(i,1); g.set(dx,10,pick([".",","]),"k-b"); continue; }
      g.set(dx,d.y,d.ch,d.k);
    }
    g.sprO(cx,cy,SPR.rainCloud,"k-d");
    if(umbrella){
      var pop = prog(t,6000,6160);
      g.spr(rx-2,6, pop < 1 ? [" .^. ","/_|_\\","  |"] : SPR.umbrella, "k-m");
      g.sprO(rx,8,[" o","/|\\","/ \\"],"k-w");
    } else {
      g.sprO(rx,8,legA ? SPR.repA : SPR.repB,"k-w");
    }
    g.text(rx-1,11,"___","k-d");
    if(t > c.dur){ // the sun peeks out for next quarter
      g.spr(45,4,[" \\ | /","-- O","  /"],"k-y");
    }
  }
};
