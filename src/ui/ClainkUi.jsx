import React from "react";
import { isMoreLine } from "../copy/claink.js";
import { CLAINK, buyClaink, cancelClaink, clainkCanCancel, clainkCanDeploy, clainkCanInstall, clainkCancelCost, clainkFrozen, deployClaink, dismissClaink, hideClainkCard } from "../game/claink.js";
import { QUARTER_WEEKS } from "../game/constants.js";
import { isRunOver } from "../game/log.js";
import { checkBurnout } from "../game/stress.js";
import { fmtTok, getQuarterInfo, money } from "../game/util.js";
import { AUDIO, reducedNow } from "./env.js";

const { useState, useEffect, useRef } = React;

// ---------- v1.20: clAInk UI (ad, agent workspace, end cards) ----------
// The ad pops up at run start; × turns clAInk off for the run. Activating swaps it for the agent workspace, which
// minimizes to a pill and drags anywhere. Position and minimized state are a UI preference, not run state.
export const CLAINK_UI_KEY="tst-claink-ui";
export const readClainkUi=()=>{
  try{
    const v=JSON.parse(localStorage.getItem(CLAINK_UI_KEY)||"null");
    // adMini is null until you minimize or expand the ad yourself (moving the console doesn't decide it for you)
    if(v && typeof v==="object") return {x:Number.isFinite(v.x)?v.x:null, y:Number.isFinite(v.y)?v.y:null, mini:!!v.mini, adMini:typeof v.adMini==="boolean"?v.adMini:null, chosen:true};
  }catch{}
  return {x:null,y:null,mini:false,adMini:null,chosen:false};
};
// until you choose, a short screen (landscape phone) gets the pills so neither the console nor the ad sits on End Week
export const isShortScreen=()=>typeof window!=="undefined" && window.innerHeight>0 && window.innerHeight<=600;
export const clainkUiFor=(u,short)=>({...(u.chosen ? u : {...u,mini:short}), adMini:u.adMini===null ? short : u.adMini});
// safe-area insets (the page uses viewport-fit=cover), read once from a probe element
let clainkInsets=null;
export const safeInsets=()=>{
  if(clainkInsets)return clainkInsets;
  const z={t:0,r:0,b:0,l:0};
  try{
    const p=document.createElement("div");
    p.style.cssText="position:fixed;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)";
    document.body.appendChild(p);
    const cs=window.getComputedStyle(p);
    clainkInsets={t:parseFloat(cs.paddingTop)||0,r:parseFloat(cs.paddingRight)||0,b:parseFloat(cs.paddingBottom)||0,l:parseFloat(cs.paddingLeft)||0};
    p.remove();
  }catch(_){ return z; }
  return clainkInsets;
};
if(typeof window!=="undefined" && window.addEventListener) window.addEventListener("resize",()=>{ clainkInsets=null; }); // rotation changes them
export const clampToView=(x,y,el)=>{
  const i=safeInsets(), w=el?el.offsetWidth:320, h=el?el.offsetHeight:200;
  const l=8+i.l, t=8+i.t, r=8+i.r, b=8+i.b;
  return {x:Math.round(Math.max(l,Math.min(x,window.innerWidth-w-r))), y:Math.round(Math.max(t,Math.min(y,window.innerHeight-h-b)))};
};
// A held Enter/Space auto-repeats. Once a clAInk control has used the key, swallow its repeats page-wide until the key
// comes back up, wherever focus lands next (End Week, the Writing Lesson dialog, an ending).
let clainkHeldKey=null;
export const guardHeldKey=(e)=>{
  if(e.repeat || (e.key!=="Enter" && e.key!==" ") || clainkHeldKey)return;
  const key=e.key;
  const block=ev=>{ if(ev.repeat && (ev.key==="Enter" || ev.key===" ")){ ev.preventDefault(); ev.stopPropagation(); } };
  const release=ev=>{ if(ev.key!==key)return; document.removeEventListener("keydown",block,true); document.removeEventListener("keyup",release,true); clainkHeldKey=null; };
  document.addEventListener("keydown",block,true);
  document.addEventListener("keyup",release,true);
  clainkHeldKey=block;
};
export const swallowRepeat=(e)=>{ if(e.repeat && (e.key==="Enter" || e.key===" ")){ e.preventDefault(); return true; } guardHeldKey(e); return false; };
// A pointer close/minimize makes its control vanish (or move); the rest of that double/triple click or tap must not land on
// the game button underneath. Only clicks of the same burst, near the same spot, are swallowed (each extends the burst);
// keyboard clicks and deliberate clicks elsewhere pass. UI-only timer: it never touches game state.
export const shieldNextClick=(e)=>{
  if(!e || e.detail===0)return;
  const x0=e.clientX, y0=e.clientY;
  let t=0;
  const off=()=>{ document.removeEventListener("click",swallow,true); clearTimeout(t); };
  const arm=()=>{ clearTimeout(t); t=setTimeout(off,600); };
  const swallow=ev=>{
    if(ev.detail===0 || Math.abs(ev.clientX-x0)>40 || Math.abs(ev.clientY-y0)>40)return;
    ev.preventDefault(); ev.stopPropagation(); arm();
  };
  document.addEventListener("click",swallow,true);
  arm();
};
// keyboard-activated close: send focus somewhere useful instead of <body> (held-key repeats are already swallowed)
export const focusEndWeek=(e)=>{ if(e && e.detail===0){ const b=document.querySelector(".footer .btn.primary"); if(b) try{ b.focus(); }catch(_){} } else shieldNextClick(e); };

