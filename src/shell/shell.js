/* ===== Tech Sales Trail: the mute key, the toast, and the SHITCORP OS boot screen ===== */
(function(){
  "use strict";
  var A = window.TST_AUDIO, Sc = window.TST_SCENES;
  if(!A || !Sc) return;
  var reduced = !!Sc.reduced;

  /* ---------- M mutes (the sound controls themselves are in the top bar and the settings menu) ---------- */
  document.addEventListener("keydown",function(e){
    if((e.key !== "m" && e.key !== "M") || e.metaKey || e.ctrlKey || e.altKey) return;
    var tg = e.target;
    if(tg && ((tg.tagName === "INPUT" && tg.type !== "range") || tg.tagName === "TEXTAREA" || tg.isContentEditable)) return;
    if(document.getElementById("boot")) return;
    A.setOn(!A.settings.on);
    if(A.settings.on) A.play("coin");
    window.TST_TOAST(A.settings.on ? "Sound on" : "Sound off");
  });

  /* ---------- a held key presses a button once ---------- */
  // Holding Enter makes the keyboard repeat it, and each repeat used to press the focused button again: three
  // actions, or three weeks, from one press. Repeats of Enter and Space on anything button-like are dropped here,
  // before the button hears them. Typing into a field is left alone.
  document.addEventListener("keydown",function(e){
    if(!e.repeat || (e.key !== "Enter" && e.key !== " ")) return;
    var tg = e.target;
    if(tg && tg.closest && tg.closest("button,[role=button],[role=switch],summary,a[href]")){ e.preventDefault(); e.stopPropagation(); }
  },true);

  /* ---------- toast (in-page replacement for alert(), which the artifact viewer blocks) ---------- */
  // Both nodes exist before the first message, so the live region is registered when it speaks. The visible
  // toast is a manual popover: the top layer keeps it above an open <dialog> and its backdrop.
  function toastNodes(){
    var el = document.getElementById("tst-toast"), live = document.getElementById("tst-live");
    if(!document.body) return null;
    if(!el){ el = document.createElement("div"); el.id = "tst-toast"; el.setAttribute("aria-hidden","true"); el.setAttribute("popover","manual"); document.body.appendChild(el); }
    if(!live){ live = document.createElement("div"); live.id = "tst-live"; live.className = "sr-only"; live.setAttribute("role","status"); live.setAttribute("aria-live","polite"); document.body.appendChild(live); }
    return {el:el, live:live};
  }
  toastNodes();
  window.TST_TOAST = function(msg){
    var n = toastNodes(); if(!n) return;
    var el = n.el;
    clearTimeout(el._t); clearTimeout(el._h);
    try{ if(el.matches(":popover-open")) el.hidePopover(); el.showPopover(); }catch(e){} // re-show = topmost
    el.textContent = msg;
    el.classList.remove("show"); void el.offsetWidth; el.classList.add("show");
    el._t = setTimeout(function(){ el.classList.remove("show"); el._h = setTimeout(function(){ try{ el.hidePopover(); }catch(e){} },400); },2600);
    // an open modal makes the rest of the page inert, so screen readers hear it from the dialog's own status line
    var live = document.querySelector("dialog[open] .tst-sr") || n.live;
    live.textContent = ""; clearTimeout(live._t); live._t = setTimeout(function(){ live.textContent = msg; },60);
  };

  /* ---------- boot screen (once per tab session) ---------- */
  var booted = false;
  try{ booted = sessionStorage.getItem("tst-booted") === "1"; }catch(e){}
  if(booted) return;
  var saved = null;
  try{ var raw = localStorage.getItem("tst-autosave-v4-3") || localStorage.getItem("tst-save-v4-3"); saved = raw ? JSON.parse(raw) : null; }catch(e){}
  if(saved && (saved.fired || saved.burnedOut || saved.win || saved.missed || saved.repo)) return; // an ending modal is about to open
  function readWeek(){ return saved && saved.week > 0 ? ((saved.week-1)%13)+1 : 1; }
  var ov = document.createElement("div");
  ov.id = "boot";
  ov.setAttribute("role","dialog"); ov.setAttribute("aria-modal","true"); ov.setAttribute("aria-label","Shitcorp OS boot screen");
  ov.innerHTML =
    '<div class="boot-monitor">'+
      '<div class="cutbox crt boot-screen"><pre class="cutscene" aria-hidden="true"></pre></div>'+
      '<div class="boot-bezel">'+
        '<span class="boot-led" aria-hidden="true"></span><span class="boot-brand">SHITCORP</span>'+
        '<span class="boot-hint">M mutes</span>'+
        '<button type="button" class="btn primary boot-btn" data-nosfx>Clock in</button>'+
      '</div>'+
    '</div>';
  document.body.appendChild(ov);
  document.documentElement.classList.add("tst-booting");
  var behind = document.getElementById("root");
  if(behind) behind.inert = true;
  var pre = ov.querySelector("pre"), btn = ov.querySelector(".boot-btn"), hint = ov.querySelector(".boot-hint");
  var stage = "standby", ctrl = Sc.play(pre,"standby",{crt:false, maxFont:20});
  try{ btn.focus({preventScroll:true}); }catch(e){}
  function start(){
    if(stage !== "standby") return;
    stage = "booting"; A.unlock();
    ctrl.stop();
    ov.classList.add("on");
    btn.textContent = "Skip"; hint.textContent = "Booting…";
    // no impact frames until the game behind the boot has mounted (Babel compiling = long main-thread stall)
    ctrl = Sc.play(pre,"boot",{crt:false, maxFont:20, meta:{week:readWeek()}, impactOk:function(){ return !!document.querySelector("#root .main"); }, onDone:function(){ setTimeout(finish, reduced ? 2000 : 400); }});
  }
  function finish(){
    if(stage === "done") return;
    stage = "done";
    try{ sessionStorage.setItem("tst-booted","1"); }catch(e){}
    ctrl.stop();
    A.play("poweroff");
    document.removeEventListener("keydown",onKey,true);
    document.documentElement.classList.remove("tst-booting");
    if(behind) behind.inert = false;
    // v2.0: the button that had the focus is about to go; hand the focus to the desk, not to <body>
    // (a dialog that opens next, such as the first day's memo, takes it from there)
    try{ var first = behind && behind.querySelector('[data-act]:not([aria-disabled="true"])'); if(first) first.focus({preventScroll:true}); }catch(e){}
    if(reduced){ ov.remove(); return; }
    pre.classList.remove("tst-crt-on"); pre.classList.add("tst-crt-off");
    ov.classList.add("off");
    setTimeout(function(){ if(ov.parentNode) ov.parentNode.removeChild(ov); },560);
  }
  function advance(){ if(stage === "standby") start(); else if(stage === "booting"){ ctrl.skip(); finish(); } }
  function onKey(e){
    if(stage === "done") return;
    if(e.ctrlKey || e.metaKey || e.altKey) return; // browser shortcuts (reload, tabs, devtools) pass through
    if(e.key === "Tab") return;
    if(e.key === "m" || e.key === "M"){ // mute toggle, without clocking in
      e.preventDefault(); e.stopPropagation();
      if(e.repeat) return;
      A.setOn(!A.settings.on);
      if(A.settings.on){ A.unlock(); A.play("coin"); }
      window.TST_TOAST(A.settings.on ? "Sound on" : "Sound off");
      return;
    }
    if(e.key === "Escape"){ e.preventDefault(); if(stage === "standby") A.unlock(); finish(); return; }
    if(/^(Shift|Control|Alt|Meta|CapsLock|Arrow|F\d)/.test(e.key)) return;
    e.preventDefault(); e.stopPropagation();
    if(e.repeat) return; // a held key starts the boot once, never skips it
    advance();
  }
  ov.addEventListener("click",function(e){ e.stopPropagation(); advance(); });
  document.addEventListener("keydown",onKey,true);
})();
