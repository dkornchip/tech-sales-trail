import { fxRandom } from "../fxrng.js";
/* ===== Tech Sales Trail v1.14: ASCII scene engine + storyboards (all art drawn for this game) ===== */
(function(root){
  "use strict";
  var HAS_DOM = typeof document !== "undefined";
  var COLS = 64, ROWS = 17, ART = 13; // rows 0-12 art, 13 rule, 14-16 caption band

  /* ---------- helpers ---------- */
  function S(str){ var a = str.split("\n"); if(a[0] === "") a.shift(); if(a.length && a[a.length-1].trim() === "") a.pop(); return a; }
  function clamp(n,a,b){ return n < a ? a : n > b ? b : n; }
  function prog(t,a,b){ return clamp((t-a)/(b-a),0,1); }
  function lerp(a,b,p){ return a+(b-a)*p; }
  function easeOut(p){ return 1-Math.pow(1-p,3); }
  function easeIn(p){ return p*p*p; }
  function blink(t,ms){ return Math.floor(t/ms)%2 === 0; }
  function pick(a){ return a[Math.floor(fxRandom()*a.length)]; }
  function rnd(a,b){ return a+fxRandom()*(b-a); }
  function esc(s){ return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
  function rep(ch,n){ var s = ""; for(var i=0;i<n;i++) s += ch; return s; }
  function dots(label,value,width){ var n = Math.max(2,width-label.length-value.length-2); return label+" "+rep(".",n)+" "+value; }
  function mod(n,m){ return ((n%m)+m)%m; }
  function easeInOut(p){ return p < .5 ? 4*p*p*p : 1-Math.pow(-2*p+2,3)/2; }

  /* ---------- character grid ---------- */
  function Grid(){ this.n = COLS*ROWS; this.ch = new Array(this.n); this.cl = new Array(this.n); this.clear(); }
  Grid.prototype.clear = function(){ for(var i=0;i<this.n;i++){ this.ch[i] = " "; this.cl[i] = ""; } };
  Grid.prototype.set = function(x,y,c,k){
    x = Math.round(x); y = Math.round(y);
    if(x<0||y<0||x>=COLS||y>=ROWS) return;
    var i = y*COLS+x; this.ch[i] = c; if(k !== undefined) this.cl[i] = k;
  };
  Grid.prototype.get = function(x,y){ x = Math.round(x); y = Math.round(y); if(x<0||y<0||x>=COLS||y>=ROWS) return " "; return this.ch[y*COLS+x]; };
  Grid.prototype.getK = function(x,y){ if(x<0||y<0||x>=COLS||y>=ROWS) return ""; return this.cl[y*COLS+x]; };
  Grid.prototype.text = function(x,y,s,k){ x = Math.round(x); for(var i=0;i<s.length;i++) this.set(x+i,y,s.charAt(i),k); };
  // sprite: spaces are see-through; "§" paints an opaque blank; optional per-char colour mask
  Grid.prototype.spr = function(x,y,lines,k,mask,pal){
    x = Math.round(x); y = Math.round(y);
    for(var r=0;r<lines.length;r++){
      var L = lines[r], M = mask && mask[r];
      for(var i=0;i<L.length;i++){
        var c = L.charAt(i); if(c === " ") continue;
        var kk = k;
        if(M && pal){ var mc = M.charAt(i); if(pal[mc] !== undefined) kk = pal[mc]; }
        this.set(x+i,y+r,c === "§" ? " " : c,kk);
      }
    }
  };
  // solid sprite: blanks between a row's first and last mark are painted, so things behind don't show through
  Grid.prototype.sprO = function(x,y,lines,k){
    x = Math.round(x); y = Math.round(y);
    for(var r=0;r<lines.length;r++){
      var L = lines[r], a = L.search(/\S/), b = L.length-1;
      if(a < 0) continue;
      while(b > a && L.charAt(b) === " ") b--;
      for(var i=a;i<=b;i++) this.set(x+i,y+r,L.charAt(i) === "§" ? " " : L.charAt(i),k);
    }
  };
  Grid.prototype.fill = function(x,y,w,h,c,k){ for(var r=0;r<h;r++) for(var i=0;i<w;i++) this.set(x+i,y+r,c,k); };
  Grid.prototype.center = function(y,s,k){ this.text(Math.floor((COLS-s.length)/2),y,s,k); };
  Grid.prototype.copyFrom = function(o){ for(var i=0;i<this.n;i++){ this.ch[i] = o.ch[i]; this.cl[i] = o.cl[i]; } };
  Grid.prototype.toText = function(){ var out=[]; for(var y=0;y<ROWS;y++) out.push(this.ch.slice(y*COLS,(y+1)*COLS).join("")); return out.join("\n"); };
  // rows y0..y1-1 (default all): starts with no open span, newlines only between its own rows, closes its span at the end
  Grid.prototype.toHTML = function(y0,y1){
    if(y0 === undefined) y0 = 0;
    if(y1 === undefined) y1 = ROWS;
    var out = "", cur = null, buf = "";
    for(var y=y0;y<y1;y++){
      for(var x=0;x<COLS;x++){
        var i = y*COLS+x, k = this.cl[i] || "";
        // blanks without their own colour ride along with the current run (fewer spans) unless it paints a background
        if(this.ch[i] === " " && k === "" && cur && cur.indexOf("b-") < 0) k = cur;
        if(k !== cur){ if(buf) out += cur ? '<span class="'+cur+'">'+esc(buf)+"</span>" : esc(buf); buf = ""; cur = k; }
        buf += this.ch[i];
      }
      if(y < y1-1) buf += "\n";
    }
    if(buf) out += cur ? '<span class="'+cur+'">'+esc(buf)+"</span>" : esc(buf);
    return out;
  };
  // a repeating texture across one row, scrolled by a world offset (tracking shots); spaces are see-through
  Grid.prototype.tile = function(y,pat,ox,k){
    var n = pat.length, o = Math.round(ox);
    for(var x=0;x<COLS;x++){ var c = pat.charAt(mod(x+o,n)); if(c !== " ") this.set(x,y,c,k); }
  };

  /* ---------- particles ---------- */
  // ox: optional world offset (particles live in world space during a tracking shot)
  function stepParts(ps,dt,g,floor,ox){
    var s = dt/1000;
    for(var i=ps.length-1;i>=0;i--){
      var p = ps[i];
      p.life -= dt;
      if(p.life <= 0){ ps.splice(i,1); continue; }
      p.vy += (p.g||0)*s; p.x += p.vx*s; p.y += p.vy*s;
      if(floor !== undefined && p.y >= floor){ if(p.onFloor) p.onFloor(p); ps.splice(i,1); continue; }
      if(g){
        var ch = p.ch;
        if(p.fade && p.life < p.fade) ch = p.life < p.fade/2 ? "." : (p.ch2 || "+");
        g.set(p.x-(ox||0),p.y,ch,p.k);
      }
    }
  }

  /* ---------- sprites ---------- */
  var SPR = {
    sun: S(String.raw`
 \ | /
-- O --
 / | \
`),
    sun2: S(String.raw`
 . | .
-- O --
 ' | '
`),
    cloud: S(String.raw`
   _  _
 _( )( )_
(________)
`),
    plane: S(String.raw`
|\
| \___________
 \  o o o o o '-.
  '---\\_\\-----'
`),
    palmA: S(String.raw`
 _.-._ _.-._
'     \|/    '
    _.-|-._
       |
       |
      _|_
`),
    palmB: S(String.raw`
  _.-._ _.-._
 '     \|/    '
     _.-|-._
       |
       |
      _|_
`),
    jacket: S(String.raw`
   _/\  /\_
 _/  \\//  \_
/  |  \/  |  \
\__|  ::  |__/
   |  ::  |
   '------'
`),
    jacketS: S(String.raw`
 _/\/\_
/ |::| \
\_|::|_/
  '--'
`),
    reader: S(String.raw`
.-------------------.
|  SHITCORP SECURE  |
|  .-------------.  |
|  |             |  |
|  '-------------'  |
|   (o)    [1][2]   |
|          [3][4]   |
'-------------------'
`),
    badge: S(String.raw`
.----------.
| SHITCORP |
|  (o_o)   |
|  MATT    |
|  SDR     |
'----------'
`),
    poster: S(String.raw`
.------------------.
|  WE'RE A FAMILY* |
|        *at-will  |
'------------------'
`),
    walkA: S(String.raw`
  o   \|/
 /|\_[BOX]
 / \
`),
    walkB: S(String.raw`
  o   \|/
 /|\_[BOX]
  |\
`),
    front: S(String.raw`
  o
[BOX]
 / \
`),
    elevator: S(String.raw`
.------------------------.
|                        |
|========================|
||                      ||
||                      ||
||                      ||
||                      ||
||                      ||
||______________________||
`),
    monitor: S(String.raw`
.--------------.
|              |
|              |
|              |
'-----.  .-----'
      |__|
`),
    worker: S(String.raw`
 (o_o)
__/|\__
   /|
__/_|__
`),
    deskTop: S(String.raw`
====================================
  ||                            ||
  ||                            ||
`),
    rainCloud: S(String.raw`
  .-~~~-.
 (       )
(_________)
`),
    repA: S(String.raw`
 o
/|\
/ \
`),
    repB: S(String.raw`
 o
/|\
 |\
`),
    umbrella: S(String.raw`
 .-^-.
/_/|\_\
   |
`),
    truck: S(String.raw`
                          _
            |           ,'
     _____  |         ,'
    /  |  \ |       ,'
 __/___|___\|_____,'
|     |  REPO     |
|_____|___________|
  (_)         (_)(_)
`),
    building: S(String.raw`
._______________________.
|  COLLECTIONS  DEPT.   |
|  ___    ___    ___    |
| |___|  |___|  |___|   |
|                       |
|          .------.     |
|          |      |     |
|__________|______|_____|
`),
    poster2: S(String.raw`
.---------------.
|  QUOTA IS A   |
|   MINDSET.    |
'---------------'
`),
    billboard: S(String.raw`
.------------------.
| PRESIDENT'S CLUB |
| see you in Cabo  |
'------------------'
         ||
         ||
         ||
         ||
         ||
         ||
         ||
`)
  };

  /* ---------- caption band ---------- */
  function caption(g,c,t,dur,run){
    var tc = c.k || "k-w", cps = 34, typed = 0;
    g.fill(0,ART,COLS,ROWS-ART," ","");
    g.text(0,ART,rep("\u2500",COLS),c.rule || "k-d");
    if(t >= c.tTitle || run.still){
      var n = run.still ? c.title.length : Math.min(c.title.length, Math.floor((t-c.tTitle)/1000*cps));
      g.text(1,ART+1,"> ","k-d"); g.text(3,ART+1,c.title.slice(0,n),tc+" k-bold"); typed += n;
      if(n < c.title.length) g.set(3+n,ART+1,"\u258c",tc);
    }
    var set = null, t0 = 0;
    if(run.still){ set = c.a; t0 = -1e9; }
    else if(t > dur){ set = (Math.floor((t-dur)/5200)%2 === 0) ? c.b : c.a; t0 = -1e9; }
    else if(t >= c.tB){ set = c.b; t0 = c.tB; }
    else if(t >= c.tA){ set = c.a; t0 = c.tA; }
    if(set){
      var el = (t-t0)/1000*cps, used = 0, lk = c.lk || "k-w";
      for(var r=0;r<set.length;r++){
        var line = set[r], m = clamp(Math.floor(el-used),0,line.length);
        g.text(3,ART+2+r,line.slice(0,m),lk); typed += m;
        if(m > 0 && m < line.length) g.set(3+m,ART+2+r,"\u258c",lk);
        used += line.length + 6;
      }
      if(!run.still && el >= used && blink(t,530)){
        var last = set[set.length-1];
        g.set(3+last.length+1,ART+1+set.length,"\u258c","k-d");
      }
    }
    return typed;
  }

  // per-cause caption override: sc.capBy[meta.cause] replaces fields of sc.cap; a line set may be a function of meta
  function capFor(sc,meta){
    var base = sc.cap; if(!base) return base;
    var o = sc.capBy && meta && sc.capBy[meta.cause], out = {}, k;
    for(k in base) out[k] = base[k];
    if(o) for(k in o) out[k] = o[k];
    if(typeof out.a === "function") out.a = out.a(meta||{});
    if(typeof out.b === "function") out.b = out.b(meta||{});
    return out;
  }
  // one-line description (aria-label, reduced-motion note); sc.summaryBy[meta.cause] wins over sc.summary
  function summaryFor(type,meta){
    var sc = SCENES[sceneKey(type,meta)]; if(!sc) return "";
    return (sc.summaryBy && meta && sc.summaryBy[meta.cause]) || sc.summary || "";
  }

  /* ======================================================================
     SCENES. Each has: dur (ms of timeline before the idle loop), cap (caption schedule; capBy = per meta.cause),
     summary (summaryBy = per meta.cause),
     cues [{t, sfx | say | amb | shake | glitch | whip | slash | impact | zoom | slam | pulse | lines | card | letterbox,
            key:true = still fires on Skip (sound cues only), cause / notCause = only for that meta.cause}],
     cam [{t, x, y, z, r, e}] camera keys: look-at offset from the art's centre (cells), zoom, roll (deg),
            e = ease into the key (io | i | o | l | cut); drift = idle sway after dur; draw(g, ctx)
     Lateral moves are tracking shots inside the grid (a world offset scrolls the set), so the CSS camera
     only ever zooms in and never shows the edge of the art.
     ====================================================================== */
  var SCENES = {};

  /* ---------------- PRESIDENT'S CLUB: jet lands on the beach, jacket descends, fireworks ---------------- */
  SCENES.club = {
    dur: 8400,
    cap: { title:"PRESIDENT'S CLUB", a:["Jacket secured.","You did the thing."], b:["Pipeline: obliterated.","Commission rains."], tTitle:300, tA:3400, tB:5900, k:"k-au", rule:"k-au-d" },
    cues: [
      {t:0, sfx:"plane"}, {t:200, lines:"h", ms:1700, dir:-1, n:10},
      {t:2000, sfx:"screech"}, {t:2000, shake:200}, {t:2000, pulse:.05, ms:320},
      {t:2900, sfx:"seatbelt"}, {t:3400, sfx:"sparkle"},
      {t:4900, sfx:"thwack"}, {t:4900, impact:110}, {t:4900, lines:"radial", ms:800, fx:31, fy:3}, {t:4900, zoom:1.14, ms:650, fx:31, fy:3},
      {t:5300, sfx:"stingerClub", key:true}, {t:5300, card:"CLUB", ms:1400}, {t:5300, shake:260},
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
    summary: "A jet lands on the beach, the jacket descends, fireworks rain commission.",
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

  /* ---------------- FIRED: access denied, walk of shame, elevator goes down ---------------- */
  var FACES = ["(-_-)","(o_o)","(-_-)","(o.o)","(-_-)"], FACES_AFTER = ["(-_-)","(._.)","(;_;)","(-_-)","(._.)"];
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

  /* ---------------- BURNOUT: stress spikes, desk melts, blue screen ---------------- */
  // the open-plan desk, three ways: STRESS meter (plain), HEART meter with extra cups (caf), or the reactor room
  // (mode "core": CORE TEMP, containment strip, geiger readout). mode "plain" skips the meter. jit rattles the rep.
  function drawDesk(g,t,p,bpm,caf,mode,jit){
    var core = mode === "core";
    g.spr(2,1,SPR.monitor,"k-d");
    var warn = p >= 85;
    g.text(4,2,core ? "REACTOR Q1" : "Q1 FORECAST","k-c");
    g.text(4,3,warn ? (blink(t,180) ? "> !!!!!!!" : "> ???????") : (core ? "> rods: ok" : "> commit?"),"k-w");
    g.text(4,4,core ? "> coolant: none" : "> ????","k-d");
    var wx = 22 + (jit ? Math.round(rnd(-1,1)) : 0);
    g.spr(wx,3,SPR.worker,"k-w");
    var face = p < 75 ? "(o_o)" : p < 88 ? "(O_O)" : p < 100 ? "(@_@)" : "(x_x)";
    g.text(wx+1,3,face,p >= 88 ? "k-r" : "k-w");
    if(p >= 80){ g.set(wx-1,3,blink(t,260) ? "'" : " ","k-c"); g.set(wx+7,4,blink(t,330) ? "'" : " ","k-c"); }
    if(p >= 90){ var sy = 2 - (Math.floor(t/160)%2); g.text(wx+2,sy,blink(t,160) ? "~ ~" : " ~ ","k-d"); }
    g.text(18,6,"c[_]","k-y");
    g.text(18,5,blink(t,400) ? " ) " : " ( ","k-d");
    if(caf){ g.text(13,6,"c[_]","k-y"); g.text(31,6,"c[_]","k-y"); if(p >= 90) g.text(8,6,"c[_]","k-y"); }
    g.spr(0,7,SPR.deskTop,"k-br");
    if(mode === "plain") return;
    // the meter
    var w = 20, f = Math.round(w*p/100);
    var mk = p < 70 ? "k-y" : p < 90 ? "k-o" : (blink(t,140) ? "k-r k-bold" : "k-r");
    var label = core ? "CORE TEMP" : caf ? "HEART" : "STRESS";
    g.text(39,2,label,"k-d");
    g.text(39,3,"["+rep("\u2588",f)+rep("\u2591",w-f)+"]",mk);
    g.text(40+label.length,2,Math.round(p)+"%",mk); // next to the label, so push-ins never crop it
    if(core){
      var cs = p >= 100 ? "FAILED" : p >= 80 ? "DEGRADED" : "NOMINAL";
      g.text(39,5,"CONTAINMENT","k-d");
      g.text(51,5,cs,p >= 100 ? (blink(t,150) ? "k-r k-bold" : "k-r") : p >= 80 ? (blink(t,300) ? "k-o" : "k-o-d") : "k-g");
      var gl = Math.round(p >= 100 ? 22 : 4 + 18*prog(p,60,100));
      for(var q=0;q<22;q++) g.set(39+q,6,q < gl ? (fxRandom() < .7 ? "|" : "!") : ".",q < gl ? (p >= 90 ? "k-r" : "k-o") : "k-d");
      return;
    }
    var beatMs = 60000/bpm;
    g.text(39,5,"BPM "+Math.round(bpm),"k-d");
    g.text(48,5,(t % beatMs) < beatMs*0.35 ? "<3" : "  ","k-r");
    // ECG trace, newest sample on the right
    for(var i=0;i<22;i++){
      var tau = t-(21-i)*26, ph = Math.floor(mod(tau,beatMs)/26);
      g.set(39+i,6,ph === 0 ? "/" : ph === 1 ? "\\" : "_",p >= 90 ? "k-r" : "k-g");
    }
  }
  // the burnout ending has two storyboards; which one plays depends on how the rep went
  function sceneKey(type,meta){
    if(type === "burnout") return meta && meta.cause === "caffeine" ? "ascension" : "meltdown";
    return SCENES[type] ? type : "club";
  }

  /* ---------------- ASCENSION (caffeine): the desk ignites and the rep rides espresso fire into orbit ---------------- */
  var ASC = { ign:2300, cut:5400 };
  var PINGS = [[6,-9,"(1)"],[40,-12,"@matt"],[22,-16,"(3)"],[52,-19,"ping"],[12,-23,"(99+)"],[34,-27,"1:1?"],[46,-31,"(2)"],[8,-35,"re: re: re:"]];
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

  /* ---------------- BOOT: SHITCORP OS ---------------- */
  // 5-row block font (6 columns a letter with the gap): the logo and the title cards
  var FONT = {S:[" ####","#    "," ### ","    #","#### "],H:["#   #","#   #","#####","#   #","#   #"],I:["###"," # "," # "," # ","###"],T:["#####","  #  ","  #  ","  #  ","  #  "],C:[" ####","#    ","#    ","#    "," ####"],O:[" ### ","#   #","#   #","#   #"," ### "],R:["#### ","#   #","#### ","#  # ","#   #"],P:["#### ","#   #","#### ","#    ","#    "],
    L:["#    ","#    ","#    ","#    ","#####"],U:["#   #","#   #","#   #","#   #"," ### "],B:["#### ","#   #","#### ","#   #","#### "],F:["#####","#    ","#### ","#    ","#    "],E:["#####","#    ","#### ","#    ","#####"],D:["#### ","#   #","#   #","#   #","#### "],N:["#   #","##  #","# # #","#  ##","#   #"],M:["#   #","## ##","# # #","#   #","#   #"],
    A:[" ### ","#   #","#####","#   #","#   #"],W:["#   #","#   #","# # #","## ##","#   #"]};
  function blockWord(word){
    var out = [];
    for(var r=0;r<5;r++) out.push(word.split("").map(function(ch){ return (FONT[ch] || FONT.O)[r]; }).join(" "));
    return out;
  }
  var LOGO = blockWord("SHITCORP");
  function drawLogo(g,x,y,k,k2){
    for(var r=0;r<LOGO.length;r++){
      var L = LOGO[r];
      for(var i=0;i<L.length;i++) if(L.charAt(i) === "#") g.set(x+i,y+r,"\u2588",r < 3 ? k : k2);
    }
  }
  var BOOT_LINES = [
    {t:260,  y:9,  s:"SHITCORP OS v4.3", k:"k-w k-bold"},
    {t:480,  y:11, bar:true},
    {t:1120, y:13, s:"ERROR: quota exceeds pipeline.", k:"k-r k-bold"},
    {t:1400, y:15, week:true, k:"k-c", cursor:true}
  ];
  SCENES.boot = {
    dur: 1700, band:false,
    cam: [{t:0, x:0, y:0, z:1, r:0}],
    cues: [
      {t:0, sfx:"bootHum"}, {t:0, slam:1.6, ms:460, fx:31, fy:4}, {t:0, lines:"radial", ms:560, fx:31, fy:4, n:34}, {t:40, impact:90},
      {t:480, sfx:"loadStart"},
      {t:1120, sfx:"errBeep"}, {t:1120, glitch:220}, {t:1120, impact:90}, {t:1120, shake:200},
      {t:1400, sfx:"chime"}, {t:1500, say:"boot", key:true}
    ],
    summary: "SHITCORP OS boots and reports quota exceeds pipeline.",
    draw: function(g,c){
      var t = c.t, st = c.st, typed = 0, X = 10;
      drawLogo(g,9,2,"k-c","k-b");
      for(var i=0;i<BOOT_LINES.length;i++){
        var L = BOOT_LINES[i]; if(t < L.t && !c.still) break;
        if(L.bar){
          var p = c.still ? 1 : prog(t,480,1000), w = 24;
          var pct = Math.round(74*p), f = Math.floor(w*pct/100);
          g.text(X,L.y,"Loading quota","k-d");
          g.text(X+14,L.y,"["+rep("\u2588",f)+rep("\u2591",w-f)+"]",pct >= 74 ? "k-r" : "k-b");
          g.text(X+41,L.y,(pct < 10 ? " " : "")+pct+"%",pct >= 74 ? "k-r k-bold" : "k-w");
          if(!c.still && p < 1){ var tk = Math.floor(p*12); if(tk !== st.tk){ st.tk = tk; c.sfx("tick"); } }
          continue;
        }
        var src = L.week ? "Week "+(c.meta.week||1)+"/13. Clocking in." : L.s;
        var n = c.still ? src.length : Math.min(src.length, Math.floor((t-L.t)/1000*110));
        g.text(X,L.y,src.slice(0,n),L.k);
        typed += n;
        if(n < src.length) g.set(X+n,L.y,"\u258c","k-w");
        else if(L.cursor && blink(t,400)) g.set(X+1+n,L.y,"\u258c","k-w");
      }
      c.typed = typed;
    }
  };
  // standby screen shown before the first click
  SCENES.standby = {
    dur: 1, band:false, cues: [], keepAlive:true, // blinks until you clock in (at the idle tick, not every frame)
    summary: "SHITCORP OS standby screen.",
    draw: function(g,c){
      var t = c.t;
      drawLogo(g,9,2,"k-c","k-b");
      g.center(8,"O S   v 4 . 3","k-d");
      if(blink(t,600) || c.still) g.center(12,"[ PRESS ANY KEY ]","k-w k-bold");
    }
  };

  /* ======================================================================
     PLAYER
     ====================================================================== */
  var reduced = HAS_DOM && root.matchMedia ? root.matchMedia("(prefers-reduced-motion: reduce)").matches : false;
  function audio(){ return root.TST_AUDIO || null; }

  function glitchPost(g,rows){
    rows = rows || ART;
    var marks = "#%&@$/\\|=+<>?!";
    for(var y=0;y<rows;y++){
      if(fxRandom() < .28){
        var sh = Math.round(rnd(-3,3)), row = g.ch.slice(y*COLS,(y+1)*COLS), rk = g.cl.slice(y*COLS,(y+1)*COLS);
        // rows wrap around, so full-width ground lines never end on screen
        for(var x=0;x<COLS;x++){ var sx = mod(x-sh,COLS); g.ch[y*COLS+x] = row[sx]; g.cl[y*COLS+x] = rk[sx]; }
      }
    }
    for(var i=0;i<34;i++) g.set(Math.floor(rnd(0,COLS)),Math.floor(rnd(0,rows)),pick(marks.split("")),pick(["k-r","k-c","k-m","k-w"]));
  }

  /* ---------- anime effects drawn into the grid ---------- */
  function isBlank(g,i){ return g.ch[i] === " " && !g.cl[i]; }
  // focus lines: rays from the frame edge toward (cx,cy), only through empty cells, dim
  function rayChar(ca,sa){ var ax = Math.abs(ca), ay = Math.abs(sa); if(ay < ax*.42) return "-"; if(ay > ax*2.4) return "|"; return ca*sa > 0 ? "\\" : "/"; }
  function radialLines(g,e,p,rows,asp){
    var n = Math.round((e.n || 30)*(p < .55 ? 1 : 1-(p-.55)/.45*.75));
    var cx = e.fx !== undefined ? e.fx : COLS/2-.5, cy = e.fy !== undefined ? e.fy : (rows-1)/2;
    for(var i=0;i<n;i++){
      var a = (i+fxRandom()*.85)/n*Math.PI*2, ca = Math.cos(a), sa = Math.sin(a), ch = rayChar(ca,sa), k = i%3 ? "k-d" : "k-b-d";
      for(var r=(e.rin || 8)+fxRandom()*7+p*8; r<96; r+=.5){
        var x = Math.round(cx+ca*r), y = Math.round(cy+sa*r/asp);
        if(x < 0 || x >= COLS || y < 0 || y >= rows) break;
        var j = y*COLS+x; if(isBlank(g,j)){ g.ch[j] = ch; g.cl[j] = k; }
      }
    }
  }
  // horizontal speed lines streaming in e.dir, only through empty cells
  function speedLines(g,e,p,el,rows){
    if(!e.st){ e.st = []; for(var i=0;i<(e.n || 9);i++) e.st.push({y:Math.floor(fxRandom()*rows), len:Math.round(rnd(5,15)), x0:rnd(0,COLS+20), v:rnd(60,120)}); }
    var fade = p > .7 ? 1-(p-.7)/.3 : 1;
    for(var k=0;k<e.st.length;k++){
      var s = e.st[k], span = COLS+s.len+4, run = s.x0 + e.dir*s.v*el, hx = mod(run,span) - 2, y = mod(s.y + Math.floor(run/span)*5,rows);
      for(var j=0;j<Math.max(1,Math.round(s.len*fade));j++){
        var x = Math.round(e.dir > 0 ? hx - j : COLS-1-hx + j); if(x < 0 || x >= COLS) continue;
        var ii = y*COLS+x; if(isBlank(g,ii)){ g.ch[ii] = j === 0 ? "=" : "-"; g.cl[ii] = "k-d"; }
      }
    }
  }
  // whip-pan smear: rows slide (wrapping) and every mark drags a streak behind it
  function smear(g,s,dir,rows){
    var maxSh = s*9, blur = s > .5 ? (s-.5)*1.6 : 0, len = Math.round(1+s*7);
    for(var y=0;y<rows;y++){
      var o = y*COLS, row = g.ch.slice(o,o+COLS), rk = g.cl.slice(o,o+COLS), sh = dir*Math.round(maxSh*(.5+fxRandom()*.5));
      for(var x=0;x<COLS;x++){
        var sx = mod(x-sh,COLS), c = row[sx];
        if(c !== " " && blur && fxRandom() < blur) c = fxRandom() < .5 ? "-" : "=";
        g.ch[o+x] = c; g.cl[o+x] = rk[sx];
      }
      var src = g.ch.slice(o,o+COLS);
      for(var x2=0;x2<COLS;x2++){
        if(src[x2] === " ") continue;
        for(var j=1;j<=len;j++){
          var xx = x2-dir*j; if(xx < 0 || xx >= COLS || src[xx] !== " ") break;
          if(g.ch[o+xx] === " "){ g.ch[o+xx] = j < 2 ? "=" : "-"; g.cl[o+xx] = "k-d"; }
        }
      }
    }
  }
  // slash cut: a "/" band sweeps left to right; behind it the new shot, ahead of it the frozen old one
  function slashWipe(g,snap,p,rows){
    var uc = -3 + (COLS+rows+6)*p;
    for(var y=0;y<rows;y++) for(var x=0;x<COLS;x++){
      var i = y*COLS+x, d = x+y-uc;
      if(d > 1.5){ g.ch[i] = snap.ch[i]; g.cl[i] = snap.cl[i]; }
      else if(d > -1.5){ g.ch[i] = "/"; g.cl[i] = Math.abs(d) < .75 ? "k-w k-bold" : "k-c"; }
    }
  }

  /* ---------- camera ---------- */
  var CAM0 = {t:0, x:0, y:0, z:1, r:0};
  function normTrack(tr){
    if(!tr || !tr.length) return null;
    var out = [], prev = CAM0;
    for(var i=0;i<tr.length;i++){
      var k = tr[i], n = {t:k.t, e:k.e || "io"};
      n.x = k.x !== undefined ? k.x : prev.x; n.y = k.y !== undefined ? k.y : prev.y;
      n.z = k.z !== undefined ? k.z : prev.z; n.r = k.r !== undefined ? k.r : prev.r;
      out.push(n); prev = n;
    }
    return out;
  }
  function ease(e,p){ return e === "l" ? p : e === "i" ? easeIn(p) : e === "o" ? easeOut(p) : e === "cut" ? 0 : easeInOut(p); }
  function trackAt(tr,t){
    var a = tr[0]; if(t <= a.t) return a;
    for(var i=1;i<tr.length;i++){
      var b = tr[i];
      if(t < b.t){ var p = ease(b.e,(t-a.t)/(b.t-a.t)); return {x:lerp(a.x,b.x,p), y:lerp(a.y,b.y,p), z:lerp(a.z,b.z,p), r:lerp(a.r,b.r,p)}; }
      a = b;
    }
    return a;
  }
  // punch-in: fast in with overshoot, settle, hold, release
  function punch(p){
    if(p < .14) return 1.3*easeOut(p/.14);
    if(p < .32) return lerp(1.3,1,easeInOut((p-.14)/.18));
    if(p < .7) return 1;
    return 1-easeInOut((p-.7)/.3);
  }
  // keep the art covering the window: zoom >= 1 (more when rolled or skewed) and the look-at offset clamped to the slack.
  // Units: x in columns, y in rows, asp = row height / column width.
  function clampCam(x,y,z,r,sk,rows,asp){
    if(Math.abs(x) < 1e-4 && Math.abs(y) < 1e-4 && Math.abs(r) < 1e-4 && Math.abs(sk) < 1e-4 && z <= 1) return {x:0, y:0, z:1, r:0, sk:0};
    var W2 = COLS/2, H2 = rows*asp/2, a = r*Math.PI/180, ca = Math.cos(a), sa = Math.sin(a), ts = Math.tan(sk*Math.PI/180), mx = 0, my = 0;
    for(var s=-1;s<=1;s+=2){ // window corners pulled back into the art's space (inverse roll, then inverse skew)
      var u = ca*W2 + sa*s*H2, v = -sa*W2 + ca*s*H2; u -= v*ts;
      mx = Math.max(mx,Math.abs(u)); my = Math.max(my,Math.abs(v));
    }
    var m = .35; // a third of a cell of slack so subpixel rounding never shows an edge
    z = Math.max(z,1,(mx+m)/W2,(my+m)/H2);
    var lx = Math.max(0,W2-(mx+m)/z), ly = Math.max(0,H2-(my+m)/z);
    return {x:clamp(x,-lx,lx), y:clamp(y*asp,-ly,ly)/asp, z:z, r:r, sk:sk};
  }
  // flash safety (WCAG 2.3.1): at most two impact frames in any second, across every player
  var IMPACTS = [];
  function impactOk(){
    var now = root.performance && root.performance.now ? root.performance.now() : Date.now();
    while(IMPACTS.length && now-IMPACTS[0] >= 1000) IMPACTS.shift();
    if(IMPACTS.length >= 2) return false;
    IMPACTS.push(now); return true;
  }
  // persistent layers per <pre>: built once, never replaced per frame
  function layers(pre,band){
    var L = pre._tst;
    if(!L || !L.win || L.win.parentNode !== pre || L.bandEl.parentNode !== pre){
      pre.innerHTML = '<span class="tst-cam-win"><span class="tst-cam"></span><span class="tst-fx"></span></span><span class="tst-band"></span>';
      L = { win:pre.firstChild, bandEl:pre.lastChild, camKey:"" };
      L.cam = L.win.firstChild; L.fx = L.win.lastChild;
      pre._tst = L;
    }
    L.bandEl.hidden = !band;
    if(!band){ L.bandEl.innerHTML = ""; L.bandEl._h = ""; }
    return L;
  }

  function measure(pre){
    try{
      var probe = document.createElement("span");
      probe.textContent = rep("M",100);
      probe.style.cssText = "position:absolute;visibility:hidden;white-space:pre;font-size:100px;line-height:1;";
      pre.appendChild(probe);
      // layout width: unaffected by the CRT, modal-open or camera scale transforms (getBoundingClientRect is not)
      var w = probe.offsetWidth/10000;
      pre.removeChild(probe);
      return w > 0.3 && w < 1 ? w : 0;
    }catch(e){ return 0; }
  }
  // size the font so all 64 columns fit the screen's width; returns false while the box isn't laid out yet
  function fit(pre){
    var box = pre.parentNode; if(!box || !box.clientWidth) return false;
    var cs = root.getComputedStyle ? root.getComputedStyle(box) : null;
    var inner = box.clientWidth - (cs ? parseFloat(cs.paddingLeft)+parseFloat(cs.paddingRight) : 16);
    if(!(inner > 0)) return false;
    var ratio = pre._ratio || measure(pre);
    if(!ratio) return false;
    pre._ratio = ratio;
    var fs = Math.max(5.5, Math.min(pre._maxFont || 13.5, Math.floor((inner/(COLS*ratio))*10)/10));
    pre.style.fontSize = fs+"px";
    return true;
  }

  function play(pre,type,opts){
    opts = opts || {};
    var sc = SCENES[sceneKey(type,opts.meta)];
    var box = opts.box || pre.parentNode;
    var hasBand = sc.band !== false, rows = hasBand ? ART : ROWS, cues = sc.cues || [], track = normTrack(sc.cam);
    var g = new Grid(), st = {}, speed = opts.speed || 1, t = 0, cue = 0, raf = 0, last = 0, acc = 0, stopped = false;
    var tick = 0, idleSince = 0, IDLE_TICK = 50, IDLE_LIVE_MS = 12000;
    var glitchUntil = 0, nextIdleGlitch = 0, lastTyped = 0, lastTick = 0, screen = "", doneFired = false, fitted = false;
    var still = !!(opts.still || reduced);
    var timers = [], envs = [], lfx = [], slash = null;
    var L = HAS_DOM ? layers(pre,hasBand) : null;
    if(opts.maxFont) pre._maxFont = opts.maxFont;
    var ctx = { t:0, dt:50, st:st, meta:opts.meta||{}, dur:sc.dur, idle:false, still:false, screen:"", typed:0,
      sfx:function(n){ if(!still && !ctx.sim){ var A = audio(); if(A) A.play(n,{scene:true}); } } };
    var cap = capFor(sc,ctx.meta);
    function later(fn,ms){ var id = setTimeout(function(){ var k = timers.indexOf(id); if(k >= 0) timers.splice(k,1); fn(); },ms); timers.push(id); return id; }
    function clearTimers(){ for(var i=0;i<timers.length;i++) clearTimeout(timers[i]); timers.length = 0; }
    function aspect(){ return 1.14/(pre._ratio || 0.6); }
    function setScreen(cls){ if(cls === screen) return; if(screen) box.classList.remove(screen); screen = cls; if(cls) box.classList.add(cls); }
    function impact(ms){
      if(!impactOk()) return;
      // an inverted frame that is on screen when the main thread stalls (e.g. the game still compiling behind
      // the boot) stays up for the whole stall, so callers can veto impacts while the page is busy
      if(opts.impactOk && !opts.impactOk()) return;
      box.classList.remove("tst-impact"); void box.offsetWidth; box.classList.add("tst-impact");
      later(function(){ box.classList.remove("tst-impact"); },clamp(Math.round(ms/speed),70,160));
    }
    function fxEl(cls,html,ms,v){
      var el = document.createElement("span"); el.className = cls;
      if(html) el.innerHTML = html;
      if(v) el.style.setProperty(v,ms+"ms");
      L.fx.appendChild(el);
      // leave with the CSS animation, whose length follows live speed changes (--spd); the timer is a fallback
      // for when animationend never comes (hidden tab), long enough for the slowest speed (120/260)
      function rm(){ if(el.parentNode) el.parentNode.removeChild(el); }
      el.addEventListener("animationend",function(e){ if(e.target === el) rm(); });
      later(rm,Math.ceil(ms*260/120)+200);
      return el;
    }
    function fire(cu){
      if(cu.cause && cu.cause !== ctx.meta.cause) return;
      if(cu.notCause && cu.notCause === ctx.meta.cause) return;
      var A = audio();
      if(cu.sfx){ if(A) A.play(cu.sfx,{scene:true}); return; }
      if(cu.say){ if(A) A.say(cu.say,{force:true,meta:ctx.meta}); return; }
      if(cu.amb){ if(A) A.ambient(cu.amb); return; }
      if(still || !L) return; // reduced motion: sound only, no camera, no flashes
      if(cu.shake){ box.classList.remove("tst-shake"); void box.offsetWidth; box.classList.add("tst-shake"); later(function(){ box.classList.remove("tst-shake"); },cu.shake); }
      else if(cu.glitch){ glitchUntil = t + cu.glitch; box.classList.add("tst-glitch"); later(function(){ box.classList.remove("tst-glitch"); },cu.glitch); }
      else if(cu.whip){ envs.push({k:"whip", t0:cu.t, ms:cu.ms || 360, dir:cu.whip === "l" ? -1 : 1}); }
      else if(cu.zoom){ envs.push({k:"zoom", t0:cu.t, ms:cu.ms || 600, z:cu.zoom, fx:cu.fx, fy:cu.fy}); }
      else if(cu.slam){ envs.push({k:"slam", t0:cu.t, ms:cu.ms || 450, z:cu.slam, fx:cu.fx, fy:cu.fy}); }
      else if(cu.pulse){ envs.push({k:"pulse", t0:cu.t, ms:cu.ms || 300, a:cu.pulse}); }
      else if(cu.impact){ impact(cu.impact); }
      else if(cu.lines){ lfx.push({k:cu.lines, t0:cu.t, ms:cu.ms || 600, fx:cu.fx, fy:cu.fy, dir:cu.dir || -1, n:cu.n}); }
      else if(cu.slash){
        var snap = new Grid(); snap.copyFrom(g); // the last frame on screen is the shot being cut away from
        slash = {t0:cu.t, ms:cu.slash, snap:snap};
        fxEl("tst-slash","",cu.slash,"--slash-ms");
      }
      else if(cu.card){
        var old = L.fx.querySelector(".tst-card"); if(old) old.parentNode.removeChild(old);
        var bw = blockWord(cu.card), ms = cu.ms || 1300;
        fxEl("tst-card "+(cu.k || (cap && cap.k) || "k-w"),
          '<span class="tst-card-w" style="font-size:'+Math.min(1.45,58/bw[0].length).toFixed(2)+'em">'+esc(bw.join("\n").replace(/#/g,"\u2588"))+"</span>",ms,"--card-ms");
      }
      else if(cu.letterbox !== undefined){ L.fx.classList.toggle("tst-lb",!!cu.letterbox); }
    }
    // camera = keyframe track + idle drift + effect envelopes, clamped so the art always covers the window
    function camAt(tt){
      var b = track ? trackAt(track,tt) : CAM0, x = b.x, y = b.y, z = b.z, r = b.r, sk = 0;
      if(tt > sc.dur && sc.drift){
        var d = sc.drift, w = (tt-sc.dur)/(d.p || 9000)*Math.PI*2;
        x += (d.x||0)*Math.sin(w); y += (d.y||0)*Math.sin(w*.7); z += (d.z||0)*(1-Math.cos(w))/2;
      }
      for(var i=envs.length-1;i>=0;i--){
        var e = envs[i], p = (tt-e.t0)/e.ms;
        if(p >= 1){ envs.splice(i,1); continue; }
        if(p < 0) continue;
        if(e.k === "whip"){ var s = Math.sin(Math.PI*p); x += e.dir*18*(p < .5 ? easeIn(p*2) : -(1-easeOut((p-.5)*2))); sk += e.dir*11*s; z *= 1+.14*s; }
        else if(e.k === "zoom"){ var w2 = punch(p); z *= 1+(e.z-1)*w2; if(e.fx !== undefined){ x = lerp(x,e.fx+.5-COLS/2,w2*.6); y = lerp(y,e.fy+.5-rows/2,w2*.6); } }
        else if(e.k === "slam"){
          var q = Math.pow(1-clamp(p/.5,0,1),3);
          z *= 1+(e.z-1)*q+.03*Math.sin(Math.PI*clamp((p-.5)/.5,0,1));
          if(e.fx !== undefined){ x = lerp(x,e.fx+.5-COLS/2,q); y = lerp(y,e.fy+.5-rows/2,q); }
        }
        else if(e.k === "pulse"){ z *= 1+e.a*(p < .22 ? easeOut(p/.22) : 1-easeInOut((p-.22)/.78)); }
      }
      return clampCam(x,y,z,r,sk,rows,aspect());
    }
    function applyCam(c){
      if(!L || still) return;
      var asp = aspect(), a = c.r*Math.PI/180, ca = Math.cos(a), sa = Math.sin(a), ts = Math.tan(c.sk*Math.PI/180);
      var kx = c.x + c.y*asp*ts, ky = c.y*asp;            // skew the look-at offset (column units)...
      var tx = -c.z*(ca*kx - sa*ky), ty = -c.z*(sa*kx + ca*ky); // ...roll and scale it, then move it to the centre
      var v = [(tx/COLS*100).toFixed(3), (ty/asp/rows*100).toFixed(3), c.z.toFixed(4), c.r.toFixed(3), c.sk.toFixed(3)], key = v.join("|");
      if(key === L.camKey) return;
      L.camKey = key;
      var s = L.cam.style;
      s.setProperty("--cx",v[0]); s.setProperty("--cy",v[1]); s.setProperty("--cz",v[2]); s.setProperty("--rot",v[3]); s.setProperty("--skew",v[4]);
    }
    function resetCam(){
      if(!L) return;
      ["--cx","--cy","--cz","--rot","--skew"].forEach(function(n){ L.cam.style.removeProperty(n); });
      L.camKey = "";
    }
    function clearFx(){
      envs.length = 0; lfx.length = 0; slash = null; glitchUntil = 0;
      box.classList.remove("tst-glitch","tst-shake","tst-impact");
      if(L){ L.fx.innerHTML = ""; L.fx.classList.remove("tst-lb"); }
    }
    function post(){
      var asp = aspect();
      for(var i=lfx.length-1;i>=0;i--){
        var e = lfx[i], p = (t-e.t0)/e.ms;
        if(p >= 1){ lfx.splice(i,1); continue; }
        if(p < 0) continue;
        if(e.k === "radial") radialLines(g,e,p,rows,asp); else speedLines(g,e,p,(t-e.t0)/1000,rows);
      }
      var s = 0, dir = 1;
      for(var j=0;j<envs.length;j++){
        var w = envs[j]; if(w.k !== "whip") continue;
        var q = (t-w.t0)/w.ms; if(q > 0 && q < 1){ var sv = Math.pow(Math.sin(Math.PI*q),1.2); if(sv > s){ s = sv; dir = -w.dir; } }
      }
      if(s > .06) smear(g,s,dir,rows);
      if(slash){ var sp = (t-slash.t0)/slash.ms; if(sp >= 1) slash = null; else slashWipe(g,slash.snap,Math.max(0,sp),rows); }
    }
    function put(el,html){ if(el._h !== html){ el._h = html; el.innerHTML = html; } }
    function render(){
      g.clear(); ctx.t = t; ctx.idle = t > sc.dur; ctx.screen = "";
      sc.draw(g,ctx);
      if(!still) post();
      if(hasBand){
        var typed = caption(g,cap,t,sc.dur,{still:still});
        if(!still && t <= sc.dur && typed > lastTyped && performance.now()-lastTick > 45){ lastTick = performance.now(); var A = audio(); if(A) A.play("key",{scene:true}); }
        lastTyped = typed;
      } else if(ctx.typed !== undefined && !still){
        if(ctx.typed > lastTyped && performance.now()-lastTick > 38){ lastTick = performance.now(); var A2 = audio(); if(A2) A2.play("key",{scene:true}); }
        lastTyped = ctx.typed;
      }
      if(t < glitchUntil) glitchPost(g,rows);
      setScreen(ctx.screen || "");
      if(L){ put(L.cam,g.toHTML(0,rows)); if(hasBand) put(L.bandEl,g.toHTML(ART,ROWS)); }
    }
    function frame(now){
      if(stopped) return;
      if(!fitted && HAS_DOM) fitted = fit(pre);
      var dt = Math.min(250, now-(last||now)); last = now; // slow frames still keep pace; a long tab-away doesn't skip the show
      t += dt*speed; acc += dt;
      while(cue < cues.length && cues[cue].t <= t){ fire(cues[cue]); cue++; }
      if(sc.idleGlitch && t > sc.dur){
        if(!nextIdleGlitch) nextIdleGlitch = t + sc.idleGlitch;
        if(t >= nextIdleGlitch){ nextIdleGlitch = t + sc.idleGlitch*rnd(.8,1.3); glitchUntil = t + 160; }
      }
      if(acc >= 50){ ctx.dt = acc*speed; acc = 0; render(); }
      applyCam(camAt(t));
      if(t >= sc.dur && !doneFired){ doneFired = true; if(opts.onDone) opts.onDone(); }
      if(t > sc.dur){
        if(!idleSince) idleSince = now;
        if(!sc.keepAlive && now-idleSince >= IDLE_LIVE_MS){ settle(); return; }
      }
      next();
    }
    // v1.20: after the timeline, the idle loop ticks at the 20 fps it draws at instead of every display frame, and an
    // ending settles on its last frame after IDLE_LIVE_MS, so an ending left open stops costing GPU. Replay restarts it.
    function next(){
      if(t > sc.dur) tick = setTimeout(function(){ tick = 0; frame(performance.now()); },IDLE_TICK);
      else raf = requestAnimationFrame(frame);
    }
    function settle(){
      clearTimers(); clearFx(); render();
      if(HAS_DOM) box.classList.remove("tst-live");
    }
    function start(){
      stopped = false; t = 0; cue = 0; last = 0; acc = 0; lastTyped = 0; nextIdleGlitch = 0; doneFired = false; idleSince = 0;
      for(var k in st) delete st[k];
      clearTimers(); clearFx(); resetCam();
      if(HAS_DOM){ fitted = fit(pre); box.style.setProperty("--spd",String(speed)); box.classList.toggle("tst-live",!still); }
      if(still){
        // reduced motion: simulate quietly to the end, draw one still frame, play only the key cues
        ctx.sim = true; ctx.still = false;
        for(var tt=0; tt<=sc.dur; tt+=50){ g.clear(); ctx.t = tt; ctx.dt = 50; ctx.idle = false; sc.draw(g,ctx); }
        ctx.sim = false; ctx.still = true; t = sc.dur; ctx.t = t;
        render();
        if(HAS_DOM && !fitted){ var tries = 0; (function refit(){ if(stopped) return; fitted = fit(pre); if(!fitted && tries++ < 40) requestAnimationFrame(refit); })(); }
        cues.forEach(function(cu){ if(cu.key) fire(cu); });
        if(opts.onDone) later(opts.onDone,0);
        return;
      }
      if(opts.crt !== false){ pre.classList.remove("tst-crt-on"); void pre.offsetWidth; pre.classList.add("tst-crt-on"); }
      while(cue < cues.length && cues[cue].t <= 0){ fire(cues[cue]); cue++; } // t:0 effects land on the first frame
      applyCam(camAt(0));
      render();
      raf = requestAnimationFrame(frame);
    }
    function stop(){ stopped = true; cancelAnimationFrame(raf); clearTimeout(tick); tick = 0; clearTimers(); clearFx(); resetCam(); setScreen(""); if(HAS_DOM) box.classList.remove("tst-live"); var A = audio(); if(A) A.stopAmbient(); }
    var onResize = function(){ if(HAS_DOM) fitted = fit(pre); };
    if(HAS_DOM) root.addEventListener("resize",onResize);
    start();
    return {
      stop: function(){ stop(); if(HAS_DOM) root.removeEventListener("resize",onResize); },
      replay: function(){ stop(); var A = audio(); if(A) A.hush(); start(); },
      skip: function(){
        if(still || t >= sc.dur) return;
        for(; cue < cues.length; cue++){ if(cues[cue].key) fire(cues[cue]); }
        clearTimers(); clearFx();
        // fast-forward state so particle systems are populated
        ctx.sim = true;
        while(t < sc.dur){ t += 50; ctx.dt = 50; g.clear(); ctx.t = t; ctx.idle = false; sc.draw(g,ctx); }
        ctx.sim = false;
        t = sc.dur + 1; render(); applyCam(camAt(t));
      },
      setSpeed: function(v){ speed = v > 0 ? v : 1; if(HAS_DOM) box.style.setProperty("--spd",String(speed)); },
      isDone: function(){ return t >= sc.dur; },
      summary: summaryFor(type,ctx.meta)
    };
  }

  // text-only frame render for tests and fallbacks
  function renderText(type,tms,meta){
    var sc = SCENES[sceneKey(type,meta)]; var g = new Grid(), st = {};
    var ctx = { t:0, dt:50, st:st, meta:meta||{}, dur:sc.dur, idle:false, still:false, sim:true, sfx:function(){} };
    var cap = capFor(sc,ctx.meta);
    for(var t=0;t<=tms;t+=50){ g.clear(); ctx.t = t; ctx.idle = t > sc.dur; ctx.screen = ""; sc.draw(g,ctx); if(sc.band !== false) caption(g,cap,t,sc.dur,{still:false}); }
    return {text:g.toText(), html:g.toHTML(), screen:ctx.screen||""};
  }

  root.TST_SCENES = { play:play, renderText:renderText, SCENES:SCENES, COLS:COLS, ROWS:ROWS, reduced:reduced, fit:fit, summaryFor:summaryFor };
})(typeof window !== "undefined" ? window : globalThis);
