import { fxRandom } from "../../fxrng.js";

export var HAS_DOM = typeof document !== "undefined";
export var COLS = 64, ROWS = 17, ART = 13; // rows 0-12 art, 13 rule, 14-16 caption band

/* ---------- helpers ---------- */
export function S(str){ var a = str.split("\n"); if(a[0] === "") a.shift(); if(a.length && a[a.length-1].trim() === "") a.pop(); return a; }
export function clamp(n,a,b){ return n < a ? a : n > b ? b : n; }
export function prog(t,a,b){ return clamp((t-a)/(b-a),0,1); }
export function lerp(a,b,p){ return a+(b-a)*p; }
export function easeOut(p){ return 1-Math.pow(1-p,3); }
export function easeIn(p){ return p*p*p; }
export function blink(t,ms){ return Math.floor(t/ms)%2 === 0; }
export function pick(a){ return a[Math.floor(fxRandom()*a.length)]; }
export function rnd(a,b){ return a+fxRandom()*(b-a); }
export function esc(s){ return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
export function rep(ch,n){ var s = ""; for(var i=0;i<n;i++) s += ch; return s; }
export function dots(label,value,width){ var n = Math.max(2,width-label.length-value.length-2); return label+" "+rep(".",n)+" "+value; }
export function mod(n,m){ return ((n%m)+m)%m; }
export function easeInOut(p){ return p < .5 ? 4*p*p*p : 1-Math.pow(-2*p+2,3)/2; }

/* ---------- character grid ---------- */
export function Grid(){ this.n = COLS*ROWS; this.ch = new Array(this.n); this.cl = new Array(this.n); this.clear(); }
Grid.prototype.clear = function(){ for(var i=0;i<this.n;i++){ this.ch[i] = " "; this.cl[i] = ""; } };
Grid.prototype.set = function(x,y,c,k){
  x = Math.round(x); y = Math.round(y);
  if(x<0||y<0||x>=COLS||y>=ROWS) return;
  var i = y*COLS+x; this.ch[i] = c; if(k !== undefined) this.cl[i] = k;
};
Grid.prototype.get = function(x,y){ x = Math.round(x); y = Math.round(y); if(x<0||y<0||x>=COLS||y>=ROWS) return " "; return this.ch[y*COLS+x]; };
Grid.prototype.getK = function(x,y){ if(x<0||y<0||x>=COLS||y>=ROWS) return ""; return this.cl[y*COLS+x]; };
Grid.prototype.text = function(x,y,s,k){ x = Math.round(x); for(var i=0;i<s.length;i++) this.set(x+i,y,s.charAt(i),k); };
// sprite: spaces are see-through; "§" paints an opaque blank; optional per-char colour mask
Grid.prototype.spr = function(x,y,lines,k,mask,pal){
  x = Math.round(x); y = Math.round(y);
  for(var r=0;r<lines.length;r++){
    var L = lines[r], M = mask && mask[r];
    for(var i=0;i<L.length;i++){
      var c = L.charAt(i); if(c === " ") continue;
      var kk = k;
      if(M && pal){ var mc = M.charAt(i); if(pal[mc] !== undefined) kk = pal[mc]; }
      this.set(x+i,y+r,c === "§" ? " " : c,kk);
    }
  }
};
// solid sprite: blanks between a row's first and last mark are painted, so things behind don't show through
Grid.prototype.sprO = function(x,y,lines,k){
  x = Math.round(x); y = Math.round(y);
  for(var r=0;r<lines.length;r++){
    var L = lines[r], a = L.search(/\S/), b = L.length-1;
    if(a < 0) continue;
    while(b > a && L.charAt(b) === " ") b--;
    for(var i=a;i<=b;i++) this.set(x+i,y+r,L.charAt(i) === "§" ? " " : L.charAt(i),k);
  }
};
Grid.prototype.fill = function(x,y,w,h,c,k){ for(var r=0;r<h;r++) for(var i=0;i<w;i++) this.set(x+i,y+r,c,k); };
Grid.prototype.center = function(y,s,k){ this.text(Math.floor((COLS-s.length)/2),y,s,k); };
Grid.prototype.copyFrom = function(o){ for(var i=0;i<this.n;i++){ this.ch[i] = o.ch[i]; this.cl[i] = o.cl[i]; } };
Grid.prototype.toText = function(){ var out=[]; for(var y=0;y<ROWS;y++) out.push(this.ch.slice(y*COLS,(y+1)*COLS).join("")); return out.join("\n"); };
// rows y0..y1-1 (default all): starts with no open span, newlines only between its own rows, closes its span at the end
Grid.prototype.toHTML = function(y0,y1){
  if(y0 === undefined) y0 = 0;
  if(y1 === undefined) y1 = ROWS;
  var out = "", cur = null, buf = "";
  for(var y=y0;y<y1;y++){
    for(var x=0;x<COLS;x++){
      var i = y*COLS+x, k = this.cl[i] || "";
      // blanks without their own colour ride along with the current run (fewer spans) unless it paints a background
      if(this.ch[i] === " " && k === "" && cur && cur.indexOf("b-") < 0) k = cur;
      if(k !== cur){ if(buf) out += cur ? '<span class="'+cur+'">'+esc(buf)+"</span>" : esc(buf); buf = ""; cur = k; }
      buf += this.ch[i];
    }
    if(y < y1-1) buf += "\n";
  }
  if(buf) out += cur ? '<span class="'+cur+'">'+esc(buf)+"</span>" : esc(buf);
  return out;
};
// a repeating texture across one row, scrolled by a world offset (tracking shots); spaces are see-through
Grid.prototype.tile = function(y,pat,ox,k){
  var n = pat.length, o = Math.round(ox);
  for(var x=0;x<COLS;x++){ var c = pat.charAt(mod(x+o,n)); if(c !== " ") this.set(x,y,c,k); }
};

/* ---------- particles ---------- */
// ox: optional world offset (particles live in world space during a tracking shot)
export function stepParts(ps,dt,g,floor,ox){
  var s = dt/1000;
  for(var i=ps.length-1;i>=0;i--){
    var p = ps[i];
    p.life -= dt;
    if(p.life <= 0){ ps.splice(i,1); continue; }
    p.vy += (p.g||0)*s; p.x += p.vx*s; p.y += p.vy*s;
    if(floor !== undefined && p.y >= floor){ if(p.onFloor) p.onFloor(p); ps.splice(i,1); continue; }
    if(g){
      var ch = p.ch;
      if(p.fade && p.life < p.fade) ch = p.life < p.fade/2 ? "." : (p.ch2 || "+");
      g.set(p.x-(ox||0),p.y,ch,p.k);
    }
  }
}
