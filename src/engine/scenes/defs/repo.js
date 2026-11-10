import { COLS, blink, easeInOut, easeOut, lerp, pick, prog, rep, rnd, stepParts } from "../core.js";
import { SCENES } from "../registry.js";
import { SPR } from "../sprites.js";
import { fxRandom } from "../../../fxrng.js";

/* ---------------- REPO: the tow truck takes the jacket ---------------- */
SCENES.repo = {
  dur: 7400,
  cap: { title:"REPOSSESSED", a:["Financed the drip.","Not the payments."], b:["Collections took the flex.","HR keeps the photo."], tTitle:200, tA:1300, tB:5600, k:"k-y", rule:"k-y-d" },
  cues: [
    {t:600, sfx:"beeper"},
    {t:860, whip:"l", ms:340}, {t:860, sfx:"fwip"}, {t:900, lines:"h", ms:750, dir:1, n:11},
    {t:1450, sfx:"screech"}, {t:1500, pulse:.06, ms:300}, {t:1500, shake:180},
    {t:1700, sfx:"beeper"},
    {t:2400, sfx:"clank"}, {t:2400, impact:100}, {t:2400, shake:260}, {t:2400, lines:"radial", ms:650, fx:34, fy:7}, {t:2400, zoom:1.15, ms:600, fx:34, fy:7},
    {t:3000, sfx:"engine"}, {t:3300, sfx:"honk"},
    {t:4700, sfx:"stingerRepo", key:true}, {t:4700, card:"REPO", ms:1400},
    {t:4850, say:"repo", key:true}
  ],
  cam: [
    {t:0,    x:6,  y:0,   z:1.18, r:0},
    {t:850,  x:4,  y:0,   z:1.24, r:0, e:"l"},
    {t:1500, x:0,  y:0.5, z:1.14, r:0},
    {t:2350, x:2,  y:0.5, z:1.42, r:-2},
    {t:2900, x:0,  y:0.2, z:1.08, r:0},  // the pan stays wide enough for the billboard's text rows
    {t:4700, x:-3, y:0.2, z:1.1,  r:0},
    {t:5200, x:6,  y:0,   z:1.12, r:0, e:"cut"},
    {t:7200, x:6,  y:0,   z:1.16, r:0, e:"l"}
  ],
  drift: {x:1, z:.015, p:8000},
  summary: "A tow truck hauls off the President's Club jacket.",
  summaryBy: { claink: "A tow truck hauls off the jacket. clAInk billed it as an outcome." },
  draw: function(g,c){
    var t = c.t, st = c.st;
    var hookX = 34, TIP = 26, ty = 3; // boom tip column inside the truck sprite; truck top row
    // the camera pans off with the truck, then (behind the title card) cuts back to the empty rack
    var ox = t < 5200 ? -46*easeInOut(prog(t,3100,4700)) : 0, O = Math.round(ox);
    // truck path (world): whips in reversing, waits, drives off accelerating
    var tw;
    if(t < 900) tw = -44;
    else if(t < 1500) tw = lerp(-44,hookX-TIP,easeOut(prog(t,900,1500)));
    else if(t < 3100) tw = hookX-TIP;
    else tw = hookX-TIP - 16*Math.pow((t-3100)/1000,2);
    // exhaust from the stack (world space), drawn first so the sign and the truck sit in front of it
    st.puffs = st.puffs || [];
    var moving = (t > 900 && t < 1500) || (t > 3100 && t < 5200);
    if(moving && fxRandom() < .55) st.puffs.push({x:tw+12,y:ty,vx:rnd(1,4),vy:rnd(-3,-1.2),life:rnd(600,1000),ch:pick(["o","O","."]),k:"k-d",fade:320,ch2:"o"});
    stepParts(st.puffs,c.dt,g,undefined,ox);
    // left of the building: a lamp post and a billboard (solid, so the exhaust passes behind its text)
    g.sprO(-36-O,0,SPR.billboard,"k-d"); g.text(-34-O,1,"PRESIDENT'S CLUB","k-au");
    var lx = -8-O;
    g.text(lx-1,4,"(_)","k-y"); for(var ly=5;ly<=9;ly++) g.set(lx,ly,"|","k-d"); g.text(lx-1,10,"_|_","k-d");
    // building + street
    g.spr(39-O,3,SPR.building,"k-d");
    g.text(42-O,4,"COLLECTIONS  DEPT.","k-y");
    if(t > c.dur){ g.text(42,8,"[:)]",blink(t,700) ? "k-au" : "k-au-d"); if(blink(t,350)) g.set(46,7,"*","k-y"); }
    g.text(0,11,rep("_",COLS),"k-d");
    g.tile(12,"  == ",ox,"k-d");
    // coat rack (stays behind after the tow)
    var rk = hookX-O;
    g.set(rk,6,"?","k-br");
    for(var py=7;py<=10;py++) g.set(rk,py,"|","k-br");
    g.text(rk-1,11,"_|_","k-br");
    var tx = Math.round(tw-ox), tipX = tx+TIP;
    // cable lowers to the hanger, clanks, lifts
    var attached = t >= 2400, cableLen = 0;
    if(t >= 1800 && t < 2400) cableLen = Math.round(lerp(0,2,prog(t,1800,2300)));
    else if(t >= 2400 && t < 2550) cableLen = 2;
    else if(t >= 2550) cableLen = Math.round(lerp(2,1,prog(t,2550,2950)));
    var swing = t > 3100 ? (blink(t,260) ? 1 : 0) : 0;
    if(!attached) g.spr(rk-3,7,SPR.jacketS,"k-au");
    g.sprO(tx,ty,SPR.truck,"k-w");
    g.text(tx+9,ty+5,"REPO","k-r k-bold");
    if(t >= 1800){
      for(var r=0;r<cableLen;r++) g.set(tipX+(r === cableLen-1 ? swing : 0),ty+1+r,"|","k-d");
      g.set(tipX+swing,ty+1+cableLen,"J","k-w");
      if(attached) g.spr(tipX-3+swing,ty+2+cableLen,SPR.jacketS,"k-au");
    }
    // dust from the tires
    if(t > 3100 && t < 5200) g.text(tx+19,ty+7,blink(t,120) ? ". '" : "' .","k-s");
    if(t > 900 && t < 1500) g.text(tx-3,ty+7,blink(t,120) ? ". '" : "' .","k-s");
    // idle: tumbleweed
    if(t > c.dur){
      var cyc = (t-c.dur) % 7000, wx = 66 - cyc/90;
      if(wx > -2) g.set(wx,10 - (Math.floor(cyc/180)%2),"@","k-br");
    }
  }
};
