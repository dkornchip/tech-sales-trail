'use strict';
/*
 * Driver for the v1.21 markup: the frozen baseline (test/baseline/v1.21/index.html) and any build whose DOM is
 * still the original one (./index.html as of the lift-and-shift split).
 *
 * The contract every driver implements is written down in drivers/interface.cjs. Line numbers below refer to
 * src/legacy/game.jsx (baseline index.html line = game.jsx line + 3169).
 */
const TRIPS = ['Japan', 'Whistler', 'Cancun', 'Thailand', 'Dubai'];   // game.jsx:381, the order is the draw table

module.exports = {
  name: 'v121',

  // Rules from lib/benign.cjs under which this build may offer FEWER moves than the baseline. None: this markup
  // is the baseline's.
  benign: [],

  // Copy that is stored in a save and has to be reduced to a code before two builds can be compared.
  canon: {
    // deal.probNote (game.jsx:413, 424-432, 543, 1255, 1295)
    probNote(text) {
      if (text === '' || text === undefined || text === null) return 'empty';
      if (text === 'referral peanut') return 'peanut';
      if (text === 'referral big') return 'big';
      if (text === 'referral whale') return 'whale';
      if (text === 'AI-touched') return 'ai';
      if (text === 'agent-promised discount') return 'discount';
      const m = /^roll (\d+)% vs (\d+)%$/.exec(String(text));
      if (m) return 'roll:' + m[1] + ':' + m[2];
      return 'unknown:' + String(text);
    },
    // state.trip (game.jsx:1586): index into TRIPS, because choice(TRIPS) is a mechanical draw
    trip(text) {
      if (text === null || text === undefined) return null;
      const i = TRIPS.indexOf(text);
      return i >= 0 ? i : 'unknown:' + String(text);
    }
  },

  /*
   * Runs inside the page (serialised with toString, so it must not close over anything in this file).
   * Returns the object the harness keeps as window.__drv.
   */
  inPage: function () {
    const AUTOSAVE = 'tst-autosave-v4-3', SAVE = 'tst-save-v4-3';   // game.jsx:16-17
    // .actions .btn by position (game.jsx:1686-1733)
    const ACTIONS = ['prospect', 'cadence', 'discovery', 'demo', 'propose', 'close', 'network', 'conference', 'recharge', 'coffee', 'politics', 'crm'];
    const q = (sel, root) => (root || document).querySelector(sel);
    const qa = (sel, root) => Array.from((root || document).querySelectorAll(sel));
    // A control counts when a player could press it: enabled and actually visible (the ad's and the console's
    // bodies carry the `hidden` attribute while minimized; their buttons are still in the DOM).
    const usable = el => !!el && !el.disabled && el.checkVisibility({ checkVisibilityCSS: true, visibilityProperty: true });

    // The title text is the only identity a v1.21 dialog has (game.jsx:592, 645, 1400, 1411, 2547-2552, 2751).
    const dialogId = title => {
      const t = String(title || '');
      if (t.indexOf('\u{1F9E8}') === 0) return 'evt:competitor';            // 🧨 Competitor Panic
      if (t.indexOf('\u{1F510}') === 0) return 'evt:security';              // 🔐 Security Incident
      if (t.indexOf('\u{1F454}') === 0) return /chatgdp/i.test(t) ? 'ck:warning' : 'ck:lesson';   // 👔
      if (t === 'How It Works') return 'help';
      if (t.indexOf('President') === 0) return 'end:club';
      if (t.indexOf('Ascension') === 0) return 'end:ascension';
      if (t.indexOf('Meltdown') === 0) return 'end:meltdown';
      if (t.indexOf('Barely Missed') === 0) return 'end:missed';
      if (t.indexOf('Jacket Repo') === 0) return 'end:repo';
      if (t.indexOf('Terminated') === 0) return 'end:fired';
      return 'unknown:' + t;
    };

    // The single source of truth for "what can be pressed right now": canonical move id -> element.
    // observe() reports its keys, act() clicks its values, so the two can never disagree.
    function controls() {
      const map = new Map();
      const add = (move, el) => { if (usable(el)) map.set(move, el); };

      // The boot overlay makes the page inert (shell.js:68-83). Nothing is legal until the harness dismisses it.
      if (document.getElementById('boot')) return { dialog: { id: 'boot', options: 0 }, map };

      // A modal <dialog> makes the rest of the page inert for a player, but a programmatic click() would still
      // land on the buttons behind it. So: while a dialog is open, its footer buttons are the ONLY legal moves.
      const open = qa('dialog[open]');
      if (open.length) {
        const d = open[open.length - 1];
        const head = q('.d-header', d);
        const id = open.map(x => dialogId((q('.d-header', x) || {}).textContent)).join('+');
        const btns = qa('.d-footer .btn', d).filter(usable);
        if (dialogId(head && head.textContent).indexOf('end:') === 0) {
          if (btns[0]) map.set('newrun', btns[0]);                           // the ending's "New Run" (game.jsx:2797)
        } else {
          btns.forEach((b, i) => map.set('dlg:' + i, b));                    // event options, or "Got it"
        }
        return { dialog: { id, options: btns.length }, map };
      }

      const acts = qa('.actions .btn');
      if (acts.length !== ACTIONS.length) throw new Error('v121 driver: expected ' + ACTIONS.length + ' action buttons, found ' + acts.length);
      acts.forEach((b, i) => add('act:' + ACTIONS[i], b));
      add('hail', q('.footer .btn.ghost'));                                  // game.jsx:2702
      add('end', q('.footer .btn.primary'));                                 // game.jsx:2709
      add('newgame', q('#new-game'));
      add('save', q('#save'));
      add('load', q('#load'));
      add('ui:rules', q('#root .grid .pill-btn'));                           // game.jsx:2668, opens the "help" dialog

      const ad = q('.claink-ad');                                            // game.jsx:1871-1915
      if (ad) {
        add('ck:cta', q('.claink-cta', ad));                                 // step 0: "Activate seat" (opens the policy)
        add('ck:accept', q('.claink-confirm', ad));                          // step 1: "Accept" (buys the seat)
        add('ck:notnow', q('.claink-notnow', ad));                           // step 1: back to step 0
        add('ck:dismiss', q('.claink-ad-close', ad));                        // x: clAInk is off for this run
        const t = q('.claink-ad-min', ad);
        if (t) add(t.getAttribute('aria-expanded') === 'true' ? 'ck:ad-min' : 'ck:ad-expand', t);
      }
      const con = q('.claink-console');                                      // game.jsx:2178-2234
      if (con) {
        add('ck:run', q('.claink-deploy', con));
        add('ck:cancel', q('.claink-cancel-link', con));                     // opens the cancel confirmation
        add('ck:cancel-confirm', q('.claink-cancel-confirm', con));          // pays the fee
        add('ck:keep', q('.claink-cancel-keep', con));                       // closes the confirmation
        add('ck:hide', q('.claink-end-close', con));                         // x on a cancelled / revoked card
        const t = q('.claink-min', con);
        if (t) add(t.getAttribute('aria-expanded') === 'true' ? 'ck:minimize' : 'ck:expand', t);
      }
      return { dialog: null, map };
    }

    let soundHooked = false;

    return {
      mounted() { return !!q('#root .grid'); },
      bootOpen() { return !!document.getElementById('boot'); },
      // "Clock in" starts the boot animation, the same button (now "Skip") ends it (shell.js:110, 129).
      bootDismiss() { const b = q('#boot .boot-btn'); if (b) b.click(); },

      observe() { const c = controls(); return { dialog: c.dialog, legal: Array.from(c.map.keys()) }; },
      // el.click() makes a click with detail === 0, which the game treats as a keyboard activation: it skips
      // the double-click shield (game.jsx:1790-1791), so the next move is never swallowed.
      act(move) {
        const el = controls().map.get(move);
        if (!el) throw new Error('v121 driver: move "' + move + '" is not available');
        el.click();
      },

      readState() { const raw = localStorage.getItem(AUTOSAVE); return raw ? JSON.parse(raw) : null; },
      // where: "manual" is what the Load button prefers (game.jsx:54-65); "autosave" is what a page load resumes.
      writeSave(where, json) { localStorage.setItem(where === 'manual' ? SAVE : AUTOSAVE, json); },

      // clAInk's joke stream decides token counts, which are saved. The game reads the property on every call
      // (game.jsx:1086), so replacing it after mount takes effect at once.
      pinFlavor(fn) {
        if (!window.TST_CLAINK || typeof window.TST_CLAINK.flavor !== 'function') throw new Error('v121 driver: window.TST_CLAINK.flavor is missing');
        window.TST_CLAINK.flavor = fn;
      },

      audioState() { const T = window.TST_AUDIO; return T ? { on: !!T.settings.on, voice: !!T.settings.voice, unlocked: !!T.unlocked } : null; },

      /*
       * Sound intents (audio.js). play() and say() are closures inside the engine and most calls are internal
       * (the log director, the announcer's chime, the heartbeat), so wrapping TST_AUDIO.play would miss them.
       * Two things are reachable from outside:
       *   - the preset table P (TST_AUDIO.presets) and the line bank LINES (TST_AUDIO.LINES). play() reads
       *     P[name] right after its "sound on and unlocked" check (audio.js:235-236) and say() reads LINES[key]
       *     right after its own (audio.js:421-426), so an accessor on every entry sees every attempt, with the
       *     final key (firedOrg, burnoutCaffeine, repoClaink are resolved before the read);
       *   - A.onPlay (audio.js:256), called once a sound has survived the three-voice limit.
       * An accepted say() plays the "pa" chime immediately after choosing its line (audio.js:433) and nothing
       * else ever plays "pa", so "pa attempted right after a line was chosen" is "the announcer took the line".
       */
      soundInstall(sink) {
        if (soundHooked) return;
        const T = window.TST_AUDIO;
        if (!T || !T._A || !T.presets || !T.LINES) throw new Error('v121 driver: window.TST_AUDIO hooks are missing');
        let awaitingPa = null;
        Object.keys(T.presets).forEach(name => {
          const preset = T.presets[name];
          Object.defineProperty(T.presets, name, { enumerable: true, configurable: true, get() {
            if (name === 'pa' && awaitingPa !== null) sink.sayAccepted(awaitingPa);
            awaitingPa = null;
            sink.playAttempt(name);
            return preset;
          } });
        });
        Object.keys(T.LINES).forEach(key => {
          const bank = T.LINES[key];
          Object.defineProperty(T.LINES, key, { enumerable: true, configurable: true, get() { awaitingPa = key; sink.sayAttempt(key); return bank; } });
        });
        T._A.onPlay = name => sink.played(name);
        soundHooked = true;
      }
    };
  }
};
