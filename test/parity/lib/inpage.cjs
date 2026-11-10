'use strict';
/*
 * The in-page half of the parity harness.
 *
 * `parityInPage` is serialised with toString() and installed through addInitScript, so it runs in every
 * document of the context BEFORE any of the game's own scripts. It must be self-contained: no closures over
 * Node-side values, everything it needs arrives in `cfg`.
 *
 * It owns four things that have to be identical in build A and build B:
 *   1. the dice      Math.random becomes a seeded mulberry32 with a draw counter and a scripted queue;
 *                    window.__TST_FX is a separate stream for the cosmetic draws (particles, sound jitter, PA filler).
 *   2. the clock     Date, performance.now, setTimeout/setInterval and requestAnimationFrame run on a fake clock
 *                    that only moves when the harness says so. MessageChannel is left alone: React's scheduler
 *                    uses it, and the harness yields to it between timers the way a browser would.
 *   3. the speakers  AudioContext and speechSynthesis are replaced by silent fakes that keep time on the fake
 *                    clock, so the sound engine's decisions (voice stealing, PA cooldowns) are deterministic.
 *   4. the step      act -> settle -> snapshot, all in one round trip.
 *
 * Nothing in here knows what the game's DOM looks like. That knowledge lives in window.__drv, the in-page part
 * of the driver for this build (see drivers/interface.cjs), which a second init script installs.
 */
