import { COLS, blink, easeOut, lerp, prog, rep } from "../core.js";
import { SCENES } from "../registry.js";
import { SPR } from "../sprites.js";

/* ---------------- FIRED: access denied, walk of shame, elevator goes down ---------------- */
export var FACES = ["(-_-)","(o_o)","(-_-)","(o.o)","(-_-)"], FACES_AFTER = ["(-_-)","(._.)","(;_;)","(-_-)","(._.)"];
SCENES.fired = {
  dur: 8800,
  cap: { title:"YOU'RE DONE", a:["Badge: deactivated.","HR took the dongles."], b:["\u201cDifferent direction.\u201d","(Not you.)"], tTitle:200, tA:1100, tB:6300, k:"k-r", rule:"k-r-d" },
  cues: [
    {t:960, sfx:"thud"}, {t:960, impact:110}, {t:960, lines:"radial", ms:720, fx:24, fy:5}, {t:960, zoom:1.15, ms:620, fx:24, fy:5},
    {t:960, glitch:320}, {t:960, shake:220},
    {t:2050, sfx:"drop"},
    {t:2410, whip:"r", ms:380}, {t:2410, sfx:"fwip"},
    {t:5500, slash:340}, {t:5500, sfx:"shing"}, {t:5500, letterbox:true},
    {t:6050, sfx:"doors"}, {t:6600, sfx:"elevator"},
    {t:7300, sfx:"stingerFired", key:true}, {t:7300, card:"FIRED", ms:1400}, {t:7300, impact:100}, {t:7300, lines:"radial", ms:900},
    {t:7450, say:"fired", key:true}, {t:8500, letterbox:false}
  ],
  cam: [
    {t:0,    x:-3, y:-0.5, z:1.24, r:-3},
    {t:900,  x:-7, y:-1,   z:1.42, r:-4.5},
    {t:1800, x:3,  y:-0.5, z:1.36, r:-2.5},
    {t:2380, x:5,  y:2,    z:1.3,  r:0},
    {t:2600, x:0,  y:0.25, z:1.08, r:0, e:"cut"},
    {t:5450, x:2,  y:0.25, z:1.12, r:0.4, e:"l"},
    {t:5500, x:0,  y:0,    z:1.14, r:0, e:"cut"},
    {t:6600, x:0,  y:-0.5, z:1.3,  r:0},
    {t:7250, x:0,  y:-4.5, z:1.85, r:-2, e:"o"},
    {t:7700, x:0,  y:-4.5, z:1.85, r:-2},
    {t:8600, x:0,  y:-1.5, z:1.3,  r:0}
  ],
  drift: {x:.8, z:.02, p:7000},
  idleGlitch: 4600,
  summary: "Badge denied, box carried past staring coworkers, elevator down.",
  draw: function(g,c){
    var t = c.t, st = c.st;
    if(t < 2600){
      // beat 1: badge reader (Dutch-tilt push-in)
      var RX = 14;
      g.spr(RX,2,SPR.reader,"k-d");
      var state = t < 800 ? "ready" : t < 960 ? "check" : "denied";
      var scr = state === "ready" ? "    READY    " : state === "check" ? "   . . .     " : "ACCESS DENIED";
      var sk = state === "ready" ? "k-g" : state === "check" ? "k-y" : "k-r k-bold";
      if(state !== "denied" || t > 2000 || blink(t,150)) g.text(RX+4,5,scr,sk);
      g.text(RX+3,3,"SHITCORP SECURE","k-w");
      var led = state === "ready" ? "k-g" : state === "check" ? "k-y" : (blink(t,200) ? "k-r" : "k-d");
      g.text(RX+4,7,"(o)",led);
      // badge slides in, taps, dies, drops
      var bx = t < 700 ? lerp(66,RX+25,easeOut(t/700)) : (t < 820 ? RX+23 : RX+25);
      var by = 3 + (t > 2000 ? Math.pow((t-2000)/1000,2)*24 : 0);
      g.sprO(bx,by,SPR.badge,"k-w");
      g.text(bx+2,by+1,"SHITCORP","k-b");
      if(t > 1300){ g.text(bx+3,by+2,"(x_x)","k-r"); }
      if(t > 1500){ g.text(bx+3,by+3,blink(t,180) ? "VOID" : "    ","k-r k-bold"); }
      if(state === "denied" && t < 1900){
        for(var i=0;i<3;i++) g.set(RX+22, 3+i*2, blink(t,100) ? "!" : " ", "k-r");
      }
      // wall + floor
      g.text(0,11,rep("_",COLS),"k-d");
      return;
    }
    if(t < 5500){
      // beat 2: walk of shame. The camera tracks Matt; the back wall slides slower than the cubicles
      var tau = (t-2600)/1000, ox = tau < .5 ? 17*tau*tau : 17*(tau-.25);
      var sx = lerp(-9,25,easeOut(prog(t,2600,3300))) + 3*prog(t,3300,5500);
      var mx = ox + sx, wo = ox*.55;
      g.spr(Math.round(3-wo),0,SPR.poster,"k-m");
      g.text(Math.round(39-wo),1,"[ 4:59 PM FRI ]",blink(t,500) ? "k-r" : "k-r-d");
      g.spr(Math.round(64-wo),0,SPR.poster2,"k-m");
      for(var h=0;h<5;h++){
        var hw = 8 + h*21, hx = Math.round(hw-ox);
        if(hx < -13 || hx >= COLS+2) continue;
        var dx = (mx+2) - (hw+2), face = FACES[h];
        if(dx > -12 && dx <= 5) face = "(O_O)"; else if(dx > 5) face = FACES_AFTER[h];
        g.text(hx,5,face,"k-w");
        g.text(hx-2,6,"|=========|","k-b");
        if(h%2 === 0) g.text(hx+9,5,"[_]","k-d");
        if(h === 2 && dx > 3 && dx < 18) g.text(hx+1,4,"rip","k-d");
      }
      var legA = Math.floor((t-2600)/230)%2 === 0;
      if(legA !== st.lastLeg){ st.lastLeg = legA; if(!c.idle) c.sfx("step"); }
      var wx = Math.round(sx);
      g.spr(wx,8,legA ? SPR.walkA : SPR.walkB,"k-w");
      g.text(wx+6,8,"\\|/","k-g");
      g.text(wx+5,9,"[BOX]","k-y");
      g.text(0,11,rep("_",COLS),"k-d");
      g.tile(12,". ' . , ",ox,"k-d");
      return;
    }
    // beat 3: elevator
    var ex = 19;
    g.spr(ex,1,SPR.elevator,"k-d");
    var closing = prog(t,6100,6600), doorW = Math.round(11*closing);
    var floor = 13;
    if(t > 6700) floor = Math.max(0,13 - Math.floor((t-6700)/260));
    var arrow = t < 6600 ? "^" : "v";
    var ind = "[ "+arrow+"  "+(floor > 0 ? (floor < 10 ? " "+floor : ""+floor) : " L")+" ]";
    g.text(ex+8,2,ind, (t > 6600 && !blink(t,300)) ? "k-r-d" : "k-r k-bold");
    // interior: mirror glint
    g.text(ex+19,4,"/","k-d"); g.text(ex+18,5,"/","k-d");
    // passenger
    if(t < 6050){
      var wx2 = lerp(4,ex+9,easeOut(prog(t,5500,6050)));
      var legA2 = Math.floor((t-5500)/180)%2 === 0;
      if(legA2 !== st.lastLeg){ st.lastLeg = legA2; if(!c.idle) c.sfx("step"); }
      g.spr(wx2,6,legA2 ? SPR.walkA : SPR.walkB,"k-w");
      g.text(wx2+6,6,"\\|/","k-g"); g.text(wx2+5,7,"[BOX]","k-y");
    } else {
      g.spr(ex+10,6,SPR.front,"k-w");
      g.text(ex+10,7,"[BOX]","k-y");
      g.text(ex+14,6,"\\|/","k-g");
    }
    // doors slide shut from both sides
    if(doorW > 0){
      for(var r=3;r<=8;r++){
        for(var dx2=0;dx2<doorW;dx2++){
          g.set(ex+2+dx2,1+r,dx2 === doorW-1 ? "]" : (r === 3 ? "-" : " "),"k-d");
          g.set(ex+23-dx2,1+r,dx2 === doorW-1 ? "[" : (r === 3 ? "-" : " "),"k-d");
        }
      }
    }
    // call buttons
    g.text(ex+28,5,"( ^ )","k-d");
    g.text(ex+28,6,"( v )",t > 6050 ? "k-r k-bold" : "k-d");
    g.text(0,11,rep("_",COLS),"k-d");
    g.tile(12,"  .   '   .   , ",0,"k-d");
  }
};
