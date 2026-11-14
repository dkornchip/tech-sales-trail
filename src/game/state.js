import { newClaink, sanitizeClaink } from "./claink.js";
import { AUTOSAVE_KEY, LEGACY_KEYS, MAX_QUARTERS, SAVE_KEY } from "./constants.js";
import { newStory, sanitizeStory } from "./story.js";
import { newRng, sanitizeRng } from "./rng.js";
import { idGen, idsPast } from "./util.js";

// FIX: page refresh now resumes the autosave (most recent state); the Load button prefers the manual save.
export const readStoredRun=(preferAutosave=true)=>{
  const keys=preferAutosave
    ?[AUTOSAVE_KEY, SAVE_KEY, ...LEGACY_KEYS]
    :[SAVE_KEY, AUTOSAVE_KEY, ...LEGACY_KEYS];
  for(const k of keys){
    try{
      const v=localStorage.getItem(k);
      if(v) return v;
    }catch{}
  }
  return null;
};

// Single merge path for restored runs (was duplicated between initial load and the Load button).
export const mergeSaved=(parsed)=>{
  const base=newGame();
  // ids handed out from here on must not repeat one the save already holds
  idsPast([...(Array.isArray(parsed.deals) ? parsed.deals : []),...(Array.isArray(parsed.logs) ? parsed.logs : [])].map(x=>x && x.id));
  return{
    ...base,
    ...parsed,
    quota: base.quota, // force current difficulty
    skills:{...base.skills,...(parsed.skills||{})},
    modifiers:{...base.modifiers,...(parsed.modifiers||{})},
    used:{...base.used,...(parsed.used||{})},
    repo:!!parsed.repo,
    repoWarned:!!parsed.repoWarned,
    perfWarnings:Number.isFinite(parsed.perfWarnings)?parsed.perfWarnings:0,
    // v1.15 fields; v1.14 saves don't have them
    coffeesThisWeek:Number.isFinite(parsed.coffeesThisWeek)?Math.max(0,Math.floor(parsed.coffeesThisWeek)):0,
    stressWarned:!!parsed.stressWarned,
    trip:typeof parsed.trip==="string"?parsed.trip:null,
    hygieneShield:!!parsed.hygieneShield,
    claink:sanitizeClaink(parsed.claink,parsed.week), // v1.19; also maps the v1.16 prototype's save shape
    endCause:typeof parsed.endCause==="string"?parsed.endCause:null,
    story:sanitizeStory(parsed.story), // v2.0; null for older saves, whose history nobody recorded
    rng:sanitizeRng(parsed.rng) // v2.1: the run's dice; a save from before them gets new ones
  };
};



export const newGame=()=>({
  week:1,
  maxQuarters:MAX_QUARTERS,
  quartersSurvived:0,
  slots:5,
  maxSlots:5,
  restedThisWeek:false,
  energy:95,
  stress:28,
  skills:{prospect:45,discovery:35,demo:30,negotiate:25},
  reputation:40,
  manager:50,
  product:60,
  cash:1200,
  quota:160000,
  closedWon:0,
  closedQuarter:0,
  discounts:0,
  pipeline:0,
  meetings:0,
  deals:[],
  logs:[],
  pip:false,
  pipLevel:0,
  fired:false,
  burnedOut:false,
  win:false,
  missed:false,
  repo:false,
  repoWarned:false,
  modifiers:{conversion:0,discount:0,expiresIn:0},
  achievements:[],
  perfWarnings:0,
  coffeesThisWeek:0,
  stressWarned:false,
  hygieneShield:false,
  trip:null,
  claink:newClaink(),
  endCause:null,
  story:newStory(),
  runId:idGen(),
  rng:newRng(),
  used:{
    prospect:false,
    cadence:false,
    discovery:false,
    demo:false,
    propose:false,
    close:false,
    network:false,
    recharge:false,
    crm:false
  }
});
