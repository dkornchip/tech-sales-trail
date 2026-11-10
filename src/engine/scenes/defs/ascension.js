import { ART, COLS, Grid, blink, clamp, mod, pick, prog, rep, rnd, stepParts } from "../core.js";
import { drawDesk } from "../desk.js";
import { SCENES } from "../registry.js";
import { SPR } from "../sprites.js";
import { fxRandom } from "../../../fxrng.js";

/* ---------------- ASCENSION (caffeine): the desk ignites and the rep rides espresso fire into orbit ---------------- */
export var ASC = { ign:2300, cut:5400 };
export var PINGS = [[6,-9,"(1)"],[40,-12,"@matt"],[22,-16,"(3)"],[52,-19,"ping"],[12,-23,"(99+)"],[34,-27,"1:1?"],[46,-31,"(2)"],[8,-35,"re: re: re:"]];
SCENES.ascension = {
  dur: 8600,
  cap: { title:"ASCENSION", a:function(m){ return [m.shots > 1 ? "Shot #"+m.shots+"." : "One shot too many.","Orbit achieved."]; }, b:["OOO. Forever.","Badge in low orbit."], tTitle:200, tA:2500, tB:6000, k:"k-y", rule:"k-y-d" },
  cues: [
    {t:0, sfx:"heartbeat"}, {t:0, pulse:.03, ms:380}, {t:650, sfx:"heartbeat"}, {t:650, pulse:.035, ms:360},
    {t:1200, sfx:"heartbeat"}, {t:1200, pulse:.04, ms:340}, {t:1200, sfx:"rumble"}, {t:1650, sfx:"heartbeat"}, {t:1650, pulse:.045, ms:300},
    {t:1950, sfx:"heartbeat"}, {t:1950, pulse:.05, ms:260}, {t:1950, shake:220}, {t:2180, sfx:"heartbeat"}, {t:2180, pulse:.06, ms:220},
    {t:2300, sfx:"ignition"}, {t:2300, impact:120}, {t:2300, slam:1.4, ms:520, fx:24, fy:4}, {t:2300, lines:"radial", ms:720, fx:24, fy:5, n:40}, {t:2300, shake:340},
    {t:2380, sfx:"liftoff"}, {t:2450, letterbox:true},
    {t:3080, sfx:"ceiling"}, {t:3080, impact:90}, {t:3080, shake:260}, {t:3080, lines:"radial", ms:450, fx:24, fy:3, n:22},
    {t:3420, sfx:"ceiling"}, {t:3420, shake:200},
    {t:3900, sfx:"ping"}, {t:4250, sfx:"ping"}, {t:4650, sfx:"sparkle"},
    {t:5400, slash:340}, {t:5400, sfx:"shing"}, {t:5400, letterbox:false},
    {t:5900, sfx:"stingerAscend", key:true}, {t:5900, card:"ASCENSION", ms:1500, k:"k-y"}, {t:5900, impact:100}, {t:5900, lines:"radial", ms:900},
    {t:6100, say:"burnout", key:true}
  ],
  cam: [
    {t:0,    x:2,  y:-0.5, z:1.08, r:0},
    {t:1500, x:5,  y:-1.5, z:1.22, r:-1.5, e:"l"},
    {t:2300, x:5,  y:-2,   z:1.3,  r:-3,   e:"l"},
    {t:2650, x:0,  y:-1,   z:1.1,  r:0,    e:"o"},
    {t:3300, x:0,  y:-1.5, z:1.14, r:2.5},
    {t:4100, x:0,  y:-0.5, z:1.12, r:-2.5},
    {t:4700, x:0,  y:0.5,  z:1.04, r:0},
    {t:5400, x:0,  y:0,    z:1.06, r:0,    e:"cut"},
    {t:5900, x:-6, y:-3,   z:1.4,  r:-1},
    {t:7700, x:-6, y:-3,   z:1.4,  r:-1},
    {t:8600, x:-1, y:-1,   z:1.1,  r:0}
  ],
  drift: {x:.6, z:.015, p:8000},
  summary: "The desk ignites and you ride a column of espresso fire through the ceiling into orbit. A crater and a Post-it remain.",
  draw: function(g,c){
    var t = c.t, st = c.st, MX = 24, MY = 3; // where the rep stays framed during the climb
    var clearChair = function(gr){ gr.text(23,3,"     ",""); gr.text(22,4,"       ",""); gr.text(22,5,"       ",""); gr.text(22,6,"       ",""); };
    if(t < ASC.ign){
      var p = clamp(61 + 39*Math.pow(prog(t,0,2200),2),0,99.4); // (@_@) right up to ignition
      drawDesk(g,t,p,88 + 104*Math.pow(prog(t,0,2200),2),true,null,p >= 86);
      if(p >= 92 && fxRandom() < .5) g.set(Math.round(rnd(19,30)),Math.round(rnd(5,6)),pick(["*","'","."]),"k-y"); // sparks: the chair is rattling
      return;
    }
    if(t < ASC.cut){
      // vertical tracking shot: the camera climbs with the rep while the office, the ceiling, the roof, the sky
      // and finally space scroll DOWN past him. World row wy lands on screen row wy + oy.
      var tau = (t-ASC.ign)/1000, oy = tau < 2.3 ? 3*tau + 4.5*tau*tau : 30.7 + 4*(tau-2.3);
      var sky = function(wy){ return Math.round(wy + oy); };
      if(!st.stars){ st.stars = []; for(var s=0;s<70;s++) st.stars.push([Math.floor(rnd(0,COLS)),Math.floor(rnd(-70,-24)),rnd(0,1)]); }
      for(var si=0;si<st.stars.length;si++){ var S = st.stars[si], y0 = sky(S[1]); if(y0 >= 0 && y0 < ART && (S[2] < .5 || blink(t+si*97,700))) g.set(S[0],y0,S[2] < .25 ? "." : S[2] < .6 ? "+" : "*","k-d"); }
      var clouds = [[4,-9],[44,-11],[20,-14],[52,-17],[8,-20],[36,-22]];
      for(var ci=0;ci<clouds.length;ci++){ var cl = clouds[ci], cy = sky(cl[1]), cx = Math.round(cl[0] + Math.sin(t/900+ci)*2); if(cy > -3 && cy < ART) g.sprO(cx,cy,SPR.cloud,"k-d"); }
      for(var pi=0;pi<PINGS.length;pi++){ var P = PINGS[pi], py = sky(P[1]); if(py >= 0 && py < ART) g.text(P[0]+Math.round(Math.sin(t/400+pi)*1.5),py,P[2],blink(t+pi*131,500) ? "k-m" : "k-p"); }
      // the roof (wy -6) and the plenum (wy -4..-3)
      var ry = sky(-6), roofHole = oy >= 8.3;
      if(ry >= 0 && ry < ART){ g.tile(ry,"/\\/\\/\\/\\",0,"k-d"); if(roofHole){ g.text(MX-3,ry,"\\         /","k-w"); g.text(MX-2,ry,"         ",""); } if(ry-1 >= 0) g.text(50,ry-1,"[HVAC]","k-d"); }
      var py2 = sky(-4); if(py2 >= 0 && py2 < ART) g.tile(py2,"___|___|___|",0,"k-d");
      var py3 = sky(-3); if(py3 >= 0 && py3 < ART) g.tile(py3,"  ~  ~    ~ ",3,"k-b-d");
      // the drop ceiling (wy -2): intact until the rep punches through at oy 5
      var cy2 = sky(-2), hole = oy >= 4.3; // the hole opens as his head reaches the tiles
      if(cy2 >= 0 && cy2 < ART){
        for(var x=0;x<COLS;x++){ if(hole && x >= MX-3 && x <= MX+7) continue; g.set(x,cy2,x%8 === 0 ? "+" : "=","k-d"); }
        if(hole){ g.set(MX-4,cy2,"\\","k-w"); g.set(MX+8,cy2,"/","k-w"); }
      }
      if(hole && !st.tiles){ st.tiles = []; for(var ti=0;ti<9;ti++) st.tiles.push({x:MX+rnd(-3,8),y:-2,vx:rnd(-6,6),vy:rnd(-3,3),life:1600,ch:pick(["=","#","+","="]),k:"k-d"}); }
      if(st.tiles){ for(var tj=0;tj<st.tiles.length;tj++){ var T = st.tiles[tj]; T.life -= c.dt; T.vy += 14*c.dt/1000; T.x += T.vx*c.dt/1000; T.y += T.vy*c.dt/1000; if(T.life > 0) g.set(T.x,sky(T.y),T.ch,T.k); } }
      // the office (wy 0..12), falling away below
      var oyr = Math.round(oy);
      if(oyr < ART+2){
        if(!st.office){
          var off = st.office = new Grid(); drawDesk(off,ASC.ign,61,88,true,"plain",false); clearChair(off);
          var heads = [[6,9,"(O_O)"],[48,9,"(O_O)"],[56,10,"(o_o)"]];
          for(var h=0;h<heads.length;h++){ off.text(heads[h][0],heads[h][1],heads[h][2],"k-w"); off.text(heads[h][0]-1,heads[h][1]+1,"|=====|","k-b"); }
          off.text(MX-4,8,"(  ~~~  )","k-r"); off.text(0,12,rep("_",COLS),"k-d");
        }
        for(var y=0;y<ART;y++){ var ty = y+oyr; if(ty < 0 || ty >= ART) continue; for(var x2=0;x2<COLS;x2++){ var ch2 = st.office.get(x2,y); if(ch2 !== " ") g.set(x2,ty,ch2,st.office.getK(x2,y)); } }
      }
      // the rep, the chair, the plume
      var face = tau < .4 ? "(O_O)" : tau < 2.3 ? "(^o^)" : "(-_-)";
      g.sprO(MX,MY,[" "+face," _/|\\_","  [=]"],"k-w");
      var L = Math.round(3 + 4*clamp(tau/.6,0,1)) - (tau > 2.3 ? 2 : 0);
      for(var fi=0;fi<L;fi++){
        var fy2 = MY+3+fi, half = Math.max(1,Math.round(2.5-fi*.35)), fk = fi < 2 ? "k-w" : fi < 4 ? "k-y" : fi < 6 ? "k-o" : "k-r";
        for(var fx=MX+2-half;fx<=MX+2+half;fx++) if(fxRandom() < .85) g.set(fx,fy2,pick(["^","(",")","'","\"","|","^"]),fk);
      }
      st.ex = st.ex || [];
      if(tau < 2.3) for(var k=0;k<3;k++) st.ex.push({x:MX+2+rnd(-2,2),y:MY+3+L,vx:rnd(-4,4),vy:rnd(10,22),life:rnd(400,800),ch:pick(["*",":","'","."]),k:pick(["k-o","k-r","k-y","k-d"])});
      stepParts(st.ex,c.dt,g);
      // vertical speed lines through empty cells while he's accelerating
      if(tau > .25 && tau < 2.3){ for(var sl=0;sl<10;sl++){ var sx = (sl*7+Math.floor(t/90))%COLS, sy0 = Math.floor(mod(t/40+sl*5,ART+6))-3; for(var j=0;j<4;j++){ var yy = sy0+j; if(yy < 0 || yy >= ART) continue; var ii = yy*COLS+sx; if(g.ch[ii] === " "){ g.ch[ii] = j === 0 ? ":" : "|"; g.cl[ii] = "k-d"; } } } }
      // the curve of the earth once he's up
      if(tau > 2.3){ var ey = ART-1-(oy-30.7)*.5; for(var ex=0;ex<COLS;ex++){ var yy2 = Math.round(ey + Math.pow((ex-32)/32,2)*3); if(yy2 >= 0 && yy2 < ART) g.set(ex,yy2,"_","k-b"); } }
      return;
    }
    // the office afterwards: a crater, a Post-it on the monitor, a growing unread count
    drawDesk(g,ASC.cut,61,88,true,"plain",false); clearChair(g);
    g.text(MX-4,7,"\\__( crater )__/","k-r"); g.text(MX-2,8," ~ ~ ~ ","k-d");
    st.sm = st.sm || [];
    if(fxRandom() < (c.idle ? .35 : .7)) st.sm.push({x:MX+rnd(-2,4),y:6.2,vx:rnd(-1.5,1.5),vy:rnd(-5,-2.5),life:rnd(900,1500),ch:pick(["o","O","."]),k:"k-d",fade:400,ch2:"o"}); // starts above the crater label
    stepParts(st.sm,c.dt,g);
    g.text(3,2,"OOO. Forever. ","k-y k-bold"); g.text(3,3,"              ",""); g.text(3,4,"              ","");
    g.text(4,4,blink(t,600) ? "(1) unread" : "(1)       ","k-m");
    var heads2 = [[6,9,"(._.)"],[48,9,"(o_o)"],[56,10,"(-_-)"]];
    for(var h2=0;h2<heads2.length;h2++){ g.text(heads2[h2][0],heads2[h2][1],heads2[h2][2],"k-w"); g.text(heads2[h2][0]-1,heads2[h2][1]+1,"|=====|","k-b"); }
    g.text(0,12,rep("_",COLS),"k-d");
  }
};
