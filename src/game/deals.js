import { ACCOUNT_NAMES, MOODS } from "./constants.js";
import { log } from "./log.js";
import { choice, clamp, idGen, money, pct, randi } from "./util.js";

// Clone nested sub-objects that actions mutate, to avoid accidental state mutation bugs.
export const cloneForSpend=(state)=>({
  ...state,
  skills:{...(state.skills||{})},
  modifiers:{...(state.modifiers||{})},
  used:{...(state.used||{})}
});

export const tickModifiers=(state)=>{
  let s={...state, modifiers:{...(state.modifiers||{conversion:0,discount:0,expiresIn:0})}};
  if((s.modifiers.expiresIn||0)>0){
    s.modifiers.expiresIn-=1;
    if(s.modifiers.expiresIn<=0){
      s.modifiers={conversion:0,discount:0,expiresIn:0};
    }
  }
  return s;
};



export const addAchievement=(state,key,label)=>{
  if(state.achievements.some(a=>a.key===key))return state;
  const next={...state,achievements:[...state.achievements,{key,label}]};
  return log(next,`🏅 Unlocked: ${label}`);
};

export const makeDeal=(state,{warm=false,big=false}={})=>{
  const base=big?randi(22000,58000):randi(5000,24000);
  const repMult=0.7+0.6*(state.reputation/100);
  const mood=warm
    ?(Math.random()<0.6?"curious":"neutral")
    :(Math.random()<0.25?"skeptical":"neutral");
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

// High-variance referrals: mostly peanuts, rare whales.
export const makeReferralDeal=(state)=>{
  const roll=Math.random();
  let base=0, note="";
  if(roll<0.70){
    base=randi(2000,11000);
    note="referral peanut";
  }else if(roll<0.90){
    base=randi(9000,26000);
  }else if(roll<0.97){
    base=randi(26000,70000);
    note="referral big";
  }else{
    base=randi(85000,220000);
    note="referral whale";
  }
  const repMult=0.75+0.70*(state.reputation/100);
  return{
    id:idGen(),
    account:choice(ACCOUNT_NAMES),
    value:Math.round(base*repMult),
    stage:0,
    mood:"happy",
    probNote:note,
    age:0
  };
};

export const checkRepo=(state)=>{
  let s={...state};
  if(s.cash<=-1500 && !s.repo && !s.fired && !s.burnedOut && !s.win && !s.missed){
    s.repo=true;
    s.endCause="repo";
    s=log(s,"🧥 Collections took the jacket. Last flex, gone.","bad");
  }else if(s.cash<=-1000 && !s.repo && !s.repoWarned){
    s.repoWarned=true;
    s=log(s,"⚠️ Cash under -$1,000. Finance eyes the jacket.","warn");
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
    const tooOld=d.age>6 && d.stage<2 && Math.random()<0.25;
    const ghosted=d.mood==="skeptical" && Math.random()<0.15;
    if(tooOld||ghosted)ghosts.push(d);
    else kept.push({...d,age:d.age+1});
  }
  s.deals=kept;
  s.pipeline=kept.reduce((sum,d)=>sum+d.value,0);
  for(const g of ghosts){
    s=log(s,`👻 ${g.account} went dark.`,"warn");
  }
  return s;
};

export const killDeals=(state,predicate,dropProb)=>{
  let s={...state};
  let lost=0,lostVal=0;
  const kept=[];
  for(const d of s.deals){
    if(predicate(d) && Math.random()<dropProb){
      lost++;
      lostVal+=d.value;
    }else kept.push(d);
  }
  s.deals=kept;
  s.pipeline=kept.reduce((sum,d)=>sum+d.value,0);
  if(lost>0){
    s=log(s,`💀 Lost ${lost} deal(s), ${money(lostVal)}.`,"bad");
  }
  return s;
};

export const tryCloseSome=(state,label="🧾 Negotiations")=>{
  let s={...state};
  const candidates=s.deals.filter(d=>d.stage>=3);
  if(candidates.length===0){
    return log(s,`${label}: no late-stage deals.`,"muted");
  }
  let closedCount=0,totalWon=0,totalDiscount=0,lost=0,lostVal=0;
  const pipPenalty=s.pip ? 0.05*(s.pipLevel||1) : 0;

  const nextDeals=[];
  for(const d of s.deals){
    if(d.stage<3){nextDeals.push(d);continue;}
    let chance=
      0.05 +
      0.26*(s.skills.negotiate/100) +
      0.10*(s.skills.discovery/100) +
      0.07*(s.manager/100) +
      0.08*(s.reputation/100) +
      0.08*(s.product/100) -
      0.20*(s.stress/100) +
      (s.modifiers.conversion||0) +
      (d.stage>=4?0.05:0) +
      (d.mood==="happy"?0.08:0) -
      (d.mood==="skeptical"?0.06:0) -
      pipPenalty;
    chance=clamp(chance,0.03,0.88);
    const roll=Math.random();
    if(roll<chance){
      const rate=s.modifiers.discount||0;
      const net=Math.round(d.value*(1-rate));
      totalWon+=net;
      totalDiscount+=Math.round(d.value*rate);
      closedCount++;
    }else{
      const loseProb=d.stage>=4?0.22:0.14;
      if(Math.random()<loseProb){
        lost++;
        lostVal+=d.value;
      }else{
        let moodIdx=MOODS.indexOf(d.mood);
        if(moodIdx<0)moodIdx=1;
        if(roll>0.9 && moodIdx>0)moodIdx-=1;
        nextDeals.push({
          ...d,
          mood:MOODS[moodIdx],
          probNote:`roll ${pct(roll)}% vs ${pct(chance)}%`
        });
      }
    }
  }
  s.deals=nextDeals;
  s.pipeline=s.deals.reduce((sum,d)=>sum+d.value,0);
  s.closedWon+=totalWon;
  s.closedQuarter+=totalWon;
  s.cash+=Math.round(totalWon*0.12);
  s.discounts+=totalDiscount;

  if(closedCount>0){
    s=log(s,`${label}: ${closedCount} signed, ${money(totalWon)}. You keep ${money(totalWon*0.12)}.`);
    if(totalWon>=65000)s=addAchievement(s,"whale","🐋 Whale Hunter");
  }else{
    s=log(s,`${label}: nobody signed. Verbal commits only.`,"warn");
  }
  if(lost>0){
    s=log(s,`💀 Lost ${lost} late-stage deal(s), ${money(lostVal)}.`,"bad");
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
