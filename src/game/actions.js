import { checkRepo, cost, killDeals, makeDeal, makeReferralDeal, tryCloseSome } from "./deals.js";
import { log } from "./log.js";
import { RECHARGE_ENERGY, RECHARGE_LUCK, TRIPS, TRIP_AT, checkBurnout, coffeeEnergy, coffeeRisk, coffeeStress, rechargeRelief } from "./stress.js";
import { choice, clamp, money, pct, randi } from "./util.js";

// What each action does to the run. Every function takes the current state and returns the next one, or null when
// the action can't be taken (no slot, no energy, already used this week). The caller applies the burnout check.
export const actProspect=(s)=>{
  // Phones cost more energy now.
  let[ns,ok]=cost(s,{energy:30,slots:1});
  if(!ok)return null;
  const n=randi(1,4)+(Math.random()<(s.skills.prospect/100)*0.4?1:0);
  const adds=Array.from({length:n},()=>makeDeal(s,{warm:false}));
  ns.used.prospect=true;
  ns.meetings=(ns.meetings||0)+randi(0,n);
  ns.skills.prospect=clamp(ns.skills.prospect+1,0,100);
  ns.stress=clamp(ns.stress+2,0,100);
  ns.deals=[...adds,...ns.deals];
  ns.pipeline=ns.deals.reduce((sum,d)=>sum+d.value,0);
  ns=log(ns,`📞 Blitz: +${adds.length} lead(s). -30 energy.`);
  return ns;
};

export const actCadence=(s)=>{
  let[ns,ok]=cost(s,{energy:18,slots:1});
  if(!ok)return null;
  const n=randi(0,3);
  const adds=Array.from({length:n},()=>makeDeal(s,{warm:true}));
  ns.used.cadence=true;
  ns.meetings=(ns.meetings||0)+randi(0,n);
  ns.deals=[...adds,...ns.deals];
  ns.pipeline=ns.deals.reduce((sum,d)=>sum+d.value,0);
  ns=log(ns,`✉️ Cadence: +${n} warm lead(s). -18 energy.`);
  return ns;
};

export const actDiscovery=(s)=>{
  let[ns,ok]=cost(s,{energy:22,slots:1});
  if(!ok)return null;
  ns.used.discovery=true;
  let advanced=0;
  ns.deals=ns.deals.map(d=>{
    if(d.stage===0 && Math.random()<(0.35+ns.skills.discovery/200)){
      advanced++;
      return {...d,stage:1,mood:d.mood==="skeptical"?"neutral":d.mood};
    }
    return d;
  });
  ns.skills.discovery=clamp(ns.skills.discovery+2,0,100);
  ns.pipeline=ns.deals.reduce((sum,d)=>sum+d.value,0);
  ns=log(ns,`🔎 Discovery: ${advanced} qualified. -22 energy.`);
  return ns;
};

export const actDemo=(s)=>{
  let[ns,ok]=cost(s,{energy:28,slots:1});
  if(!ok)return null;
  ns.used.demo=true;
  let advanced=0;
  ns.deals=ns.deals.map(d=>{
    if(d.stage===1 && Math.random()<(0.30+ns.skills.demo/220+ns.product/350)){
      advanced++;
      return {...d,stage:2,mood:d.mood==="neutral"?"curious":d.mood};
    }
    return d;
  });
  ns.skills.demo=clamp(ns.skills.demo+2,0,100);
  ns.pipeline=ns.deals.reduce((sum,d)=>sum+d.value,0);
  ns=log(ns,`🖥️ Demos: ${advanced} advanced. -28 energy.`);
  return ns;
};

export const actPropose=(s)=>{
  let[ns,ok]=cost(s,{energy:25,slots:1});
  if(!ok)return null;
  ns.used.propose=true;
  let advanced=0;
  ns.deals=ns.deals.map(d=>{
    if(d.stage===2 && Math.random()<0.38){
      advanced++;
      return {...d,stage:3,mood:d.mood==="curious"?"happy":d.mood};
    }
    return d;
  });
  ns.pipeline=ns.deals.reduce((sum,d)=>sum+d.value,0);
  ns=log(ns,`📑 Proposals: ${advanced} sent. -25 energy.`);
  return ns;
};

