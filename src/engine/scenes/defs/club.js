import { COLS, blink, easeInOut, easeOut, lerp, mod, pick, prog, rnd, stepParts } from "../core.js";
import { SCENE_COPY } from "../../../copy/scenes.js";
import { SCENES } from "../registry.js";
import { SPR } from "../sprites.js";
import { fxRandom } from "../../../fxrng.js";

/* ---------------- PRESIDENT'S CLUB: jet lands on the beach, jacket descends, fireworks ---------------- */
var WORDS = SCENE_COPY.club; // the words: captions, title card, summary
SCENES.club = {
  dur: 8400,
  cap: { title:WORDS.title, a:WORDS.a, b:WORDS.b, tTitle:300, tA:3400, tB:5900, k:"k-au", rule:"k-au-d" },
  cues: [
    {t:0, sfx:"plane"}, {t:200, lines:"h", ms:1700, dir:-1, n:10},
    {t:2000, sfx:"screech"}, {t:2000, shake:200}, {t:2000, pulse:.05, ms:320},
    {t:2900, sfx:"seatbelt"}, {t:3400, sfx:"sparkle"},
    {t:4900, sfx:"thwack"}, {t:4900, impact:110}, {t:4900, lines:"radial", ms:800, fx:31, fy:3}, {t:4900, zoom:1.14, ms:650, fx:31, fy:3},
    {t:5300, sfx:"stingerClub", key:true}, {t:5300, card:WORDS.card, ms:1400}, {t:5300, shake:260},
    {t:5500, say:"club", key:true}
  ],
  cam: [
    {t:0,    x:-8, y:-2.5, z:1.3,  r:2.5},
    {t:1000, x:-4, y:-1.2, z:1.22, r:1.5, e:"l"},
    {t:2000, x:0,  y:0.6,  z:1.16, r:0},
    {t:3000, x:0,  y:0,    z:1.06, r:0},
    {t:3400, x:0,  y:0,    z:1.06, r:0},
    {t:4850, x:-1, y:-3,   z:1.34, r:0},
    {t:5700, x:-1, y:-3,   z:1.34, r:0},
    {t:6700, x:0,  y:-0.4, z:1.08, r:0}
  ],
  drift: {x:1.5, y:.3, z:.02, p:9000},
  summary: WORDS.summary,
  draw: function(g,c){
    var t = c.t, st = c.st;
    // tracking shot: the camera rides with the jet, the beach scrolls past, then it all settles
    var ox = -64*Math.pow(1-prog(t,0,2900),2);
    // sky: the sun is too far away to move; clouds drift at a quarter of the speed
    g.spr(56,0, blink(t,420) ? SPR.sun : SPR.sun2, "k-y");
    var c1 = mod(t/240 + 10 - ox*.25,84) - 12, c2 = mod(t/360 + 46 - ox*.25,84) - 12;
    g.sprO(c1,0,SPR.cloud,"k-d"); g.sprO(c2,1,SPR.cloud,"k-d");
    // fireworks behind the palms
    if(t > 5300){
      st.fw = st.fw || []; if(!st.nextFw) st.nextFw = 5300;
      if(t >= st.nextFw){
        st.nextFw = t + (c.idle ? 1150 : 430)*rnd(.7,1.3);
        var bx = rnd(4,60), by = rnd(1,4.5), col = pick(["k-au","k-m","k-c","k-g","k-p"]);
        var n = 12 + Math.floor(fxRandom()*6);
        for(var i=0;i<n;i++){
          var ang = (i/n)*Math.PI*2, sp = rnd(4.5,8.5);
          st.fw.push({x:bx,y:by,vx:Math.cos(ang)*sp*2.1,vy:Math.sin(ang)*sp,g:5,life:rnd(650,1050),fade:360,ch:pick(["*","$","*","+"]),k:col});
        }
        if(!c.idle) c.sfx("pop");
      }
      if(fxRandom() < (c.idle ? .22 : .65)) st.fw.push({x:rnd(0,63),y:-0.4,vx:0,vy:rnd(5,8),life:3000,ch:"$",k:pick(["k-g","k-au"])});
      stepParts(st.fw,c.dt,g,10);
    }
    // palms (the last two are the final composition)
    var sway = blink(t,640), palms = [-60,-27,0,50];
    for(var pi=0;pi<palms.length;pi++){
      var px0 = Math.round(palms[pi]-ox); if(px0 < -15 || px0 >= COLS) continue;
      g.spr(px0,4,(pi%2 ? !sway : sway) ? SPR.palmA : SPR.palmB,"k-g");
      for(var y=7;y<=9;y++) g.set(px0+7,y,"|","k-br");
      g.text(px0+6,9,"_|_","k-br");
    }
    // runway, sand and sea
    var sand = ".:'.:.'::.'.:.:'.:.::'.:.'.:'::.:'.:..:'.:.:'.::.'.:.'.:.:'::.'.";
    g.tile(10,sand,ox,"k-s");
    for(var x=0;x<COLS;x++){ var wx = x+Math.round(ox); if(wx >= 12 && wx < 52) g.set(x,10,(mod(wx,4) < 2) ? "=" : " ","k-d"); }
    var wave = "~~~  ~~ ~~~~   ~~   ~~~ ~~  ~~~~ ~ ~~~   ~~ ~~~~  ~~   ~~~ ~ ~~  ";
    g.tile(11,wave,Math.floor(t/320)+ox,"k-c");
    g.tile(12,wave,ox-Math.floor(t/450),"k-b");
    // jet: in over the palms, flare, touchdown, roll-out (screen position; the world moves under it)
    var sx, py, gearDown = t > 1100;
    if(t < 700) sx = lerp(-18,12,easeOut(t/700));
    else if(t < 2000) sx = lerp(12,22,(t-700)/1300);
    else sx = lerp(22,34,easeOut(prog(t,2000,3000)));
    py = t < 2000 ? Math.round(6*Math.pow(prog(t,150,2000),1.6)) : 6;
    sx = Math.round(sx);
    if(t < 2000) g.text(sx-4,py+2,blink(t,120) ? "= -" : "- =","k-d");
    g.sprO(sx,py,SPR.plane,"k-w");
    if(gearDown) { g.set(sx+5,py+4,"o","k-d"); g.set(sx+14,py+4,"o","k-d"); }
    if(t > 2000 && t < 2800) g.text(sx-2,py+4,blink(t,90) ? "~ ." : ". ~","k-d");
    // jacket floats down in a ring of sparkles and lands on the beat
    if(t > 3300){
      var jy = Math.round(lerp(-7,0,easeInOut(prog(t,3300,4900)))), jx = 24;
      for(var s=0;s<8;s++){
        var a = t/300 + s*0.8, rr = 9 + Math.sin(t/400+s)*1.5;
        g.set(jx+7+Math.cos(a)*rr, jy+2.5+Math.sin(a)*rr*0.42, pick(["*","+","'","."]), s%2 ? "k-y" : "k-w");
      }
      g.sprO(jx,jy,SPR.jacket,"k-au k-glow");
    }
  }
};
