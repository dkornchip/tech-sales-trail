export const REDUCED_MOTION = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

// v1.14: sound + toast hooks. Everything below is presentation only; game state never reads from these.
export const AUDIO=()=>window.TST_AUDIO||null;
export const sfx=(name,opts)=>{ const a=AUDIO(); if(a) a.play(name,opts); };
export const notify=(msg)=>{ if(window.TST_TOAST) window.TST_TOAST(msg); else alert(msg); };

export const reducedNow=()=>!!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