export const actClose=(s)=>{
  let[ns,ok]=cost(s,{energy:28,slots:1});
  if(!ok)return null;
  ns.used.close=true;
  ns.skills.negotiate=clamp(ns.skills.negotiate+1,0,100);
  ns=tryCloseSome(ns,"🤝 Close push");
  return ns;
};

export const actNetwork=(s)=>{
  let[ns,ok]=cost(s,{energy:16,slots:1});
  if(!ok)return null;
  ns.used.network=true;

  // Rep buff first so it actually affects deal sizing.
  ns.reputation=clamp(ns.reputation+4,0,100);

  const n=randi(1,2);
  const adds=Array.from({length:n},()=>makeReferralDeal(ns));

  ns.meetings=(ns.meetings||0)+randi(0,n);
  ns.deals=[...adds,...ns.deals];
  ns.pipeline=ns.deals.reduce((sum,d)=>sum+d.value,0);

  const hasWhale=adds.some(d=>d.probNote==="referral whale");
  const hasBig=adds.some(d=>d.probNote==="referral big");
  const tag = hasWhale ? " 🐋 Whale." : hasBig ? " 🐳 Big one." : "";

  ns=log(ns,`🧑‍🤝‍🧑 Referrals: +${n} intro(s). -16 energy.${tag}`);
  return ns;
};

export const actRecharge=(s)=>{
  let[ns,ok,reason]=cost(s,{energy:0,slots:1,onceKey:"restedThisWeek"});
  if(!ok)return reason==="once" ? log(s,"⏱️ Already recharged this week.","warn") : null;
  ns.used.recharge=true;
  // v1.15: caffeine in the system blunts the reset. v1.17: a lucky nap adds 0-25% to both, one roll per use.
  const luck=Math.random()*RECHARGE_LUCK;
  const gain=RECHARGE_ENERGY+Math.round(RECHARGE_ENERGY*luck);
  const base=rechargeRelief(ns.coffeesThisWeek||0);
  const relief=base+Math.round(base*luck);
  ns.energy=clamp(ns.energy+gain,0,100);
  ns.stress=clamp(ns.stress-relief,0,100);
  const tag=luck>=0.15 ? ` Good nap, +${pct(luck)}%.` : "";
  ns=log(ns,relief>0 ? `🧘 Recharged. +${gain} energy, -${relief} stress.${tag}` : `🧘 Recharged. +${gain} energy. Caffeine ate the calm.`);
  if(luck>TRIP_AT){ ns.trip=choice(TRIPS); ns=log(ns,`🏝️ Manager approved your ${ns.trip} trip.`); }
  return ns;
};

// v1.15: each shot this week hits harder and does less; from shot 3 the heart rolls dice.
export const actCoffee=(s)=>{
  let[ns,ok]=cost(s,{energy:0,slots:1});
  if(!ok)return null;
  const n=ns.coffeesThisWeek||0, k=n+1;
  const e=coffeeEnergy(n), st=coffeeStress(n), risk=coffeeRisk(n);
  ns.coffeesThisWeek=k;
  ns.energy=clamp(ns.energy+e,0,100);
  ns.cash-=6;
  ns.stress=clamp(ns.stress+st,0,100);
  // a shot that maxes stress counts as the heart giving out too
  if(ns.stress>=100 || (risk>0 && Math.random()<risk)){
    ns.burnedOut=true;
    ns.endCause="caffeine";
    return log(ns,`🚀 Shot #${k}. Liftoff.`,"bad");
  }
  ns=checkRepo(ns);
  ns=log(ns,`☕ Shot #${k}. +${e} energy, +${st} stress.`);
  return ns;
};

