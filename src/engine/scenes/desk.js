import { blink, mod, prog, rep, rnd } from "./core.js";
import { SCENES } from "./registry.js";
import { SPR } from "./sprites.js";
import { DESK_TEXT as TEXT } from "../../copy/scenes.js";
import { fxRandom } from "../../fxrng.js";

/* ---------------- BURNOUT: stress spikes, desk melts, blue screen ---------------- */
// the open-plan desk, three ways: STRESS meter (plain), HEART meter with extra cups (caf), or the reactor room
// (mode "core": CORE TEMP, containment strip, geiger readout). mode "plain" skips the meter. jit rattles the rep.
export function drawDesk(g,t,p,bpm,caf,mode,jit){
  var core = mode === "core";
  g.spr(2,1,SPR.monitor,"k-d");
  var warn = p >= 85;
  g.text(4,2,core ? TEXT.reactor : TEXT.forecast,"k-c");
  g.text(4,3,warn ? (blink(t,180) ? "> !!!!!!!" : "> ???????") : (core ? TEXT.rods : TEXT.commit),"k-w");
  g.text(4,4,core ? TEXT.coolant : "> ????","k-d");
  var wx = 22 + (jit ? Math.round(rnd(-1,1)) : 0);
  g.spr(wx,3,SPR.worker,"k-w");
  var face = p < 75 ? "(o_o)" : p < 88 ? "(O_O)" : p < 100 ? "(@_@)" : "(x_x)";
  g.text(wx+1,3,face,p >= 88 ? "k-r" : "k-w");
  if(p >= 80){ g.set(wx-1,3,blink(t,260) ? "'" : " ","k-c"); g.set(wx+7,4,blink(t,330) ? "'" : " ","k-c"); }
  if(p >= 90){ var sy = 2 - (Math.floor(t/160)%2); g.text(wx+2,sy,blink(t,160) ? "~ ~" : " ~ ","k-d"); }
  g.text(18,6,"c[_]","k-y");
  g.text(18,5,blink(t,400) ? " ) " : " ( ","k-d");
  if(caf){ g.text(13,6,"c[_]","k-y"); g.text(31,6,"c[_]","k-y"); if(p >= 90) g.text(8,6,"c[_]","k-y"); }
  g.spr(0,7,SPR.deskTop,"k-br");
  if(mode === "plain") return;
  // the meter
  var w = 20, f = Math.round(w*p/100);
  var mk = p < 70 ? "k-y" : p < 90 ? "k-o" : (blink(t,140) ? "k-r k-bold" : "k-r");
  var label = core ? TEXT.meterCore : caf ? TEXT.meterHeart : TEXT.meterStress;
  g.text(39,2,label,"k-d");
  g.text(39,3,"["+rep("\u2588",f)+rep("\u2591",w-f)+"]",mk);
  g.text(40+label.length,2,Math.round(p)+"%",mk); // next to the label, so push-ins never crop it
  if(core){
    var cs = p >= 100 ? TEXT.failed : p >= 80 ? TEXT.degraded : TEXT.nominal;
    g.text(39,5,TEXT.containment,"k-d");
    g.text(51,5,cs,p >= 100 ? (blink(t,150) ? "k-r k-bold" : "k-r") : p >= 80 ? (blink(t,300) ? "k-o" : "k-o-d") : "k-g");
    var gl = Math.round(p >= 100 ? 22 : 4 + 18*prog(p,60,100));
    for(var q=0;q<22;q++) g.set(39+q,6,q < gl ? (fxRandom() < .7 ? "|" : "!") : ".",q < gl ? (p >= 90 ? "k-r" : "k-o") : "k-d");
    return;
  }
  var beatMs = 60000/bpm;
  g.text(39,5,TEXT.bpm+Math.round(bpm),"k-d");
  g.text(48,5,(t % beatMs) < beatMs*0.35 ? "<3" : "  ","k-r");
  // ECG trace, newest sample on the right
  for(var i=0;i<22;i++){
    var tau = t-(21-i)*26, ph = Math.floor(mod(tau,beatMs)/26);
    g.set(39+i,6,ph === 0 ? "/" : ph === 1 ? "\\" : "_",p >= 90 ? "k-r" : "k-g");
  }
}
// the burnout ending has two storyboards; which one plays depends on how the rep went
export function sceneKey(type,meta){
  if(type === "burnout") return meta && meta.cause === "caffeine" ? "ascension" : "meltdown";
  return SCENES[type] ? type : "club";
}
