import { LOG } from "../copy/log.js";
import { idGen, now } from "./util.js";

// One entry in the activity log. `tag` names the line (a key of LOG in src/copy/log.js) and `params` is what the line
// needs: counts, amounts, an account name. The words are built once, here, and stored as `msg`, so a saved log reads
// the same forever; `tag` and `d` (the params) are what sound and later logic read, never the words.
// wk is the week the line was written in. Entries from saves made before tags existed have msg and kind only.
export const log=(state,tag,params,kind="info")=>{
  const line=LOG[tag];
  const entry={id:idGen(),t:now(),msg:line ? line(params||{}) : String(tag),kind,tag,wk:state.week};
  if(params && Object.keys(params).length) entry.d=params;
  return{...state,logs:[entry,...state.logs].slice(0,220)};
};

// v1.15: caffeine and stress can end a run. Numbers tuned with the Monte Carlo sim.
export const isRunOver=(st)=>!!(st.fired||st.burnedOut||st.win||st.missed||st.repo);
