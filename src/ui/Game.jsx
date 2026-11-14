import React from "react";
import { ENDINGS } from "../copy/endings.js";
import { EVENT_COPY } from "../copy/events.js";
import { HELP, HELP_MEMO, HELP_OK, HELP_TITLE } from "../copy/help.js";
import { EVENTS } from "../game/events.js";
import { causeOf } from "../game/legacy.js";
import { step, waiting } from "../game/run.js";
import { CLAINK } from "../game/claink.js";
import { newGame } from "../game/state.js";
import { CRASH_PER_SHOT, RECHARGE_ENERGY, RECHARGE_LUCK, TRIP_AT } from "../game/stress.js";
import { pct } from "../game/util.js";
import { MENU, NAMES, RECOVERY, TOAST } from "../copy/ui.js";
import { describe } from "./app/ActionGrid.jsx";
import { Board } from "./app/Board.jsx";
import { hailBlock } from "./app/Foot.jsx";
import { SettingsMenu } from "./app/SettingsMenu.jsx";
import { useShortcuts } from "./app/shortcuts.js";
import { TopBar } from "./app/TopBar.jsx";
import { CLAINK_UI_KEY, ClainkDock, clainkUiFor, isNarrowScreen, isShortScreen, readClainkUi } from "./ClainkUi.jsx";
import { clearCaption, pushCaption } from "./captions.js";
import { Ending } from "./Ending.jsx";
import { AUDIO, noHover, notify, sfx } from "./env.js";
import { Modal } from "./primitives.jsx";
import { Tour, Welcome, endFirstDay, isFirstDay, useBooting } from "./FirstRun.jsx";
import { hasStoredRun, readForLoad, readOnOpen, setAside, writeAutosave, writeSave } from "./storage.js";

const { useState, useEffect, useRef } = React;

// A choice that is waiting for an answer is part of the run (its `pending` list, game/run.js), so it is saved with
// it and nothing can walk away from it: not a reload, not a Load, not a second press. (A run stored by v2.0, which
// kept such a choice beside its autosave, gets it back when it is read: game/save.js.)
const isAck=p=>!!p && p.id.indexOf("ck:")===0;

