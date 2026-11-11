import { bandOf, render } from "../copy/engine.js";
import { LOG } from "../copy/log.js";
import { QUARTER_WEEKS } from "./constants.js";
import { tally } from "./story.js";
import { idGen, now } from "./util.js";

// One entry in the activity log. `tag` names the line (a key of LOG in src/copy/log.js) and `params` is what the line
// needs: counts, amounts, an account name. The words are chosen once, here, and stored as `msg`, so a saved log reads
// the same forever; `tag` and `d` (the params) are what sound and later logic read, never the words.
// wk is the week the line was written in, dl its stat changes as the interface shows them, v which wording was used
// (so the next one differs). Entries from saves made before tags existed have msg and kind only.
// Choosing the wording rolls no dice: it is a hash of the run, the tag and how often the tag has been logged.
export const log=(state,tag,params,kind="info")=>{
  const line=LOG[tag];
  let n=0,last=-1;
  for(const e of state.logs){ if(e.tag===tag){ if(n===0 && typeof e.v==="number") last=e.v; n++; } }
  const week=((state.week-1)%QUARTER_WEEKS)+1;
  const r=line ? render(line,params||{},{week,band:bandOf(week),n},state.runId+"|"+tag+"|"+n,last) : {text:String(tag),dl:"",v:-1};
  const entry={id:idGen(),t:now(),msg:r.text,kind,tag,wk:state.week};
  if(r.dl) entry.dl=r.dl;
  if(r.v>=0) entry.v=r.v;
  if(params && Object.keys(params).length) entry.d=params;
  const next={...state,logs:[entry,...state.logs].slice(0,220)};
  // the run's story (game/story.js) is kept here, where every line passes; a run without one stays without
  const story=tally(state.story,tag,params);
  if(story!==state.story) next.story=story;
  return next;
};

// v1.15: caffeine and stress can end a run. Numbers tuned with the Monte Carlo sim.
export const isRunOver=(st)=>!!(st.fired||st.burnedOut||st.win||st.missed||st.repo);
