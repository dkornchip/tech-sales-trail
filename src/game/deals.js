import { ACCOUNT_NAMES, ACHIEVEMENTS, DEAL_NOTES } from "../copy/names.js";
import { MOODS } from "./constants.js";
import { discountRate } from "./effects.js";
import { log } from "./log.js";
import { CASH, PAY, closeOdds } from "./rules.js";
import { choice, clamp, idGen, pct, randi } from "./util.js";
import { rnd } from "./rng.js";

// Clone nested sub-objects that actions mutate, to avoid accidental state mutation bugs.
export const cloneForSpend=(state)=>({
  ...state,
  skills:{...(state.skills||{})},
  used:{...(state.used||{})}
});



// key: a key of ACHIEVEMENTS (src/copy/names.js); the save keeps the label next to it
export const addAchievement=(state,key)=>{
  if(state.achievements.some(a=>a.key===key))return state;
  const next={...state,achievements:[...state.achievements,{key,label:ACHIEVEMENTS[key]}]};
  return log(next,"ach.unlocked",{key});
};

export const makeDeal=(state,{warm=false,big=false}={})=>{
  const base=big?randi(22000,58000):randi(5000,24000);
  const repMult=0.7+0.6*(state.reputation/100);
  const mood=warm
    ?(rnd()<0.6?"curious":"neutral")
    :(rnd()<0.25?"skeptical":"neutral");
  return{
    id:idGen(),
    account:choice(ACCOUNT_NAMES),
    value:Math.round(base*repMult),
    stage:0,
    mood,
    probNote:"",
    age:0
  };
};

// New deals join the front of the pipeline. Two open deals never share an account name: a name that is already
// taken is traded for the next free one down the list. No dice: the draw that picked the name has already happened,
// and nothing in the rules reads a name. (With every name taken, the duplicate stands.)
export const withDeals=(deals,adds)=>{
  const taken=new Set(deals.map(d=>d.account));
  const fresh=adds.map(d=>{
    let name=d.account;
    if(taken.has(name)){
      const at=Math.max(0,ACCOUNT_NAMES.indexOf(name));
      for(let k=1;k<ACCOUNT_NAMES.length;k++){
        const next=ACCOUNT_NAMES[(at+k)%ACCOUNT_NAMES.length];
        if(!taken.has(next)){ name=next; break; }
      }
    }
    taken.add(name);
    return name===d.account ? d : {...d,account:name};
  });
  return [...fresh,...deals];
};

// High-variance referrals: mostly peanuts, rare whales. Returns {deal, tier}: tier is "peanut", "big", "whale" or ""
// (the ordinary middle), so nothing has to read the size back out of the note on the deal card.
export const makeReferral=(state)=>{
  const roll=rnd();
  let base=0, tier="";
  if(roll<0.70){
    base=randi(2000,11000);
    tier="peanut";
  }else if(roll<0.90){
    base=randi(9000,26000);
  }else if(roll<0.97){
    base=randi(26000,70000);
    tier="big";
  }else{
    base=randi(85000,220000);
    tier="whale";
  }
  const repMult=0.75+0.70*(state.reputation/100);
  return{tier,deal:{
    id:idGen(),
    account:choice(ACCOUNT_NAMES),
    value:Math.round(base*repMult),
    stage:0,
    mood:"happy",
    probNote:tier ? DEAL_NOTES[tier] : "",
    age:0
  }};
};

// One close push (any source) that signs this much in total earns the Whale hunter distinction.
export const WHALE_PUSH=65000;

export const checkRepo=(state)=>{
  let s={...state};
  if(s.cash<=CASH.repoAt && !s.repo && !s.fired && !s.burnedOut && !s.win && !s.missed){
    s.repo=true;
    s.endCause="repo";
    s=log(s,"end.repo",null,"bad");
  }else if(s.cash<=CASH.warnAt && !s.repo && !s.repoWarned){
    s.repoWarned=true;
    s=log(s,"pay.repoWarn",null,"warn");
  }
  return s;
};

