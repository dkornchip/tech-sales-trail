import { ACHIEVEMENTS } from "../copy/names.js";
import { newClaink, sanitizeClaink } from "./claink.js";
import { MAX_QUARTERS, MOODS, QUARTER_WEEKS } from "./constants.js";
import { legacyEffects, sanitizeEffects } from "./effects.js";
import { EVENTS } from "./events.js";
import { newStory, sanitizeStory } from "./story.js";
import { newRng, sanitizeRng } from "./rng.js";
import { idGen, idsPast } from "./util.js";

// The choices a save was waiting on: only ones the rules know, in order, and none on a finished run.
export const sanitizePending=(raw,over)=>{
  if(over || !Array.isArray(raw)) return [];
  const out=[];
  for(const p of raw.slice(0,16)){
    if(out.length>=4) break;
    if(!p || typeof p!=="object" || typeof p.id!=="string" || !Object.prototype.hasOwnProperty.call(EVENTS,p.id)) continue;
    const params=p.params && typeof p.params==="object" && !Array.isArray(p.params) ? p.params : null;
    const clean={};
    if(params){
      if(typeof params.account==="string") clean.account=params.account.slice(0,60);
      if(typeof params.miracle==="boolean") clean.miracle=params.miracle;
    }
    out.push(Object.keys(clean).length ? {id:p.id,params:clean} : {id:p.id});
  }
  return out;
};

// ---- reading a run back ----
// A save is user data. Nothing in it is trusted: every field of the run is rebuilt here from what the save holds,
// by name, with numbers in range, lists that are lists and text that is short plain text (the interface only ever
// renders text as text). A field the save does not have, or has wrongly, gets the value a new run would have. A
// field this version does not know is dropped. Nothing is invented: no event, no achievement, no history.
const num=(v,lo,hi,dflt)=>(typeof v==="number" && Number.isFinite(v) ? Math.max(lo,Math.min(hi,v)) : dflt);
const int=(v,lo,hi,dflt)=>(typeof v==="number" && Number.isFinite(v) ? Math.max(lo,Math.min(hi,Math.floor(v))) : dflt);
const text=(v,max,dflt="")=>(typeof v==="string" ? v.slice(0,max) : dflt);
const KINDS=["info","warn","bad","muted","good"];       // "good" is from logs written before v2.0; they keep it
const CAUSES={club:"win",missed:"missed",repo:"repo",claink:"repo",stress:"burnedOut",caffeine:"burnedOut",qbr:"fired",review:"fired",org:"fired",politics:"fired"};
const ENDS=["repo","burnedOut","win","missed","fired"];       // the order the interface resolves them in

// The params of a log line: plain values a couple of levels deep, nothing executable, nothing huge.
const plain=(v,depth=0)=>{
  if(v===null || typeof v==="boolean") return v;
  if(typeof v==="number") return Number.isFinite(v) ? v : 0;
  if(typeof v==="string") return v.slice(0,160);
  if(Array.isArray(v) || typeof v!=="object" || depth>=3) return undefined;
  const out={};
  for(const k of Object.keys(v).slice(0,16)){ const x=plain(v[k],depth+1); if(x!==undefined && k!=="__proto__") out[k.slice(0,24)]=x; }
  return out;
};
const cleanDeals=(raw)=>{
  const out=[],ids=new Set();
  for(const d of (Array.isArray(raw) ? raw : []).slice(0,200)){
    if(!d || typeof d!=="object") continue;
    const value=Number.isFinite(d.value) ? Math.floor(d.value) : 0, stage=Number.isFinite(d.stage) ? Math.floor(d.stage) : -1;
    if(value<1 || value>1e9 || stage<0 || stage>4 || typeof d.account!=="string" || !d.account) continue;      // not a deal
    let id=typeof d.id==="string" && d.id && d.id.length<=40 ? d.id : idGen();
    if(ids.has(id)) id=idGen();
    ids.add(id);
    out.push({id,account:d.account.slice(0,60),value,stage,mood:MOODS.includes(d.mood) ? d.mood : "neutral",probNote:text(d.probNote,80),age:int(d.age,0,999,0)});
  }
  return out;
};
const cleanLogs=(raw)=>{
  const out=[],ids=new Set();
  for(const e of (Array.isArray(raw) ? raw : []).slice(0,220)){
    if(!e || typeof e!=="object" || typeof e.msg!=="string") continue;
    let id=typeof e.id==="string" && e.id && e.id.length<=40 ? e.id : idGen();
    if(ids.has(id)) id=idGen();
    ids.add(id);
    const entry={id,t:text(e.t,16),msg:e.msg.slice(0,400),kind:KINDS.includes(e.kind) ? e.kind : "info"};
    if(typeof e.tag==="string" && /^[a-z][\w.]{0,39}$/i.test(e.tag)) entry.tag=e.tag;
    if(Number.isFinite(e.wk)) entry.wk=int(e.wk,1,99,1);
    if(typeof e.dl==="string" && e.dl) entry.dl=e.dl.slice(0,240);
    if(Number.isFinite(e.v)) entry.v=int(e.v,0,99,0);
    const d=e.d && typeof e.d==="object" ? plain(e.d) : undefined;
    if(d && Object.keys(d).length) entry.d=d;
    out.push(entry);
  }
  return out;
};

