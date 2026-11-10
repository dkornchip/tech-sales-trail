import { ART, COLS, Grid, blink, clamp, pick, prog, rnd, stepParts } from "../core.js";
import { drawDesk } from "../desk.js";
import { SCENES } from "../registry.js";
import { fxRandom } from "../../../fxrng.js";

/* ---------------- MELTDOWN (stress): core temp hits quota, containment fails, the desk runs to slag ---------------- */
SCENES.meltdown = {
  dur: 8200,
  cap: { title:"MELTDOWN", a:["Core temp: quota.","Containment failed."], b:["Stop code:","SOUL_NOT_FOUND"], tTitle:200, tA:2600, tB:5400, k:"k-r", rule:"k-r-d" },
  cues: [
    {t:0, sfx:"rumble"}, {t:150, sfx:"geiger"}, {t:600, pulse:.03, ms:400}, {t:1100, pulse:.035, ms:380},
    {t:1500, sfx:"geiger"}, {t:1550, pulse:.045, ms:340}, {t:1900, pulse:.05, ms:300}, {t:1900, shake:180},
    {t:2200, pulse:.06, ms:260}, {t:2200, sfx:"rumble"},
    {t:2400, sfx:"crack"}, {t:2400, impact:120}, {t:2400, zoom:1.22, ms:620, fx:49, fy:3}, {t:2400, lines:"radial", ms:720, fx:49, fy:3, n:36}, {t:2400, shake:320}, {t:2400, glitch:220},
    {t:2600, slash:320}, {t:2600, sfx:"shing"},
    {t:2650, sfx:"slag"}, {t:2700, sfx:"meltdown"}, {t:3150, sfx:"fire"}, {t:3700, sfx:"slag"},
    {t:4300, sfx:"glitch"}, {t:4300, glitch:460}, {t:4300, shake:320},
    {t:4700, sfx:"bsod"},
    {t:5000, sfx:"stingerMelt", key:true}, {t:5000, card:"MELTDOWN", ms:1400, k:"k-r"}, {t:5000, impact:100}, {t:5000, lines:"radial", ms:900},
    {t:5150, say:"burnout", key:true}
  ],
  cam: [
    {t:0,    x:2,  y:-0.5, z:1.08, r:0},
    {t:1500, x:5,  y:-1.5, z:1.22, r:-1.5, e:"l"},
    {t:2350, x:5,  y:-2,   z:1.26, r:-2.5, e:"l"},
    {t:2400, x:12, y:-3.5, z:1.6,  r:3,    e:"o"},
    {t:2600, x:0.6,y:0,    z:1.08, r:0,    e:"cut"},
    {t:4250, x:0,  y:1.5,  z:1.24, r:2.5},
    {t:4700, x:0,  y:0,    z:1,    r:0,    e:"cut"},
    {t:8000, x:-1, y:0,    z:1.05, r:0,    e:"l"}
  ],
  idleGlitch: 5200,
  summary: "Core temp hits quota, containment fails, the desk melts to slag, blue screen.",
  draw: function(g,c){
    var t = c.t, st = c.st;
    if(t < 2600){
      var p = clamp(61 + 39*Math.pow(prog(t,0,2300),2),0,100);
      drawDesk(g,t,p,0,false,"core",p >= 90);
      st.steam = st.steam || [];
      if(p >= 82 && fxRandom() < .6) st.steam.push({x:rnd(2,36),y:7,vx:rnd(-1,1),vy:rnd(-4,-2),life:rnd(500,900),ch:pick(["~","}","{"]),k:"k-d"});
      stepParts(st.steam,c.dt,g);
      if(t >= 2400){
        // the gauge overflows and the monitor glass goes
        g.text(61,3,blink(t,120) ? "\u2588\u2588" : "\u2588 ","k-r k-bold");
        if(!st.cracks){ st.cracks = []; for(var i=0;i<9;i++) st.cracks.push([Math.floor(rnd(3,16)),Math.floor(rnd(1,6)),pick(["\\","/","|","X"])]); }
        for(var ck=0;ck<st.cracks.length;ck++){ var C = st.cracks[ck]; g.set(C[0],C[1],C[2],"k-w"); }
        if(blink(t,100)) g.text(2,0,"!! CONTAINMENT FAILED !!","k-r k-bold");
      }
      return;
    }
    if(t < 4700){
      // melt: render the frozen room, then slide each column down at its own pace, flames at the floor
      if(!st.melt){
        st.melt = new Grid(); drawDesk(st.melt,2600,100,0,false,"core",false);
        st.delay = []; st.speed = [];
        for(var i2=0;i2<COLS;i2++){ st.delay.push(rnd(0,700)); st.speed.push(rnd(95,240)); }
      }
      var m = st.melt, el = t-2600;
      for(var x=0;x<COLS;x++){
        var off = Math.max(0,Math.floor((el-st.delay[x])/st.speed[x]));
        for(var y=ART-1;y>=0;y--){
          var ch = m.get(x,y); if(ch === " ") continue;
          var ny = y+off; if(ny > ART-1) continue;
          g.set(x,ny,ch,m.getK(x,y));
          if(off > 0 && y+off-1 >= 0 && g.get(x,y+off-1) === " " && (x+y)%3 === 0) g.set(x,y+off-1,"'","k-d");
        }
      }
      // heat haze: a few rows shimmer sideways
      if(el > 300) for(var hz=0;hz<3;hz++){ var ry = Math.floor(rnd(0,ART)), sh = fxRandom() < .5 ? -1 : 1, o = ry*COLS, row = g.ch.slice(o,o+COLS), rk = g.cl.slice(o,o+COLS); for(var hx=0;hx<COLS;hx++){ var sx = hx-sh; g.ch[o+hx] = sx >= 0 && sx < COLS ? row[sx] : " "; g.cl[o+hx] = sx >= 0 && sx < COLS ? rk[sx] : ""; } }
      if(el > 400){
        var dens = clamp((el-400)/1400,0,1);
        for(var fx=0;fx<COLS;fx++) for(var fy=10;fy<=12;fy++){
          var chance = dens*(fy === 12 ? .85 : fy === 11 ? .55 : .25);
          if(fxRandom() < chance) g.set(fx,fy,pick(["^","(",")","'","\"","^"]),pick(["k-r","k-o","k-y","k-o"]));
        }
        if(el > 1200) g.tile(12,"~~__~~~___~~_~~~",Math.floor(t/300),"k-o"); // slag pooling on the floor
      }
      return;
    }
    // blue screen
    c.screen = "bsod";
    var pctDone = t <= c.dur ? Math.floor(37*prog(t,4900,c.dur)) : Math.min(99, 37 + Math.floor((t-c.dur)/900));
    g.text(3,1,":(","k-bs k-bold");
    g.text(3,3,"Your rep ran into a problem and needs to cool down.","k-bs");
    g.text(3,4,"Core temp: QUOTA. Containment: none.","k-bs");
    g.text(3,6,pctDone+"% complete","k-bs");
    g.text(3,8,"Stop code: SOUL_NOT_FOUND","k-bs");
    g.text(3,9,"What failed: containment.sys","k-bs");
    if(blink(t,500)) g.text(3+(""+pctDone).length+10,6,"_","k-bs");
  }
};
