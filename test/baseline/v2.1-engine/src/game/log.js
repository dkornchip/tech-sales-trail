import { bandOf, render } from "../copy/engine.js";
import { LOG } from "../copy/log.js";
import { QUARTER_WEEKS } from "./constants.js";
import { tally } from "./story.js";
import { idGen, now } from "./util.js";

// One entry in the activity log. `tag` names the line (a key of LOG in src/copy/log.js) and `params` is what the line
// needs: counts, amounts, an account name. The words are chosen once, here, and stored as `msg`, so a saved log reads
// the same forever; `tag` and `d` (the params) are what sound and later logic read, never the words.
// wk is the week the line was written in, dl its stat changes as the interface shows them. Entries from saves made
// before tags existed have msg and kind only.
// Choosing the wording rolls no dice: it is a hash of the run, the tag and how often the tag has been logged
// (state.said), and it never repeats the sentence this tag said last (src/copy/engine.js).
// The meters a line can report a change to.
const FX_KEYS=["energy","stress","manager","reputation","product","cash"];
// The meters as they stand, to measure a change against later (the rules change a state in place while they build it).
export const snap=(s)=>({energy:s.energy,stress:s.stress,manager:s.manager,reputation:s.reputation,product:s.product,cash:s.cash});
// What actually happened to the meters between two moments, in the whole numbers the interface shows. A meter that
// was already at its limit moves by less than the rule says, and this is what says so: {manager:-3,stress:6}.
export const fxOf=(before,after,keys=FX_KEYS)=>{
  const out={};
  for(const k of keys){ const d=Math.round(after[k])-Math.round(before[k]); if(d) out[k]=d; }
  return out;
};

// before (optional): the meters before whatever this line reports (snap). The line then carries what really
// changed, as params.fx, limited to `keys` when given.
export const log=(state,tag,params,kind="info",before=null,keys=undefined)=>{
  if(before){ const fx=fxOf(before,state,keys); if(Object.keys(fx).length) params={...(params||{}),fx}; }
  const line=LOG[tag];
  // how often this line has been written in this run (kept by the run, not counted from the log, which is capped),
  // and what it said last time, if the log still holds it: the same sentence is not said twice running
  const said=state.said && typeof state.said==="object" ? state.said : {};
  const n=Number.isFinite(said[tag]) ? said[tag] : 0;
  let lastText=null;
  for(const e of state.logs){ if(e.tag===tag){ lastText=e.msg; break; } }
  // the line that opens a week speaks for the week it announces, not the one that is ending
  const at=tag==="week.next" && params && Number.isFinite(params.week) ? params.week : state.week;
  const week=((at-1)%QUARTER_WEEKS)+1;
  // which variant: a hash salted with the run's own seed, so the same seed and moves read the same, and no dice are rolled
  const salt=state.rng && Number.isFinite(state.rng.seed) ? state.rng.seed : state.runId;
  const r=line ? render(line,params||{},{week,band:bandOf(week),n},salt+"|"+tag+"|"+n,lastText) : {text:String(tag),dl:""};
  const entry={id:idGen(),t:now(),msg:r.text,kind,tag,wk:state.week};
  if(r.dl) entry.dl=r.dl;
  if(params && Object.keys(params).length) entry.d=params;
  const next={...state,logs:[entry,...state.logs].slice(0,220),said:{...said,[tag]:n+1}};
  // the run's story (game/story.js) is kept here, where every line passes; a run without one stays without
  const story=tally(state.story,tag,params);
  if(story!==state.story) next.story=story;
  return next;
};

// v1.15: caffeine and stress can end a run. Numbers tuned with the Monte Carlo sim.
export const isRunOver=(st)=>!!(st.fired||st.burnedOut||st.win||st.missed||st.repo);
