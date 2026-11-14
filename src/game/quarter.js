import { FIRING_FROM, PACE_GRACE, PAY, RENT_WEEKS, TUNING, fireCap, paceGap, pipelineRelief } from "./rules.js";
import { checkRepo } from "./deals.js";
import { log, snap } from "./log.js";
import { clamp, getQuarterInfo, pct } from "./util.js";
import { rnd } from "./rng.js";

// The quarterly review: the last Friday of the quarter. One resolution, in this order:
//   100% or more   Club. (Rarely, a manager who cannot stand you fires you anyway: QBR.politics, and the ending says
//                  politics, not performance.)
//   80% to 99%     you keep the job, possibly on a PIP
//   70% to 79%     the review decides: fired, or kept on a PIP
//   under 70%      fired. There is no roll and no reprieve to announce first.
// The percentages are compared as they are, never rounded up across a line (69.6% is under 70%).
export const QBR={club:1,safe:0.8,floor:0.7,politics:0.06,politicsBelow:25};
export const evaluateQuarter=(state)=>{
  let s={...state};
  const {quarter}=getQuarterInfo(s.week);
  const perfQ=s.quota>0 ? s.closedQuarter/s.quota : 0;
  const coverage=s.quota>0 ? s.pipeline/s.quota : 0;
  const mgr=s.manager;

  let lines=[]; // [tag, params, kind] of each line, in the order they are logged
  lines.push(["qbr.final",{quarter,pct:Math.floor(perfQ*100+1e-9)},"info"]);

  if(perfQ>=QBR.club){
    s.manager=clamp(s.manager+10,0,100);
    s.reputation=clamp(s.reputation+5,0,100);
    s.pip=false;
    s.pipLevel=0;
    lines.push(["qbr.hit",null,"info"]);
  }else if(perfQ>=QBR.safe){
    s.manager=clamp(s.manager+(mgr>60?2:-3),0,100);
    if(mgr<40){
      if(!s.pip){
        s.pip=true;
        s.pipLevel=1;
        lines.push(["qbr.pip",null,"warn"]);
      }else{
        s.pipLevel=Math.min(2,s.pipLevel+1);
        lines.push(["qbr.pipUp",null,"warn"]);
      }
    }else if(mgr>70){
      lines.push(["qbr.macro",null,"info"]);
    }else{
      lines.push(["qbr.survive",null,"info"]);
    }
  }else if(perfQ>=QBR.floor){
    let fireChance=0.25;
    if(s.pip)fireChance+=0.20;
    if(mgr<35)fireChance+=0.20;
    if(coverage<0.8)fireChance+=0.10;
    fireChance=clamp(fireChance,0.15,0.95);
    const roll=rnd();
    if(roll<fireChance){
      s.fired=true;
      s.endCause="qbr";
      lines.push(["end.fired.qbr",null,"bad"]);
    }else{
      if(!s.pip){
        s.pip=true;
        s.pipLevel=1;
        lines.push(["qbr.dodged",null,"warn"]);
      }else{
        s.pipLevel=Math.min(2,s.pipLevel+1);
        lines.push(["qbr.dodgedUp",null,"warn"]);
      }
      s.manager=clamp(s.manager-8,0,100);
    }
  }else{
    s.fired=true;
    s.endCause="qbr";
    lines.push(["end.fired.under70",null,"bad"]);
  }

  if(!s.fired && perfQ>=QBR.club && mgr<QBR.politicsBelow && rnd()<QBR.politics){
    s.fired=true;
    s.endCause="politics";
    lines.push(["end.fired.politics",null,"bad"]);
  }

  if(!s.fired && s.manager<30 && s.pipeline>0 && rnd()<0.35){
    const sorted=[...s.deals].sort((a,b)=>b.value-a.value);
    const cut=sorted.slice(0,Math.min(2,sorted.length));
    const cutIds=new Set(cut.map(d=>d.id));
    let total=0;
    s.deals=s.deals.filter(d=>{
      if(cutIds.has(d.id)){total+=d.value;return false;}
      return true;
    });
    s.pipeline=s.deals.reduce((sum,d)=>sum+d.value,0);
    lines.push(["qbr.reassigned",{n:cut.length,value:total},"warn"]);
  }

  if(!s.fired && s.manager>75 && perfQ<1 && rnd()<0.5){
    if(s.pip){
      s.pip=false;
      s.pipLevel=0;
      lines.push(["qbr.pipGone",null,"info"]);
    }
  }

  s.quartersSurvived+=1;

  if(s.quartersSurvived>=s.maxQuarters && !s.fired && !s.burnedOut && !s.repo){
    if(perfQ>=QBR.club){
      s.win=true;
      s.endCause="club";
      lines.push(["end.club",null,"info"]);
    }else{
      // 70% or more: under 70% was fired above
      s.missed=true;
      s.endCause="missed";
      lines.push(["end.missed",null,"warn"]);
    }
  }
  // A run that goes on to another quarter starts its count again. One that ends here keeps the quarter's number:
  // it is what the ending screen and the save report as the final attainment.
  if(!(s.fired || s.win || s.missed)) s.closedQuarter=0;

  let acc=s;
  for(const [tag,params,kind] of lines) acc=log(acc,tag,params,kind);
  return acc;
};


