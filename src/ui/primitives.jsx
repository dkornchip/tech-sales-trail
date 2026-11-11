import React from "react";
import { WHO } from "../copy/pa.js";
import { captionSeq, useCaption } from "./captions.js";
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

// onDismiss: Esc may close it (info-only dialogs). Without it, Esc does nothing.
// dialogId: what this dialog is (data-dialog), so tests and code can find it without reading its title:
// "evt:competitor", "evt:security", "ck:warning", "ck:lesson", "end:club" ... "end:repo", "help".
// className: a variant ("ending"). An action may carry ui (data-ui, for tests), side:"start" (sits at the left of
// the footer) and focus (takes the focus when the dialog opens; the first action does otherwise).
// aside: something quiet at the left of the footer (a link), which is not one of the dialog's answers.
export const Modal=({open,title,children,actions,onDismiss,dialogId,className,aside})=>{
  const ref=useRef(null);
  const titleId=React.useId()+"t";
  // what the announcer says while this dialog is open is captioned under its title, and stays until it closes
  const said=useCaption();
  const[since,setSince]=useState(0);
  // (not when the line only repeats what the dialog itself says: the manager's warning is his line already)
  const own=ref.current && ref.current.querySelector(".d-body") ? ref.current.querySelector(".d-body").textContent : "";
  const cap=open && said && since && said.id>=since && own.indexOf(said.text)<0 ? said : null;
  useEffect(()=>{ setSince(open ? captionSeq()+1 : 0); },[open]);
  useEffect(()=>{
    if(!ref.current)return;
    if(open){
      if(!ref.current.open){
        ref.current.showModal();
        // the browser focuses the first control; an action marked `focus` takes it instead
        const want=ref.current.querySelector("[data-focus]");
        if(want)want.focus();
      }
    }else{
      if(ref.current.open)ref.current.close();
    }
  },[open]);
  return(
    <dialog ref={ref} className={className||undefined} aria-labelledby={titleId} data-dialog={dialogId||undefined}
      onCancel={e=>{ if(!onDismiss)e.preventDefault(); }}
      onClose={()=>{
        if(onDismiss){ if(open)onDismiss(); return; }
        // Chromium force-closes on a repeated Esc even when cancel is prevented; keep the dialog in step with state
        if(open && ref.current && !ref.current.open)ref.current.showModal();
      }}>
      <div className="d-header"><span className="d-title" id={titleId}>{title}</span>
        {cap && <span className="d-cap" role="status"><span className="pa-who">{WHO[cap.who]||WHO.pa}</span>{cap.text}</span>}</div>
      <div className="d-body">{children}</div>
      <div className={"d-footer"+(actions && actions.some(a=>a.note) ? " options" : "")}>
        {aside ? <span className="d-aside">{aside}</span> : null}
        {actions && actions.map((a,i)=>(
          <button
            key={a.ui||i}
            className={"btn "+(a.className||"ghost")+(a.note ? " option" : "")+(a.side==="start" ? " at-start" : "")}
            data-ui={a.ui||undefined}
            data-focus={a.focus ? "" : undefined}
            onClick={a.onClick}
            autoFocus={actions.some(x=>x.focus) ? !!a.focus : i===0}
          >
            {a.note ? <><span className="opt-label">{a.label}</span><span className="opt-effect">{a.note}</span></> : a.label}
          </button>
        ))}
      </div>
      <span className="sr-only tst-sr" role="status" aria-live="polite"></span>
    </dialog>
  );
};
