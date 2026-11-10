import { QUARTER_WEEKS } from "./constants.js";

export const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
export const rand=(a,b)=>Math.random()*(b-a)+a;
export const randi=(a,b)=>Math.floor(rand(a,b+1));
export const choice=(arr)=>arr[Math.floor(Math.random()*arr.length)];
// FIX: negative cash used to render as "$-1,500". en-US grouping everywhere: logs, badges and the big-close PA regex.
export const money=(n)=>{const r=Math.round(n);return (r<0?"-$":"$")+Math.abs(r).toLocaleString("en-US");};
export const pct=(p)=>Math.round(p*100);
export const now=()=>new Date().toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"});
export const idGen=(()=>{let i=0;return()=> (++i).toString(36)+"-"+Date.now().toString(36).slice(-4)})();


export const getQuarterInfo=(week)=>{
  const quarter=Math.floor((week-1)/QUARTER_WEEKS)+1;
  const weekInQuarter=((week-1)%QUARTER_WEEKS)+1;
  return{quarter,weekInQuarter};
};