// v1.15: pipeline hygiene. Not a funnel motion; once per week.
export const actCrm=(s)=>{
  if(s.used && s.used.crm)return null;
  let[ns,ok]=cost(s,{energy:15,slots:1});
  if(!ok)return null;
  ns.used.crm=true;
  const dead=d=>d.stage<=1 && (d.mood==="skeptical" || d.age>=5);
  const pruned=ns.deals.filter(dead).length;
  ns.deals=ns.deals.filter(d=>!dead(d));
  const gain=Math.min(10,5+pruned);
  // "Close that out" reads the manager's mood before the cleanup lands
  const nukeChance=s.manager<40?0.25:0.15;
  ns.manager=clamp(ns.manager+gain,0,100);
  ns.hygieneShield=true;
  let nuked=null;
  const pool=ns.deals.filter(d=>d.stage===1||d.stage===2);
  if(pool.length && Math.random()<nukeChance){
    const warm=d=>(d.mood==="happy"||d.mood==="curious")?1:0;
    nuked=[...pool].sort((a,b)=>warm(b)-warm(a)||b.value-a.value)[0];
    ns.deals=ns.deals.filter(d=>d.id!==nuked.id);
  }
  ns.pipeline=ns.deals.reduce((sum,d)=>sum+d.value,0);
  ns=log(ns,pruned>0
    ? `🧹 CRM cleanup. -${pruned} dead lead(s), +${gain} manager.`
    : `🧹 CRM cleanup. Nothing dead. +${gain} manager.`);
  if(nuked)ns=log(ns,`🗑️ “Close that out.” ${nuked.account} gone. -${money(nuked.value)}.`,"bad");
  return ns;
};

export const actPolitics=(s)=>{
  // Internal politics costs more energy now.
  let[ns,ok]=cost(s,{energy:20,slots:1});
  if(!ok)return null;
  ns.manager=clamp(ns.manager+8,0,100);
  ns.product=clamp(ns.product+3,0,100);
  ns.reputation=clamp(ns.reputation-4,0,100);
  ns.stress=clamp(ns.stress+2,0,100);
  ns=log(ns,"🏛️ Politics: +8 manager, +3 product, -4 rep.");
  return ns;
};

export const actConference=(s)=>{
  let[ns,ok]=cost(s,{energy:40,slots:2});
  if(!ok)return null;
  ns.cash-=800;
  const n=randi(3,8);
  const adds=Array.from({length:n},()=>makeDeal(s,{warm:true,big:Math.random()<0.4}));
  ns.deals=[...adds,...ns.deals];
  ns.pipeline=ns.deals.reduce((sum,d)=>sum+d.value,0);
  ns.stress=clamp(ns.stress+5,0,100);
  if(Math.random()<0.30){
    ns.modifiers={
      conversion:(ns.modifiers.conversion||0)+0.08,
      discount:ns.modifiers.discount||0,
      expiresIn:Math.max(1,ns.modifiers.expiresIn||0)
    };
  }
  ns=checkRepo(ns);
  ns=log(ns,`🏟️ Conference: +${n} leads. -40 energy, -$800.`);
  return ns;
};

// The Hail Mary applies its own repo and burnout checks, and reports "no late-stage deals" as a log line.
export const hailMary=(s)=>{
  if(!s.deals.some(d=>d.stage>=3)){
    return log(s,"🧪 No late-stage deals to Hail-Mary.","warn");
  }
  let[ns,ok]=cost(s,{energy:10,slots:1});
  if(!ok)return null;
  const miracle=Math.random()<0.2;
  const beforeClosed=ns.closedWon;

  ns=log(
    ns,
    miracle
      ? "🧪 Hail-Mary: “last chance” blast to every exec."
      : "🧪 Hail-Mary: leaning on every late deal. Hard.",
    "warn"
  );
  let st=tryCloseSome(ns,"🧪 Hail-Mary");
  const closedDelta=st.closedWon-beforeClosed;

  if(miracle){
    if(closedDelta>0){
      st.manager=clamp(st.manager+8,0,100);
      st.stress=clamp(st.stress+4,0,100);
      st=log(st,"🌪️ Chaos worked. +8 manager, +4 stress.");
    }else{
      st.manager=clamp(st.manager-4,0,100);
      st.stress=clamp(st.stress+6,0,100);
      st=log(st,"🤕 All noise, no ink. -4 manager, +6 stress.","bad");
    }
  }else{
    st=killDeals(st,d=>d.stage>=3,0.55);
    st.manager=clamp(st.manager-8,0,100);
    st.stress=clamp(st.stress+8,0,100);
    st.reputation=clamp(st.reputation-4,0,100);
    if(closedDelta<=0){
      st=log(st,"📛 Pipe torched. -8 manager, -4 rep, +8 stress.","bad");
    }else{
      st.manager=clamp(st.manager+2,0,100);
      st.reputation=clamp(st.reputation+1,0,100);
      st=log(st,"😬 Got ink, cooked the pipe. Net -6 manager, -3 rep.","warn");
    }
  }
  st=checkRepo(st);
  st=checkBurnout(st);
  return st;
};
