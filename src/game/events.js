import { killDeals, makeDeal, withDeals } from "./deals.js";
import { QUARTER_WEEKS } from "./constants.js";
import { addEffect } from "./effects.js";
import { log, snap } from "./log.js";
import { clamp, getQuarterInfo, randi } from "./util.js";
import { rnd } from "./rng.js";

// ---- choices ----
// The events that stop the game and wait for an answer, as data. A waiting choice is {id, params} at the head of
// the run's `pending` list: the id names an entry here (what each button does) and one in src/copy/events.js (what
// the dialog says). Each option's apply() takes the state when the button is pressed and returns the next one; it
// never changes the state it was given. The ids are the dialog ids the test harness and the sound director know:
// "evt:" for the two End Week choices, "ck:" for clAInk's manager (clainkManager in claink.js), which only asks to
// be acknowledged.
//
// What a choice does to the signing odds is an effect (effects.js): it starts in the week the button is pressed
// (a Friday's choice is answered after the week has turned, so that is the week it was made for) and ends on its
// own clock, whatever else is running.
export const SECURITY_WALK={own:0.30,spin:0.15};   // the chance each deal at Demoed or later walks
export const EVENTS={
  "evt:competitor":{options:[
    {
      id:"match",
      className:"primary",
      apply:(state)=>log(addEffect(state,"competitorMatch"),"evt.competitor.match")
    },
    {
      id:"hold",
      className:"ghost",
      apply:(state)=>{
        const b=snap(state);
        const x=addEffect({...state,reputation:clamp(state.reputation+4,0,100)},"competitorHold");
        return log(x,"evt.competitor.hold",null,"warn",b);
      }
    }
  ]},
  "evt:security":{options:[
    {
      id:"own",
      className:"primary",
      apply:(state)=>{
        const b=snap(state);
        let x={...state};
        x.reputation=clamp(x.reputation+6,0,100);
        x.product=clamp(x.product-18,0,100);
        x=addEffect(x,"securityOwn");
        x=killDeals(x,d=>d.stage>=2,SECURITY_WALK.own);
        return log(x,"evt.security.own",null,"warn",b);
      }
    },
    {
      id:"spin",
      className:"ghost",
      apply:(state)=>{
        const b=snap(state);
        let x={...state};
        x.reputation=clamp(x.reputation-8,0,100);
        x.product=clamp(x.product-12,0,100);
        x=addEffect(x,"securitySpin");
        x=killDeals(x,d=>d.stage>=2,SECURITY_WALK.spin);
        return log(x,"evt.security.spin",null,"warn",b);
      }
    }
  ]},
  "ck:warning":{options:[{id:"ack",className:"primary",apply:(state)=>({...state})}]},
  "ck:lesson":{options:[{id:"ack",className:"primary",apply:(state)=>({...state})}]}
};

// The run with one more choice waiting, behind any that already is.
export const queueChoice=(state,id,params)=>({...state,pending:[...(Array.isArray(state.pending) ? state.pending : []),params ? {id,params} : {id}]});

