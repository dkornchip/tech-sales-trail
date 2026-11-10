import React from "react";
import { AUDIO, reducedNow, sfx } from "./env.js";

const { useState, useEffect, useRef } = React;

// v1.16: Shitcorp onboarding memo at the top of the Rules. Game remounts it (new key) on every open so the
// gag replays; `active` is the modal's open state, and closing cancels anything still queued.
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
    if(!greet())retry.current=setTimeout(greet,800);
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
      <div className="memo-head" aria-hidden="true"><span>Shitcorp • People & Culture</span><span>Internal • Do not forward</span></div>
      <h3>Welcome to Shitcorp, Matt! <span className="memo-cannon" aria-hidden="true">🎉<i className="memo-bit"/><i className="memo-bit"/><i className="memo-bit"/></span></h3>
      <p>The next disruptor in SaaS. (Our PE owners say we’re on track to overtake Scheisskorp in market cap by the end of the decade!)</p>
      <p>Here, our culture is our glue. Your fair and killer comp plan rewards builders, not takers. You could become a gorillionaire!</p>
      <p>And since you close deals, internally you’ll be known as an <span className="memo-title">Associate Account Executive<span className="memo-stamp" aria-hidden="true">SDR*</span></span>. How cool is that, for a young man of your tenure!</p>
      <p className="memo-foot">*HR will classify you as an SDR… for… ahem… admin and streamlining purposes.</p>
    </div>
  );
};
