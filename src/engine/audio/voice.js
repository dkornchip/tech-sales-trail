import { A, HAS_DOM } from "./core.js";
import { play, stopAmbient } from "./mixer.js";
import { root } from "../root.js";
import { HR_LINES, LINES } from "../../copy/pa.js";
import { fxRandom } from "../../fxrng.js";

/* ---------- PA announcer (speechSynthesis) ---------- */
// What it says is in src/copy/pa.js (LINES, by key). v1.18: terminations are read by HR, calmly, in a female voice
export { HR_LINES, LINES };
export var HR_KEYS = { fired:1, firedOrg:1, firedReview:1, clainkRevoked:1 }; // v1.20: HR offboards the agent, too
// v1.17: the PA went silent on Windows Chromium/Edge. Three things in that engine bite a naive speak():
//  - voice objects go stale when the browser reloads its list (voiceschanged fires more than once) and a stale
//    voice speaks nothing, so the choice is kept by NAME and resolved against the live list at speak time;
//  - speechSynthesis.speaking can stick at true after an utterance that never ends (Edge's online voices with
//    no network, our silent primer), which made every non-forced line bail, so busy-ness is tracked here;
//  - an utterance the page no longer references can be garbage-collected mid-queue, so the current one is held.
// Edge lists its "Online (Natural)" voices first; they need the network, so a local voice of the same family wins.
export var SAY = { last:0, voiceName:{m:null,f:null}, timer:0, current:null, since:0, primer:null };
export var VOICE_PREFS = {
  m: ["Google UK English Male","Daniel","Microsoft Guy","Microsoft Ryan","Microsoft David","Microsoft Mark","Arthur","Aaron","Alex","Fred","Google US English"],
  f: ["Microsoft Aria","Microsoft Jenny","Microsoft Zira","Microsoft Sonia","Microsoft Michelle","Google UK English Female","Samantha","Karen","Moira","Tessa","Victoria","Fiona","Google US English"]
};
export function voiceList(){ try{ return root.speechSynthesis.getVoices() || []; }catch(e){ return []; } }
export function pickVoice(kind){
  if(!("speechSynthesis" in root)) return null;
  var vs = voiceList(); if(!vs.length) return null;
  var prefs = VOICE_PREFS[kind || "m"];
  var best = null, bestRank = Infinity;
  for(var k=0;k<vs.length;k++){
    var v = vs[k], rank = Infinity, i;
    for(i=0;i<prefs.length;i++) if(v.name.indexOf(prefs[i]) === 0){ rank = i*2 + (v.localService === false ? 1 : 0); break; }
    if(rank === Infinity && /^en[-_]/i.test(v.lang || "")) rank = 1000 + (v.localService === false ? 1 : 0);
    if(rank < bestRank){ bestRank = rank; best = v; }
  }
  return best || vs[0];
}
export function rememberVoice(kind){ kind = kind || "m"; var v = pickVoice(kind); SAY.voiceName[kind] = v ? v.name : null; return v; }
export function rememberVoices(){ rememberVoice("m"); rememberVoice("f"); }
export function voiceFor(kind){
  kind = kind || "m";
  var vs = voiceList(); if(!vs.length) return null;
  var name = SAY.voiceName[kind];
  if(name) for(var i=0;i<vs.length;i++) if(vs[i].name === name) return vs[i];
  return rememberVoice(kind);
}
if(HAS_DOM && "speechSynthesis" in root){ try{ root.speechSynthesis.onvoiceschanged = rememberVoices; }catch(e){} }
// true while a line of ours is still going; a browser flag stuck on with nothing of ours in flight is cleared
export function speechBusy(){
  var ss = root.speechSynthesis;
  if(SAY.current && Date.now()-SAY.since < 15000) return true;
  SAY.current = null;
  if(SAY.primer) return false; // the unlock primer is still playing; a queued line simply follows it
  if(ss.speaking || ss.pending){ try{ ss.cancel(); }catch(e){} }
  return false;
}
export function utter(text,key,voice,isRetry,kind){
  var ss = root.speechSynthesis, u = new root.SpeechSynthesisUtterance(text);
  if(voice){ u.voice = voice; u.lang = voice.lang; } else u.lang = "en-US";
  // HR is measured and level; the PA is a tired baritone
  u.rate = kind === "f" ? 0.95 : 0.97; u.pitch = kind === "f" ? 1.0 : 0.85;
  u.volume = Math.min(1,A.settings.vol*1.15);
  var done = function(){ if(SAY.current === u) SAY.current = null; };
  u.onend = done;
  u.onerror = function(ev){
    done();
    var err = (ev && ev.error) || "error";
    A.lastSpeechError = err;
    // the chosen voice failed (an online voice offline, a voice gone from the list): one retry on the browser default
    if(voice && !isRetry && err !== "interrupted" && err !== "canceled" && err !== "not-allowed"){
      SAY.voiceName[kind || "m"] = null;
      setTimeout(function(){ if(A.settings.on && A.settings.voice){ try{ utter(text,key,null,true,kind); }catch(e){} } },150);
    }
  };
  SAY.current = u; SAY.since = Date.now();
  if(ss.paused) ss.resume();
  ss.speak(u);
  if(A.onSay) A.onSay(text);
}
export function say(key,opts){
  opts = opts || {};
  if(!A.settings.on || !A.settings.voice || !A.unlocked) return false;
  if(!("speechSynthesis" in root)) return false;
  if(key === "fired" && opts.meta){ if(opts.meta.cause === "org") key = "firedOrg"; else if(opts.meta.cause === "review") key = "firedReview"; }
  if(key === "burnout" && opts.meta && opts.meta.cause === "caffeine") key = "burnoutCaffeine";
  if(key === "repo" && opts.meta && opts.meta.cause === "claink") key = "repoClaink";
  var bank = LINES[key], text = bank ? bank[Math.floor(fxRandom()*bank.length)] : String(key);
  var ss = root.speechSynthesis, now = Date.now();
  if(!opts.force){
    if(now - SAY.last < (opts.cooldown || 12000)) return false;
    if(speechBusy()) return false;
  } else { try{ ss.cancel(); }catch(e){} SAY.current = null; SAY.primer = null; }
  SAY.last = now;
  play("pa");
  clearTimeout(SAY.timer);
  // the chime leads the voice by 720ms, which also keeps speak() clear of a cancel() (back to back they can drop the line)
  SAY.timer = setTimeout(function(){
    SAY.timer = 0;
    if(!A.settings.on || !A.settings.voice) return;
    var kind = HR_KEYS[key] ? "f" : "m";
    try{ utter(text,key,voiceFor(kind),false,kind); }catch(e){ A.lastSpeechError = String(e && e.message || e); }
  }, 720);
  return true;
}
// drop a line say() has queued but not spoken yet; unlike hush(), nothing already playing is touched
export function cancelSay(){ var queued = !!SAY.timer; clearTimeout(SAY.timer); SAY.timer = 0; return queued; }
export function hush(){ clearTimeout(SAY.timer); SAY.timer = 0; SAY.current = null; SAY.primer = null; try{ if("speechSynthesis" in root) root.speechSynthesis.cancel(); }catch(e){} stopAmbient(); }
