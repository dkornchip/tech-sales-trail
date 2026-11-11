import React from "react";
import { ENDINGS } from "../copy/endings.js";
import { EVENT_COPY } from "../copy/events.js";
import { HELP, HELP_MEMO, HELP_OK, HELP_TITLE } from "../copy/help.js";
import { hailMary } from "../game/actions.js";
import { EVENTS } from "../game/events.js";
import { legacyCause } from "../game/legacy.js";
import { endWeek as runEndWeek } from "../game/week.js";
import { CLAINK } from "../game/claink.js";
import { AUTOSAVE_KEY, SAVE_KEY } from "../game/constants.js";
import { isRunOver } from "../game/log.js";
import { mergeSaved, newGame, readStoredRun } from "../game/state.js";
import { CRASH_PER_SHOT, RECHARGE_ENERGY, RECHARGE_LUCK, TRIP_AT, checkBurnout } from "../game/stress.js";
import { money, pct } from "../game/util.js";
import { MENU, NAMES, TOAST } from "../copy/ui.js";
import { describe } from "./app/ActionGrid.jsx";
import { Board } from "./app/Board.jsx";
import { hailBlock } from "./app/Foot.jsx";
import { SettingsMenu } from "./app/SettingsMenu.jsx";
import { useShortcuts } from "./app/shortcuts.js";
import { TopBar } from "./app/TopBar.jsx";
import { CLAINK_UI_KEY, ClainkDock, clainkUiFor, isShortScreen, readClainkUi } from "./ClainkUi.jsx";
import { clearCaption, pushCaption } from "./captions.js";
import { Ending } from "./Ending.jsx";
import { AUDIO, REDUCED_MOTION, notify, sfx } from "./env.js";
import { Modal } from "./primitives.jsx";
import { Tour, Welcome, endFirstDay, isFirstDay, useBooting } from "./FirstRun.jsx";

const { useState, useEffect, useRef } = React;