// fresh: start a new run without reading storage (the way out of the crash page, ui/main.jsx)
export function Game({fresh}){
  // What storage holds is read once, before the first render (ui/storage.js). A run that opens is played. One that
  // does not (damaged, or written by a later version) is left exactly where it is: a new run is put on the desk
  // behind a dialog that says so and offers what can actually be done, and nothing is saved until the player has chosen.
  const boot=useRef(null);
  if(boot.current===null) boot.current=fresh ? {state:null,problem:null,others:[]} : readOnOpen();
  const createInitial=()=>boot.current.state || newGame();
  const[recovery,setRecovery]=useState(()=>(boot.current.problem ? {problem:boot.current.problem,others:boot.current.others} : null));

  const[s,setS]=useState(createInitial);
  // The choice the run is waiting on: {id, params} (EVENTS in game/events.js), or null. An End Week choice is shown
  // at once. An acknowledgement of clAInk's manager (a "ck:" choice) waits for the run's report to have its say:
  // it is shown when the report finishes (or is skipped), when anything else is attempted, and at once in a run
  // that was opened with one already waiting.
  const head=waiting(s);
  const[ackOpen,setAckOpen]=useState(()=>isAck(waiting(s)));
  const[over,setOver]=useState(null);
  const[showHelp,setShowHelp]=useState(false);
  // The first day (ui/FirstRun.jsx): "memo" (the opening), then 0, 1, 2 (the tour's stops), then null for good.
  // "memo-again" is the memo reopened from the rules. A browser with a saved run never gets a first day.
  const[first,setFirst]=useState(()=>{ const hasRun=fresh || hasStoredRun(); if(hasRun) endFirstDay(); return isFirstDay(hasRun) ? "memo" : null; });
  const booting=useBooting();
  const[helpOpens,setHelpOpens]=useState(0); // keys the onboarding memo so its gag replays each time it is reopened
  const[claUi,setClaUi]=useState(readClainkUi); // clAInk's panel: minimized or not (a UI preference, not run state)
  const[epoch,setEpoch]=useState(0);            // v1.19: New Game, Load and New Run remount clAInk's local UI state
  const setClaUiByYou=fn=>setClaUi(u=>({...(typeof fn==="function"?fn(u):fn),chosen:true})); // only your own moves/toggles are saved
  const[shortScreen,setShortScreen]=useState(isShortScreen); // re-checked on rotation, for the pill default
  const[narrowScreen,setNarrowScreen]=useState(isNarrowScreen);
  useEffect(()=>{ const on=()=>{ setShortScreen(isShortScreen()); setNarrowScreen(isNarrowScreen()); }; window.addEventListener("resize",on); return()=>window.removeEventListener("resize",on); },[]);
  useEffect(()=>{ if(!claUi.chosen)return; try{ localStorage.setItem(CLAINK_UI_KEY,JSON.stringify({mini:claUi.mini,adMini:claUi.adMini})); }catch{} },[claUi]);
  const expandAd=()=>setClaUi(u=>u.adMini===null ? u : {...u,adMini:null}); // v1.21: a new run's ad starts fresh (expanded; the pill on a short screen)

  // The run as it stands, for anything that acts on it: the ref is written in the same breath as the state, so a
  // second press that lands before the next render still sees what the first one did.
  const sRef=useRef(s);
  const commit=ns=>{ sRef.current=ns; setS(ns); };
  // Every change to a run is a move through the rules' front door (game/run.js). Returns what the move did.
  const dispatch=move=>{
    const r=step(sRef.current,move);
    if(r.state!==sRef.current) commit(r.state);
    if(r.refused==="pending") setAckOpen(true);     // the manager will not be talked over
    return r;
  };

  const onNew=()=>{
    const a=AUDIO(); if(a){ a.hush(); a.play("newgame"); a.say("newrun",{cooldown:3000}); }
    commit(newGame());
    setEpoch(e=>e+1); // v1.19: fresh clAInk UI state
    expandAd();
    setAckOpen(false);
    setOver(null);
  };
  // The manual save is its own slot: written only here, read only by Load.
  const onSave=()=>{
    if(writeSave(sRef.current)){ sfx("save"); notify(TOAST.saved); }
    else{ sfx("nope"); notify(TOAST.saveBlocked); }
  };
  // Load swaps the whole run in one step, or not at all: a save that cannot be opened leaves the run on the desk
  // exactly as it is, and says so.
  const openRun=run=>{
    commit(run);
    setEpoch(e=>e+1); // v1.19: fresh clAInk UI state
    setAckOpen(isAck(waiting(run)));
    setOver(null);
  };
  const onLoad=()=>{
    const found=readForLoad();
    if(found.status==="none"){ sfx("nope"); notify(TOAST.noSave); return; }
    if(found.status!=="ok"){ sfx("nope"); notify(found.status==="newer" ? TOAST.newer : TOAST.damaged); return; }
    const a=AUDIO(); if(a){ a.hush(); a.play("load"); }
    openRun(found.state);
  };
  // The way out of the dialog for a stored run that would not open. Whatever is chosen, that run is kept aside first.
  const recover=other=>{
    setAside(recovery.problem);
    if(other) openRun(other.state);
    setRecovery(null);
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

  // The autosave: the whole run, in one piece, after every change. It waits while the recovery dialog is open (the
  // run that could not be opened is still under that key). A browser that refuses storage is told about once.
  const storageWarned=useRef(false);
  useEffect(()=>{
    if(recovery)return;
    if(!writeAutosave(s) && !storageWarned.current){ storageWarned.current=true; notify(TOAST.saveBlocked); }
  },[s,recovery]);

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
  // the choice on screen right now, or null (an acknowledgement waits its turn; see above)
  const shown=head && (!isAck(head) || ackOpen) ? head : null;
  const shownId=shown ? shown.id : null;
  useEffect(()=>{
    if(!shownId)return;
    const a=AUDIO(); if(a) a.onModal(shownId);
    // an acknowledgement brings the run's result for screen readers (the report behind it is inert by now)
    const L=isAck(shown) && sRef.current.claink ? sRef.current.claink.last : null;
    if(!L || !L.announce)return;
    const t=setTimeout(()=>{
      const d=[...document.querySelectorAll("dialog[open]")].find(x=>x.getAttribute("data-dialog")===shownId);
      const sr=d && d.querySelector(".tst-sr");
      if(sr && sr.textContent!==L.announce){ sr.textContent=""; sr.textContent=L.announce; } // once, even if the run's own effect got there first
    },120);
    return()=>clearTimeout(t);
  },[shownId]);

  const endWeek=()=>{ dispatch({t:"end"}); };

  useEffect(()=>{
    if(s.fired || s.burnedOut || s.win || s.missed || s.repo){
      const type=
        s.repo ? "repo" :
        s.burnedOut ? "burnout" :
        s.win ? "club" :
        s.missed ? "missed" :
        "fired";
      // v1.15: endCause is set wherever an ending lands; log parsing (game/legacy.js) is only for pre-v1.15 saves
      const cause=causeOf(type,s);
      // the burnout ending has two faces; everything else is its own ending
      const id=type==="burnout" ? (cause==="caffeine" ? "ascension" : "meltdown") : type;
      const words=ENDINGS[id], p={closed:s.closedWon,cash:s.cash,cause};
      const title=words.title(p);
      const body=words.body(p);
      const meta={pct:s.quota>0 ? s.closedWon/s.quota : 0, cause, shots:s.coffeesThisWeek||0};
      setOver({id,title,body,type,meta});
    }else{
      setOver(null);
    }
  },[s.fired,s.burnedOut,s.win,s.missed,s.repo,s.closedWon]);

  // v1.14: heartbeat under the music when stress runs hot
  useEffect(()=>{ const a=AUDIO(); if(a) a.setStress(over ? 0 : s.stress); },[s.stress,over]);

  const tryOpportunisticClose=()=>{ if(hailBlock(sRef.current))return; dispatch({t:"hail"}); };
  const act=a=>{ if(describe(a,sRef.current).block)return; dispatch({t:"act",id:a.id}); };
  useShortcuts({ onActKey:act, onEndWeek:()=>endWeek(), onHail:tryOpportunisticClose, onRules:openRules });

  // clAInk's report has had its say (it finished, was skipped, or there was nothing to watch): an acknowledgement
  // that the run is waiting on may open now. A run started while one was waiting hides it again until its own report is done.
  const onReport=done=>setAckOpen(done ? isAck(waiting(sRef.current)) : false);

  // the event dialog on screen: what its buttons do (game/events.js) and what it says (copy/events.js)
  const eventDef=shown ? EVENTS[shown.id] : null;
  const eventWords=shown ? EVENT_COPY[shown.id] : null;
  const eventParams=(shown && shown.params)||{};
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
          : <ClainkDock key={s.runId+":"+epoch} s={s} dispatch={dispatch} ui={clainkUiFor(claUi,shortScreen,narrowScreen)} setUi={setClaUiByYou} onReport={onReport} />} />

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
          {HELP.filter(sec=>!(sec.keys && noHover())).map(sec=>(
            <section key={sec.title}>
              <h3>{sec.title}</h3>
              {sec.rows.map((row,i)=><p key={i}><strong>{row.term}</strong>{row.body(helpNumbers)}</p>)}
            </section>
          ))}
        </div>
      </Modal>

      <Welcome key={"w"+helpOpens} open={!booting && (first==="memo" || first==="memo-again")} again={first==="memo-again"} s={s}
        onClose={()=>{ if(first==="memo"){ endFirstDay(); setFirst(0); } else setFirst(null); }} />
      {typeof first==="number" && !over && !head && !showHelp && (
        <Tour step={first} onStep={setFirst} onEnd={toDesk=>{
          setFirst(null);
          if(toDesk===true){ const b=document.querySelector('[data-act="prospect"]'); if(b) try{ if(b.scrollIntoView) b.scrollIntoView({block:"center",inline:"nearest"}); b.focus({preventScroll:true}); }catch{} }
        }} />
      )}

      <Modal
        open={!!shown && !booting && !(isAck(shown) && showHelp)}
        title={eventWords ? eventWords.title(eventParams) : NAMES.event}
        dialogId={shown ? shown.id : undefined}
        actions={eventDef && eventWords ? eventDef.options.map(opt=>{ const w=eventWords.options[opt.id](eventParams); return {
          label:typeof w==="string" ? w : w.label,
          note:typeof w==="string" ? null : w.effect,
          className:opt.className||"ghost",
          onClick:()=>{
            dispatch({t:"choose",event:shown.id,option:opt.id});
            setAckOpen(false);
          }
        }; }) : []}
      >
        <p className="tiny">{eventWords ? eventWords.body(eventParams) : null}</p>
      </Modal>

      <Modal
        open={!!recovery && !booting}
        title={RECOVERY.title}
        dialogId="recovery"
        actions={recovery ? [
          {label:RECOVERY.newRun,className:"primary",ui:"recover-new",onClick:()=>recover(null)},
          ...recovery.others.map((o,i)=>({label:RECOVERY.open(o.slot,o.state.week,o.legacy),className:"ghost",ui:"recover-"+o.slot+"-"+i,onClick:()=>recover(o)}))
        ] : []}
      >
        <p className="tiny">{recovery ? RECOVERY.body(recovery.problem.status,recovery.others.length) : null}</p>
      </Modal>

      <Ending over={over} s={s} onNew={onNew} />
    </>
  );
}
