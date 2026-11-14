import React from "react";
import { isMoreLine } from "../copy/claink.js";
import { CK_AD, CK_END, CK_REPORT, CK_STRIKES, CK_WORKSPACE } from "../copy/clainkUi.js";
import { CLAINK, clainkCanCancel, clainkCanDeploy, clainkCanInstall, clainkCancelCost, clainkFrozen } from "../game/claink.js";
import { QUARTER_WEEKS } from "../game/constants.js";
import { isRunOver } from "../game/log.js";
import { getQuarterInfo } from "../game/util.js";
import { Icon } from "./app/Icon.jsx";
import { AUDIO, reducedNow } from "./env.js";

const { useState, useEffect, useRef } = React;

// ---------- v1.20: clAInk UI (ad, agent workspace, end cards) ----------
// The ad pops up at run start; its close button turns clAInk off for the run. Activating swaps it for the agent
// workspace. Both sit docked at the bottom of the right column (v2.0: nothing floats or drags any more) and both
// minimize to a pill. Minimized is a UI preference, not run state.
export const CLAINK_UI_KEY="tst-claink-ui";
export const readClainkUi=()=>{
  try{
    const v=JSON.parse(localStorage.getItem(CLAINK_UI_KEY)||"null");
    // adMini is null until you minimize or expand the ad yourself
    // (a window position saved by v1.21 is ignored)
    if(v && typeof v==="object") return {mini:!!v.mini, adMini:typeof v.adMini==="boolean"?v.adMini:null, chosen:true};
  }catch{}
  return {mini:false,adMini:null,chosen:false};
};
// until you choose, a short screen (landscape phone) gets the pills so neither the console nor the ad sits on End Week
export const isShortScreen=()=>typeof window!=="undefined" && window.innerHeight>0 && window.innerHeight<=600;
// narrow: a phone held upright. The ad is taller than that screen, so until you say otherwise it is its one-line bar
// (the workspace stays open: Run agents is a weekly control).
export const isNarrowScreen=()=>typeof window!=="undefined" && window.innerWidth>0 && window.innerWidth<=640;
export const clainkUiFor=(u,short,narrow)=>({...(u.chosen ? u : {...u,mini:short}), adMini:u.adMini===null ? (short||!!narrow) : u.adMini});
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
export const focusEndWeek=(e)=>{ if(e && e.detail===0){ const b=document.querySelector('[data-ui="end"]'); if(b) try{ b.focus(); }catch(_){} } else shieldNextClick(e); };

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
  const ends=CK_AD.ends(lastWeek,CLAINK.OFFER_LAST_WEEK);
  // focus follows the control that replaced the one you used (never back to <body>)
  useEffect(()=>{
    const k=focusNext.current; focusNext.current=null;
    const el=k==="notnow" ? notNowRef.current : k==="cta" ? ctaRef.current : k==="toggle" ? toggleRef.current : null;
    if(el) try{ el.focus({preventScroll:true}); }catch(_){}
  });
  const toggle=(e)=>{ focusNext.current="toggle"; onToggle(); shieldNextClick(e); }; // the toggle moves out from under the pointer
  const onKeyDown=e=>{
    if(swallowRepeat(e))return;
    if(e.key!=="Escape")return;
    if(e.repeat){ e.preventDefault(); return; }
    if(step===1){ e.preventDefault(); focusNext.current="cta"; setStep(0); }
    else if(!mini){ e.preventDefault(); toggle(e); }
  };
  return(
    <aside ref={ref} className={"claink-ad"+(mini?" is-mini":"")+(step===1 && !mini?" confirming":"")} aria-label={CK_AD.label(mini)} onKeyDown={onKeyDown}>
      <div className="claink-ad-top">
        {mini
          ? <span className="claink-ad-pill"><ClainkMark size={16}/><span className="claink-word" aria-hidden="true">cl<b>AI</b>nk</span><span className="sr-only">clAInk. </span><span className="ends">{ends}</span></span>
          : <span className="claink-sponsored">{CK_AD.sponsored}</span>}
        <span className="claink-ad-btns">
          <button type="button" ref={toggleRef} className="claink-ad-min" aria-expanded={!mini} aria-controls={bodyId}
            aria-label={mini ? CK_AD.expandLabel : CK_AD.minimizeLabel} title={mini ? CK_AD.expand : CK_AD.minimize}
            onClick={toggle}>{mini ? <Icon name="maximize-2" /> : <Icon name="minus" />}</button>
          <button type="button" className="claink-ad-close" aria-label={CK_AD.closeLabel}
            title={CK_AD.closeTitle} onClick={onDismiss}><Icon name="x" /></button>
        </span>
      </div>
      <div className="claink-ad-body" id={bodyId} hidden={mini}>
        <div className="claink-announce"><Icon name="sparkles" /><span>{CK_AD.announce[0]}<b>{CK_AD.announce[1]}</b>{CK_AD.announce[2]}</span><Icon name="arrow-right" /></div>
        <ClainkLogo/>
        <h3 className="claink-headline">{CK_AD.headline}</h3>
        <p className="claink-sub">{CK_AD.sub}</p>
        <div className="claink-chips">{CK_AD.chips.map(t=><span key={t}>{t}</span>)}</div>
        <p className="claink-proof">{CK_AD.proof}<span>{CK_AD.proofBy}</span></p>
        <div className="claink-price"><b>{CK_AD.price[0]}</b>{CK_AD.price[1]}</div>
        <div className="claink-badges">{CK_AD.badges.map(t=><span key={t}>{t}</span>)}<span className="urgent"><Icon name="hourglass" />{ends}</span></div>
        <div className="claink-actions">
          {step===0
            ? <button type="button" ref={ctaRef} className="claink-cta" disabled={!can}
                onClick={()=>{ focusNext.current="notnow"; setStep(1); }}>{declined ? CK_AD.declined : CK_AD.activate(CLAINK.INSTALL)}</button>
            : <>
                <div className="claink-policy" id={policyId} role="group" aria-labelledby={policyId+"-hd"}>
                  <div className="hd" id={policyId+"-hd"}>{CK_AD.policyTitle} <span>{CK_AD.policyVersion}</span></div>
                  <ul>{CK_AD.policy(CLAINK.STRIKES).map((t,i)=><li key={i}>{t}</li>)}</ul>
                </div>
                <div className="claink-confirm-row">
                  <button type="button" className="claink-confirm" disabled={!can} onClick={onInstall} aria-describedby={policyId}>{CK_AD.accept(CLAINK.INSTALL)}</button>
                  <button type="button" ref={notNowRef} className="claink-notnow" onClick={()=>{ focusNext.current="cta"; setStep(0); }} aria-describedby={policyId}>{CK_AD.notNow}</button>
                </div>
              </>}
        </div>
        <p className="claink-fine">{CK_AD.fine(CLAINK.OFFER_LAST_WEEK)}</p>
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
  if(!hot) note=n===0 ? CK_STRIKES.none(S) : CK_STRIKES.some(n,S);
  else{
    // after this week's run the next one waits for Friday's bill and payday, so only the usual range holds
    const [best,worst]=ran ? [-CLAINK.TRUEUP_OVER[0],-CLAINK.TRUEUP_OVER[1]] : ckTrueUpRange(cash,due);
    const head=CK_STRIKES.hotHead(S);
    note=!ran && best<=CLAINK.REPO_AT ? head+CK_STRIKES.hotCollections : head+CK_STRIKES.hotRange(best,worst,ran,CLAINK.REPO_AT);
  }
  return(
    <div className={"claink-strikes"+(hot?" hot":"")}>
      <div className="row1">
        <span className="lbl">{CK_STRIKES.label}</span>
        <span className="boxes" role="img" aria-label={CK_STRIKES.count(n,S)}>
          {Array.from({length:S},(_,i)=>{
            const on=i<n, e=log.find(x=>x.n===i+1);
            const tip=on ? CK_STRIKES.tip(i+1,e && e.who,e && e.line) : i+1===S ? CK_STRIKES.lastTip(S) : undefined;
            return <span key={i} className={"ck-box"+(on?" on":"")} title={tip}>{on ? <Icon name="x" /> : i+1}</span>;
          })}
        </span>
        <span className="who">{CK_STRIKES.who}</span>
      </div>
      <div className={"note"+(hot?" warn":"")}>{note}</div>
    </div>
  );
};

