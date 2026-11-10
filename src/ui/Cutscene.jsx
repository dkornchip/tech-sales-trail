import React from "react";
import { CUTSCENES } from "./cutscenesFallback.js";

const { useState, useEffect, useRef } = React;

// v1.14: endings play on the ASCII scene engine (plain script above the React tags).
// The original two-frame flipbook is kept as a fallback if that engine is unavailable.
export const Cutscene=({type,speed,play,meta,ctrlRef})=>{
  const preRef=useRef(null);
  const[fallback,setFallback]=useState(false);
  const[index,setIndex]=useState(0);
  const engine=window.TST_SCENES;
  useEffect(()=>{
    if(!play)return;
    if(!engine||!preRef.current){ setFallback(true); return; }
    let ctrl=null;
    try{ ctrl=engine.play(preRef.current,type,{speed:120/speed,meta:meta||{}}); }
    catch(e){ setFallback(true); return; }
    if(ctrlRef)ctrlRef.current=ctrl;
    return()=>{ try{ctrl.stop();}catch(e){} if(ctrlRef && ctrlRef.current===ctrl)ctrlRef.current=null; };
  },[play,type]);
  useEffect(()=>{ if(ctrlRef && ctrlRef.current)ctrlRef.current.setSpeed(120/speed); },[speed]);
  const frames=CUTSCENES[type]||CUTSCENES.club;
  useEffect(()=>{
    if(!fallback||!play)return;
    setIndex(0);
    let i=0;
    const id=setInterval(()=>{
      i=(i+1)%frames.length;
      setIndex(i);
    },speed);
    return()=>clearInterval(id);
  },[fallback,play,frames,speed]);
  if(fallback || !engine){
    return(
      <div className="cutbox">
        <pre className="cutscene">{frames[index]||""}</pre>
      </div>
    );
  }
  const label=(engine.summaryFor && engine.summaryFor(type,meta)) || "Ending animation";
  return(
    <div className="cutbox crt" role="img" aria-label={label}>
      <pre className="cutscene" ref={preRef}></pre>
    </div>
  );
};
