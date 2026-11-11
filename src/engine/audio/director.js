import { play } from "./mixer.js";
import { BIG_CLOSE, CASH_WARN_TAG, isRunTag, modalSay, ruleFor } from "./tagmap.js";
import { say } from "./voice.js";
import { fxRandom } from "../../fxrng.js";

/* ---------- director: turn new log lines into sound + PA lines ---------- */
// It reads each entry's tag and params (entry.tag, entry.d), never its words: tagmap.js says what each tag sounds like.
export { ruleFor };
export function onLogs(entries,info){
  info = info || {};
  if(info.over || !entries || !entries.length) return;
  var picks = [], speech = null, runBatch = false;
  for(var k=0;k<entries.length;k++){ if(isRunTag(entries[k].tag)){ runBatch = true; break; } }
  for(var i=0;i<entries.length;i++){
    // a run owns its whole batch: its "Cash under -$1,000" warning sounds when the strike card lands, and the PA line is the run's
    if(isRunTag(entries[i].tag) || (runBatch && entries[i].tag === CASH_WARN_TAG)) continue;
    var e = entries[i], d = e.d || {}, r = ruleFor(e.tag,d);
    if(r && r.close){ var amt = typeof d.won === "number" ? d.won : 0; if(amt >= BIG_CLOSE) r.say = "bigClose"; }
    // the week flip (d.week is the week that is starting): a line for the weeks that matter, now and then a filler
    if(r && r.sfx === "week"){ var n = d.week; if(typeof n === "number" && n >= 0 && isFinite(n)){ var w = ((Math.floor(n)-1)%13)+1;
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
// id: the dialog's id (the keys of EVENTS in src/game/events.js)
export function onModal(id){
  play("modal");
  var line = modalSay(id);
  if(line) say(line,{cooldown:4000});
}