export const ClainkStrikeCard=({st})=>(
  <div className={"claink-strike ck-beat"+(st.n>=CLAINK.STRIKES?" out":"")}>
    <div className="hd">{CK_STRIKES.cardHead(st.n,CLAINK.STRIKES)}{st.who && <span>{CK_STRIKES.cardBy(st.who)}</span>}</div>
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
      <div className="hd"><span>{CK_REPORT.welcome}</span></div>
      <ul>{last.lines.map((l,i)=><li key={i}>{l}</li>)}</ul>
    </div>
  );
  if(!all && beat<=0) return(
    <div className="claink-report working" onClick={onSkip||undefined} title={CK_REPORT.skip}>
      <Icon name="loader" />{CK_REPORT.working}<b>{CK_REPORT.tokens(workTok)}</b>
    </div>
  );
  const miracle=k==="miracle", shown=all ? nL : Math.min(nL,beat);
  const net=all || beat>nL, card=all || beat>nL+1;
  return(<>
    {nL>0 && <div className={"claink-report "+(miracle?"miracle":"strike")+(onSkip?" revealing":"")} onClick={onSkip||undefined} title={onSkip ? CK_REPORT.skip : undefined}>
      <div className="hd"><span>{miracle ? <><Icon name="sparkles" />{CK_REPORT.worked}</> : CK_REPORT.delivered(last.run)}</span>
        {last.tokens>0 && <span className="tok">{CK_REPORT.tokens(last.tokens)}</span>}</div>
      <ul>{last.lines.slice(0,shown).map((l,i)=><li key={i} className={"ck-beat"+(isMoreLine(l)?" more":"")}>{l}</li>)}</ul>
      {net && <div className={"net ck-beat"+(miracle?"":" zero")}>{miracle ? CK_REPORT.closed(last.revenue) : CK_REPORT.closedNone}</div>}
    </div>}
    {card && (last.strike ? <ClainkStrikeCard st={last.strike}/> : miracle && last.clear ? <div className="claink-clear ck-beat">{last.clear}</div> : null)}
  </>);
};