let clainkMarkSeq=0;
export const ClainkMark=({size=24})=>{
  const id=useRef(null);
  if(id.current===null) id.current="clkg"+(++clainkMarkSeq);
  return(
    <svg className="claink-mark" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={id.current} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#a78bfa"/><stop offset=".55" stopColor="#22d3ee"/><stop offset="1" stopColor="#f472b6"/>
        </linearGradient>
      </defs>
      <rect x="1.5" y="1.5" width="29" height="29" rx="9.5" fill={`url(#${id.current})`}/>
      <path d="M16 5.5 18.4 13.6 26.5 16 18.4 18.4 16 26.5 13.6 18.4 5.5 16 13.6 13.6Z" fill="#0c0a22"/>
      <circle cx="23.6" cy="8.4" r="1.7" fill="#0c0a22"/>
    </svg>
  );
};
export const ClainkLogo=({small})=>(
  <span className={"claink-logo"+(small?" sm":"")} role="img" aria-label="clAInk Enterprise">
    <ClainkMark size={small?18:30}/>
    <span className="claink-word" aria-hidden="true">cl<b>AI</b>nk</span>
    <span className="claink-tier" aria-hidden="true">ENTERPRISE</span>
  </span>
);

// v1.21: the ad minimizes to a pill (the – button, or Esc) and expands again from it; × still turns clAInk off for the
// run. Minimized is a UI preference like the workspace's (it survives a reload, and a new run expands the ad again).
export const ClainkAd=({s,mini,onToggle,onInstall,onDismiss})=>{
  const ref=useRef(null), ctaRef=useRef(null), notNowRef=useRef(null), toggleRef=useRef(null);
  const[step,setStep]=useState(0); // 0: CTA, 1: the AI use policy + confirm
  const focusNext=useRef(null);
  const policyIdRef=useRef(null);
  if(policyIdRef.current===null) policyIdRef.current="claink-policy-"+(++clainkMarkSeq);
  const policyId=policyIdRef.current, bodyId=policyId+"-body";
  const can=clainkCanInstall(s);
  const declined=!isRunOver(s) && s.cash-CLAINK.INSTALL<=CLAINK.REPO_AT;
  const lastWeek=getQuarterInfo(s.week).weekInQuarter>=CLAINK.OFFER_LAST_WEEK;
  const ends=lastWeek ? "Pilot pricing ends this week" : `Pilot pricing ends Week ${CLAINK.OFFER_LAST_WEEK}`;
  // focus follows the control that replaced the one you used (never back to <body>)
  useEffect(()=>{
    const k=focusNext.current; focusNext.current=null;
    const el=k==="notnow" ? notNowRef.current : k==="cta" ? ctaRef.current : k==="toggle" ? toggleRef.current : null;
    if(el) try{ el.focus({preventScroll:true}); }catch(_){}
  });
  // the ad is bottom-anchored: reserve that much page under it so End Week, deals and the log always scroll clear
  // (on a desktop display the page doesn't scroll; the activity log scrolls clear of it instead, see the CSS)
  useEffect(()=>{
    const el=ref.current, root=document.documentElement;
    if(!el)return;
    const set=()=>{ const b=parseFloat(window.getComputedStyle(el).bottom)||16; root.style.setProperty("--claink-h",Math.ceil(el.offsetHeight+b+8)+"px"); };
    set();
    let ro=null;
    if(typeof ResizeObserver!=="undefined"){ ro=new ResizeObserver(set); ro.observe(el); }
    window.addEventListener("resize",set);
    return()=>{ if(ro)ro.disconnect(); window.removeEventListener("resize",set); root.style.removeProperty("--claink-h"); };
  },[]);
  const toggle=(e)=>{ focusNext.current="toggle"; onToggle(); shieldNextClick(e); }; // the toggle moves out from under the pointer
  const onKeyDown=e=>{
    if(swallowRepeat(e))return;
    if(e.key!=="Escape")return;
    if(e.repeat){ e.preventDefault(); return; }
    if(step===1){ e.preventDefault(); focusNext.current="cta"; setStep(0); }
    else if(!mini){ e.preventDefault(); toggle(e); }
  };
  return(
    <aside ref={ref} className={"claink-ad"+(mini?" is-mini":"")+(step===1 && !mini?" confirming":"")} aria-label={"Sponsored: clAInk Enterprise"+(mini?" (minimized)":"")} onKeyDown={onKeyDown}>
      <div className="claink-ad-top">
        {mini
          ? <span className="claink-ad-pill"><ClainkMark size={16}/><span className="claink-word" aria-hidden="true">cl<b>AI</b>nk</span><span className="sr-only">clAInk. </span><span className="ends">{ends}</span></span>
          : <span className="claink-sponsored">Sponsored · Enterprise pilot</span>}
        <span className="claink-ad-btns">
          <button type="button" ref={toggleRef} className="claink-ad-min" aria-expanded={!mini} aria-controls={bodyId}
            aria-label={mini ? "Expand clAInk ad" : "Minimize clAInk ad"} title={mini ? "Expand" : "Minimize"}
            onClick={toggle}><span aria-hidden="true">{mini ? "▢" : "–"}</span></button>
          <button type="button" className="claink-ad-close" aria-label="Close ad. clAInk will be off for this run"
            title="Close (turns clAInk off for this run)" onClick={onDismiss}><span aria-hidden="true">×</span></button>
        </span>
      </div>
      <div className="claink-ad-body" id={bodyId} hidden={mini}>
        <div className="claink-announce"><span aria-hidden="true">✦</span><span>New: <b>Autonomous Pipeline</b> is GA</span><span aria-hidden="true">→</span></div>
        <ClainkLogo/>
        <h3 className="claink-headline">Your reps sell. Our agents do everything else.</h3>
        <p className="claink-sub">Up to 70% of a rep's week is busywork. clAInk runs a team of autonomous agents that research accounts, write the outreach and advance your deals, around the clock.</p>
        <div className="claink-chips"><span>Account research</span><span>Outreach at scale</span><span>Deal advancement</span></div>
        <p className="claink-proof">“Our agents completed 1.2 million tasks last quarter.”<span>VP of RevOps, Fortune 500 logistics company</span></p>
        <div className="claink-price"><b>Outcome-based pricing.</b> Pay for every outcome, plus the tokens it took to get there.</div>
        <div className="claink-badges"><span>SOC 2 Type II</span><span>SSO</span><span>Human-in-the-loop (optional)</span><span className="urgent"><span aria-hidden="true">⏳ </span>{ends}</span></div>
        <div className="claink-actions">
          {step===0
            ? <button type="button" ref={ctaRef} className="claink-cta" disabled={!can}
                onClick={()=>{ focusNext.current="notnow"; setStep(1); }}>{declined ? "Declined · cash too low" : `Activate seat · ${money(CLAINK.INSTALL)}`}</button>
            : <>
                <div className="claink-policy" id={policyId} role="group" aria-labelledby={policyId+"-hd"}>
                  <div className="hd" id={policyId+"-hd"}>Shitcorp AI Use Policy <span>v3 (final) (2)</span></div>
                  <ul>
                    <li>The seat, the tokens and every “outcome” come out of your commission.</li>
                    <li>A run that closes $0 earns a strike from the AI Governance Council.</li>
                    <li>Strike {CLAINK.STRIKES}: seat revoked, plus the token true-up.</li>
                  </ul>
                </div>
                <div className="claink-confirm-row">
                  <button type="button" className="claink-confirm" disabled={!can} onClick={onInstall} aria-describedby={policyId}>Accept · {money(CLAINK.INSTALL)}</button>
                  <button type="button" ref={notNowRef} className="claink-notnow" onClick={()=>{ focusNext.current="cta"; setStep(0); }} aria-describedby={policyId}>Not now</button>
                </div>
              </>}
        </div>
        <p className="claink-fine">Charged back to you under the Shitcorp AI Use Policy. Usage is invoiced Fridays.
          Pilot results: 1 in 5 agent runs closed real revenue. The other 4 delivered outcomes. Offer ends after Week {CLAINK.OFFER_LAST_WEEK}.</p>
      </div>
    </aside>
  );
};

