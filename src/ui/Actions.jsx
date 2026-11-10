import React from "react";
import { checkRepo, cost, makeDeal, makeReferralDeal, tryCloseSome } from "../game/deals.js";
import { log } from "../game/log.js";
import { CRASH_PER_SHOT, RECHARGE_ENERGY, RECHARGE_LUCK, TRIPS, TRIP_AT, checkBurnout, coffeeEnergy, coffeeRisk, coffeeStress, rechargeMax, rechargeRelief } from "../game/stress.js";
import { choice, clamp, money, pct, randi } from "../game/util.js";

// FIX: Actions was declared inside Game, so React saw a brand-new component type every render and
// remounted the whole action grid on each state change (killing hover/focus and any CSS transitions).
export const Actions=({s,setS:commit})=>{
  // v1.15: every action result passes through the burnout check
  const setS=ns=>commit(checkBurnout(ns));
  const actProspect=()=>{
    // Phones cost more energy now.
    let[ns,ok]=cost(s,{energy:30,slots:1});
    if(!ok)return;
    const n=randi(1,4)+(Math.random()<(s.skills.prospect/100)*0.4?1:0);
    const adds=Array.from({length:n},()=>makeDeal(s,{warm:false}));
    ns.used.prospect=true;
    ns.meetings=(ns.meetings||0)+randi(0,n);
    ns.skills.prospect=clamp(ns.skills.prospect+1,0,100);
    ns.stress=clamp(ns.stress+2,0,100);
    ns.deals=[...adds,...ns.deals];
    ns.pipeline=ns.deals.reduce((sum,d)=>sum+d.value,0);
    ns=log(ns,`📞 Blitz: +${adds.length} lead(s). -30 energy.`);
    setS(ns);
  };

  const actCadence=()=>{
    let[ns,ok]=cost(s,{energy:18,slots:1});
    if(!ok)return;
    const n=randi(0,3);
    const adds=Array.from({length:n},()=>makeDeal(s,{warm:true}));
    ns.used.cadence=true;
    ns.meetings=(ns.meetings||0)+randi(0,n);
    ns.deals=[...adds,...ns.deals];
    ns.pipeline=ns.deals.reduce((sum,d)=>sum+d.value,0);
    ns=log(ns,`✉️ Cadence: +${n} warm lead(s). -18 energy.`);
    setS(ns);
  };

  const actDiscovery=()=>{
    let[ns,ok]=cost(s,{energy:22,slots:1});
    if(!ok)return;
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
    setS(ns);
  };

  const actDemo=()=>{
    let[ns,ok]=cost(s,{energy:28,slots:1});
    if(!ok)return;
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
    setS(ns);
  };

  const actPropose=()=>{
    let[ns,ok]=cost(s,{energy:25,slots:1});
    if(!ok)return;
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
    setS(ns);
  };

  const actClose=()=>{
    let[ns,ok]=cost(s,{energy:28,slots:1});
    if(!ok)return;
    ns.used.close=true;
    ns.skills.negotiate=clamp(ns.skills.negotiate+1,0,100);
    ns=tryCloseSome(ns,"🤝 Close push");
    setS(ns);
  };

  const actNetwork=()=>{
    let[ns,ok]=cost(s,{energy:16,slots:1});
    if(!ok)return;
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
    setS(ns);
  };

  const actRecharge=()=>{
    let[ns,ok,reason]=cost(s,{energy:0,slots:1,onceKey:"restedThisWeek"});
    if(!ok){
      if(reason==="once")setS(log(s,"⏱️ Already recharged this week.","warn"));
      return;
    }
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
    setS(ns);
  };

  // v1.15: each shot this week hits harder and does less; from shot 3 the heart rolls dice.
  const actCoffee=()=>{
    let[ns,ok]=cost(s,{energy:0,slots:1});
    if(!ok)return;
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
      setS(log(ns,`🚀 Shot #${k}. Liftoff.`,"bad"));
      return;
    }
    ns=checkRepo(ns);
    ns=log(ns,`☕ Shot #${k}. +${e} energy, +${st} stress.`);
    setS(ns);
  };

  // v1.15: pipeline hygiene. Not a funnel motion; once per week.
  const actCrm=()=>{
    if(s.used && s.used.crm)return;
    let[ns,ok]=cost(s,{energy:15,slots:1});
    if(!ok)return;
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
    setS(ns);
  };

  const actPolitics=()=>{
    // Internal politics costs more energy now.
    let[ns,ok]=cost(s,{energy:20,slots:1});
    if(!ok)return;
    ns.manager=clamp(ns.manager+8,0,100);
    ns.product=clamp(ns.product+3,0,100);
    ns.reputation=clamp(ns.reputation-4,0,100);
    ns.stress=clamp(ns.stress+2,0,100);
    ns=log(ns,"🏛️ Politics: +8 manager, +3 product, -4 rep.");
    setS(ns);
  };

  const actConference=()=>{
    let[ns,ok]=cost(s,{energy:40,slots:2});
    if(!ok)return;
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
    setS(ns);
  };

  const disabled=(needEnergy,needSlots,usedKey)=>(
    s.energy<needEnergy || s.slots<needSlots || s.fired || s.burnedOut || s.win || s.missed || s.repo ||
    !!(usedKey && s.used && s.used[usedKey])
  );
  const shotsNow=s.coffeesThisWeek||0;
  // actCoffee also kills when the shot itself takes stress to 100 (cost() leaves stress alone), so show that as 100%
  const shotLethal=(s.stress||0)+coffeeStress(shotsNow)>=100;
  const nextShotRisk=shotLethal?1:coffeeRisk(shotsNow);
  const crmDone=!!(s.used && s.used.crm);

  return(
    <div className="actions">
      <button className="btn" disabled={disabled(30,1)} onClick={actProspect}>
        <div className="title">📞 Prospect Blitz</div>
        <div className="desc">Find new leads. Cost: 30 Energy • 1 Slot</div>
      </button>
      <button className="btn" disabled={disabled(18,1)} onClick={actCadence}>
        <div className="title">✉️ Email Cadence</div>
        <div className="desc">Warm replies and meetings. Cost: 18 Energy • 1 Slot</div>
      </button>
      <button className="btn" disabled={disabled(22,1)} onClick={actDiscovery}>
        <div className="title">🔎 Discovery Deep Dive</div>
        <div className="desc">Qualify top of funnel. Cost: 22 Energy • 1 Slot</div>
      </button>
      <button className="btn" disabled={disabled(28,1)} onClick={actDemo}>
        <div className="title">🖥️ Demo Marathon</div>
        <div className="desc">Run demos. Cost: 28 Energy • 1 Slot</div>
      </button>
      <button className="btn" disabled={disabled(25,1)} onClick={actPropose}>
        <div className="title">📑 Proposals & Commit</div>
        <div className="desc">Move deals to paper. Cost: 25 Energy • 1 Slot</div>
      </button>
      <button className="btn" disabled={disabled(28,1)} onClick={actClose}>
        <div className="title">🤝 Close Deals</div>
        <div className="desc">Push late-stage opps over the line. Cost: 28 Energy • 1 Slot</div>
      </button>
      <button className="btn" disabled={disabled(16,1)} onClick={actNetwork}>
        <div className="title">🧑‍🤝‍🧑 Referrals & Social</div>
        <div className="desc">High variance: mostly small, sometimes massive. Cost: 16 Energy • 1 Slot</div>
      </button>
      <button className="btn" disabled={disabled(40,2)} onClick={actConference}>
        <div className="title">🏟️ Conference Run</div>
        <div className="desc">Big swing, big leads. Cost: 40 Energy • 2 Slots • $800</div>
      </button>
      <button className="btn" disabled={disabled(0,1)} onClick={actRecharge}>
        <div className="title">🧘 Recharge</div>
        <div className="desc">Once per week. Cost: 1 Slot • Energy +{RECHARGE_ENERGY}–{rechargeMax(RECHARGE_ENERGY)} • Stress -{rechargeRelief(shotsNow)}{rechargeMax(rechargeRelief(shotsNow))>rechargeRelief(shotsNow) ? `–${rechargeMax(rechargeRelief(shotsNow))}` : ""}</div>
      </button>
      <button className="btn" disabled={disabled(0,1)} onClick={actCoffee}>
        <div className="title">☕ Quad Shot</div>
        <div className="desc">Borrow from tomorrow. Cost: 1 Slot • $6 • Stress +{coffeeStress(shotsNow)} (+{CRASH_PER_SHOT} Fri){nextShotRisk>0 ? ` • 🫀 ${pct(nextShotRisk)}%` : ""}</div>
      </button>
      <button className="btn" disabled={disabled(20,1)} onClick={actPolitics}>
        <div className="title">🏛️ Internal Politics</div>
        <div className="desc">Buff manager, tax reputation. Cost: 20 Energy • 1 Slot</div>
      </button>
      <button className="btn" disabled={disabled(15,1,"crm")} onClick={actCrm} title={crmDone ? "Once per week. Back next week." : undefined}>
        <div className="title">🧹 CRM Cleanup</div>
        <div className="desc">{crmDone ? "Done this week. Back next week." : "Weekly. Prune dead leads, +manager. Risky. Cost: 15 Energy • 1 Slot"}</div>
      </button>
    </div>
  );
};