// ---- helpers that used to be re-created inside the component on every render ----
// Friday's money. The salary lands first, then rent when it is due. (short: the rent took the cash below zero, so
// it was charged rather than paid.)
export const salaryAndBills=(state)=>{
  let ns={...state};
  ns.cash+=PAY.salary;
  const {weekInQuarter}=getQuarterInfo(ns.week);
  if(RENT_WEEKS.includes(weekInQuarter)){
    ns.cash-=PAY.rent;
    ns=log(ns,"pay.rent",{rent:PAY.rent,short:ns.cash<0},"warn");
  }
  ns=log(ns,"pay.salary",{salary:PAY.salary});
  ns=checkRepo(ns);
  return ns;
};

export const countStage=(deals,stageIndex)=>deals.filter(d=>d.stage===stageIndex).length;

// Behind pace: further behind what this week expects (rules.js, expectedAttainment) than the grace allows.
export const behindPace=(state)=>paceGap(state)>PACE_GRACE;

export const midQuarterRisk=(state, weekInQuarter)=>{
  let ns={...state};
  // how far behind, less what a healthy pipeline is allowed to take off it (nothing, unless that knob is on)
  const behind=Math.max(0,paceGap(ns)-pipelineRelief(ns));

  if(!Number.isFinite(ns.perfWarnings)) ns.perfWarnings=0;
  let warnedThisWeek=false;
  // v1.15: a CRM Cleanup this week keeps the warning ladder still and takes the edge off the fire roll.
  const shielded=!!ns.hygieneShield;

  if(shielded){
    // clean CRM: nothing for the manager to escalate this week
  }else if(ns.perfWarnings===0 && rnd()<0.7){
    const b=snap(ns);
    ns.stress=clamp(ns.stress+4,0,100);
    ns=log(ns,"risk.audit",null,"warn",b,["stress"]);
    ns.perfWarnings=1;
    warnedThisWeek=true;
  }else if(ns.perfWarnings===1 && rnd()<0.6){
    const b=snap(ns);
    ns.stress=clamp(ns.stress+5,0,100);
    ns=log(ns,"risk.hygiene",null,"warn",b,["stress"]);
    ns.perfWarnings=2;
    warnedThisWeek=true;
  }else if(ns.perfWarnings===2 && rnd()<0.5){
    const b=snap(ns);
    ns.stress=clamp(ns.stress+6,0,100);
    ns=log(ns,"risk.hr",null,"warn",b,["stress"]);
    ns.perfWarnings=3;
    warnedThisWeek=true;
  }

  const severity=clamp(behind*1.8,0,0.9);
  let fireChance=0.03 + severity*0.45 + ns.perfWarnings*0.06;

  if(ns.manager<50)fireChance+=0.04;
  if(ns.manager<35)fireChance+=0.08;
  if(ns.manager<20)fireChance+=0.10;
  if(ns.pipeline<ns.quota*0.4)fireChance+=0.05;

  if(!warnedThisWeek && ns.perfWarnings===0) fireChance*=0.6;
  if(shielded) fireChance-=0.06;

  fireChance=clamp(fireChance,TUNING.fireFloor,Math.min(0.70,fireCap(weekInQuarter)));

  if(weekInQuarter>=FIRING_FROM){
    const roll=rnd();
    if(roll<fireChance){
      ns.fired=true;
      ns.endCause=ns.perfWarnings>0 ? "review" : "org";
      const tag = ns.perfWarnings>0
        ? "end.fired.review"
        : "end.fired.org";
      ns=log(ns,tag,null,"bad");
    }else if(!warnedThisWeek && ns.perfWarnings>0 && rnd()<0.4){
      ns=log(ns,"risk.recurring",null,"warn");
    }
  }
  return ns;
};
