import { idGen, now } from "./util.js";

export const log=(state,msg,kind="info")=>{
  const entry={id:idGen(),t:now(),msg,kind};
  return{...state,logs:[entry,...state.logs].slice(0,220)};
};

// v1.15: caffeine and stress can end a run. Numbers tuned with the Monte Carlo sim.
export const isRunOver=(st)=>!!(st.fired||st.burnedOut||st.win||st.missed||st.repo);