// Three boxes, filled by Shitcorp's AI Governance Council. The note under them says what the next strike costs.
// At two strikes it works out where the true-up leaves you: max(the run's usage, all your cash + $200-1,800), so a
// player already in the red lands at cash minus the run's usage, which can be Collections outright.
export const ckTrueUpRange=(cash,due)=>{
  const lo=CLAINK.RETAINER+CLAINK.OUTCOMES[0]*CLAINK.PER_OUTCOME[0], hi=CLAINK.RETAINER+CLAINK.OUTCOMES[1]*CLAINK.PER_OUTCOME[1];
  return [Math.min(-CLAINK.TRUEUP_OVER[0],cash-(due+lo)), Math.min(-CLAINK.TRUEUP_OVER[1],cash-(due+hi))];
};
export const ClainkStrikes=({n,log,cash,due,ran})=>{
  const S=CLAINK.STRIKES, hot=n>=S-1;
  let note;
  if(!hot) note=n===0 ? `Every run that closes $0 is a strike. ${S} and the seat is revoked.`
    : `${n} down. Strike ${S} revokes the seat and runs the token true-up.`;
  else{
    // after this week's run the next one waits for Friday's bill and payday, so only the usual range holds
    const [best,worst]=ran ? [-CLAINK.TRUEUP_OVER[0],-CLAINK.TRUEUP_OVER[1]] : ckTrueUpRange(cash,due);
    const head=`Next $0 run is strike ${S}: seat revoked, a deal walks, and the token true-up `;
    note=!ran && best<=CLAINK.REPO_AT ? head+"sends you to Collections."
      : head+`leaves you around ${money(best)} to ${money(worst)}${ran?", worse if you're in the red":""}. Collections comes at ${money(CLAINK.REPO_AT)}.`;
  }
  return(
    <div className={"claink-strikes"+(hot?" hot":"")}>
      <div className="row1">
        <span className="lbl">Strikes</span>
        <span className="boxes" role="img" aria-label={`${n} of ${S} strikes`}>
          {Array.from({length:S},(_,i)=>{
            const on=i<n, e=log.find(x=>x.n===i+1);
            const tip=on ? (e ? `Strike ${i+1} · ${e.who}: ${e.line}` : `Strike ${i+1}`) : i+1===S ? `Strike ${S}: seat revoked` : undefined;
            return <span key={i} className={"ck-box"+(on?" on":"")} title={tip}>{on?"✕":i+1}</span>;
          })}
        </span>
        <span className="who">AI Governance Council</span>
      </div>
      <div className={"note"+(hot?" warn":"")}>{note}</div>
    </div>
  );
};