// ---- what a Friday can bring ----
// Each event: its chance (p), whether it needs an answer (modal), when it can happen at all (can), and what it
// does (run). The list is in the order the events are rolled, which is the order they have always been written in.
//
// A choice is never asked on the last Friday: the review that follows ends the run, and nothing could answer it.
const beforeLastFriday=s=>getQuarterInfo(s.week).weekInQuarter<QUARTER_WEEKS;
const refresh=st=>{ st.pipeline=st.deals.reduce((sum,d)=>sum+d.value,0); return st; };
export const FRIDAY_EVENTS=[
  {id:"marketing",p:0.22,run:st=>{
    const n=randi(2,6);
    const adds=Array.from({length:n},()=>makeDeal(st,{warm:true}));
    st.deals=withDeals(st.deals,adds);
    return log(refresh(st),"evt.marketing",{n});
  }},
  {id:"competitor",p:0.18,modal:true,can:beforeLastFriday,run:st=>queueChoice(st,"evt:competitor")},
  {id:"seFumble",p:0.14,can:s=>s.deals.some(d=>d.stage===1||d.stage===2),run:st=>{
    const b=snap(st);
    const candidate=st.deals.find(d=>d.stage===1||d.stage===2);
    st.product=clamp(st.product-6,0,100);
    st.stress=clamp(st.stress+4,0,100);
    return log(st,"evt.seFumble",{account:candidate.account},"warn",b);
  }},
  {id:"seSave",p:0.12,can:s=>s.deals.some(d=>d.stage>=2),run:st=>{
    const b=snap(st);
    const candidate=st.deals.find(d=>d.stage>=2);
    st.product=clamp(st.product+8,0,100);
    st.reputation=clamp(st.reputation+3,0,100);
    return log(st,"evt.seSave",{account:candidate.account},"info",b);
  }},
  {id:"security",p:0.10,modal:true,can:beforeLastFriday,run:st=>queueChoice(st,"evt:security")},
  {id:"outage",p:0.12,run:st=>{
    const b=snap(st);
    st.product=clamp(st.product-12,0,100);
    st=killDeals(st,d=>d.stage>=2,0.18);
    return log(st,"evt.outage",null,"bad",b);
  }},
  {id:"champion",p:0.11,can:s=>s.deals.some(d=>d.stage>=2),run:st=>{
    const b=snap(st);
    const candidate=st.deals.find(d=>d.stage>=2);
    const boosted={...candidate,stage:Math.min(4,candidate.stage+1),mood:"happy"};
    st.deals=st.deals.map(d=>d.id===candidate.id?boosted:d);
    refresh(st);
    st.reputation=clamp(st.reputation+3,0,100);
    st.manager=clamp(st.manager+3,0,100);
    // moved: the deal really went up a stage (one already at Closing has nowhere to go)
    return log(st,"evt.champion",{account:candidate.account,moved:boosted.stage>candidate.stage},"info",b);
  }},
  {id:"caseStudy",p:0.10,run:st=>{
    const b=snap(st);
    st.reputation=clamp(st.reputation+5,0,100);
    return log(addEffect(st,"caseStudy","next"),"evt.caseStudy",null,"info",b);
  }},
  {id:"meme",p:0.10,run:st=>{
    const b=snap(st);
    const n=randi(1,3);
    const adds=Array.from({length:n},()=>makeDeal(st,{warm:true,big:rnd()<0.5}));
    st.deals=withDeals(st.deals,adds);
    refresh(st);
    st.reputation=clamp(st.reputation+4,0,100);
    return log(st,"evt.meme",{n},"info",b);
  }},
  {id:"freeze",p:0.10,run:st=>log(addEffect(st,"freeze","next"),"evt.freeze",null,"warn")},
  {id:"crud",p:0.10,can:s=>s.energy<55,run:st=>{
    const b=snap(st);
    st.stress=clamp(st.stress+6,0,100);
    st.energy=clamp(st.energy-10,0,100);
    // conf: you were at a conference this week or last, so there is somewhere to have brought it back from
    return log(st,"evt.crud",{conf:!!st.lastConference && st.lastConference>=st.week-1},"warn",b);
  }},
  {id:"rebalance",p:0.11,can:s=>s.manager<35 && s.deals.length>0,run:st=>{
    const sorted=[...st.deals].sort((a,b)=>b.value-a.value);
    const toSteal=sorted.slice(0,Math.min(2,sorted.length));
    const stealIds=new Set(toSteal.map(d=>d.id));
    let total=0;
    st.deals=st.deals.filter(d=>{
      if(stealIds.has(d.id)){total+=d.value;return false;}
      return true;
    });
    return log(refresh(st),"evt.rebalance",{n:toSteal.length,value:total},"bad");
  }},
  {id:"favors",p:0.09,can:s=>s.manager>=75,run:st=>{
    if(st.pip && rnd()<0.6){
      st.pip=false;
      st.pipLevel=0;
      return log(st,"evt.pipShred");
    }
    const n=randi(1,3);
    const adds=Array.from({length:n},()=>makeDeal(st,{warm:true,big:rnd()<0.5}));
    st.deals=withDeals(st.deals,adds);
    return log(refresh(st),"evt.favors",{n});
  }}
];
export const FRIDAY_EVENT_CAP=2;      // events applied on one Friday, at most
export const FRIDAY_CHOICE_CAP=1;     // ...of which this many may need an answer

// One Friday's events.
//   1. Only events that can happen right now are rolled, each once, in the list's order, at its own chance.
//   2. The ones that came up are put in a fair order: by how far inside its chance each roll landed (roll / p is
//      uniform for an event that came up, whatever its chance), so no event wins a slot by being written first,
//      and no extra roll is spent on the order.
//   3. They are applied in that order until the caps are reached. An event that can no longer happen by the time
//      its turn comes (an earlier one took the deal it needed) is passed over and takes no slot; nothing is rolled
//      again.
// (Up to v2.0.1 the list was scanned top to bottom and stopped at two successes, so early entries crowded out late
// ones, and an event with nothing to act on still used up a slot.)
export const randomEvents=(state,maxFires=FRIDAY_EVENT_CAP)=>{
  if(roller) return roller(state,FRIDAY_EVENTS,maxFires);
  let s={...state};
  const up=[];
  for(const ev of FRIDAY_EVENTS){
    if(ev.can && !ev.can(s)) continue;
    const roll=rnd();
    if(roll<ev.p) up.push({ev,rank:roll/ev.p});
  }
  up.sort((a,b)=>a.rank-b.rank);
  let fired=0,choices=0;
  for(const {ev} of up){
    if(fired>=maxFires) break;
    if(ev.modal && choices>=FRIDAY_CHOICE_CAP) continue;
    if(ev.can && !ev.can(s)) continue;
    s=ev.run({...s});
    fired++;
    if(ev.modal) choices++;
  }
  return s;
};

// For the differential tool only (test/engine/tools/integrity-diff.mjs): it swaps in the scan the rules used up to
// v2.0.1, to show that nothing else about a Friday changed. The game never calls this.
let roller=null;
export const setEventRoller=fn=>{ roller=typeof fn==="function" ? fn : null; };
