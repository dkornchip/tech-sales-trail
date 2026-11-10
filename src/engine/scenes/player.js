import { root } from "../root.js";
import { capFor, caption, summaryFor } from "./captions.js";
import { ART, COLS, Grid, HAS_DOM, ROWS, clamp, easeIn, easeInOut, easeOut, esc, lerp, mod, pick, rep, rnd } from "./core.js";
import { blockWord } from "./defs/boot.js";
import { sceneKey } from "./desk.js";
import { SCENES } from "./registry.js";
import { fxRandom } from "../../fxrng.js";

/* ======================================================================
   PLAYER
   ====================================================================== */
export var reduced = HAS_DOM && root.matchMedia ? root.matchMedia("(prefers-reduced-motion: reduce)").matches : false;
export function audio(){ return root.TST_AUDIO || null; }

export function glitchPost(g,rows){
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
export function isBlank(g,i){ return g.ch[i] === " " && !g.cl[i]; }
// focus lines: rays from the frame edge toward (cx,cy), only through empty cells, dim
export function rayChar(ca,sa){ var ax = Math.abs(ca), ay = Math.abs(sa); if(ay < ax*.42) return "-"; if(ay > ax*2.4) return "|"; return ca*sa > 0 ? "\\" : "/"; }
export function radialLines(g,e,p,rows,asp){
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
export function speedLines(g,e,p,el,rows){
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
export function smear(g,s,dir,rows){
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
export function slashWipe(g,snap,p,rows){
  var uc = -3 + (COLS+rows+6)*p;
  for(var y=0;y<rows;y++) for(var x=0;x<COLS;x++){
    var i = y*COLS+x, d = x+y-uc;
    if(d > 1.5){ g.ch[i] = snap.ch[i]; g.cl[i] = snap.cl[i]; }
    else if(d > -1.5){ g.ch[i] = "/"; g.cl[i] = Math.abs(d) < .75 ? "k-w k-bold" : "k-c"; }
  }
}

/* ---------- camera ---------- */
export var CAM0 = {t:0, x:0, y:0, z:1, r:0};
export function normTrack(tr){
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
export function ease(e,p){ return e === "l" ? p : e === "i" ? easeIn(p) : e === "o" ? easeOut(p) : e === "cut" ? 0 : easeInOut(p); }
export function trackAt(tr,t){
  var a = tr[0]; if(t <= a.t) return a;
  for(var i=1;i<tr.length;i++){
    var b = tr[i];
    if(t < b.t){ var p = ease(b.e,(t-a.t)/(b.t-a.t)); return {x:lerp(a.x,b.x,p), y:lerp(a.y,b.y,p), z:lerp(a.z,b.z,p), r:lerp(a.r,b.r,p)}; }
    a = b;
  }
  return a;
}
// punch-in: fast in with overshoot, settle, hold, release
export function punch(p){
  if(p < .14) return 1.3*easeOut(p/.14);
  if(p < .32) return lerp(1.3,1,easeInOut((p-.14)/.18));
  if(p < .7) return 1;
  return 1-easeInOut((p-.7)/.3);
}
// keep the art covering the window: zoom >= 1 (more when rolled or skewed) and the look-at offset clamped to the slack.
// Units: x in columns, y in rows, asp = row height / column width.
export function clampCam(x,y,z,r,sk,rows,asp){
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
export var IMPACTS = [];
export function impactOk(){
  var now = root.performance && root.performance.now ? root.performance.now() : Date.now();
  while(IMPACTS.length && now-IMPACTS[0] >= 1000) IMPACTS.shift();
  if(IMPACTS.length >= 2) return false;
  IMPACTS.push(now); return true;
}
// persistent layers per <pre>: built once, never replaced per frame
export function layers(pre,band){
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

export function measure(pre){
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
// v2.0: the mono face is bundled in the page but still takes a moment to decode, and until it has, layout uses
// the fallback's glyph width. True while a face the <pre> asks for is on its way (and asks for it, if nothing has).
export function faceLoading(pre){
  try{
    var f = document.fonts, font = "12px "+root.getComputedStyle(pre).fontFamily;
    if(!f || !f.check || f.check(font)) return false;
    f.load(font).then(null,function(){});
    return f.status === "loading";
  }catch(e){ return false; }
}
// size the font so all 64 columns fit the screen's width; returns false while the box isn't laid out yet,
// or while the face is still loading (v2.0: that fit uses the fallback's ratio for now and does not keep it)
export function fit(pre){
  var box = pre.parentNode; if(!box || !box.clientWidth) return false;
  var cs = root.getComputedStyle ? root.getComputedStyle(box) : null;
  var inner = box.clientWidth - (cs ? parseFloat(cs.paddingLeft)+parseFloat(cs.paddingRight) : 16);
  if(!(inner > 0)) return false;
  var loading = !pre._ratio && faceLoading(pre);
  var ratio = pre._ratio || measure(pre);
  if(!ratio) return false;
  if(!loading) pre._ratio = ratio;
  var fs = Math.max(5.5, Math.min(pre._maxFont || 13.5, Math.floor((inner/(COLS*ratio))*10)/10));
  pre.style.fontSize = fs+"px";
  return !loading;
}

export function play(pre,type,opts){
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