module.exports = function parityInPage(cfg) {
  const W = window;
  if (W.__parity) return;

  const mulberry = seed => {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  /* ------------------------------------------------------------------ 1. the dice */
  // The mechanical stream. Every call counts, whether it is answered from the scripted queue or from the stream:
  // "equal number of draws consumed" is one of the four per-step assertions.
  let stream = mulberry(cfg.seed), draws = 0, fromQueue = 0, armed = false;
  const early = [];           // who drew before the first reset (module load: react-dom, babel)
  W.__rngQueue = [];          // values handed out before the stream, to force a rare branch
  const random = () => {
    draws++;
    if (!armed && early.length < 12) early.push(String(new Error().stack || '').split('\n').slice(2, 4).map(s => s.trim().slice(0, 140)).join(' <- '));
    const q = W.__rngQueue;
    if (q && q.length) { fromQueue++; return q.shift(); }
    return stream();
  };
  Math.random = random;
  W.__rngReset = seed => { stream = mulberry(seed); draws = 0; fromQueue = 0; W.__rngQueue = []; armed = true; };
  W.__rngDraws = () => draws;

  // The cosmetic stream. Build B reads globalThis.__TST_FX by itself; the baseline is patched at route time to do
  // the same (see lib/serve.cjs). 'const' pins every cosmetic draw to one value.
  let fxDraws = 0;
  const fxStream = cfg.fx.mode === 'const' ? () => cfg.fx.value : mulberry(cfg.fx.seed);
  W.__TST_FX = () => { fxDraws++; return fxStream(); };

  /* ------------------------------------------------------------------ 2. the clock */
  // Wall time survives a reload through sessionStorage (the game only ever reads its own "tst-booted" key there),
  // so log timestamps and run ids keep moving forward the way they would for a player.
  let wall = cfg.epoch;
  try { const kept = Number(W.sessionStorage.getItem('__parity_wall')); if (kept > wall) wall = kept; } catch (_) {}
  let ticks = 0;              // performance.now(): milliseconds since this document started
  let timerSeq = 1;
  const timers = new Map();   // id -> {id, at, fn, args, every, raf}
  const addTimer = (fn, delay, args, every, raf) => {
    const id = timerSeq++;
    timers.set(id, { id, at: ticks + Math.max(0, Number(delay) || 0), fn, args, every, raf });
    return id;
  };
  const dropTimer = id => { timers.delete(id); };
  W.setTimeout = (fn, delay, ...args) => addTimer(fn, delay, args, 0, false);
  W.setInterval = (fn, delay, ...args) => addTimer(fn, delay, args, Math.max(1, Number(delay) || 0), false);
  W.clearTimeout = dropTimer;
  W.clearInterval = dropTimer;
  W.requestAnimationFrame = fn => addTimer(fn, 16 - (ticks % 16), [], 0, true);   // frames land on 16 ms boundaries
  W.cancelAnimationFrame = dropTimer;
  W.performance.now = () => ticks;
  const RealDate = W.Date;
  const dateNow = () => wall;
  W.Date = new Proxy(RealDate, {
    construct(T, args) { return args.length ? new T(...args) : new T(wall); },
    apply(T) { return new T(wall).toString(); },
    get(T, p) { return p === 'now' ? dateNow : Reflect.get(T, p); }
  });

  // One real macrotask. React's scheduler posts its work on a MessageChannel of its own, and messages are
  // delivered first in, first out, so by the time ours arrives React has rendered whatever was pending.
  const chan = new MessageChannel();
  let wake = null;
  chan.port1.onmessage = () => { const w = wake; wake = null; if (w) w(); };
  const realTick = () => new Promise(resolve => { wake = resolve; chan.port2.postMessage(0); });
  const realTicks = async n => { for (let i = 0; i < n; i++) await realTick(); };

  const advanceTo = t => { wall += t - ticks; ticks = t; };
  const thrown = [];          // exceptions out of timer callbacks; any entry fails the run
  const fire = t => {
    try { if (typeof t.fn === 'function') { if (t.raf) t.fn(ticks); else t.fn(...t.args); } }
    catch (e) { thrown.push('timer callback threw: ' + String(e && e.stack || e).slice(0, 400)); }
  };
  // Fires every timer due within the next `ms`, in order, advancing the clock to each one. After each timer (or
  // each animation frame: all callbacks of one frame run together, as in a browser) the page gets a real
  // macrotask so React can render before the next timer fires.
  async function runFor(ms) {
    const target = ticks + ms;
    let fired = 0;
    for (;;) {
      let first = null;
      for (const t of timers.values()) {
        if (t.at <= target && (!first || t.at < first.at || (t.at === first.at && t.id < first.id))) first = t;
      }
      if (!first) break;
      if (++fired > 200000) { thrown.push('timer storm: more than 200000 timers in one runFor(' + ms + ')'); break; }
      advanceTo(first.at);
      if (first.raf) {
        const frame = [];
        for (const t of timers.values()) if (t.raf && t.at === first.at) frame.push(t);
        frame.sort((a, b) => a.id - b.id);
        for (const t of frame) timers.delete(t.id);
        for (const t of frame) fire(t);
      } else {
        if (first.every) first.at += first.every; else timers.delete(first.id);
        fire(first);
      }
      await realTick();
    }
    advanceTo(target);
    try { W.sessionStorage.setItem('__parity_wall', String(wall)); } catch (_) {}
  }

  /* ------------------------------------------------------------------ 3. the speakers */
  // Headless Chromium gives the page a real AudioContext whose currentTime runs on real time, and a
  // speechSynthesis with no voices whose utterances may never end. Both feed decisions in the sound engine
  // (three-voice limit by currentTime; "is a line still being spoken"), so both are replaced by fakes that keep
  // time on the fake clock. The fakes make no sound and are the same object model in A and B.
  const param = v => ({ value: v, setValueAtTime() { return this; }, linearRampToValueAtTime() { return this; },
    exponentialRampToValueAtTime() { return this; }, setTargetAtTime() { return this; }, cancelScheduledValues() { return this; } });
  const audioNode = extra => Object.assign({ connect(x) { return x; }, disconnect() {}, start() {}, stop() {} }, extra);
  function FakeAudioContext() {
    this.sampleRate = 4410;   // only sizes the noise buffer (two seconds of cosmetic draws)
    this.state = 'running';
    this.destination = audioNode({});
  }
  Object.defineProperty(FakeAudioContext.prototype, 'currentTime', { get() { return ticks / 1000; } });
  Object.assign(FakeAudioContext.prototype, {
    resume() { this.state = 'running'; return Promise.resolve(); },
    suspend() { return Promise.resolve(); },
    close() { this.state = 'closed'; return Promise.resolve(); },
    createGain() { return audioNode({ gain: param(1) }); },
    createOscillator() { return audioNode({ type: 'sine', frequency: param(440), detune: param(0) }); },
    createBiquadFilter() { return audioNode({ type: 'lowpass', frequency: param(350), Q: param(1), gain: param(0) }); },
    createDynamicsCompressor() { return audioNode({ threshold: param(-24), knee: param(30), ratio: param(12), attack: param(0.003), release: param(0.25) }); },
    createBuffer(channels, length, rate) { const data = new Float32Array(length); return { length, sampleRate: rate, duration: length / rate, numberOfChannels: channels, getChannelData() { return data; } }; },
    createBufferSource() { return audioNode({ buffer: null, loop: false, playbackRate: param(1) }); }
  });
  W.AudioContext = FakeAudioContext;
  W.webkitAudioContext = FakeAudioContext;

  const spoken = [];          // every utterance handed to the fake speech engine, in order
  const speechQueue = [];
  const voices = [
    { name: 'Google UK English Male', lang: 'en-GB', localService: true, default: true, voiceURI: 'parity-m' },
    { name: 'Microsoft Zira - English (United States)', lang: 'en-US', localService: true, default: false, voiceURI: 'parity-f' }
  ];
  const fakeSpeech = {
    speaking: false, pending: false, paused: false, onvoiceschanged: null,
    getVoices() { return voices.slice(); },
    speak(u) {
      // A line lasts 300 ms plus 60 ms a character, on the fake clock, then ends like a real one.
      const text = String(u && u.text || '');
      const entry = { u, timer: 0 };
      speechQueue.push(entry);
      this.speaking = true;
      if (text.trim()) spoken.push(text);
      entry.timer = W.setTimeout(() => {
        const k = speechQueue.indexOf(entry); if (k >= 0) speechQueue.splice(k, 1);
        this.speaking = speechQueue.length > 0;
        if (typeof u.onend === 'function') u.onend({ type: 'end' });
      }, 300 + 60 * text.length);
    },
    cancel() {
      const dropped = speechQueue.splice(0);
      this.speaking = false;
      for (const e of dropped) { W.clearTimeout(e.timer); if (typeof e.u.onerror === 'function') e.u.onerror({ type: 'error', error: 'canceled' }); }
    },
    pause() {}, resume() {}
  };
  try { Object.defineProperty(W, 'speechSynthesis', { configurable: true, get() { return fakeSpeech; } }); } catch (_) {}
  W.SpeechSynthesisUtterance = function FakeUtterance(text) { this.text = text; this.volume = 1; this.rate = 1; this.pitch = 1; this.lang = ''; this.voice = null; this.onend = null; this.onerror = null; };
  // the stress heartbeat is skipped while the tab is hidden; a headless page must never count as hidden
  try { Object.defineProperty(document, 'hidden', { configurable: true, get() { return false; } }); } catch (_) {}
  try { Object.defineProperty(document, 'visibilityState', { configurable: true, get() { return 'visible'; } }); } catch (_) {}

  // The sound trace. The driver for this build reports four kinds of moment (see drivers/interface.cjs):
  //   playAttempt(name)  the game asked for a sound while sound is on and unlocked
  //   played(name)       ...and the mixer started it (it was not dropped by the three-voice limit)
  //   sayAttempt(key)    the game asked the announcer for a line
  //   sayAccepted(key)   ...and the announcer took it (not on cooldown, not busy)
  // The trace is the sequence of intents: "play:<name>" / "play:<name>!drop", "say:<key>" / "say:<key>!drop".
  const trace = [];
  let lastPlay = null, lastSay = null;
  const sink = {
    playAttempt(name) { lastPlay = { kind: 'play', name: String(name), ok: false }; trace.push(lastPlay); },
    played(name) { if (lastPlay && lastPlay.name === String(name)) lastPlay.ok = true; else trace.push({ kind: 'play', name: String(name), ok: true, orphan: true }); },
    sayAttempt(key) { lastSay = { kind: 'say', name: String(key), ok: false }; trace.push(lastSay); },
    sayAccepted(key) { if (lastSay && lastSay.name === String(key)) lastSay.ok = true; else trace.push({ kind: 'say', name: String(key), ok: true, orphan: true }); }
  };
  const drainTrace = () => trace.splice(0).map(e => e.kind + ':' + e.name + (e.ok ? '' : '!drop') + (e.orphan ? '!orphan' : ''));

  /* ------------------------------------------------------------------ no CSS motion, no pixels */
  // CSS animations and transitions run on the compositor's clock, not ours. With them on, the clAInk ad stays
  // visibility:hidden for a real 1.2 s (animation delay), which would make "is this control usable" a race.
  //
  // html{opacity:0}: nothing here ever looks at pixels, and painting them was most of the cost of a step (software
  // raster of a 1440x900 page after every move: about 15 ms a step with it, about 6 ms without). Layout, style
  // and visibility are untouched: opacity is not part of "can a player press this" (see usable() in the driver).
  const calm = () => {
    if (!document.documentElement || document.getElementById('__parity_calm')) return;
    const st = document.createElement('style');
    st.id = '__parity_calm';
    st.textContent = '*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}' +
      'html{opacity:0!important}';
    document.documentElement.appendChild(st);
  };
  calm();
  document.addEventListener('DOMContentLoaded', calm);

  /* ------------------------------------------------------------------ 4. the step */
  const drv = () => { if (!W.__drv) throw new Error('parity: no driver installed in this page'); return W.__drv; };
  let flavorCalls = 0, soundHooked = false;
  let lastTop = null;         // id of the newest log line already reported

  const rawState = () => { const s = drv().readState(); return s && typeof s === 'object' ? s : null; };

  // Everything the runner compares, in one object. The state travels as a JSON string without its logs (they are
  // the bulk of a save and are never compared); the log lines that are new since the last snapshot ride along
  // separately, oldest first, for the census and for failure reports.
  function snapshot() {
    const s = rawState();
    const obs = drv().observe();
    let fresh = [], logsSwapped = false, logCount = 0;
    if (s && Array.isArray(s.logs)) {
      logCount = s.logs.length;
      let idx = s.logs.length;
      if (lastTop !== null) { idx = s.logs.findIndex(e => e && e.id === lastTop); if (idx < 0) { idx = Math.min(s.logs.length, 60); logsSwapped = true; } }
      fresh = s.logs.slice(0, idx).reverse().map(e => ({ msg: String(e && e.msg), kind: e && e.kind }));
      lastTop = s.logs.length ? s.logs[0].id : null;
    }
    const lite = s ? Object.assign({}, s, { logs: undefined }) : null;
    return {
      state: lite ? JSON.stringify(lite) : null,
      logs: fresh, logsSwapped, logCount,
      draws, fromQueue, queueLeft: W.__rngQueue.length, fxDraws, flavorCalls,
      dialog: obs.dialog, legal: obs.legal.slice().sort(),
      sound: drainTrace(), speech: spoken.splice(0),
      wall, rngIntact: Math.random === random, thrown: thrown.splice(0)
    };
  }

  // What must stop changing before a step counts as settled.
  const signature = () => {
    let raw = null;
    try { raw = W.localStorage.getItem(cfg.autosaveKey); } catch (_) {}
    return String(raw) + '\u0001' + draws + '\u0001' + JSON.stringify(drv().observe());
  };

  // One round = let React finish, ride the timers for roundMs of fake time, let React finish again.
  // A step is settled when two rounds in a row end with the same signature.
  async function settle(roundMs, maxRounds) {
    let prev = null, rounds = 0;
    for (;;) {
      await realTicks(3);
      await runFor(roundMs);
      await realTicks(3);
      rounds++;
      const sig = signature();
      if (prev !== null && sig === prev) return { rounds, settled: true };
      if (rounds >= maxRounds) return { rounds, settled: false };
      prev = sig;
    }
  }
  async function rounds(n, roundMs) {
    for (let i = 0; i < n; i++) { await realTicks(3); await runFor(roundMs); await realTicks(3); }
  }

  W.__parity = {
    // Wait for the app, dismiss the boot overlay, settle. Fake time is advanced in small slices while waiting in
    // case a build mounts from a timer.
    async boot(roundMs, maxRounds) {
      let mounted = false;
      for (let i = 0; i < 400 && !(mounted = !!drv().mounted()); i++) { await realTicks(2); if (i % 5 === 4) await runFor(20); }
      if (!mounted) return { mounted: false };
      let bootSeen = false;
      await realTicks(3);
      for (let i = 0; i < 4 && drv().bootOpen(); i++) { bootSeen = true; drv().bootDismiss(); await realTicks(3); await runFor(700); await realTicks(3); }
      const st = await settle(roundMs, maxRounds);
      return { mounted: true, bootSeen, bootStillOpen: !!drv().bootOpen(), settled: st.settled, earlyDraws: draws, early: early.slice(), wall };
    },
    // Called after boot and after every reload, in both builds, with the same arguments.
    arm(seed, flavorValue, traceSound) {
      W.__rngReset(seed);
      drv().pinFlavor(() => { flavorCalls++; return flavorValue; });
      if (traceSound && !soundHooked) { drv().soundInstall(sink); soundHooked = true; }
      trace.length = 0; spoken.length = 0; lastPlay = lastSay = null;
      const s = rawState();
      lastTop = s && Array.isArray(s.logs) && s.logs.length ? s.logs[0].id : null;
      return { audio: drv().audioState() };
    },
    async step(move, queue, roundMs, maxRounds) {
      W.__rngQueue = Array.isArray(queue) ? queue.slice() : [];
      let actError = null;
      try { drv().act(move); } catch (e) { actError = String(e && e.message || e); }
      const st = await settle(roundMs, maxRounds);
      W.__rngQueue = [];      // a scripted queue belongs to one move; leftovers never leak into the next
      const snap = snapshot();
      return Object.assign(snap, { rounds: st.rounds, settled: st.settled, actError });
    },
    async extra(n, roundMs) { await rounds(n, roundMs); const snap = snapshot(); snap.rounds = n; snap.settled = true; snap.actError = null; return snap; },
    async idle(roundMs, maxRounds) { const st = await settle(roundMs, maxRounds); const snap = snapshot(); return Object.assign(snap, { rounds: st.rounds, settled: st.settled, actError: null }); },
    snapshot,
    writeSave(where, json) { drv().writeSave(where, json); return true; },
    pendingTimers() { return timers.size; }
  };
};
