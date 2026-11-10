import { blink, prog, rep } from "../core.js";
import { SCENES } from "../registry.js";

/* ---------------- BOOT: SHITCORP OS ---------------- */
// 5-row block font (6 columns a letter with the gap): the logo and the title cards
export var FONT = {S:[" ####","#    "," ### ","    #","#### "],H:["#   #","#   #","#####","#   #","#   #"],I:["###"," # "," # "," # ","###"],T:["#####","  #  ","  #  ","  #  ","  #  "],C:[" ####","#    ","#    ","#    "," ####"],O:[" ### ","#   #","#   #","#   #"," ### "],R:["#### ","#   #","#### ","#  # ","#   #"],P:["#### ","#   #","#### ","#    ","#    "],
  L:["#    ","#    ","#    ","#    ","#####"],U:["#   #","#   #","#   #","#   #"," ### "],B:["#### ","#   #","#### ","#   #","#### "],F:["#####","#    ","#### ","#    ","#    "],E:["#####","#    ","#### ","#    ","#####"],D:["#### ","#   #","#   #","#   #","#### "],N:["#   #","##  #","# # #","#  ##","#   #"],M:["#   #","## ##","# # #","#   #","#   #"],
  A:[" ### ","#   #","#####","#   #","#   #"],W:["#   #","#   #","# # #","## ##","#   #"]};
export function blockWord(word){
  var out = [];
  for(var r=0;r<5;r++) out.push(word.split("").map(function(ch){ return (FONT[ch] || FONT.O)[r]; }).join(" "));
  return out;
}
export var LOGO = blockWord("SHITCORP");
export function drawLogo(g,x,y,k,k2){
  for(var r=0;r<LOGO.length;r++){
    var L = LOGO[r];
    for(var i=0;i<L.length;i++) if(L.charAt(i) === "#") g.set(x+i,y+r,"\u2588",r < 3 ? k : k2);
  }
}
export var BOOT_LINES = [
  {t:260,  y:9,  s:"SHITCORP OS v4.3", k:"k-w k-bold"},
  {t:480,  y:11, bar:true},
  {t:1120, y:13, s:"ERROR: quota exceeds pipeline.", k:"k-r k-bold"},
  {t:1400, y:15, week:true, k:"k-c", cursor:true}
];
SCENES.boot = {
  dur: 1700, band:false,
  cam: [{t:0, x:0, y:0, z:1, r:0}],
  cues: [
    {t:0, sfx:"bootHum"}, {t:0, slam:1.6, ms:460, fx:31, fy:4}, {t:0, lines:"radial", ms:560, fx:31, fy:4, n:34}, {t:40, impact:90},
    {t:480, sfx:"loadStart"},
    {t:1120, sfx:"errBeep"}, {t:1120, glitch:220}, {t:1120, impact:90}, {t:1120, shake:200},
    {t:1400, sfx:"chime"}, {t:1500, say:"boot", key:true}
  ],
  summary: "SHITCORP OS boots and reports quota exceeds pipeline.",
  draw: function(g,c){
    var t = c.t, st = c.st, typed = 0, X = 10;
    drawLogo(g,9,2,"k-c","k-b");
    for(var i=0;i<BOOT_LINES.length;i++){
      var L = BOOT_LINES[i]; if(t < L.t && !c.still) break;
      if(L.bar){
        var p = c.still ? 1 : prog(t,480,1000), w = 24;
        var pct = Math.round(74*p), f = Math.floor(w*pct/100);
        g.text(X,L.y,"Loading quota","k-d");
        g.text(X+14,L.y,"["+rep("\u2588",f)+rep("\u2591",w-f)+"]",pct >= 74 ? "k-r" : "k-b");
        g.text(X+41,L.y,(pct < 10 ? " " : "")+pct+"%",pct >= 74 ? "k-r k-bold" : "k-w");
        if(!c.still && p < 1){ var tk = Math.floor(p*12); if(tk !== st.tk){ st.tk = tk; c.sfx("tick"); } }
        continue;
      }
      var src = L.week ? "Week "+(c.meta.week||1)+"/13. Clocking in." : L.s;
      var n = c.still ? src.length : Math.min(src.length, Math.floor((t-L.t)/1000*110));
      g.text(X,L.y,src.slice(0,n),L.k);
      typed += n;
      if(n < src.length) g.set(X+n,L.y,"\u258c","k-w");
      else if(L.cursor && blink(t,400)) g.set(X+1+n,L.y,"\u258c","k-w");
    }
    c.typed = typed;
  }
};
// standby screen shown before the first click
SCENES.standby = {
  dur: 1, band:false, cues: [], keepAlive:true, // blinks until you clock in (at the idle tick, not every frame)
  summary: "SHITCORP OS standby screen.",
  draw: function(g,c){
    var t = c.t;
    drawLogo(g,9,2,"k-c","k-b");
    g.center(8,"O S   v 4 . 3","k-d");
    if(blink(t,600) || c.still) g.center(12,"[ PRESS ANY KEY ]","k-w k-bold");
  }
};
