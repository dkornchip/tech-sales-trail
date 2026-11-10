import { play } from "./mixer.js";
import { say } from "./voice.js";
import { fxRandom } from "../../fxrng.js";

/* ---------- director: turn new log lines into sound + PA lines ---------- */
export function norm(s){ return String(s||"").replace(/️/g,""); }
export var RULES = [
  // prefix (emoji stripped of variation selectors), sound, priority, optional PA line key
  ["📞","dial",3], ["✉","whoosh",3], ["🔎","typewriter",3], ["🖥","demo",3], ["📑","printer",3],
  ["🏟","airport",3], ["🧘","bowl",3], ["⏱","nope",3], ["☕","coffee",3], ["🏛","sneaky",3],
  ["🧪 No late-stage","nope",3], ["🧪","hailmary",3], ["🌪","fanfareS",3], ["🤕","bad",3], ["📛","bad",3], ["😬","warn",3],
  ["🏠","rent",2], ["💸 Salary","coin",1], ["💸 Matched","discount",2], ["🧱","thud",2],
  ["📣","leads",2,"sqlStorm"], ["🛠","fumble",2], ["🧙","magic",2], ["🔦","warn",2], ["🌀","warn",2],
  ["🌩","thunder",2,"outage"], ["🪜","rise",2], ["📘","ping",2], ["🐦","chirp",2,"viral"],
  ["🥶 Budget","ice",2,"freeze"], ["🍂","ice",2], ["🤒","sick",2], ["📉 Territory","bad",3,"rebalance"],
  ["🛡","shield",2], ["👻","ghost",2], ["🧩","puzzle",2], ["🪫","powerdown",2], ["🕑","ticktock",2],
  ["📵","busy",2,"phones"], ["👀","suspicion",3,"meetings"], ["📋","suspicion",3,"hygiene"], ["🧊","hr",4,"hr"],
  ["📆 Recurring","hrSoft",2], ["📆 Week ","week",1], ["📊","qbr",1],
  ["🏅","achievement",4,"whale"], ["💀","lost",4], ["⚠","alarm",4,"cash"]
];
RULES.unshift(["🧹","crm",3,"hygiene"],["🗑","lost",4,"closeOut"],["🫀","heartbeat",2],["🚀","ignition",4],["☢","crack",4],["🏝","airport",3],["🥴","sick",2]);
// v1.20 clAInk: specific prefixes first ("🤖 clAInk: N signed, $X" already plays cash through the close regex in ruleFor).
// A strike is stamped; one with real damage glitches; strike 3 blue-screens and HR offboards the agent.
RULES.unshift(["🤖 clAInk seat","chime",3],["🤖","beep",2],["✨","sparkle",4,"claink"],["⚖","stamp",3,"strike"],["💥","glitch",4,"sev1"],
  ["🧾","printer",2],["🔒","bsod",5,"clainkRevoked"],["💔","lost",4],["🔌","poweroff",3],["🙅","whoosh",2],["⏳","nope",2],
  ["👔 Boss took","lost",4],["👔","suspicion",3,"chatgdp"]);
export function ruleFor(msg){
  var m = norm(msg);
  if(/\d+ signed, \$/.test(m)) return {sfx:"cash", prio:4, close:true};
  if(/nobody signed/.test(m)) return {sfx:"thud", prio:3};
  if(/nothing to close|no late-stage deals/.test(m)) return {sfx:"nope", prio:3};
  if(m.indexOf("🧑") === 0 && /🐋/.test(m)) return {sfx:"sonar", prio:3};
  if(m.indexOf("🧑") === 0) return {sfx:"ping", prio:3};
  for(var i=0;i<RULES.length;i++){ var r = RULES[i]; if(m.indexOf(norm(r[0])) === 0) return {sfx:r[1], prio:r[2], say:r[3]}; }
  return null;
}
// v1.20: a clAInk run's report is voiced by the agent workspace as each beat lands (see ClainkConsole), so the director
// leaves those lines alone; installs, invoices, cancels and the rest still sound here. ruleFor still maps them (tests).
export var CLAINK_RUN = ["🤖 clAInk run","🤖 clAInk:","✨","⚖","💥","🔒","💔","👔"];
export function isClainkRun(msg){ var m = norm(msg); for(var i=0;i<CLAINK_RUN.length;i++){ if(m.indexOf(norm(CLAINK_RUN[i])) === 0) return true; } return false; }
export function onLogs(entries,info){
  info = info || {};
  if(info.over || !entries || !entries.length) return;
  var picks = [], speech = null, runBatch = false;
  for(var k=0;k<entries.length;k++){ if(isClainkRun(entries[k].msg)){ runBatch = true; break; } }
  for(var i=0;i<entries.length;i++){
    // a run owns its whole batch: its "Cash under -$1,000" warning sounds when the strike card lands, and the PA line is the run's
    if(isClainkRun(entries[i].msg) || (runBatch && norm(entries[i].msg).indexOf("⚠") === 0)) continue;
    var e = entries[i], r = ruleFor(e.msg);
    if(r && r.close){ var mm = /signed, \$([\d,]+)/.exec(e.msg); var amt = mm ? parseInt(mm[1].replace(/,/g,""),10) : 0; if(amt >= 45000) r.say = "bigClose"; }
    if(r && r.sfx === "week"){ var wm = /📆 Week (\d+)/.exec(e.msg); if(wm){ var w = ((parseInt(wm[1],10)-1)%13)+1;
      r.say = w === 5 ? "week5" : w === 7 ? "week7" : w === 12 ? "week12" : w === 13 ? "week13" : (fxRandom() < .3 ? "filler" : null); } }
    if(r){ r.i = i; picks.push(r); if(r.say && (!speech || r.prio > speech.prio)) speech = r; }
  }
  // the week flip always plays (it is the End Week confirmation); the two most important others join it,
  // all in the order they happened
  var seen = {}, week = null;
  picks = picks.filter(function(p){ if(p.sfx === "week"){ week = p; return false; } return true; });
  picks = picks.sort(function(a,b){ return b.prio-a.prio || a.i-b.i; }).filter(function(p){ if(seen[p.sfx]) return false; seen[p.sfx] = 1; return true; }).slice(0,week ? 2 : 3);
  if(week) picks.push(week);
  picks.sort(function(a,b){ return a.i-b.i; });
  picks.forEach(function(p,k){ play(p.sfx,{delay:k*0.17,prio:p.sfx === "week" ? 3 : undefined}); });
  if(speech && !runBatch) say(speech.say,{cooldown: speech.sfx === "week" ? 9000 : 6000});
}
export function onModal(title){
  play("modal");
  var t = norm(title);
  if(t.indexOf("🧨") === 0) say("competitor",{cooldown:4000});
  else if(t.indexOf("🔐") === 0) say("incident",{cooldown:4000});
  else if(t.indexOf("👔") === 0) say(/chatgdp/i.test(t) ? "chatgdp" : "yoink",{cooldown:4000}); // v1.21: the warning; v1.19: the Writing Lesson
}