// FIX: the old version logged ghosts inside the filter callback, which reassigned `s` mid-expression,
// so the filtered/aged deal list was written to the OLD state object and thrown away whenever a deal
// ghosted. Ghosts were announced but never removed and deals never aged on those weeks.
export const ageAndGhost=(state)=>{
  let s={...state};
  const kept=[];
  const ghosts=[];
  for(const d of s.deals){
    const tooOld=d.age>6 && d.stage<2 && rnd()<0.25;
    const ghosted=d.mood==="skeptical" && rnd()<0.15;
    if(tooOld||ghosted)ghosts.push(d);
    else kept.push({...d,age:d.age+1});
  }
  s.deals=kept;
  s.pipeline=kept.reduce((sum,d)=>sum+d.value,0);
  for(const g of ghosts){
    s=log(s,"deal.ghost",{account:g.account},"warn");
  }
  return s;
};

export const killDeals=(state,predicate,dropProb)=>{
  let s={...state};
  let lost=0,lostVal=0;
  const kept=[];
  for(const d of s.deals){
    if(predicate(d) && rnd()<dropProb){
      lost++;
      lostVal+=d.value;
    }else kept.push(d);
  }
  s.deals=kept;
  s.pipeline=kept.reduce((sum,d)=>sum+d.value,0);
  if(lost>0){
    s=log(s,"deal.lost",{n:lost,value:lostVal},"bad");
  }
  return s;
};

// src says where the closes came from: "negotiations", "close" (the Close Deals action), "friday" (End Week) or "hail"
// (the Hail Mary). The log lines name it (CLOSE_SOURCE in src/copy/log.js).
// before (optional): the meters before the action that led here (log.js, snap), so the first line of the batch can
// say what the attempt itself cost. Commission is in the sentence, so cash is left out of it.
const SPENT=["energy","stress","manager","reputation","product"];
export const tryCloseSome=(state,src="negotiations",before=null)=>{
  let s={...state};
  const candidates=s.deals.filter(d=>d.stage>=3);
  if(candidates.length===0){
    return log(s,"close.none",{src},"muted",before,SPENT);
  }
  let closedCount=0,totalWon=0,totalDiscount=0,lost=0,lostVal=0;
  let top=null; // the largest deal signed in this pass, for the run's story

  const nextDeals=[];
  for(const d of s.deals){
    if(d.stage<3){nextDeals.push(d);continue;}
    const chance=closeOdds(s,d);
    const roll=rnd();
    if(roll<chance){
      const rate=discountRate(s);
      const net=Math.round(d.value*(1-rate));
      totalWon+=net;
      totalDiscount+=Math.round(d.value*rate);
      closedCount++;
      if(!top || net>top.value) top={account:d.account,value:net};
    }else{
      const loseProb=d.stage>=4?0.22:0.14;
      if(rnd()<loseProb){
        lost++;
        lostVal+=d.value;
      }else{
        let moodIdx=MOODS.indexOf(d.mood);
        if(moodIdx<0)moodIdx=1;
        if(roll>0.9 && moodIdx>0)moodIdx-=1;
        nextDeals.push({
          ...d,
          mood:MOODS[moodIdx],
          probNote:DEAL_NOTES.roll(pct(roll),pct(chance))
        });
      }
    }
  }
  s.deals=nextDeals;
  s.pipeline=s.deals.reduce((sum,d)=>sum+d.value,0);
  s.closedWon+=totalWon;
  s.closedQuarter+=totalWon;
  s.cash+=Math.round(totalWon*PAY.commission);
  s.discounts+=totalDiscount;

  if(closedCount>0){
    s=log(s,"close.signed",{src,n:closedCount,won:totalWon,keep:Math.round(totalWon*PAY.commission),top,...(totalDiscount>0 ? {off:totalDiscount} : {})},"info",before,SPENT);
    if(totalWon>=WHALE_PUSH)s=addAchievement(s,"whale");
  }else{
    s=log(s,"close.nobody",{src},"warn",before,SPENT);
  }
  if(lost>0){
    s=log(s,"close.lost",{n:lost,value:lostVal},"bad");
  }
  s=checkRepo(s);
  return s;
};


export const cost=(state,{energy=0,slots=1,onceKey=null}={})=>{
  if(state.fired || state.burnedOut || state.win || state.missed || state.repo) return [state,false,"over"];
  if(state.slots<slots)return[state,false,"slots"];
  if(state.energy<energy)return[state,false,"energy"];
  if(onceKey && state[onceKey])return[state,false,"once"];
  let s=cloneForSpend(state);
  s.energy=clamp(s.energy-energy,0,100);
  s.slots-=slots;
  if(onceKey)s[onceKey]=true;
  return[s,true,null];
};