// Single merge path for restored runs: the autosave on page load, and the Load button. `parsed` is the run as it
// was stored (any version); what comes back is a run this version can play, or at least one every screen can draw.
export const mergeSaved=(parsed)=>{
  const base=newGame();
  const p=parsed && typeof parsed==="object" && !Array.isArray(parsed) ? parsed : {};
  // ids handed out from here on must not repeat one the save already holds
  idsPast([...(Array.isArray(p.deals) ? p.deals : []),...(Array.isArray(p.logs) ? p.logs : [])].map(x=>x && x.id));
  const week=int(p.week,1,QUARTER_WEEKS*MAX_QUARTERS,1);
  // one ending at most: the one the save names as its cause, else the first the interface would have shown
  const flagged=ENDS.filter(k=>p[k]===true);
  const cause=typeof p.endCause==="string" && Object.prototype.hasOwnProperty.call(CAUSES,p.endCause) ? p.endCause : null;
  const ending=flagged.length ? (cause && flagged.includes(CAUSES[cause]) ? CAUSES[cause] : flagged[0]) : null;
  const deals=cleanDeals(p.deals);
  const skills=p.skills && typeof p.skills==="object" ? p.skills : {};
  const used=p.used && typeof p.used==="object" ? p.used : {};
  const achievements=[];
  for(const a of (Array.isArray(p.achievements) ? p.achievements : []).slice(0,20)){
    // an achievement is kept only if it is one this game has ever given; none is ever added here
    if(a && typeof a==="object" && typeof a.key==="string" && Object.prototype.hasOwnProperty.call(ACHIEVEMENTS,a.key) && !achievements.some(x=>x.key===a.key)) achievements.push({key:a.key,label:text(a.label,60,ACHIEVEMENTS[a.key])});
  }
  return{
    week,
    maxQuarters:base.maxQuarters,
    quartersSurvived:int(p.quartersSurvived,0,base.maxQuarters,0),
    slots:int(p.slots,0,base.maxSlots,base.maxSlots),
    maxSlots:base.maxSlots,
    restedThisWeek:p.restedThisWeek===true,
    energy:num(p.energy,0,100,base.energy),
    stress:num(p.stress,0,100,base.stress),
    skills:Object.fromEntries(Object.keys(base.skills).map(k=>[k,num(skills[k],0,100,base.skills[k])])),
    reputation:num(p.reputation,0,100,base.reputation),
    manager:num(p.manager,0,100,base.manager),
    product:num(p.product,0,100,base.product),
    cash:num(p.cash,-1e9,1e9,base.cash),
    quota:base.quota, // force current difficulty
    closedWon:num(p.closedWon,0,1e9,0),
    closedQuarter:num(p.closedQuarter,0,1e9,0),
    discounts:num(p.discounts,0,1e9,0),
    pipeline:deals.reduce((sum,d)=>sum+d.value,0),     // always the sum of the open deals, whatever the save said
    meetings:int(p.meetings,0,1e6,0),
    deals,
    logs:cleanLogs(p.logs),
    pip:p.pip===true,
    pipLevel:p.pip===true ? int(p.pipLevel,1,2,1) : 0,
    fired:ending==="fired",
    burnedOut:ending==="burnedOut",
    win:ending==="win",
    missed:ending==="missed",
    repo:ending==="repo",
    repoWarned:p.repoWarned===true,
    // a save from before v2.1 carries one shared bonus-and-timer (modifiers); from v2.1 on, a list of effects
    effects:Array.isArray(p.effects) ? sanitizeEffects(p.effects,week) : legacyEffects(p.modifiers,week),
    pending:sanitizePending(p.pending,!!ending),
    lastConference:int(p.lastConference,0,week,0),
    achievements,
    perfWarnings:int(p.perfWarnings,0,3,0),
    coffeesThisWeek:int(p.coffeesThisWeek,0,99,0),
    stressWarned:p.stressWarned===true,
    hygieneShield:p.hygieneShield===true,
    trip:typeof p.trip==="string" && p.trip ? p.trip.slice(0,40) : null,
    claink:sanitizeClaink(p.claink,week), // v1.19; also maps the v1.16 prototype's save shape
    // why the run ended, when it says so in words this game uses. (An ended run that does not say is asked for its
    // last line instead: legacy.js, causeOf.)
    endCause:ending ? (cause && CAUSES[cause]===ending ? cause : null) : null,
    story:sanitizeStory(p.story), // v2.0; null for older saves, whose history nobody recorded
    runId:typeof p.runId==="string" && p.runId && p.runId.length<=40 ? p.runId : base.runId,
    rng:sanitizeRng(p.rng), // v2.1: the run's dice; a save from before them gets new ones
    used:Object.fromEntries(Object.keys(base.used).map(k=>[k,used[k]===true]))
  };
};

// What every screen assumes about a run. mergeSaved always returns one; this is the check that says so.
export const isRun=(r)=>!!r && typeof r==="object" && ["week","energy","stress","cash","slots","maxSlots","quota","manager","reputation","product","closedWon"].every(k=>Number.isFinite(r[k]))
  && r.week>=1 && Array.isArray(r.deals) && Array.isArray(r.logs) && Array.isArray(r.effects) && Array.isArray(r.pending) && !!r.claink && !!r.rng && !!r.skills && !!r.used;

// opts.seed: the run's dice, for a test or a simulation that wants a named run. The interface never passes one.
export const newGame=(opts)=>({
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
  effects:[],          // what is bending the signing odds, and until when (effects.js)
  pending:[],          // choices waiting for an answer, first in line first (events.js); nothing else moves until then
  lastConference:0,    // the week of the last conference this run, or 0
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
  rng:newRng(opts && Number.isFinite(opts.seed) ? opts.seed : undefined),
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
