import { root } from "../root.js";

export var HAS_DOM = typeof document !== "undefined";
export var KEY = "tst-audio-v1";
export var A = { ctx:null, master:null, unlocked:false, voices:[], amb:null, hb:null, hbTimer:0, stress:0, lastHydrate:0,
          settings:{ on:true, voice:true, vol:0.6, captions:true } };

/* ---------- settings ---------- */
try{
  var raw = root.localStorage && root.localStorage.getItem(KEY);
  if(raw){ var v = JSON.parse(raw); if(v && typeof v === "object"){
    if(typeof v.on === "boolean") A.settings.on = v.on;
    if(typeof v.voice === "boolean") A.settings.voice = v.voice;
    if(typeof v.vol === "number" && v.vol >= 0 && v.vol <= 1) A.settings.vol = v.vol;
    if(typeof v.captions === "boolean") A.settings.captions = v.captions;
  } }
}catch(e){}
export function saveSettings(){ try{ root.localStorage.setItem(KEY,JSON.stringify(A.settings)); }catch(e){} }
export function gainFor(vol){ return Math.pow(vol,1.6)*0.95; }

/* ---------- notes ---------- */
export var IDX = {C:-9,"C#":-8,Db:-8,D:-7,"D#":-6,Eb:-6,E:-5,F:-4,"F#":-3,Gb:-3,G:-2,"G#":-1,Ab:-1,A:0,"A#":1,Bb:1,B:2};
export function N(n){ var m = /^([A-G](?:#|b)?)(-?\d)$/.exec(n); return 440*Math.pow(2,(IDX[m[1]]+(parseInt(m[2],10)-4)*12)/12); }