// An End Week choice ("evt:" dialogs) is kept beside the autosave while it is on screen, with the run and week it
// belongs to, so a reload cannot be used to walk away from it. It is honoured only for that same run and week.
const PENDING_KEY="tst-pending-v2";
const heldEvent=s=>{
  try{
    const p=JSON.parse(localStorage.getItem(PENDING_KEY)||"null");
    if(!p || typeof p.id!=="string" || p.id.indexOf("evt:")!==0 || !EVENTS[p.id])return null;
    if(p.runId!==s.runId || p.week!==s.week || isRunOver(s))return null;
    return {id:p.id,params:p.params && typeof p.params==="object" ? p.params : undefined};
  }catch{ return null; }
};
const holdEvent=(pending,s)=>{
  try{
    if(pending && pending.id.indexOf("evt:")===0) localStorage.setItem(PENDING_KEY,JSON.stringify({runId:s.runId,week:s.week,id:pending.id,params:pending.params}));
    else localStorage.removeItem(PENDING_KEY);
  }catch{}
};

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
  // the event dialog on screen: {id, params} (EVENTS in game/events.js), or null. A choice that was on screen when
  // the page closed is still waiting when it opens again (v1.21 dropped it, and both of its outcomes with it).
  const[pending,setPending]=useState(()=>heldEvent(s));
  const[over,setOver]=useState(null);
  const[showHelp,setShowHelp]=useState(false);
  // The first day (ui/FirstRun.jsx): "memo" (the opening), then 0, 1, 2 (the tour's stops), then null for good.
  // "memo-again" is the memo reopened from the rules. A browser with a saved run never gets a first day.
  const[first,setFirst]=useState(()=>{ const hasRun=!!readStoredRun(true); if(hasRun) endFirstDay(); return isFirstDay(hasRun) ? "memo" : null; });
  const booting=useBooting();
  const[helpOpens,setHelpOpens]=useState(0); // keys the onboarding memo so its gag replays each time it is reopened
  const[claUi,setClaUi]=useState(readClainkUi); // clAInk's panel: minimized or not (a UI preference, not run state)
  const[epoch,setEpoch]=useState(0);            // v1.19: New Game, Load and New Run remount clAInk's local UI state
  const setClaUiByYou=fn=>setClaUi(u=>({...(typeof fn==="function"?fn(u):fn),chosen:true})); // only your own moves/toggles are saved
  const[shortScreen,setShortScreen]=useState(isShortScreen); // re-checked on rotation, for the pill default
  useEffect(()=>{ const on=()=>setShortScreen(isShortScreen()); window.addEventListener("resize",on); return()=>window.removeEventListener("resize",on); },[]);
  useEffect(()=>{ if(!claUi.chosen)return; try{ localStorage.setItem(CLAINK_UI_KEY,JSON.stringify({mini:claUi.mini,adMini:claUi.adMini})); }catch{} },[claUi]);
  const expandAd=()=>setClaUi(u=>u.adMini===null ? u : {...u,adMini:null}); // v1.21: a new run's ad starts fresh (expanded; the pill on a short screen)

  // New run, Save and Load live in the settings menu. They read the live state through a ref.
  const sRef=useRef(s);
  (React.useLayoutEffect||useEffect)(()=>{ sRef.current=s; },[s]);

  const onNew=()=>{
    const a=AUDIO(); if(a){ a.hush(); a.play("newgame"); a.say("newrun",{cooldown:3000}); }
    setS(newGame());
    setEpoch(e=>e+1); // v1.19: fresh clAInk UI state
    expandAd();
    setPending(null); // an event that fired on the final week must not leak into the next run
    setOver(null);
  };
  const onSave=()=>{
    try{
      localStorage.setItem(SAVE_KEY,JSON.stringify(sRef.current));
      sfx("save");
      notify(TOAST.saved);
    }catch{
      sfx("nope");
      notify(TOAST.saveBlocked);
    }
  };
  const onLoad=()=>{
    const v=readStoredRun(false);
    if(!v){
      sfx("nope");
      notify(TOAST.noSave);
      return;
    }
    try{
      const a=AUDIO(); if(a){ a.hush(); a.play("load"); }
      setS(mergeSaved(JSON.parse(v)));
      setEpoch(e=>e+1); // v1.19: fresh clAInk UI state
      setPending(null);
      setOver(null);
    }catch{
      notify(TOAST.damaged);
      setS(newGame());
      setEpoch(e=>e+1); // v1.19: fresh clAInk UI state
      setPending(null);
      setOver(null);
    }
  };

  // Sound settings belong to the audio engine; the top bar and the settings menu mirror them.
  const[audio,setAudio]=useState(()=>{ const a=AUDIO(); return a ? {...a.settings} : {on:false,voice:false,vol:0}; });
  useEffect(()=>{ const a=AUDIO(); if(!a)return; a.onChange=st=>setAudio({...st}); a.onCaption=pushCaption; setAudio({...a.settings}); return()=>{ a.onChange=null; a.onCaption=null; }; },[]);
  const audioApi={
    ...audio,
    setOn:on=>{ const a=AUDIO(); if(!a)return; a.setOn(on); if(on){ a.unlock(); a.play("coin"); } },
    setVoice:on=>{ const a=AUDIO(); if(!a)return; a.setVoice(on); if(on) a.say(MENU.voiceOn,{force:true}); },
    setVolume:v=>{ const a=AUDIO(); if(a) a.setVolume(v); },
    setCaptions:on=>{ const a=AUDIO(); if(!a)return; a.setCaptions(on); if(!on) clearCaption(); }
  };
  const[menuOpen,setMenuOpen]=useState(false);
  const menuBtn=useRef(null);
  const closeMenu=refocus=>{ setMenuOpen(false); if(refocus && menuBtn.current) try{ menuBtn.current.focus(); }catch{} };
  const openRules=()=>setShowHelp(true);

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
  useEffect(()=>{ holdEvent(pending,s); },[pending]);

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

  const tryOpportunisticClose=()=>{ if(hailBlock(s))return; const ns=hailMary(s); if(ns) setS(ns); };
  // every action result passes through the burnout check
  const act=a=>{ if(describe(a,s).block)return; const ns=a.run(s); if(ns) setS(checkBurnout(ns)); };
  useShortcuts({ onActKey:act, onEndWeek:()=>endWeek(), onHail:tryOpportunisticClose, onRules:openRules });

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

  // the event dialog on screen: what its buttons do (game/events.js) and what it says (copy/events.js)
  const eventDef=pending ? EVENTS[pending.id] : null;
  const eventWords=pending ? EVENT_COPY[pending.id] : null;
  const eventParams=(pending && pending.params)||{};
  // the numbers the Rules quote, straight from the game
  const helpNumbers={quota:s.quota, rechargeEnergy:RECHARGE_ENERGY, luckPct:pct(RECHARGE_LUCK), tripPct:pct(TRIP_AT), crash:CRASH_PER_SHOT,
    seat:CLAINK.INSTALL, strikes:CLAINK.STRIKES, trueUpLo:CLAINK.TRUEUP_OVER[0], trueUpHi:CLAINK.TRUEUP_OVER[1], offerWeek:CLAINK.OFFER_LAST_WEEK};

  return(
    <>
      <Board s={s} onAct={act} onHail={tryOpportunisticClose} onEndWeek={endWeek}
        top={
          <TopBar onRules={openRules} soundOn={audio.on} onSound={()=>audioApi.setOn(!audio.on)} onSettings={()=>setMenuOpen(o=>!o)} settingsRef={menuBtn} menuOpen={menuOpen}>
            <SettingsMenu open={menuOpen} onClose={closeMenu} audio={audioApi} captions={audio.captions!==false} onCaptions={audioApi.setCaptions} onSave={onSave} onLoad={onLoad} onNewRun={onNew} anchorRef={menuBtn} />
          </TopBar>
        }
        dock={first!==null && first!=="memo-again" ? null /* the vendor waits until onboarding is over */
          : <ClainkDock key={s.runId+":"+epoch} s={s} setS={setS} ui={clainkUiFor(claUi,shortScreen)} setUi={setClaUiByYou} onEvent={offerLesson} />} />

      <Modal
        open={showHelp}
        title={HELP_TITLE}
        dialogId="help"
        className="help"
        aside={<button type="button" className="linkbtn" data-ui="memo-again" onClick={()=>{ setShowHelp(false); setHelpOpens(n=>n+1); setFirst("memo-again"); }}>{HELP_MEMO}</button>}
        onDismiss={()=>setShowHelp(false)}
        actions={[
          {
            label:HELP_OK,
            className:"primary",
            onClick:()=>setShowHelp(false)
          }
        ]}
      >
        <div className="rules">
          {HELP.map(sec=>(
            <section key={sec.title}>
              <h3>{sec.title}</h3>
              {sec.rows.map((row,i)=><p key={i}><strong>{row.term}</strong>{row.body(helpNumbers)}</p>)}
            </section>
          ))}
        </div>
      </Modal>

      <Welcome key={"w"+helpOpens} open={!booting && (first==="memo" || first==="memo-again")} again={first==="memo-again"} s={s}
        onClose={()=>{ if(first==="memo"){ endFirstDay(); setFirst(0); } else setFirst(null); }} />
      {typeof first==="number" && !over && !pending && !showHelp && (
        <Tour step={first} onStep={setFirst} onEnd={toDesk=>{
          setFirst(null);
          if(toDesk===true){ const b=document.querySelector('[data-act="prospect"]'); if(b) try{ b.focus({preventScroll:true}); }catch{} }
        }} />
      )}

      <Modal
        open={!!pending && !booting}
        title={eventWords ? eventWords.title(eventParams) : NAMES.event}
        dialogId={pending ? pending.id : undefined}
        actions={eventDef && eventWords ? eventDef.options.map(opt=>{ const w=eventWords.options[opt.id](eventParams); return {
          label:typeof w==="string" ? w : w.label,
          note:typeof w==="string" ? null : w.effect,
          className:opt.className||"ghost",
          onClick:()=>{
            let ns=checkBurnout(opt.apply(s));
            setS(ns);
            setPending(null);
          }
        }; }) : []}
      >
        <p className="tiny">{eventWords ? eventWords.body(eventParams) : null}</p>
      </Modal>

      <Ending over={over} s={s} onNew={onNew} />
    </>
  );
}
