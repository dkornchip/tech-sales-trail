import { QUARTER_WEEKS } from "./constants.js";
import { checkRepo } from "./deals.js";
import { log } from "./log.js";
import { clamp, getQuarterInfo, money, pct } from "./util.js";

export const evaluateQuarter=(state)=>{
  let s={...state};
  const {quarter}=getQuarterInfo(s.week);
  const perfQ=s.quota>0 ? s.closedQuarter/s.quota : 0;
  const coverage=s.quota>0 ? s.pipeline/s.quota : 0;
  const mgr=s.manager;

  let lines=[];
  lines.push(`📊 Q${quarter} final: ${pct(perfQ)}% of quota.`);

  if(perfQ>=1){
    s.manager=clamp(s.manager+10,0,100);
    s.reputation=clamp(s.reputation+5,0,100);
    s.pip=false;
    s.pipLevel=0;
    lines.push("🗣️ QBR: nods all around. No PIP.");
  }else if(perfQ>=0.8){
    s.manager=clamp(s.manager+(mgr>60?2:-3),0,100);
    if(mgr<40){
      if(!s.pip){
        s.pip=true;
        s.pipLevel=1;
        lines.push("🗣️ QBR: soft PIP. More dashboards.");
      }else{
        s.pipLevel=Math.min(2,s.pipLevel+1);
        lines.push("🗣️ QBR: PIP tightens. Milestones now fiction.");
      }
    }else if(mgr>70){
      lines.push("🗣️ QBR: manager blames “macro.” You live.");
    }else{
      lines.push("🗣️ QBR: passive-aggressive. You survive.");
    }
  }else{
    let fireChance=0.25;
    if(perfQ<0.6)fireChance+=0.25;
    if(s.pip)fireChance+=0.20;
    if(mgr<35)fireChance+=0.20;
    if(coverage<0.8)fireChance+=0.10;
    fireChance=clamp(fireChance,0.15,0.95);
    const roll=Math.random();
    if(roll<fireChance){
      s.fired=true;
      s.endCause="qbr";
      lines.push("🗣️ QBR became an exit interview.");
    }else{
      if(!s.pip){
        s.pip=true;
        s.pipLevel=1;
        lines.push("📄 Dodged the axe. Landed on a PIP.");
      }else{
        s.pipLevel=Math.min(2,s.pipLevel+1);
        lines.push("📄 Barely kept the badge. PIP escalates.");
      }
      s.manager=clamp(s.manager-8,0,100);
    }
  }

  if(!s.fired && perfQ>=1 && mgr<25 && Math.random()<0.06){
    s.fired=true;
    s.endCause="politics";
    lines.push("🗡️ Hit quota, fired anyway. Politics.");
  }

  if(!s.fired && s.manager<30 && s.pipeline>0 && Math.random()<0.35){
    const sorted=[...s.deals].sort((a,b)=>b.value-a.value);
    const cut=sorted.slice(0,Math.min(2,sorted.length));
    const cutIds=new Set(cut.map(d=>d.id));
    let total=0;
    s.deals=s.deals.filter(d=>{
      if(cutIds.has(d.id)){total+=d.value;return false;}
      return true;
    });
    s.pipeline=s.deals.reduce((sum,d)=>sum+d.value,0);
    lines.push(`📉 Manager “reassigned” ${cut.length} big deal(s), ${money(total)}.`);
  }

  if(!s.fired && s.manager>75 && perfQ<1 && Math.random()<0.5){
    if(s.pip){
      s.pip=false;
      s.pipLevel=0;
      lines.push("🪄 Manager likes you. PIP vanishes.");
    }
  }

  s.closedQuarter=0;
  s.quartersSurvived+=1;

  if(s.quartersSurvived>=s.maxQuarters && !s.fired && !s.burnedOut && !s.repo){
    if(perfQ>=1){
      s.win=true;
      s.endCause="club";
      lines.push("🏆 Number hit. President’s Club.");
    }else if(perfQ>=0.7){
      s.missed=true;
      s.endCause="missed";
      lines.push("😮‍💨 Under quota. Still employed.");
    }else{
      s.fired=true;
      s.endCause="qbr";
      lines.push("🗣️ QBR: under 70%. Voted off the island.");
    }
  }

  let acc=s;
  lines.forEach((line,idx)=>{
    const kind=idx===0?"info":(idx===lines.length-1 && (s.fired||s.burnedOut||s.repo)?"bad":"warn");
    acc=log(acc,line,kind);
  });
  return acc;
};


// ---- helpers that used to be re-created inside the component on every render ----
export const salaryAndBills=(state)=>{
  let ns={...state};
  ns.cash+=1000;
  const {weekInQuarter}=getQuarterInfo(ns.week);
  if(weekInQuarter===1||weekInQuarter===5||weekInQuarter===9){
    ns.cash-=1600;
    ns=log(ns,"🏠 Rent: -$1,600.","warn");
  }
  ns=log(ns,"💸 Salary: +$1,000.");
  ns=checkRepo(ns);
  return ns;
};

export const countStage=(deals,stageIndex)=>deals.filter(d=>d.stage===stageIndex).length;

export const behindPace=(state, weekInQuarter)=>{
  const pace=weekInQuarter/QUARTER_WEEKS;
  const perfToDate=state.quota>0 ? state.closedQuarter/state.quota : 0;
  const behind=pace-perfToDate;
  return behind>0.03;
};

export const midQuarterRisk=(state, weekInQuarter)=>{
  let ns={...state};
  const pace=weekInQuarter/QUARTER_WEEKS;
  const perfToDate=ns.quota>0 ? ns.closedQuarter/ns.quota : 0;
  const behind=pace-perfToDate;

  if(!Number.isFinite(ns.perfWarnings)) ns.perfWarnings=0;
  let warnedThisWeek=false;
  // v1.15: a CRM Cleanup this week keeps the warning ladder still and takes the edge off the fire roll.
  const shielded=!!ns.hygieneShield;

  if(shielded){
    // clean CRM: nothing for the manager to escalate this week
  }else if(ns.perfWarnings===0 && Math.random()<0.7){
    ns=log(ns,"👀 Manager wants a meeting audit. “For forecasting.”","warn");
    ns.stress=clamp(ns.stress+4,0,100);
    ns.perfWarnings=1;
    warnedThisWeek=true;
  }else if(ns.perfWarnings===1 && Math.random()<0.6){
    ns=log(ns,"📋 Surprise “pipeline hygiene” review.","warn");
    ns.stress=clamp(ns.stress+5,0,100);
    ns.perfWarnings=2;
    warnedThisWeek=true;
  }else if(ns.perfWarnings===2 && Math.random()<0.5){
    ns=log(ns,"🧊 HR is on your next 1:1. Nobody mentions it.","warn");
    ns.stress=clamp(ns.stress+6,0,100);
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

  fireChance=clamp(fireChance,0.02,0.70);

  if(weekInQuarter>=6){
    const roll=Math.random();
    if(roll<fireChance){
      ns.fired=true;
      ns.endCause=ns.perfWarnings>0 ? "review" : "org";
      const msg = ns.perfWarnings>0
        ? "📉 Forecast review became an exit meeting."
        : "🪓 Surprise “org update.” You’re off the chart.";
      ns=log(ns,msg,"bad");
    }else if(!warnedThisWeek && ns.perfWarnings>0 && Math.random()<0.4){
      ns=log(ns,"📆 Recurring meeting about you. Not invited.","warn");
    }
  }
  return ns;
};
