import React from "react";
import { ENDINGS } from "../copy/endings.js";
import { EVENT_COPY } from "../copy/events.js";
import { HELP, HELP_OK, HELP_TITLE } from "../copy/help.js";
import { hailMary } from "../game/actions.js";
import { EVENTS } from "../game/events.js";
import { legacyCause } from "../game/legacy.js";
import { endWeek as runEndWeek } from "../game/week.js";
import { CLAINK } from "../game/claink.js";
import { AUTOSAVE_KEY, QUARTER_WEEKS, SAVE_KEY } from "../game/constants.js";
import { isRunOver } from "../game/log.js";
import { mergeSaved, newGame, readStoredRun } from "../game/state.js";
import { CRASH_PER_SHOT, RECHARGE_ENERGY, RECHARGE_LUCK, STRESS_DANGER, TRIP_AT, checkBurnout } from "../game/stress.js";
import { getQuarterInfo, money, pct } from "../game/util.js";
import { Actions } from "./Actions.jsx";
import { CLAINK_UI_KEY, ClainkDock, clainkUiFor, isShortScreen, readClainkUi } from "./ClainkUi.jsx";
import { Cutscene } from "./Cutscene.jsx";
import { AUDIO, REDUCED_MOTION, notify, sfx } from "./env.js";
import { DealCard, Modal, Stat } from "./primitives.jsx";
import { WelcomeMemo } from "./WelcomeMemo.jsx";

const { useState, useEffect, useRef } = React;