export const ClainkStrikeCard=({st})=>(
  <div className={"claink-strike ck-beat"+(st.n>=CLAINK.STRIKES?" out":"")}>
    <div className="hd">Strike {st.n} of {CLAINK.STRIKES}{st.who && <span> · filed by {st.who}</span>}</div>
    <p>{st.why}</p>
    {st.fx && <div className="fx">{st.fx}</div>}
  </div>
);

// The run report. beat 0 is "agents working" (tokens ticking up); each beat after that lands one more piece:
// the report lines one by one, the net line, then the strike (or the all-clear). 99 = everything.
export const ClainkReport=({last,beat,workTok,onSkip})=>{
  const k=last.kind, all=beat>=99, nL=last.lines.length;
  if(k==="onboarded") return(
    <div className="claink-report onboarded">
      <div className="hd"><span>Welcome aboard</span></div>
      <ul>{last.lines.map((l,i)=><li key={i}>{l}</li>)}</ul>
    </div>
  );
  if(!all && beat<=0) return(
    <div className="claink-report working" onClick={onSkip||undefined} title="Click or press Esc to skip">
      <span aria-hidden="true">◌ </span>Agents working… <b>{fmtTok(workTok)}</b> tokens
    </div>
  );
  const miracle=k==="miracle", shown=all ? nL : Math.min(nL,beat);
  const net=all || beat>nL, card=all || beat>nL+1;
  return(<>
    {nL>0 && <div className={"claink-report "+(miracle?"miracle":"strike")+(onSkip?" revealing":"")} onClick={onSkip||undefined} title={onSkip?"Click or press Esc to skip":undefined}>
      <div className="hd"><span>{miracle ? <><span aria-hidden="true">✨ </span>It actually worked</> : last.run ? `Run ${last.run} · outcomes delivered` : "Outcomes delivered"}</span>
        {last.tokens>0 && <span className="tok">{fmtTok(last.tokens)} tokens</span>}</div>
      <ul>{last.lines.slice(0,shown).map((l,i)=><li key={i} className={"ck-beat"+(isMoreLine(l)?" more":"")}>{l}</li>)}</ul>
      {net && <div className={"net ck-beat"+(miracle?"":" zero")}>{miracle ? `Closed +${money(last.revenue)} · verified by Finance` : "Closed: $0"}</div>}
    </div>}
    {card && (last.strike ? <ClainkStrikeCard st={last.strike}/> : miracle && last.clear ? <div className="claink-clear ck-beat">{last.clear}</div> : null)}
  </>);
};

// the seat's obituary: the three strikes as filed, and what the pilot cost
export const ClainkRevoked=({c})=>(
  <div className="claink-revoked ck-beat">
    <div className="stamp" aria-hidden="true">REVOKED</div>
    <p>The AI Governance Council has sunset your agents. They will be missed by no one.</p>
    {c.last && c.last.farewell && <p className="farewell">Its farewell email to {c.last.farewell}: “It's not you, it's me.” They agreed.</p>}
    {c.strikeLog.length>0 && <ol className="claink-recap">{c.strikeLog.map((e,i)=>(
      <li key={`${e.n}-${i}`}><span className="num" aria-hidden="true">{e.n}</span><span className="sr-only">Strike {e.n}: </span><b>{e.who}</b> · {e.line}</li>
    ))}</ol>}
    <p className="claink-stats">{fmtTok(c.tokens)} tokens · Influenced {money(c.claimed)} · Closed {money(c.delivered)} · Charged back {money(c.billed)}</p>
  </div>
);

