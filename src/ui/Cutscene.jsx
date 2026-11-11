import React from "react";
import { SCENE_COPY } from "../copy/scenes.js";
import { NAMES } from "../copy/ui.js";

const { useState, useEffect, useRef } = React;

// What a scene shows when it cannot be played: its own one-sentence account of itself (the sentence a screen
// reader gets, and the one shown under reduced motion). The engine picks it by the ending's cause; without the
// engine it is read straight from the copy.
const summaryOf=(engine,type,meta)=>{
  try{ const said=engine && engine.summaryFor && engine.summaryFor(type,meta); if(said)return said; }catch(e){}
  const key=type==="burnout" ? (meta && meta.cause==="caffeine" ? "ascension" : "meltdown") : type;
  const scene=SCENE_COPY[key];
  return (scene && scene.summary) || NAMES.ending;
};

// Endings play on the ASCII scene engine (src/engine/scenes), on the CRT. If the engine cannot start a scene, the
// screen says what happened in one sentence instead, and the caller is told at once that there is nothing to wait
// for. (v1.21 fell back to a two-frame flipbook that looped for ever; it went with the rest of the old copy.)
// maxFont: the largest type the screen may use (the engine fits all 64 columns to the box, up to this).
// onDone: called when the scene reaches its last frame, or is skipped there.
export const Cutscene=({type,speed=120,play,meta,ctrlRef,maxFont,onDone})=>{
  const preRef=useRef(null);
  const[failed,setFailed]=useState(false);
  const engine=window.TST_SCENES;
  const doneRef=useRef(onDone); doneRef.current=onDone;
  useEffect(()=>{ if(failed && play && doneRef.current)doneRef.current(); },[failed,play]);
  useEffect(()=>{
    if(!play)return;
    if(!engine||!preRef.current){ setFailed(true); return; }
    let ctrl=null;
    try{ ctrl=engine.play(preRef.current,type,{speed:120/speed,meta:meta||{},maxFont,onDone:()=>{ if(doneRef.current)doneRef.current(); }}); }
    catch(e){ setFailed(true); return; }
    if(ctrlRef)ctrlRef.current=ctrl;
    return()=>{ try{ctrl.stop();}catch(e){} if(ctrlRef && ctrlRef.current===ctrl)ctrlRef.current=null; };
  },[play,type]);
  useEffect(()=>{ if(ctrlRef && ctrlRef.current)ctrlRef.current.setSpeed(120/speed); },[speed]);
  if(failed || !engine){
    return(
      <div className="cutbox crt scene-still">
        <p>{summaryOf(engine,type,meta)}</p>
      </div>
    );
  }
  return(
    <div className="cutbox crt" role="img" aria-label={summaryOf(engine,type,meta)}>
      <pre className="cutscene" ref={preRef}></pre>
    </div>
  );
};
