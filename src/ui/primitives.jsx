import React from "react";
import { MOOD_NAMES, STAGE_NAMES, STAGE_UNKNOWN } from "../copy/names.js";
import { clamp, money } from "../game/util.js";
import { REDUCED_MOTION } from "./env.js";

const { useState, useEffect, useRef } = React;

// Eases a displayed number toward its real value; the real value is never changed.
export const useTween=(target,ms=650)=>{
  const[v,setV]=useState(target);
  const rafRef=useRef(0);
  useEffect(()=>{
    if(REDUCED_MOTION){setV(target);return;}
    const from=v;
    if(from===target)return;
    const start=performance.now();
    cancelAnimationFrame(rafRef.current);
    const step=(t)=>{
      const p=Math.min(1,(t-start)/ms);
      const e=1-Math.pow(1-p,3);
      if(p<1){
        setV(from+(target-from)*e);
        rafRef.current=requestAnimationFrame(step);
      }else{
        setV(target);
      }
    };
    rafRef.current=requestAnimationFrame(step);
    return()=>cancelAnimationFrame(rafRef.current);
  },[target]);
  return v;
};

export const Stat=({label,value,num,fmt,sub,barValue,barKind})=>{
  const hasNum=typeof num==="number";
  const tv=useTween(hasNum?num:0);
  const display=hasNum ? (fmt?fmt(tv):String(Math.round(tv))) : value;
  let cls="bar";
  if(barKind)cls+=" "+barKind;
  return(
    <div className="stat">
      <div className="label">{label}</div>
      <div className="value pop" key={hasNum?num:value}>{display}</div>
      {sub && <div className="sub">{sub}</div>}
      {typeof barValue==="number" && (
        <div className={cls}>
          <div style={{width:clamp(barValue,0,100)+"%"}}/>
        </div>
      )}
    </div>
  );
};

export const DealCard=({deal})=>{
  const stageName=STAGE_NAMES[deal.stage]||STAGE_UNKNOWN;
  const moodClass="pill mood-"+deal.mood;
  // a mood this build has no name for (a hand-edited save) shows as stored
  const moodName=Object.prototype.hasOwnProperty.call(MOOD_NAMES,deal.mood) ? MOOD_NAMES[deal.mood] : deal.mood;
  return(
    <div className="deal">
      <div className="deal-header">
        <div className="deal-title">{deal.account}</div>
        <div className="pill-row">
          <span className="pill stage">{stageName}</span>
          <span className={moodClass}>{moodName}</span>
        </div>
      </div>
      <div className="deal-footer">
        <span className="pill value">{money(deal.value)}</span>
        <span>Age: {deal.age}w {deal.probNote && <span className="tiny">({deal.probNote})</span>}</span>
      </div>
    </div>
  );
};

// onDismiss: Esc may close it (info-only dialogs). Without it, Esc does nothing.
// dialogId: what this dialog is (data-dialog), so tests and code can find it without reading its title:
// "evt:competitor", "evt:security", "ck:warning", "ck:lesson", "end:club" ... "end:repo", "help".
export const Modal=({open,title,children,actions,onDismiss,dialogId})=>{
  const ref=useRef(null);
  const titleId=React.useId()+"t";
  useEffect(()=>{
    if(!ref.current)return;
    if(open){
      if(!ref.current.open)ref.current.showModal();
    }else{
      if(ref.current.open)ref.current.close();
    }
  },[open]);
  return(
    <dialog ref={ref} aria-labelledby={titleId} data-dialog={dialogId||undefined}
      onCancel={e=>{ if(!onDismiss)e.preventDefault(); }}
      onClose={()=>{
        if(onDismiss){ if(open)onDismiss(); return; }
        // Chromium force-closes on a repeated Esc even when cancel is prevented; keep the dialog in step with state
        if(open && ref.current && !ref.current.open)ref.current.showModal();
      }}>
      <div className="d-header" id={titleId}>{title}</div>
      <div className="d-body">{children}</div>
      <div className="d-footer">
        {actions && actions.map((a,i)=>(
          <button
            key={i}
            className={"btn "+(a.className||"ghost")}
            onClick={a.onClick}
            autoFocus={i===0}
          >
            {a.label}
          </button>
        ))}
      </div>
      <span className="sr-only tst-sr" role="status" aria-live="polite"></span>
    </dialog>
  );
};
