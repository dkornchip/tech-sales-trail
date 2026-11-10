import "./defs/club.js";
import "./defs/fired.js";
import "./defs/ascension.js";
import "./defs/meltdown.js";
import "./defs/missed.js";
import "./defs/repo.js";
import "./defs/boot.js";
import { root } from "../root.js";
import { capFor, caption, summaryFor } from "./captions.js";
import { COLS, Grid, ROWS } from "./core.js";
import { sceneKey } from "./desk.js";
import { fit, play, reduced } from "./player.js";
import { SCENES } from "./registry.js";

// text-only frame render for tests and fallbacks
export function renderText(type,tms,meta){
  var sc = SCENES[sceneKey(type,meta)]; var g = new Grid(), st = {};
  var ctx = { t:0, dt:50, st:st, meta:meta||{}, dur:sc.dur, idle:false, still:false, sim:true, sfx:function(){} };
  var cap = capFor(sc,ctx.meta);
  for(var t=0;t<=tms;t+=50){ g.clear(); ctx.t = t; ctx.idle = t > sc.dur; ctx.screen = ""; sc.draw(g,ctx); if(sc.band !== false) caption(g,cap,t,sc.dur,{still:false}); }
  return {text:g.toText(), html:g.toHTML(), screen:ctx.screen||""};
}

root.TST_SCENES = { play:play, renderText:renderText, SCENES:SCENES, COLS:COLS, ROWS:ROWS, reduced:reduced, fit:fit, summaryFor:summaryFor };
