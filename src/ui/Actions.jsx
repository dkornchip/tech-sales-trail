import React from "react";
import { actCadence, actClose, actCoffee, actConference, actCrm, actDemo, actDiscovery, actNetwork, actPolitics, actPropose, actProspect, actRecharge } from "../game/actions.js";
import { CRASH_PER_SHOT, RECHARGE_ENERGY, checkBurnout, coffeeRisk, coffeeStress, rechargeMax, rechargeRelief } from "../game/stress.js";
import { pct } from "../game/util.js";

// FIX: Actions was declared inside Game, so React saw a brand-new component type every render and
// remounted the whole action grid on each state change (killing hover/focus and any CSS transitions).
export const Actions=({s,setS:commit})=>{
  // v1.15: every action result passes through the burnout check
  const setS=ns=>commit(checkBurnout(ns));
  const run=act=>()=>{ const ns=act(s); if(ns) setS(ns); };

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
      <button className="btn" disabled={disabled(30,1)} onClick={run(actProspect)}>
        <div className="title">📞 Prospect Blitz</div>
        <div className="desc">Find new leads. Cost: 30 Energy • 1 Slot</div>
      </button>
      <button className="btn" disabled={disabled(18,1)} onClick={run(actCadence)}>
        <div className="title">✉️ Email Cadence</div>
        <div className="desc">Warm replies and meetings. Cost: 18 Energy • 1 Slot</div>
      </button>
      <button className="btn" disabled={disabled(22,1)} onClick={run(actDiscovery)}>
        <div className="title">🔎 Discovery Deep Dive</div>
        <div className="desc">Qualify top of funnel. Cost: 22 Energy • 1 Slot</div>
      </button>
      <button className="btn" disabled={disabled(28,1)} onClick={run(actDemo)}>
        <div className="title">🖥️ Demo Marathon</div>
        <div className="desc">Run demos. Cost: 28 Energy • 1 Slot</div>
      </button>
      <button className="btn" disabled={disabled(25,1)} onClick={run(actPropose)}>
        <div className="title">📑 Proposals & Commit</div>
        <div className="desc">Move deals to paper. Cost: 25 Energy • 1 Slot</div>
      </button>
      <button className="btn" disabled={disabled(28,1)} onClick={run(actClose)}>
        <div className="title">🤝 Close Deals</div>
        <div className="desc">Push late-stage opps over the line. Cost: 28 Energy • 1 Slot</div>
      </button>
      <button className="btn" disabled={disabled(16,1)} onClick={run(actNetwork)}>
        <div className="title">🧑‍🤝‍🧑 Referrals & Social</div>
        <div className="desc">High variance: mostly small, sometimes massive. Cost: 16 Energy • 1 Slot</div>
      </button>
      <button className="btn" disabled={disabled(40,2)} onClick={run(actConference)}>
        <div className="title">🏟️ Conference Run</div>
        <div className="desc">Big swing, big leads. Cost: 40 Energy • 2 Slots • $800</div>
      </button>
      <button className="btn" disabled={disabled(0,1)} onClick={run(actRecharge)}>
        <div className="title">🧘 Recharge</div>
        <div className="desc">Once per week. Cost: 1 Slot • Energy +{RECHARGE_ENERGY}–{rechargeMax(RECHARGE_ENERGY)} • Stress -{rechargeRelief(shotsNow)}{rechargeMax(rechargeRelief(shotsNow))>rechargeRelief(shotsNow) ? `–${rechargeMax(rechargeRelief(shotsNow))}` : ""}</div>
      </button>
      <button className="btn" disabled={disabled(0,1)} onClick={run(actCoffee)}>
        <div className="title">☕ Quad Shot</div>
        <div className="desc">Borrow from tomorrow. Cost: 1 Slot • $6 • Stress +{coffeeStress(shotsNow)} (+{CRASH_PER_SHOT} Fri){nextShotRisk>0 ? ` • 🫀 ${pct(nextShotRisk)}%` : ""}</div>
      </button>
      <button className="btn" disabled={disabled(20,1)} onClick={run(actPolitics)}>
        <div className="title">🏛️ Internal Politics</div>
        <div className="desc">Buff manager, tax reputation. Cost: 20 Energy • 1 Slot</div>
      </button>
      <button className="btn" disabled={disabled(15,1,"crm")} onClick={run(actCrm)} title={crmDone ? "Once per week. Back next week." : undefined}>
        <div className="title">🧹 CRM Cleanup</div>
        <div className="desc">{crmDone ? "Done this week. Back next week." : "Weekly. Prune dead leads, +manager. Risky. Cost: 15 Energy • 1 Slot"}</div>
      </button>
    </div>
  );
};
