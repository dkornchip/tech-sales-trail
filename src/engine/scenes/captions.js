import { ART, COLS, ROWS, blink, clamp, rep } from "./core.js";
import { sceneKey } from "./desk.js";
import { SCENES } from "./registry.js";

/* ---------- caption band ---------- */
export function caption(g,c,t,dur,run){
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
export function capFor(sc,meta){
  var base = sc.cap; if(!base) return base;
  var o = sc.capBy && meta && sc.capBy[meta.cause], out = {}, k;
  for(k in base) out[k] = base[k];
  if(o) for(k in o) out[k] = o[k];
  if(typeof out.a === "function") out.a = out.a(meta||{});
  if(typeof out.b === "function") out.b = out.b(meta||{});
  return out;
}
// one-line description (aria-label, reduced-motion note); sc.summaryBy[meta.cause] wins over sc.summary
export function summaryFor(type,meta){
  var sc = SCENES[sceneKey(type,meta)]; if(!sc) return "";
  return (sc.summaryBy && meta && sc.summaryBy[meta.cause]) || sc.summary || "";
}
