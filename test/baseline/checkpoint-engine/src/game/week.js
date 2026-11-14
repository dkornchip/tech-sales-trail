import { FRIDAY } from "./rules.js";
import { billClaink, expireClaink } from "./claink.js";
import { QUARTER_WEEKS } from "./constants.js";
import { ageAndGhost, checkRepo, tickModifiers, tryCloseSome } from "./deals.js";
import { randomEvents } from "./events.js";
import { isRunOver, log } from "./log.js";
import { behindPace, countStage, evaluateQuarter, midQuarterRisk, salaryAndBills } from "./quarter.js";
import { CRASH_PER_SHOT, DANGER_RATE, STRESS_DANGER, checkBurnout } from "./stress.js";
import { clamp, getQuarterInfo } from "./util.js";
import { rnd } from "./rng.js";

// One End Week, start to finish. Takes the current state and returns {state, over}: the state after the week,
// and whether the run ended during it (the caller then drops any event queued this week, so it can't stack on the
// ending). Returns null if the run was already over. An event that needs a choice is handed to queueEvent as it fires.
// The order of the steps is load-bearing: each early return keeps the ending as the last line of the log.
export const endWeek=(s,queueEvent)=>{
  if(s.fired || s.burnedOut || s.win || s.missed || s.repo)return null;
  let ns={...s};

  // End-of-week closes still happen with current modifiers.
  if(rnd()<0.15){
    ns=tryCloseSome(ns,"friday");
  }

  // Tick down existing modifiers BEFORE we potentially apply new ones during this endWeek().
  ns=tickModifiers(ns);

  ns=salaryAndBills(ns);
  if(isRunOver(ns))return {state:ns,over:true}; // v1.19: a rent repo ends the week here, so the ending stays the last line
  ns=randomEvents(ns,queueEvent,2);
  ns=ageAndGhost(ns);
  ns=checkBurnout(ns);
  // a run that just ended (burnout here, repo from the bills) stops simulating, so its ending stays the last line
  if(isRunOver(ns))return {state:ns,over:true};

  const u=ns.used;
  const didProspectish=u.prospect||u.cadence||u.network;
  const didLate=u.propose||u.close;
  const motionsHit=[
    didProspectish,
    u.discovery,
    u.demo,
    didLate
  ].filter(Boolean).length;
  const motionsSkipped=4-motionsHit;

  if(motionsHit>=3){
    ns.modifiers={
      conversion:(ns.modifiers.conversion||0)+0.06,
      discount:ns.modifiers.discount||0,
      expiresIn:Math.max(1,ns.modifiers.expiresIn||0)
    };
    ns=log(ns,"week.fullFunnel");
  }else if(motionsSkipped>=3 && ns.pipeline>0){
    ns.modifiers={
      conversion:(ns.modifiers.conversion||0)-0.06,
      discount:ns.modifiers.discount||0,
      expiresIn:Math.max(1,ns.modifiers.expiresIn||0)
    };
    ns=log(ns,"week.neglected",null,"warn");
  }

  if(!u.discovery && countStage(ns.deals,0)>=6){
    let lost=0;
    ns.deals=ns.deals.filter(d=>{
      if(d.stage===0 && rnd()<0.20){lost++;return false;}
      return true;
    });
    if(lost>0){
      ns=log(ns,"week.stale",{n:lost},"warn");
      ns.pipeline=ns.deals.reduce((sum,d)=>sum+d.value,0);
    }
  }

  if(!u.demo && countStage(ns.deals,1)>=5){
    let reg=0;
    ns.deals=ns.deals.map(d=>{
      if(d.stage===1 && rnd()<0.18){
        reg++;
        return {...d,stage:0,mood:"skeptical"};
      }
      return d;
    });
    if(reg>0){
      ns=log(ns,"week.backlog",{n:reg},"warn");
      ns.pipeline=ns.deals.reduce((sum,d)=>sum+d.value,0);
    }
  }

  ns.energy=clamp(ns.energy+FRIDAY.energy,0,100);
  // v1.15: caffeinated weeks crash instead of recovering
  const shots=ns.coffeesThisWeek||0;
  if(shots>0){
    const crash=CRASH_PER_SHOT*shots;
    ns.stress=clamp(ns.stress+crash,0,100);
    ns=log(ns,"coffee.crash",{stress:crash},"warn");
  }else{
    ns.stress=clamp(ns.stress-FRIDAY.relief,0,100);
  }

  // v1.15: burnout lands before reviews. Danger zone rolls every weekend.
  ns=checkBurnout(ns);
  if(!isRunOver(ns) && ns.stress>=STRESS_DANGER && rnd()<(ns.stress-75)*DANGER_RATE){
    ns.burnedOut=true;
    ns.endCause="stress";
    ns=log(ns,"end.meltdown.weekend",null,"bad");
  }
  if(isRunOver(ns))return {state:ns,over:true};

  ns=checkRepo(ns);

  const perfToDate=ns.quota>0 ? ns.closedQuarter/ns.quota : 0;
  const drift=(perfToDate-0.5)*4;
  ns.manager=clamp(ns.manager+drift,0,100);

  // Email cadence without calling annoys the manager.
  if(ns.used.cadence && !ns.used.prospect){
    ns.manager=clamp(ns.manager-3,0,100);
    ns=log(ns,"mgr.emails",null,"warn");
  }

  const {weekInQuarter}=getQuarterInfo(ns.week);

  // Early termination checks never fire on the final week (week 13); QBR handles that.
  if(weekInQuarter>=5 && weekInQuarter<QUARTER_WEEKS && behindPace(ns, weekInQuarter) && !ns.fired && !ns.burnedOut && !ns.repo && !ns.win && !ns.missed){
    ns=midQuarterRisk(ns, weekInQuarter);
    ns=checkBurnout(ns);
  }

  if(weekInQuarter===QUARTER_WEEKS && !ns.fired && !ns.burnedOut && !ns.repo){
    ns=evaluateQuarter(ns);
  }

  if(ns.fired || ns.burnedOut || ns.win || ns.missed || ns.repo){
    return {state:ns,over:true}; // an event queued this week must not stack on the game-over dialog
  }

  // v1.19: clAInk invoices last, so a fired or finished run is never billed (and a week-13 Club can't turn into a repo)
  ns=billClaink(ns);
  ns=expireClaink(ns);
  if(isRunOver(ns))return {state:ns,over:true};

  const nextWeek=ns.week+1;
  ns=log(ns,"week.next",{week:nextWeek});
  ns.week=nextWeek;
  ns.slots=ns.maxSlots;
  ns.restedThisWeek=false;
  ns.coffeesThisWeek=0;
  ns.stressWarned=false;
  ns.hygieneShield=false;
  ns.used={
    prospect:false,
    cadence:false,
    discovery:false,
    demo:false,
    propose:false,
    close:false,
    network:false,
    recharge:false,
    crm:false
  };

  return {state:ns,over:false};
};