export function Game(){
  const createInitial=()=>{
    const base=newGame();
    try{
      const raw=readStoredRun(true);
      if(!raw)return base;
      return mergeSaved(JSON.parse(raw));
    }catch{ return base; }
  };

  const[s,setS]=useState(createInitial);
  const[pending,setPending]=useState(null); // the event dialog on screen: {id, params} (EVENTS in game/events.js), or null
  const[over,setOver]=useState(null);
  const[asciiSpeed,setAsciiSpeed]=useState(120);
  const[showHelp,setShowHelp]=useState(false);
  const[helpOpens,setHelpOpens]=useState(0); // keys the onboarding memo so its gag replays on each open
  const[claUi,setClaUi]=useState(readClainkUi); // v1.19: clAInk console position + minimized (a UI preference, not run state)
  const[epoch,setEpoch]=useState(0);            // v1.19: New Game, Load and New Run remount clAInk's local UI state
  const setClaUiByYou=fn=>setClaUi(u=>({...(typeof fn==="function"?fn(u):fn),chosen:true})); // only your own moves/toggles are saved
  const[shortScreen,setShortScreen]=useState(isShortScreen); // re-checked on rotation, for the pill default
  useEffect(()=>{ const on=()=>setShortScreen(isShortScreen()); window.addEventListener("resize",on); return()=>window.removeEventListener("resize",on); },[]);
  useEffect(()=>{ if(!claUi.chosen)return; try{ localStorage.setItem(CLAINK_UI_KEY,JSON.stringify({x:claUi.x,y:claUi.y,mini:claUi.mini,adMini:claUi.adMini})); }catch{} },[claUi]);
  const expandAd=()=>setClaUi(u=>u.adMini===null ? u : {...u,adMini:null}); // v1.21: a new run's ad starts fresh (expanded; the pill on a short screen)
  const sceneRef=useRef(null);

  // FIX: header buttons were re-bound on every state change. Bind once; read live state through a ref.
  const sRef=useRef(s);
  (React.useLayoutEffect||useEffect)(()=>{ sRef.current=s; },[s]);

  useEffect(()=>{
    const ng=document.getElementById("new-game");
    const sv=document.getElementById("save");
    const ld=document.getElementById("load");
    const onNew=()=>{
      const a=AUDIO(); if(a){ a.hush(); a.play("newgame"); a.say("newrun",{cooldown:3000}); }
      setS(newGame());
      setEpoch(e=>e+1); // v1.19: fresh clAInk UI state
      expandAd();
      setPending(null);
      setOver(null);
    };
    const onSave=()=>{
      try{
        localStorage.setItem(SAVE_KEY,JSON.stringify(sRef.current));
        sfx("save");
        notify("Run saved.");
      }catch{
        sfx("nope");
        notify("Couldn’t save — storage is blocked in this browser.");
      }
    };
    const onLoad=()=>{
      const v=readStoredRun(false);
      if(!v){
        sfx("nope");
        notify("No save found.");
        return;
      }
      try{
        const a=AUDIO(); if(a){ a.hush(); a.play("load"); }
        setS(mergeSaved(JSON.parse(v)));
        setEpoch(e=>e+1); // v1.19: fresh clAInk UI state
        setPending(null);
        setOver(null);
      }catch{
        notify("Save was corrupted. Starting a new run.");
        setS(newGame());
        setEpoch(e=>e+1); // v1.19: fresh clAInk UI state
        setPending(null);
        setOver(null);
      }
    };
    if(ng)ng.addEventListener("click",onNew);
    if(sv)sv.addEventListener("click",onSave);
    if(ld)ld.addEventListener("click",onLoad);
    return()=>{
      if(ng)ng.removeEventListener("click",onNew);
      if(sv)sv.removeEventListener("click",onSave);
      if(ld)ld.removeEventListener("click",onLoad);
    };
  },[]);

  useEffect(()=>{
    try{
      localStorage.setItem(AUTOSAVE_KEY,JSON.stringify(s));
    }catch{}
  },[s]);

  // v1.14: every new log line maps to a sound (and sometimes a PA line). Reads state only.
  const lastLogRef=useRef(s.logs.length?s.logs[0].id:null);
  useEffect(()=>{
    const prev=lastLogRef.current;
    lastLogRef.current=s.logs.length?s.logs[0].id:null;
    const a=AUDIO(); if(!a)return;
    let fresh;
    if(prev===null){ fresh=s.logs.slice(); }
    else{
      const idx=s.logs.findIndex(e=>e.id===prev);
      if(idx<0)return; // a whole run was swapped in (load / new game)
      fresh=s.logs.slice(0,idx);
    }
    if(fresh.length===0 || fresh.length>40)return;
    a.onLogs(fresh.reverse(),{over:!!(s.fired||s.burnedOut||s.win||s.missed||s.repo)});
  },[s.logs]);
  useEffect(()=>{
    if(!pending || s.fired || s.burnedOut || s.win || s.missed || s.repo)return;
    const a=AUDIO(); if(a) a.onModal(pending.id);
  },[pending]);

  const endWeek=()=>{
    const r=runEndWeek(s,setPending);
    if(!r)return;
    if(r.over)setPending(null);
    setS(r.state);
  };

  useEffect(()=>{
    if(s.fired || s.burnedOut || s.win || s.missed || s.repo){
      const type=
        s.repo ? "repo" :
        s.burnedOut ? "burnout" :
        s.win ? "club" :
        s.missed ? "missed" :
        "fired";
      // v1.15: endCause is set wherever an ending lands; log parsing (game/legacy.js) is only for pre-v1.15 saves
      const cause=s.endCause || legacyCause(type,s.logs);
      // the burnout ending has two faces; everything else is its own ending
      const id=type==="burnout" ? (cause==="caffeine" ? "ascension" : "meltdown") : type;
      const words=ENDINGS[id], p={closed:s.closedWon,cash:s.cash,cause};
      const title=words.title(p);
      const body=words.body(p);
      const meta={pct:s.quota>0 ? s.closedWon/s.quota : 0, cause, shots:s.coffeesThisWeek||0};
      setPending(null);
      setOver({id,title,body,type,meta});
    }else{
      setOver(null);
    }
  },[s.fired,s.burnedOut,s.win,s.missed,s.repo,s.closedWon]);

  // v1.14: heartbeat under the music when stress runs hot
  useEffect(()=>{ const a=AUDIO(); if(a) a.setStress(over ? 0 : s.stress); },[s.stress,over]);

  const {weekInQuarter}=getQuarterInfo(s.week);
  const hasLateDeal = s.deals.some(d=>d.stage>=3);
  const pacePercent=pct(weekInQuarter/QUARTER_WEEKS);
  // v1.15: the caffeine crash lands inside End Week, right before the danger roll, so label stress by where it will be
  const crashDue=CRASH_PER_SHOT*(s.coffeesThisWeek||0);
  const projStress=Math.min(100,s.stress+crashDue);
  const stressZone=projStress>=STRESS_DANGER ? "Danger zone" : projStress>=60 ? "Edgy" : "";
  const stressSub=(stressZone||crashDue)
    ? <span style={{color:projStress>=STRESS_DANGER?"var(--bad)":"var(--warn)"}}>{[stressZone,crashDue?(stressZone?`+${crashDue} Fri`:`Crash +${crashDue} Fri`):""].filter(Boolean).join(" • ")}</span>
    : null;

  const tryOpportunisticClose=()=>{ const ns=hailMary(s); if(ns) setS(ns); };

  // v1.20: the Writing Lesson (ev: {id, params} from clainkManager, plus where it came from) arrives after the run's
  // report has played. It only opens on the run, week and clAInk run
  // that produced it (New Game or Load mid-report drop it), waits for the Rules to close, and gives way to any other
  // dialog: then it stays in the log only. It brings the run's result for screen readers, as v1.19's did.
  const helpOpen=useRef(false); helpOpen.current=showHelp;
  const lessonWait=useRef(null);
  const offerLesson=ev=>{
    const cur=sRef.current;
    if(!cur || isRunOver(cur) || ev.runId!==cur.runId || ev.week!==cur.week || !cur.claink || cur.claink.deploys!==ev.run)return;
    if(helpOpen.current){ lessonWait.current=ev; return; }
    setPending(p=>p||{id:ev.id,params:ev.params});
    if(ev.announce) setTimeout(()=>{
      const d=[...document.querySelectorAll("dialog[open]")].find(x=>x.getAttribute("data-dialog")===ev.id);
      const sr=d && d.querySelector(".tst-sr");
      if(sr && sr.textContent!==ev.announce){ sr.textContent=""; sr.textContent=ev.announce; } // once, even if the run's own effect got there first
    },120);
  };
  useEffect(()=>{ if(!showHelp && lessonWait.current){ const ev=lessonWait.current; lessonWait.current=null; offerLesson(ev); } },[showHelp]);

  const opportunisticDisabled=(
    s.energy<10 || s.slots<=0 || s.fired || s.burnedOut || s.win || s.missed || s.repo || !hasLateDeal
  );

  // the event dialog on screen: what its buttons do (game/events.js) and what it says (copy/events.js)
  const eventDef=pending ? EVENTS[pending.id] : null;
  const eventWords=pending ? EVENT_COPY[pending.id] : null;
  const eventParams=(pending && pending.params)||{};
  // the numbers the Rules quote, straight from the game
  const helpNumbers={rechargeEnergy:RECHARGE_ENERGY, luckPct:pct(RECHARGE_LUCK), tripPct:pct(TRIP_AT), crash:CRASH_PER_SHOT,
    seat:CLAINK.INSTALL, strikes:CLAINK.STRIKES, trueUpLo:CLAINK.TRUEUP_OVER[0], trueUpHi:CLAINK.TRUEUP_OVER[1], offerWeek:CLAINK.OFFER_LAST_WEEK};

  return(
    <>
      <div className="grid">
        <div className="panel">
          <div className="row between wrap" style={{marginBottom:8}}>
            <h2>Quarter Map</h2>
            <div className="row wrap">
              <span className="kbd">Week {weekInQuarter}/{QUARTER_WEEKS}</span>
              <span className="kbd">Turn {s.week}</span>
              <span className="kbd">Slots {s.slots}/{s.maxSlots}</span>
              <span className="kbd">Run {s.runId.slice(0,5)}</span>
              <button className="pill-btn" onClick={()=>{ setHelpOpens(n=>n+1); setShowHelp(true); }}>Rules</button>
            </div>
          </div>
          <div className="stats">
            <Stat label="Energy" num={s.energy} fmt={v=>`${Math.round(v)}/100`} barValue={s.energy} barKind={s.energy>50?"good":s.energy>25?"warn":"bad"} />
            <Stat label="Stress" num={s.stress} fmt={v=>`${Math.round(v)}/100`} barValue={s.stress} barKind={s.stress<40?"good":s.stress<70?"warn":"bad"}
              sub={stressSub} />
            <Stat label="Cash" num={s.cash} fmt={money} sub="Salary + commission" />
            <Stat label="Pipeline" num={s.pipeline} fmt={money} sub={`${s.deals.length} live deals`} />
            <Stat label="Closed (Q)" num={s.closedQuarter} fmt={money} sub={`${pct(s.closedQuarter/s.quota)}% of quota • Pace ${pacePercent}%`} />
            <Stat label="Manager" num={s.manager} barValue={s.manager} />
            <Stat label="Prospecting" num={s.skills.prospect} barValue={s.skills.prospect} />
            <Stat label="Discovery" num={s.skills.discovery} barValue={s.skills.discovery} />
            <Stat label="Demo" num={s.skills.demo} barValue={s.skills.demo} />
            <Stat label="Negotiation" num={s.skills.negotiate} barValue={s.skills.negotiate} />
            <Stat label="Reputation" num={s.reputation} barValue={s.reputation} />
            <Stat label="Product" num={s.product} sub="How cursed the stack is" barValue={s.product} />
          </div>
          <div className="sep"></div>
          <Actions s={s} setS={setS} />
          <div className="footer">
            <div className="badge-row">
              <span className="badge">Total Closed: {money(s.closedWon)}</span>
              <span className="badge">Quota: {money(s.quota)}</span>
              {s.pip && <span className="badge">📄 PIP L{(s.pipLevel||1)}</span>}
              {s.modifiers.discount>0 && <span className="badge">🧾 Discount {pct(s.modifiers.discount)}%</span>}
              {s.modifiers.conversion!==0 && <span className="badge">🎲 Conv Mod {s.modifiers.conversion>0?"+":""}{pct(s.modifiers.conversion)}%</span>}
              {s.restedThisWeek && <span className="badge">🧘 Rested</span>}
              {s.trip && <span className="badge">🏝️ {s.trip} trip approved</span>}
              {s.claink && s.claink.status==="active" && <span className={"badge claink-badge"+(s.claink.strikes>=CLAINK.STRIKES-1?" hot":"")}>🤖 clAInk{s.claink.strikes>0 ? ` • ${s.claink.strikes}/${CLAINK.STRIKES} strikes` : " • live"}</span>}
              {s.coffeesThisWeek>0 && <span className="badge">☕×{s.coffeesThisWeek}</span>}
              {s.repo && <span className="badge">🧥 Jacket Repo’d</span>}
            </div>
            <div className="row right">
              <button
                className="btn ghost"
                onClick={tryOpportunisticClose}
                disabled={opportunisticDisabled}
              >
                🧪 Hail-Mary (10 Energy • 1 Slot • Risky)
              </button>
              <button
                className={"btn primary"+(s.slots<=0 && !isRunOver(s) ? " nudge" : "")}
                onClick={endWeek}
                disabled={s.fired || s.burnedOut || s.win || s.missed || s.repo}
              >
                End Week
              </button>
            </div>
          </div>
        </div>

        <div className="panel">
          <h2>Active Deals</h2>
          <div className="deal-list">
            {s.deals.length>0 ? (
              s.deals.map(d=>(
                <DealCard key={d.id} deal={d} />
              ))
            ) : (
              <div className="tiny">No deals. Start dialing.</div>
            )}
          </div>
          <div className="sep"></div>
          <h2>Activity Log</h2>
          <div className="log">
            {s.logs.length>0 ? (
              s.logs.map(entry=>(
                <p key={entry.id}>
                  <span className="muted">{entry.t}</span> — {entry.msg}
                </p>
              ))
            ) : (
              <p className="muted">Nothing yet. Quota’s waiting.</p>
            )}
          </div>
        </div>
      </div>

      <ClainkDock key={s.runId+":"+epoch} s={s} setS={setS} ui={clainkUiFor(claUi,shortScreen)} setUi={setClaUiByYou} onEvent={offerLesson} />

      <Modal
        open={showHelp}
        title={HELP_TITLE}
        dialogId="help"
        onDismiss={()=>setShowHelp(false)}
        actions={[
          {
            label:HELP_OK,
            className:"primary",
            onClick:()=>setShowHelp(false)
          }
        ]}
      >
        {helpOpens>0 && <WelcomeMemo key={helpOpens} active={showHelp} />}
        {HELP.map((row,i)=><p className="tiny" key={i}><strong>{row.term}</strong>{row.body(helpNumbers)}</p>)}
      </Modal>

      <Modal
        open={!!pending}
        title={eventWords ? eventWords.title(eventParams) : "Event"}
        dialogId={pending ? pending.id : undefined}
        actions={eventDef && eventWords ? eventDef.options.map(opt=>({
          label:eventWords.options[opt.id](eventParams),
          className:opt.className||"ghost",
          onClick:()=>{
            let ns=checkBurnout(opt.apply(s));
            setS(ns);
            setPending(null);
          }
        })) : []}
      >
        <p className="tiny">{eventWords ? eventWords.body(eventParams) : null}</p>
      </Modal>

      <Modal
        open={!!over}
        title={over?.title || "Game Over"}
        dialogId={over ? "end:"+over.id : undefined}
        actions={[
          {
            label:"New Run",
            className:"success",
            onClick:()=>{
              const a=AUDIO(); if(a){ a.hush(); a.play("newgame"); a.say("newrun",{cooldown:3000}); }
              setS(newGame());
              setEpoch(e=>e+1); // v1.19: fresh clAInk UI state
              expandAd();
              setPending(null); // FIX: an event that fired on the final week no longer leaks into the next run
              setOver(null);
            }
          }
        ]}
      >
        <p className="tiny">{over?.body}</p>
        <Cutscene
          type={over?.type || "club"}
          speed={asciiSpeed}
          play={!!over}
          meta={over?.meta}
          ctrlRef={sceneRef}
        />
        {REDUCED_MOTION && over && window.TST_SCENES && window.TST_SCENES.summaryFor(over.type,over.meta) && (
          <p className="tiny scene-note">{window.TST_SCENES.summaryFor(over.type,over.meta)}</p>
        )}
        {!REDUCED_MOTION && window.TST_SCENES && (
          <div className="row right scene-ctl">
            <button className="pill-btn" onClick={()=>{ if(sceneRef.current)sceneRef.current.skip(); }}>Skip to end</button>
            <button className="pill-btn" onClick={()=>{ if(sceneRef.current)sceneRef.current.replay(); }}>Replay</button>
          </div>
        )}
        <div className="row between" style={{marginTop:6}}>
          <div className="badge-row">
            <span className="badge">Total Closed: {money(s.closedWon)}</span>
            <span className="badge">Pipeline: {money(s.pipeline)}</span>
            <span className="badge">Total Discounts: {money(s.discounts)}</span>
          </div>
          <div className="row">
            <span className="tiny">ASCII speed</span>
            <button className="btn ghost" onClick={()=>setAsciiSpeed(p=>Math.max(60,p-20))}>Faster</button>
            <button className="btn ghost" onClick={()=>setAsciiSpeed(p=>Math.min(260,p+20))}>Slower</button>
          </div>
        </div>
      </Modal>
    </>
  );
}
