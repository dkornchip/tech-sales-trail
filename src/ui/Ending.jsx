import React from "react";
import { DISTINCTIONS, NOTES, NOTE_ORDER, RESULTS, VERDICT } from "../copy/endings.js";
import { WHALE_PUSH } from "../game/deals.js";
import { distinctionsOf, runFacts } from "../game/selectors.js";
import { money } from "../game/util.js";
import { Cutscene } from "./Cutscene.jsx";
import { REDUCED_MOTION } from "./env.js";
import { Modal } from "./primitives.jsx";

const { useState, useEffect, useRef } = React;

const usd=v=>money(v).replace("-","−");

// The numbers under the cutscene: two the save always has, then the first two the run can vouch for.
const tiles=f=>{
  const out=[
    {label:RESULTS.closed, value:usd(f.closed), sub:RESULTS.ofQuota(f.quotaPct)},
    {label:RESULTS.cash, value:usd(f.cash), tone:f.cash<0 ? "bad" : null}
  ];
  const more=[];
  // once signed revenue has been reversed (a clawback), the count is of what was signed, not of what was kept
  if(f.known) more.push({label:f.reversed ? RESULTS.signedSoFar : RESULTS.signed, value:String(f.signed), sub:f.lost ? RESULTS.lost(f.lost) : null});
  if(f.top) more.push({label:RESULTS.top, value:usd(f.top.value), sub:f.top.account});
  if(f.shots) more.push({label:RESULTS.shots, value:String(f.shots)});
  if(f.billed>0 || f.strikes>0) more.push({label:RESULTS.claink, value:RESULTS.strikes(f.strikes), sub:f.billed>0 ? RESULTS.clainkBilled(f.billed) : null});
  if(f.discounts>0) more.push({label:RESULTS.discounts, value:usd(f.discounts)});
  if(f.pipeline>0) more.push({label:RESULTS.pipeline, value:usd(f.pipeline)});
  return out.concat(more.slice(0,2));
};

// What the company put on file: the first two notes this run has earned, in the order the ending cares about.
const applies={
  trip:f=>!!f.trip,
  top:f=>!!f.top,
  none:f=>f.known && f.signed===0,
  took:f=>!!f.took,
  revoked:f=>f.revoked,
  strikes:f=>!f.revoked && f.strikes>0,
  billed:f=>f.billed>0,
  shots:f=>f.shots>=5,
  hails:f=>f.hails>=2,
  lunches:f=>f.lunches>=3,
  cadences:f=>f.cadences>=6,
  lost:f=>f.lost>=6
};
const notesFor=(id,f)=>{
  const order=NOTE_ORDER[id]||NOTE_ORDER.other, out=[];
  const p={...f, account:f.top ? f.top.account : "", value:f.top ? f.top.value : 0};
  for(const key of order){
    if(!applies[key](f))continue;
    const entry=NOTES[key];
    const line=typeof entry==="function" ? entry : (entry[id]||entry.other);
    if(line) out.push({key,text:line(p)});
    if(out.length===2)break;
  }
  return out;
};

// The largest type the scene may use. In a short window (a phone on its side) it is what lets all seventeen rows
// of the terminal fit the height: 17 rows at a line height of 1.14, less the dialog's margins and the line above.
const sceneFont=()=>{
  const h=window.innerHeight;
  if(h>600 || window.innerWidth<=h) return h>=760 ? 16 : 14;     // tall, or held upright: the width decides
  return Math.max(7,Math.min(14,Math.floor(((h-24-2*12-20-34)/(17*1.14))*10)/10));
};