export const CK_WORK_MS=650, CK_BEAT_MS=280;

export const ClainkConsole=({s,ui,setUi,focusOnMount,onDeploy,onCancel,onHide,onRevealDone})=>{
  const c=s.claink;
  const end=c.status!=="active";
  const mini=!!ui.mini && !end;
  const ref=useRef(null), statusRef=useRef(null), toggleRef=useRef(null), cancelRef=useRef(null), keepRef=useRef(null);
  // pos = where you put it (saved); shown = where it fits on this screen right now (never saved, so a rotation or a
  // short-lived resize doesn't lose your spot)
  const[pos,setPos]=useState(()=>Number.isFinite(ui.x) && Number.isFinite(ui.y) ? {x:ui.x,y:ui.y} : null);
  const[shown,setShown]=useState(null);
  const[confirmCancel,setConfirmCancel]=useState(false);
  const[dragging,setDragging]=useState(false);
  const drag=useRef(null);
  const focusNext=useRef(focusOnMount ? "status" : null);
  const bodyIdRef=useRef(null);
  if(bodyIdRef.current===null) bodyIdRef.current="claink-body-"+(++clainkMarkSeq);
  const bodyId=bodyIdRef.current;
  // v1.20: a run plays out beat by beat (tokens tick up, outcomes land one at a time, then the strike lands), so a run
  // reads as a short story instead of a wall of text, and each beat is voiced as it lands (the activity log leaves these
  // lines to the workspace). Only a run you just started plays: a reload, a minimized workspace or reduced motion gets
  // the whole report, and one cue, at once. Click the report or press Esc to skip. onRevealDone hands over the Writing
  // Lesson (if the manager took a deal) once the report has had its say.
  const[beat,setBeat]=useState(99);
  const[workTok,setWorkTok]=useState(0);
  const seenRun=useRef(c.deploys);
  const reveal=useRef({timers:[],live:false});
  const holdH=useRef(0); // the window keeps its height while a report replays, so nothing moves under the pointer
  const doneRef=useRef(onRevealDone); doneRef.current=onRevealDone;
  const liveS=useRef(s); liveS.current=s;
  const handOver=()=>{ const r=reveal.current; if(r.live){ r.live=false; if(doneRef.current) doneRef.current(); } };
  const finishReveal=()=>{
    const r=reveal.current;
    r.timers.forEach(clearTimeout); r.timers=[];
    holdH.current=0;
    setBeat(99);
    handOver();
  };
  // one beat's sound and PA line; silent once an ending is playing its own score
  const cue=(sound,pa)=>{
    if(isRunOver(liveS.current))return;
    const a=AUDIO(); if(!a)return;
    if(sound) a.play(sound);
    if(pa) a.say(pa,{cooldown:4000});
  };
  // a layout effect, so the finished report never paints ahead of "Agents working…"
  (React.useLayoutEffect||useEffect)(()=>{
    if(c.deploys===seenRun.current)return;
    seenRun.current=c.deploys;
    const r=reveal.current, L=c.last;
    r.timers.forEach(clearTimeout); r.timers=[]; r.live=true;
    const isRun=!!L && (L.kind==="miracle" || L.kind==="strike" || L.kind==="revoked");
    if(!isRun){ setBeat(99); r.timers.push(setTimeout(finishReveal,0)); return; }
    const out=L.kind==="revoked", win=L.kind==="miracle", hurt=!!(L.strike && L.strike.hurt);
    // one PA line per run: HR offboarding the agent, else the manager (the warning and a yoink speak when their dialog
    // opens), else the result
    const managerPa=L.ping && !L.yoink && !L.warn && !out ? "chatgdp" : null;
    const resultPa=out ? "clainkRevoked" : L.ping ? null : win ? "claink" : hurt ? "sev1" : "strike";
    const hit=out ? "bsod" : win ? "cash" : hurt ? "glitch" : "stamp";
    // nothing to watch: hand over right after this commit (so the page's own effects have seen the new state)
    if(reducedNow() || mini){ setBeat(99); cue(hit,resultPa||managerPa); if(L.cashWarn) cue("alarm"); r.timers.push(setTimeout(finishReveal,0)); return; }
    const nL=L.lines.length, beats=nL+2+(L.ping?1:0)+(out?1:0), tok=L.tokens||0;
    const at=b=>CK_WORK_MS+(b-1)*CK_BEAT_MS, later=(ms,fn)=>r.timers.push(setTimeout(fn,ms));
    setBeat(0); setWorkTok(Math.round(tok*0.06)); cue("beep");
    for(let i=1;i<6;i++) later(i*CK_WORK_MS/6,()=>setWorkTok(Math.round(tok*Math.min(1,0.06+i*0.19))));
    for(let b=1;b<=beats;b++) later(at(b),()=>setBeat(b));
    // the cues ride the same beats: a tick per outcome, the net, the strike (or the all-clear), the manager, the farewell
    for(let b=1;b<=nL;b++) later(at(b),()=>cue(b===1 && win ? "sparkle" : "tick"));
    later(at(nL+1),()=>cue(win ? "cash" : "thud"));
    later(at(nL+2),()=>{ cue(win ? null : hit,resultPa); if(L.cashWarn) cue("alarm"); });
    if(L.ping) later(at(nL+3),()=>cue(L.yoink ? "lost" : "suspicion",managerPa));
    if(out && L.farewell) later(at(beats),()=>cue("lost"));
    later(CK_WORK_MS+beats*CK_BEAT_MS,finishReveal);
  },[c.deploys]);
  // closed mid-report (the end card's × finishes it first; an unmount here means New Game or Load, and the page drops it)
  useEffect(()=>()=>{ const r=reveal.current; r.timers.forEach(clearTimeout); r.timers=[]; handOver(); },[]);
  const place=p=>{ setPos(p); setShown(p); setUi(u=>({...u,x:p.x,y:p.y,mini})); }; // user moves only; keeps what you see (pill or console)
  const fit=()=>{
    const el=ref.current;
    if(!el || !pos || drag.current)return;
    const p=clampToView(pos.x,pos.y,el);
    if(!shown || p.x!==shown.x || p.y!==shown.y) setShown(p);
  };
  // focus follows the control that replaced the one you used (never back to <body>)
  useEffect(()=>{
    const k=focusNext.current; focusNext.current=null;
    const el=k==="status" ? (mini ? toggleRef.current : statusRef.current) : k==="toggle" ? toggleRef.current : k==="cancel" ? cancelRef.current : k==="keep" ? keepRef.current : null;
    if(el) try{ el.focus({preventScroll:true}); }catch(_){}
  });
  // fit before paint after every render, so content that just grew (cancel confirm, a report line) never flashes off-screen
  (React.useLayoutEffect||useEffect)(fit);
  // ...and on size changes React didn't cause (fonts loading) and window resizes / rotations
  useEffect(()=>{
    const el=ref.current;
    let ro=null;
    if(el && typeof ResizeObserver!=="undefined"){ ro=new ResizeObserver(fit); ro.observe(el); }
    window.addEventListener("resize",fit);
    return()=>{ if(ro)ro.disconnect(); window.removeEventListener("resize",fit); };
  },[pos,shown,mini,end]);
  // a run result also reaches screen readers when a dialog has already made the page inert (an ending that the run
  // caused; the delayed Writing Lesson carries its own copy). Only for results that happen while you're here: a reload
  // must not replay an old one into an ending dialog.
  const heard=useRef(`${c.deploys}|${c.status}`);
  useEffect(()=>{
    const key=`${c.deploys}|${c.status}`;
    if(heard.current===key || !c.last || !c.last.announce)return;
    heard.current=key;
    const t=setTimeout(()=>{ const sr=document.querySelector("dialog[open] .tst-sr"); if(sr){ sr.textContent=""; sr.textContent=c.last.announce; } },120);
    return()=>clearTimeout(t);
  },[c.deploys,c.status]);
  const onPointerDown=e=>{
    if(e.pointerType==="mouse" && e.button!==0)return;
    if(e.target.closest && e.target.closest("button:not(.claink-grip)"))return; // the grip drags too; minimize/close don't
    const el=ref.current; if(!el)return;
    const r=el.getBoundingClientRect();
    drag.current={id:e.pointerId,dx:e.clientX-r.left,dy:e.clientY-r.top,moved:false};
    try{ e.currentTarget.setPointerCapture(e.pointerId); }catch(_){}
    setDragging(true);
  };
  const onPointerMove=e=>{
    const d=drag.current; if(!d || d.id!==e.pointerId)return;
    d.moved=true;
    const p=clampToView(e.clientX-d.dx,e.clientY-d.dy,ref.current);
    setPos(p); setShown(p);
  };
  const endDrag=e=>{
    const d=drag.current; if(!d || d.id!==e.pointerId)return;
    drag.current=null; setDragging(false);
    const el=ref.current;
    if(d.moved && el){ const r=el.getBoundingClientRect(); place(clampToView(r.left,r.top,el)); }
  };
  const onGripKey=e=>{
    const dir={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];
    if(!dir)return;
    e.preventDefault();
    const el=ref.current; if(!el)return;
    const r=el.getBoundingClientRect(), step=e.shiftKey?64:16;
    place(clampToView(r.left+dir[0]*step,r.top+dir[1]*step,el));
  };
  // minimize/expand keeps your parked spot (the console may sit higher only while it needs the room); with no spot yet,
  // the top-left corner you see becomes it, so the pill stays put
  const toggle=(e)=>{
    const el=ref.current;
    let p=pos;
    if(!p && el){ const r=el.getBoundingClientRect(); p={x:Math.round(r.left),y:Math.round(r.top)}; }
    if(p){ setPos(p); setShown(null); }
    setUi(u=>({...u,x:p?p.x:u.x,y:p?p.y:u.y,mini:!mini}));
    focusNext.current="toggle";
    shieldNextClick(e); // the toggle moves out from under the pointer
  };
  const onKeyDown=e=>{
    if(swallowRepeat(e))return;
    if(e.key==="Escape" && e.repeat){ e.preventDefault(); return; }
    if(e.key==="Escape" && beat<99){ e.preventDefault(); finishReveal(); return; }
    if(e.key==="Escape" && !end && !ui.mini){ e.preventDefault(); toggle(); }
  };
  const L=c.last;
  const isRun=!!L && (L.kind==="miracle" || L.kind==="strike" || L.kind==="revoked");
  const nL=L ? L.lines.length : 0, all=beat>=99;
  // the strike box fills when its card lands, not while the agents are still "working"
  const strikeIn=all || beat>nL+1;
  const strikes=c.strikes||0;
  const shownStrikes=(isRun && L.strike && !strikeIn) ? Math.max(0,strikes-1) : strikes;
  const pingIn=all || beat>nL+2;
  const endIn=all || beat>nL+2+(L && L.ping?1:0);
  const cost=clainkCancelCost(s), canCancel=clainkCanCancel(s);
  const frozen=clainkFrozen(s);
  const pill=end ? (c.status==="revoked" ? "Revoked" : "Cancelled") : frozen ? "Frozen" : c.deployed ? "Ran" : "Ready";
  const at=shown||pos;
  const hold=beat<99 && holdH.current && !mini && c.status!=="cancelled" ? Math.min(holdH.current,window.innerHeight-24) : 0;
  const style=at || hold ? {...(at?{left:at.x+"px",top:at.y+"px"}:{}),...(hold?{minHeight:hold+"px"}:{})} : undefined;
  const skip=beat<99 ? finishReveal : null;
  return(
    <aside ref={ref} style={style} onKeyDown={onKeyDown} aria-label="clAInk agent workspace"
      className={"claink-console"+(mini?" is-mini":"")+(end?" is-end":"")+(pos?" is-placed":"")+(dragging?" dragging":"")}>
      <div className="claink-titlebar" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerCancel={endDrag}>
        <ClainkMark size={16}/>
        <span className="claink-title">clAInk{!mini && <span> Agent Workspace</span>}</span>
        {mini && <span className="claink-pilltext">{pill}{shownStrikes>0 && !end ? ` · ${shownStrikes}/${CLAINK.STRIKES} strikes` : ""}</span>}
        <span className={"claink-dot"+(end ? (endIn?" dead":" busy") : c.deployed?" busy":"")} aria-hidden="true"/>
        <span className="claink-tb-btns">
          <button type="button" className="claink-grip" aria-label="Move clAInk window" title="Drag to move, or use the arrow keys"
            onKeyDown={onGripKey}><span aria-hidden="true">⠿</span></button>
          {!end && <button type="button" ref={toggleRef} className="claink-min" aria-expanded={!mini} aria-controls={bodyId}
            aria-label={mini ? "Expand clAInk workspace" : "Minimize clAInk workspace"} title={mini ? "Expand" : "Minimize"}
            onClick={toggle}><span aria-hidden="true">{mini ? "▢" : "–"}</span></button>}
          {end && <button type="button" className="claink-end-close" aria-label="Close clAInk window" title="Close"
            onClick={e=>{ if(beat<99) finishReveal(); onHide(e); }}><span aria-hidden="true">×</span></button>}
        </span>
      </div>
      <div className="claink-body" id={bodyId} hidden={mini}>
        {c.status==="active" && <>
          <div className="claink-statusline" tabIndex={-1} ref={statusRef}><span aria-hidden="true">● </span>{frozen ? "Quarter-end freeze · no runs" : c.deployed ? "Agents ran this week" : "Agents idle · awaiting delegation"}</div>
          <button type="button" className="claink-deploy" disabled={!clainkCanDeploy(s)}
            onClick={e=>{ focusNext.current="status"; holdH.current=ref.current ? ref.current.offsetHeight : 0; shieldNextClick(e); onDeploy(); }}>
            <span><span aria-hidden="true">{frozen ? "🔒 " : c.deployed ? "✓ " : "▶ "}</span>{frozen ? "Quarter-end freeze" : c.deployed ? "Ran this week" : "Run agents"}</span>
            <small>{frozen ? "no runs in week 13" : c.deployed ? (getQuarterInfo(s.week).weekInQuarter>=QUARTER_WEEKS-1 ? "last run this quarter" : "next run: next week") : "0 energy · 0 slots · billed Fri"}</small>
          </button>
          <ClainkStrikes n={shownStrikes} log={c.strikeLog} cash={s.cash} due={c.due} ran={c.deployed}/>
        </>}
        {c.status==="revoked" && <div className="claink-statusline" tabIndex={-1} ref={statusRef}><span aria-hidden="true">● </span>{endIn ? "Seat revoked" : "Agents running…"}</div>}
        {L && c.status!=="cancelled" && (isRun || L.kind==="onboarded") && <ClainkReport last={L} beat={beat} workTok={workTok} onSkip={skip}/>}
        {L && L.ping && pingIn && <div className="claink-ping ck-beat"><span className="who"><span aria-hidden="true">👔 </span>Your manager</span><span>{L.ping}</span></div>}
        {c.status==="active" && <>
          {(all || !isRun) && <div className="claink-usage">{frozen ? <>Quarter-end freeze: nothing more gets billed · Charged back so far {money(c.billed)}</>
            : c.deployed ? <>This week: <b>{money(c.due)}</b> ({fmtTok(c.weekTokens)} tokens), billed Friday · Charged back so far {money(c.billed)}</>
            : <>Idle weeks still bill {money(CLAINK.IDLE[0])}–{money(CLAINK.IDLE[1])}: background agents keep “thinking” · Charged back so far {money(c.billed)}</>}</div>}
          {frozen ? null : !confirmCancel
            ? <button type="button" ref={cancelRef} className="claink-cancel-link"
                onClick={()=>{ focusNext.current="keep"; setConfirmCancel(true); }}>Cancel seat</button>
            : <div className="claink-cancel-box" role="group" aria-label="Cancel clAInk seat">
                <span>Early termination: {money(cost)} ({money(CLAINK.CANCEL)} fee + this week's usage).</span>
                <span className="offer">Before you go: Enterprise Plus hits 21% success. Just $4,999/wk.</span>
                <span className="row2">
                  <button type="button" ref={keepRef} className="claink-cancel-keep" onClick={()=>{ focusNext.current="cancel"; setConfirmCancel(false); }}>Keep agents</button>
                  <button type="button" className="claink-cancel-confirm" disabled={!canCancel}
                    onClick={()=>{ focusNext.current="status"; onCancel(); }}>{canCancel ? `Pay ${money(cost)} & cancel` : "Can't afford the fee"}</button>
                </span>
              </div>}
        </>}
        {c.status==="revoked" && endIn && <ClainkRevoked c={c}/>}
        {c.status==="cancelled" && <div className="claink-offboarded">
          <div className="claink-statusline" tabIndex={-1} ref={statusRef}>Seat cancelled</div>
          <p>Your data stays with clAInk “to improve the models.” <span aria-hidden="true">💜</span></p>
          <p className="claink-stats">{fmtTok(c.tokens)} tokens · Closed {money(c.delivered)} · Charged back {money(c.billed)}</p>
        </div>}
      </div>
      <div className="claink-live sr-only" aria-live="polite">{c.last && c.last.announce
        ? (isRun ? `Run ${c.deploys}: ${c.last.announce}` : c.last.announce) : ""}</div>
    </aside>
  );
};

// picks what clAInk shows: the ad, the workspace, an end card, or nothing (closed ad, expired offer, closed end card)
export const ClainkDock=({s,setS,ui,setUi,onEvent})=>{
  const c=s.claink;
  const prev=useRef(c ? c.status : null);
  const justInstalled=prev.current==="ad" && !!c && c.status==="active";
  useEffect(()=>{ prev.current=c ? c.status : null; });
  const lesson=useRef(null); // the Writing Lesson waits for the run's report to finish
  // New Game / Load remount the dock: React tears a deleted tree down parent first, so this drops a held lesson before
  // the workspace's own cleanup could hand it over into the next run
  useEffect(()=>()=>{ lesson.current=null; },[]);
  if(!c)return null;
  const commit=fn=>setS(p=>checkBurnout(fn(p)));
  if(c.status==="ad"){
    if(isRunOver(s) || getQuarterInfo(s.week).weekInQuarter>CLAINK.OFFER_LAST_WEEK)return null;
    // toggle from what you see, not from the stored preference (a short screen shows the pill before you chose)
    const adMini=!!ui.adMini;
    return <ClainkAd s={s} mini={adMini} onToggle={()=>setUi(u=>({...u,adMini:!adMini}))}
      onInstall={()=>commit(buyClaink)} onDismiss={e=>{ commit(dismissClaink); focusEndWeek(e); }}/>;
  }
  if(c.status==="active" || ((c.status==="cancelled" || c.status==="revoked") && !c.hidden)){
    return <ClainkConsole s={s} ui={ui} setUi={setUi} focusOnMount={justInstalled}
      onDeploy={()=>{
        const r=deployClaink(s), L=r.state.claink && r.state.claink.last;
        lesson.current=r.event ? {...r.event,week:r.state.week,runId:r.state.runId,run:r.state.claink.deploys,announce:(L && L.announce)||""} : null;
        setS(checkBurnout(r.state));
      }}
      onRevealDone={()=>{ const ev=lesson.current; lesson.current=null; if(ev) onEvent(ev); }}
      onCancel={()=>commit(cancelClaink)}
      onHide={e=>{ commit(hideClainkCard); focusEndWeek(e); }}/>;
  }
  return null;
};
