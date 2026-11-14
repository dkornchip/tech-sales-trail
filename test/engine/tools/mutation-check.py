#!/usr/bin/env python3
# Can the engine tests fail? Each entry below is a small plausible mistake in src/game (a threshold off by one, a
# dropped clamp, two steps swapped). It is applied, the engine suite is run, and the file is put back. A mutant that
# survives is a rule no test holds (or a change that changes nothing: say which).
#   python3 test/engine/tools/mutation-check.py      (from the repository root; about two minutes)
import subprocess, sys
M=[
 ("src/game/week.js","if(rnd()<FRIDAY_CLOSE){","if(rnd()<=FRIDAY_CLOSE){"),
 ("src/game/week.js","ns=expireEffects(ns);","/*ns=expireEffects(ns);*/"),
 ("src/game/week.js","if(motionsHit>=3){","if(motionsHit>=2){"),
 ("src/game/week.js","if(d.stage===0 && rnd()<0.20){lost++;return false;}","if(d.stage===0 && rnd()<0.25){lost++;return false;}"),
 ("src/game/quarter.js","}else if(perfQ>=QBR.floor){","}else if(perfQ>QBR.floor){"),
 ("src/game/quarter.js","if(!s.fired && perfQ>=QBR.club && mgr<QBR.politicsBelow && rnd()<QBR.politics){","if(!s.fired && perfQ>=QBR.club && mgr<=QBR.politicsBelow && rnd()<QBR.politics){"),
 ("src/game/quarter.js","if(shielded) fireChance-=0.06;","if(shielded) fireChance-=0.05;"),
 ("src/game/quarter.js","  if(weekInQuarter>=FIRING_FROM){","  if(weekInQuarter>=FIRING_FROM-1){"),
 ("src/game/quarter.js","pct:Math.floor(perfQ*100+1e-9)","pct:Math.round(perfQ*100)"),
 ("src/game/events.js","  up.sort((a,b)=>a.rank-b.rank);","  /*unsorted*/"),
 ("src/game/events.js","    if(ev.can && !ev.can(s)) continue;\n    s=ev.run({...s});","    s=ev.run({...s});"),
 ("src/game/events.js","    if(ev.modal && choices>=FRIDAY_CHOICE_CAP) continue;","    "),
 ("src/game/events.js","x=killDeals(x,d=>d.stage>=2,SECURITY_WALK.own);","x=killDeals(x,d=>d.stage>=3,SECURITY_WALK.own);"),
 ("src/game/effects.js","return { ...s, effects: [...list(s).filter(e => e.src !== src),","return { ...s, effects: [...list(s),"),
 ("src/game/effects.js","const from = when === \"next\" ? s.week + 1 : s.week;","const from = s.week;"),
 ("src/game/effects.js","export const convMod = s => clamp(activeEffects(s).reduce((t, e) => t + e.conv, 0), -MAX_SWING, MAX_SWING);","export const convMod = s => activeEffects(s).reduce((t, e) => t + e.conv, 0);"),
 ("src/game/effects.js","const kept = list(s).filter(e => e.until > s.week);","const kept = list(s).filter(e => e.until >= s.week);"),
 ("src/game/deals.js","const loseProb=d.stage>=4?0.22:0.14;","const loseProb=d.stage>=4?0.14:0.22;"),
 ("src/game/deals.js","if(roll>0.9 && moodIdx>0)moodIdx-=1;","if(roll>=0.9 && moodIdx>0)moodIdx-=1;"),
 ("src/game/deals.js","const net=Math.round(d.value*(1-rate));","const net=Math.round(d.value);"),
 ("src/game/deals.js","if(s.cash<=CASH.repoAt && !s.repo","if(s.cash<CASH.repoAt && !s.repo"),
 ("src/game/actions.js","st.manager=clamp(st.manager+2,0,100);\n      st.reputation=clamp(st.reputation+1,0,100);","st.reputation=clamp(st.reputation+1,0,100);"),
 ("src/game/actions.js","  ns=log(ns,\"coffee.shot\",{shot:k,energy:e,stress:st},\"info\",b);\n  ns=checkRepo(ns);","  ns=checkRepo(ns);\n  ns=log(ns,\"coffee.shot\",{shot:k,energy:e,stress:st},\"info\",b);"),
 ("src/game/actions.js","if(luck>TRIP_AT){","if(luck>=TRIP_AT){"),
 ("src/game/actions.js","ns.reputation=clamp(ns.reputation+4,0,100);\n\n  const n=randi(1,2);","const n=randi(1,2);\n  ns.reputation=clamp(ns.reputation+4,0,100);"),
 ("src/game/stress.js","export const rechargeMax=(base)=>base+Math.max(0,Math.ceil(base*RECHARGE_LUCK-0.5));","export const rechargeMax=(base)=>base+Math.round(base*RECHARGE_LUCK);"),
 ("src/game/run.js","  if (head) {\n    if (m.t !== \"choose\") return \"pending\";","  if (head && m.t !== \"end\") {\n    if (m.t !== \"choose\") return \"pending\";"),
 ("src/game/run.js","    return { state: checkBurnout(opt.apply({ ...s, pending: pendingOf(s).slice(1) })) };","    return { state: checkBurnout(opt.apply({ ...s })) };"),
 ("src/game/run.js","  if (isRunOver(state) && pendingOf(state).length) state = { ...state, pending: [] };","  "),
 ("src/game/claink.js","const hurt=rInc<CLAINK.INCIDENT_P;","const hurt=rInc<=CLAINK.INCIDENT_P;"),
 ("src/game/claink.js","const charge=Math.max(CLAINK.TRUEUP_MIN+c.due,s.cash+ckInt(CLAINK.TRUEUP_OVER[0],CLAINK.TRUEUP_OVER[1]));","const charge=s.cash+ckInt(CLAINK.TRUEUP_OVER[0],CLAINK.TRUEUP_OVER[1]);"),
 ("src/game/claink.js","earned:Number.isFinite(c.earned) ? c.earned+keep : c.earned,","earned:c.earned,"),
 ("src/game/claink.js","const largest=s.deals.every(d=>d.value<=victim.value);","const largest=true;"),
 ("src/game/claink.js","  if(!c || c.status!==\"active\" || isRunOver(state))return state;\n  const base=","  if(!c || c.status!==\"active\")return state;\n  const base="),
 ("src/game/claink.js","getQuarterInfo(s.week).weekInQuarter<=CLAINK.OFFER_LAST_WEEK && s.cash-CLAINK.INSTALL>CLAINK.REPO_AT;","getQuarterInfo(s.week).weekInQuarter<=CLAINK.OFFER_LAST_WEEK && s.cash-CLAINK.INSTALL>=CLAINK.REPO_AT;"),
 ("src/game/state.js","    pending:sanitizePending(parsed.pending,isRunOver(parsed)),","    pending:sanitizePending(parsed.pending,false),"),
 ("src/game/log.js","const d=Math.round(after[k])-Math.round(before[k]); if(d) out[k]=d;","const d=Math.round(after[k]-before[k]); out[k]=d;"),
]
caught=0; missed=[]
for i,(f,a,b) in enumerate(M):
    src=open(f,encoding='utf8').read()
    if src.count(a)!=1: print("SKIP (pattern not unique/found):",f,a[:50]); continue
    open(f,'w',encoding='utf8').write(src.replace(a,b))
    try:
        r=subprocess.run(["node","scripts/unit.mjs","engine","test/engine"],capture_output=True,text=True,timeout=300)
        ok = r.returncode!=0
    finally:
        open(f,'w',encoding='utf8').write(src)
    if ok: caught+=1
    else: missed.append((f,a[:70]))
print(f"mutants caught: {caught} of {len(M)}")
for m in missed: print("  SURVIVED:",m)