// The ending: the company's one line about Matt, the cutscene at full size, and then the paperwork.
// The run is already over when this opens; the card only arrives after the scene so the scene gets watched.
// New run is there from the first frame.
export const Ending=({over,s,onNew})=>{
  const sceneRef=useRef(null);
  const[done,setDone]=useState(false);
  const key=over ? over.id+"|"+s.runId : "";
  useEffect(()=>{
    setDone(false);
    if(!over)return;
    // the card must never depend on an animation finishing
    const id=setTimeout(()=>setDone(true),REDUCED_MOTION || !window.TST_SCENES ? 0 : 16000);
    return()=>clearTimeout(id);
  },[key]);
  // The scene's own button holds the focus while the scene plays, so a key meant for the week that just ended can
  // only skip the scene. When the paperwork arrives, the focus moves on to New run (unless you have put it elsewhere).
  const cardRef=useRef(null);
  useEffect(()=>{
    if(!done || !over || !cardRef.current)return;
    const dlg=cardRef.current.closest("dialog"), at=document.activeElement;
    if(!dlg || !dlg.open)return;
    if(at && at!==document.body && at!==dlg && !(at.classList && at.classList.contains("at-start")))return;
    const go=dlg.querySelector('[data-ui="newrun"]');
    if(go)go.focus({preventScroll:true});
  },[done,key]);
  // On a small screen the paperwork unfolds below the fold (under the pinned buttons, or under the scene in a short
  // window). Once it has unfolded, whatever scrolls is taken to its end, so the numbers and the notes are seen.
  useEffect(()=>{
    if(!done || !over || !cardRef.current)return;
    const dlg=cardRef.current.closest("dialog");
    if(!dlg)return;
    const id=setTimeout(()=>{
      for(const el of [dlg,dlg.querySelector(".d-body")]){
        if(el && el.scrollHeight>el.clientHeight+4) el.scrollTo({top:el.scrollHeight,behavior:REDUCED_MOTION ? "auto" : "smooth"});
      }
    },REDUCED_MOTION ? 0 : 560);
    return()=>clearTimeout(id);
  },[done,key]);
  if(!over) return <Modal open={false} title="" />;
  const f=runFacts(s);
  const notes=notesFor(over.id,f);
  const honours=distinctionsOf(s,over.id).map(k=>DISTINCTIONS.find(d=>d.key===k)).filter(Boolean)
    .map(d=>({key:d.key,title:d.title,sub:typeof d.sub==="function" ? d.sub(WHALE_PUSH) : d.sub}));
  const engine=window.TST_SCENES;
  const summary=REDUCED_MOTION && engine && engine.summaryFor(over.type,over.meta);
  const actions=[];
  if(!REDUCED_MOTION && engine) actions.push({
    label:done ? RESULTS.replay : RESULTS.skip, className:"ghost", side:"start",
    onClick:()=>{ const c=sceneRef.current; if(!c)return; if(done)c.replay(); else c.skip(); }
  });
  actions.push({label:RESULTS.newRun, className:"primary", ui:"newrun", onClick:onNew});
  return(
    <Modal open className="ending" dialogId={"end:"+over.id}
      title={<><span className="end-over">{RESULTS.overline(f.week,f.weeks)}</span><span className="end-title">{over.title}</span></>}
      actions={actions}>
      <p className="end-body">{over.body}{over.note ? <span className="end-cause"> {over.note}</span> : null}</p>
      <Cutscene type={over.type} play meta={over.meta} ctrlRef={sceneRef} maxFont={sceneFont()} onDone={()=>setDone(true)} />
      {summary && <p className="scene-note">{summary}</p>}
      <div ref={cardRef} className={"end-card"+(done ? " is-in" : "")} aria-hidden={done ? undefined : "true"}>
        <div className="end-card-in">
        {VERDICT[over.id] && <p className="end-verdict" data-ui="verdict"><span className="end-notes-h">{RESULTS.verdict}</span>{VERDICT[over.id]}</p>}
        <dl className="end-facts">
          {tiles(f).map(t=>(
            <div className="end-fact" key={t.label}>
              <dt>{t.label}</dt>
              <dd className={t.tone ? "is-"+t.tone : undefined}>{t.value}</dd>
              {t.sub && <dd className="end-sub">{t.sub}</dd>}
            </div>
          ))}
        </dl>
        {notes.length>0 && (
          <div className="end-notes">
            <div className="end-notes-h">{RESULTS.notes}</div>
            <ul>{notes.map(n=><li key={n.key}>{n.text}</li>)}</ul>
          </div>
        )}
        {honours.length>0 && (
          <div className="end-notes end-honours" data-ui="distinctions">
            <div className="end-notes-h">{RESULTS.distinctions}</div>
            <ul>{honours.map(h=><li key={h.key} data-distinction={h.key}><b>{h.title}</b><span>{h.sub}</span></li>)}</ul>
          </div>
        )}
        </div>
      </div>
    </Modal>
  );
};