// the seat's obituary: the three strikes as filed, and what the pilot cost
export const ClainkRevoked=({c})=>(
  <div className="claink-revoked ck-beat">
    <div className="stamp" aria-hidden="true">{CK_END.stamp}</div>
    <p>{CK_END.sunset}</p>
    {c.last && c.last.farewell && <p className="farewell">{CK_END.farewell(c.last.farewell)}</p>}
    {c.strikeLog.length>0 && <ol className="claink-recap">{c.strikeLog.map((e,i)=>(
      <li key={`${e.n}-${i}`}><span className="num" aria-hidden="true">{e.n}</span><span className="sr-only">{CK_END.strikeSr(e.n)}</span><b>{e.who}</b> · {e.line}</li>
    ))}</ol>}
    <p className="claink-stats">{CK_END.statsRevoked(c.tokens,c.claimed,c.delivered,c.billed)}</p>
  </div>
);

export const CK_WORK_MS=650, CK_BEAT_MS=280;

export const ClainkConsole=({s,ui,setUi,focusOnMount,onDeploy,onCancel,onHide,onRevealDone})=>{
  const c=s.claink;
  const end=c.status!=="active";
  const mini=!!ui.mini && !end;
  const ref=useRef(null), statusRef=useRef(null), toggleRef=useRef(null), cancelRef=useRef(null), keepRef=useRef(null);
  const[confirmCancel,setConfirmCancel]=useState(false);
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
  // focus follows the control that replaced the one you used (never back to <body>)
  useEffect(()=>{
    const k=focusNext.current; focusNext.current=null;
    const el=k==="status" ? (mini ? toggleRef.current : statusRef.current) : k==="toggle" ? toggleRef.current : k==="cancel" ? cancelRef.current : k==="keep" ? keepRef.current : null;
    if(el) try{ el.focus({preventScroll:true}); }catch(_){}
  });
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
  const toggle=(e)=>{
    setUi(u=>({...u,mini:!mini}));
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
  const P=CK_WORKSPACE.pill;
  const pill=end ? (c.status==="revoked" ? P.revoked : P.cancelled) : frozen ? P.frozen : c.deployed ? P.ran : P.ready;
  const hold=beat<99 && holdH.current && !mini && c.status!=="cancelled" ? Math.min(holdH.current,window.innerHeight-24) : 0;
  const style=hold ? {minHeight:hold+"px"} : undefined;
  const skip=beat<99 ? finishReveal : null;
  return(
    <aside ref={ref} style={style} onKeyDown={onKeyDown} aria-label={CK_WORKSPACE.label}
      className={"claink-console"+(mini?" is-mini":"")+(end?" is-end":"")}>
      <div className="claink-titlebar">
        <ClainkMark size={16}/>
        <span className="claink-title">clAInk{!mini && <span>{CK_WORKSPACE.title}</span>}</span>
        {mini && <span className="claink-pilltext">{pill}{shownStrikes>0 && !end ? CK_WORKSPACE.pillStrikes(shownStrikes,CLAINK.STRIKES) : ""}</span>}
        <span className={"claink-dot"+(end ? (endIn?" dead":" busy") : c.deployed?" busy":"")} aria-hidden="true"/>
        <span className="claink-tb-btns">
          {!end && <button type="button" ref={toggleRef} className="claink-min" aria-expanded={!mini} aria-controls={bodyId}
            aria-label={mini ? CK_WORKSPACE.expandLabel : CK_WORKSPACE.minimizeLabel} title={mini ? CK_WORKSPACE.expand : CK_WORKSPACE.minimize}
            onClick={toggle}>{mini ? <Icon name="maximize-2" /> : <Icon name="minus" />}</button>}
          {end && <button type="button" className="claink-end-close" aria-label={CK_WORKSPACE.closeLabel} title={CK_WORKSPACE.close}
            onClick={e=>{ if(beat<99) finishReveal(); onHide(e); }}><Icon name="x" /></button>}
        </span>
      </div>
      <div className="claink-body" id={bodyId} hidden={mini}>
        {c.status==="active" && <>
          <div className="claink-statusline" tabIndex={-1} ref={statusRef}><i className="ck-dot" aria-hidden="true" />{frozen ? CK_WORKSPACE.status.frozen : c.deployed ? CK_WORKSPACE.status.ran : CK_WORKSPACE.status.idle}</div>
          <button type="button" className="claink-deploy" disabled={!clainkCanDeploy(s)}
            onClick={e=>{ focusNext.current="status"; holdH.current=ref.current ? ref.current.offsetHeight : 0; shieldNextClick(e); onDeploy(); }}>
            <span>{frozen ? <Icon name="lock" /> : c.deployed ? <Icon name="check" /> : <Icon name="play" />}{frozen ? CK_WORKSPACE.run.frozen : c.deployed ? CK_WORKSPACE.run.ran : CK_WORKSPACE.run.go}</span>
            <small>{frozen ? CK_WORKSPACE.runNote.frozen : c.deployed ? (getQuarterInfo(s.week).weekInQuarter>=QUARTER_WEEKS-1 ? CK_WORKSPACE.runNote.last : CK_WORKSPACE.runNote.next) : CK_WORKSPACE.runNote.go}</small>
          </button>
          <ClainkStrikes n={shownStrikes} log={c.strikeLog} cash={s.cash} due={c.due} ran={c.deployed}/>
        </>}
        {c.status==="revoked" && <div className="claink-statusline" tabIndex={-1} ref={statusRef}><i className="ck-dot" aria-hidden="true" />{endIn ? CK_WORKSPACE.status.revoked : CK_WORKSPACE.status.running}</div>}
        {L && c.status!=="cancelled" && (isRun || L.kind==="onboarded") && <ClainkReport last={L} beat={beat} workTok={workTok} onSkip={skip}/>}
        {L && L.ping && pingIn && <div className="claink-ping ck-beat"><span className="who"><Icon name="user-round" />{CK_WORKSPACE.manager}</span><span>{L.ping}</span></div>}
        {c.status==="active" && <>
          {(all || !isRun) && <div className="claink-usage">{frozen ? CK_WORKSPACE.usageFrozen(c.billed)
            : c.deployed ? (u=><>{u[0]}<b>{u[1]}</b>{u[2]}</>)(CK_WORKSPACE.usageRan(c.due,c.weekTokens,c.billed))
            : CK_WORKSPACE.usageIdle(CLAINK.IDLE[0],CLAINK.IDLE[1],c.billed)}</div>}
          {frozen ? null : !confirmCancel
            ? <button type="button" ref={cancelRef} className="claink-cancel-link"
                onClick={()=>{ focusNext.current="keep"; setConfirmCancel(true); }}>{CK_WORKSPACE.cancel}</button>
            : <div className="claink-cancel-box" role="group" aria-label={CK_WORKSPACE.cancelLabel}>
                <span>{CK_WORKSPACE.cancelCost(cost,CLAINK.CANCEL)}</span>
                <span className="offer">{CK_WORKSPACE.cancelOffer}</span>
                <span className="row2">
                  <button type="button" ref={keepRef} className="claink-cancel-keep" onClick={()=>{ focusNext.current="cancel"; setConfirmCancel(false); }}>{CK_WORKSPACE.keep}</button>
                  <button type="button" className="claink-cancel-confirm" disabled={!canCancel}
                    onClick={()=>{ focusNext.current="status"; onCancel(); }}>{canCancel ? CK_WORKSPACE.cancelPay(cost) : CK_WORKSPACE.cancelBroke}</button>
                </span>
              </div>}
        </>}
        {c.status==="revoked" && endIn && <ClainkRevoked c={c}/>}
        {c.status==="cancelled" && <div className="claink-offboarded">
          <div className="claink-statusline" tabIndex={-1} ref={statusRef}>{CK_END.cancelled}</div>
          <p>{CK_END.data}</p>
          <p className="claink-stats">{CK_END.statsCancelled(c.tokens,c.delivered,c.billed)}</p>
        </div>}
      </div>
      <div className="claink-live sr-only" aria-live="polite">{c.last && c.last.announce
        ? (isRun ? CK_WORKSPACE.live(c.deploys,c.last.announce) : c.last.announce) : ""}</div>
    </aside>
  );
};

// picks what clAInk shows: the ad, the workspace, an end card, or nothing (closed ad, expired offer, closed end card)
// dispatch: the page's one way to change a run (a move through game/run.js)
// onReport(done): a run's report has started (false) or has had its say (true); the page holds the manager's
// acknowledgement, which the run itself is waiting on, until then
export const ClainkDock=({s,dispatch,ui,setUi,onReport})=>{
  const c=s.claink;
  const prev=useRef(c ? c.status : null);
  const justInstalled=prev.current==="ad" && !!c && c.status==="active";
  useEffect(()=>{ prev.current=c ? c.status : null; });
  if(!c)return null;
  const ck=op=>dispatch({t:"ck",op});
  if(c.status==="ad"){
    if(isRunOver(s) || getQuarterInfo(s.week).weekInQuarter>CLAINK.OFFER_LAST_WEEK)return null;
    // toggle from what you see, not from the stored preference (a short screen shows the pill before you chose)
    const adMini=!!ui.adMini;
    return <ClainkAd s={s} mini={adMini} onToggle={()=>setUi(u=>({...u,adMini:!adMini}))}
      onInstall={()=>ck("buy")} onDismiss={e=>{ ck("dismiss"); focusEndWeek(e); }}/>;
  }
  if(c.status==="active" || ((c.status==="cancelled" || c.status==="revoked") && !c.hidden)){
    return <ClainkConsole s={s} ui={ui} setUi={setUi} focusOnMount={justInstalled}
      onDeploy={()=>{ onReport(false); ck("deploy"); }}
      onRevealDone={()=>onReport(true)}
      onCancel={()=>ck("cancel")}
      onHide={e=>{ ck("hide"); focusEndWeek(e); }}/>;
  }
  return null;
};
