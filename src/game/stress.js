import { isRunOver, log } from "./log.js";
import { clamp } from "./util.js";

export const STRESS_WARN=70;            // 🫀 warning, once per week
export const STRESS_DANGER=80;          // end-of-week burnout roll starts here
export const DANGER_RATE=0.03;          // chance per point above 75
export const CRASH_PER_SHOT=13;         // end-of-week stress per Quad Shot drunk that week
// n = shots already drunk this week, so these describe the NEXT shot
export const COFFEE_ENERGY=[18,16,15,14,12]; // v1.17: fade per extra shot halved
export const coffeeEnergy=(n)=>COFFEE_ENERGY[clamp(Math.floor(n)||0,0,COFFEE_ENERGY.length-1)];
export const coffeeStress=(n)=>12+3*n;        // v1.17: was 12+6n
export const rechargeRelief=(n)=>Math.max(0,12-2*n); // caffeine in the system blunts the Recharge (v1.17: was 4 per shot)
export const RECHARGE_ENERGY=35;
export const RECHARGE_LUCK=0.5;         // v1.18: each Recharge rolls a 0-50% bonus on both energy and relief
export const TRIP_AT=0.40;              // a roll above this and your manager signs off a trip (the destinations: TRIPS in src/copy/names.js)
export const rechargeMax=(base)=>base+Math.round(base*RECHARGE_LUCK);
export const coffeeRisk=(n)=>n<2?0:n===2?0.20:n===3?0.45:Math.min(0.95,0.75+0.10*(n-4)); // palpitations from shot 3
export const checkBurnout=(state)=>{
  if(!state || isRunOver(state))return state; // an ending already landed; keep its priority
  if(state.stress>=100){
    return log({...state,burnedOut:true,endCause:state.endCause||"stress"},"end.meltdown.stress",null,"bad");
  }
  if(state.stress>=STRESS_WARN && !state.stressWarned){
    return log({...state,stressWarned:true},"stress.warn",{stress:Math.round(state.stress)},"warn");
  }
  return state;
};
