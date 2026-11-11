import React from "react";
import { Icon } from "./app/Icon.jsx";
import { MEMO } from "../copy/memo.js";
import { AUDIO, reducedNow, sfx } from "./env.js";

const { useState, useEffect, useRef } = React;

// v1.16: Shitcorp onboarding memo. v2.0: it is the opening of a first run (ui/FirstRun.jsx) and can be reread from
// the rules. It is remounted on every open so the gag replays; `active` is the dialog's open state, and closing
// cancels anything still queued.
// The cues line up with the CSS: the cannon fizzles at .3s, the stamp lands at 1.4s + 60% of .42s,
// and the HR footnote's fade-in (1.9s + .4s) is the last beat.
export const MEMO_SFX=[["sadHorn",300],["stamp",1650]];
export const MEMO_END=2300;

let welcomeSaid=false; // the PA welcome plays once per page load, not on every reopen
export const WelcomeMemo=({active})=>{
  const[rm]=useState(reducedNow);    // read on each open (the memo remounts), so a mid-session OS change counts
  const[done,setDone]=useState(rm);  // .done = the stamped frame with no animation
  const[live,setLive]=useState(!rm); // skippable only while the gag is still playing
  const cues=useRef([]);
  const retry=useRef(0);
  const stamped=useRef(rm);
  const paQueued=useRef(false);
  const clearCues=()=>{ cues.current.forEach(clearTimeout); cues.current=[]; };
  useEffect(()=>{
    if(!active)return;
    // The PA is sound, not motion, so it plays under reduced motion too. On a fresh tab the Rules click can be
    // the first gesture, and the audio unlock's silent primer then makes say() decline; try once more after it.
    const greet=()=>{ if(welcomeSaid)return false; const a=AUDIO(); if(a && a.say("welcome",{cooldown:3000})){ welcomeSaid=true; paQueued.current=true; } return welcomeSaid; };
    // (v2.0: the memo can open right behind the boot screen's own announcement, so it keeps trying for a few seconds)
    let tries=0;
    const again=()=>{ if(!greet() && ++tries<5)retry.current=setTimeout(again,800); };
    again();
    if(!rm){
      cues.current=MEMO_SFX.map(([name,ms])=>setTimeout(()=>{ if(name==="stamp")stamped.current=true; sfx(name); },ms));
      cues.current.push(setTimeout(()=>setLive(false),MEMO_END));
    }
    return()=>{
      clearCues(); clearTimeout(retry.current);
      // closed before the PA spoke: drop the line and let the next open try again
      if(paQueued.current){ paQueued.current=false; const a=AUDIO(); if(a && a.cancelSay && a.cancelSay())welcomeSaid=false; }
    };
  },[active]);
  // click to skip straight to the stamped memo (the stamp still lands, with its thud)
  const skip=()=>{
    if(!live)return;
    clearCues();
    if(!stamped.current){ stamped.current=true; sfx("stamp"); }
    setDone(true); setLive(false);
  };
  return(
    <div className={"memo"+(done?" done":"")+(live?" live":"")} onClick={skip}>
      <div className="memo-head" aria-hidden="true"><span>{MEMO.head[0]}</span><span>{MEMO.head[1]}</span></div>
      <h3>{MEMO.greeting}<span className="memo-cannon" aria-hidden="true"><Icon name="party-popper" /><i className="memo-bit"/><i className="memo-bit"/><i className="memo-bit"/></span></h3>
      {MEMO.paragraphs.map((text,i)=><p key={i}>{text}</p>)}
      <p>{MEMO.role.before}<span className="memo-title">{MEMO.role.title}<span className="memo-stamp" aria-hidden="true">{MEMO.role.stamp}</span></span>{MEMO.role.after}</p>
      <p className="memo-foot">{MEMO.footnote}</p>
    </div>
  );
};
