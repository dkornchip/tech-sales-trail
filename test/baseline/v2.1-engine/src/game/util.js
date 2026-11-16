import { QUARTER_WEEKS } from "./constants.js";

export const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
// The dice are in rng.js (a seeded stream carried in the run); the rules still ask for them by these names.
export { rand, randi, choice } from "./rng.js";
// FIX: negative cash used to render as "$-1,500". en-US grouping everywhere: logs, badges and the big-close PA regex.
export const money=(n)=>{const r=Math.round(n);return (r<0?"-$":"$")+Math.abs(r).toLocaleString("en-US");};
export const pct=(p)=>Math.round(p*100);
// token counts, the way an invoice prints them: 1.2B, 3.4M, 12K
export const fmtTok=(n)=>n>=1e9 ? `${(n/1e9).toFixed(1)}B` : n>=1e6 ? `${(n/1e6).toFixed(1)}M` : n>=1e3 ? `${Math.round(n/1e3)}K` : String(Math.round(n||0));
export const now=()=>new Date().toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"});
// An id is a counter and a scrap of the clock. The counter restarts with the page, so after a save is read back
// it is moved past every id in that save (idsPast): a new deal or log line can then never repeat an old id.
let idCount=0;
export const idGen=()=> (++idCount).toString(36)+"-"+Date.now().toString(36).slice(-4);
export const idsPast=(ids)=>{
  for(const id of ids){
    const n=typeof id==="string" ? parseInt(id.split("-")[0],36) : NaN;
    if(Number.isFinite(n) && n>idCount && n<1e9) idCount=n;
  }
};


export const getQuarterInfo=(week)=>{
  const quarter=Math.floor((week-1)/QUARTER_WEEKS)+1;
  const weekInQuarter=((week-1)%QUARTER_WEEKS)+1;
  return{quarter,weekInQuarter};
};
