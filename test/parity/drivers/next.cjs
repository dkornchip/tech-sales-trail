'use strict';
/*
 * Driver for the v2.0 markup (src/ui/app): the build under test once the new interface is switched on.
 *
 * The contract every driver implements is written down in drivers/interface.cjs. This one finds controls by the
 * data attributes the interface carries for exactly this purpose:
 *   [data-act="<id>"]                 the twelve actions            aria-disabled="true" = cannot be pressed
 *   [data-ui="end"|"hail"|"rules"]    End week, Hail Mary, the rules
 *   [data-ui="settings"]              opens the settings menu, which holds [data-ui="save"|"load"|"newgame"]
 *   dialog[data-dialog="<id>"]        the canonical dialog id (help, evt:*, ck:*, end:*)
 * clAInk's controls keep their .claink-* classes.
 */
const TRIPS = ['Japan', 'Whistler', 'Cancun', 'Thailand', 'Dubai'];   // game.jsx:381, the order is the draw table

module.exports = {
  name: 'next',
  autosaveKey: 'tst-autosave-v5',      // the key whose text changes when the run is saved (lib/inpage.cjs watches it)

  // Rules from lib/allowlist.cjs under which this build may offer FEWER moves than the baseline.
  benign: ['recharge-when-rested'],

  // Copy that is stored in a save and has to be reduced to a code before two builds can be compared.
  // Differences this build made on purpose that change what the BASELINE sounds like. In a --sound run the baseline
  // is served with these applied (and says so in its label), so that every other sound can still be compared, and
  // the floors that the adapted baseline can no longer meet are dropped.
  soundAdaptations: [
    { name: 'memo-cues-silenced',
      why: 'v2.0 moved the onboarding memo from the rules dialog to the first-day dialog, and its three cues (the welcome announcement, the sad horn, the stamp) went with it. test/e2e/firstday.cjs checks that they fire there.',
      floors: ['snd.say.welcome', 'snd.play.sadHorn', 'snd.play.stamp'],
      apply(babel, { replaceOnce }) {
        const noCues = replaceOnce(babel, 'const MEMO_SFX=[["sadHorn",300],["stamp",1650]];', 'const MEMO_SFX=[];');
        return replaceOnce(noCues, 'let welcomeSaid=false;', 'let welcomeSaid=true;');
      } }
  ],

  // Moves that sit in a menu: the keyboard test reaches them through `via` (focus it, press Enter, then Tab to the item).
  menu: { via: 'settings', moves: ['save', 'load', 'newgame'] },

  canon: {
    // Save, Load and New run moved into the settings menu, so reaching one costs a click the baseline never made
    // (opening the menu). That one click is taken out of the sound trace for those moves; nothing else is.
    rewrittenCaptions: false,  // v2.0.1: the scenes type v1.21's words again, so their typing ticks are compared too (lib/runner.cjs)
    // That menu click is a sound, and a sound spends cosmetic draws (its jitter): Save costs 6 cosmetic draws in
    // v1.21 and 8 here, New run 5 and 7. So after the first Save, Load, New run or injected state this build is two
    // draws ahead per menu move, and a SEEDED cosmetic stream rolls the filler line differently from then on. Plain
    // play spends exactly the baseline's draws (8,824 at the boot screen, then step for step). run.cjs leaves the
    // seeded sound pass out for this reason; the two pinned passes are unaffected.
    cosmeticDrift: 'the settings menu\'s extra click spends cosmetic draws the baseline never makes',
    sound(list, move) {
      if (!/^(newgame|save|load|inject:|\(load\))/.test(String(move))) return list;
      const i = list.indexOf('play:click');
      return i < 0 ? list : list.slice(0, i).concat(list.slice(i + 1));
    },
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
    // v2.1 stores a run as an envelope under its own keys (src/game/save.js). The harness reads the run out of it;
    // what it writes (a crafted or a fixture save) goes under the v2.0 keys, which the game still reads.
    const AUTOSAVE_NOW = 'tst-autosave-v5', AUTOSAVE = 'tst-autosave-v4-3', SAVE = 'tst-save-v4-3';
    // The harness plays as someone who has been here before: v2.0 gives a brand-new browser a first day (the
    // onboarding memo and a tour, src/ui/FirstRun.jsx), which the baseline does not have. test/e2e/firstday.cjs
    // covers that flow on its own. This runs before any of the page's scripts, on every load.
    try { window.localStorage.setItem('tst-onboarded-v2', '1'); } catch (_) {}
    const ACTIONS = ['prospect', 'cadence', 'discovery', 'demo', 'propose', 'close', 'network', 'conference', 'recharge', 'coffee', 'politics', 'crm'];
    const q = (sel, root) => (root || document).querySelector(sel);
    const qa = (sel, root) => Array.from((root || document).querySelectorAll(sel));
    // A control counts when a player could press it: enabled and actually visible (the ad's and the console's
    // bodies carry the `hidden` attribute while minimized; their buttons are still in the DOM).
    const usable = el => !!el && !el.disabled && el.getAttribute('aria-disabled') !== 'true' && el.checkVisibility({ checkVisibilityCSS: true, visibilityProperty: true });

    // A dialog says what it is: <dialog data-dialog="evt:competitor">.
    const dialogId = d => (d && d.getAttribute('data-dialog')) || 'unknown:' + String(((d && q('.d-header', d)) || {}).textContent || '');

    // New run, Save and Load live in the settings menu. A player reaches them in two presses; so does the driver.
    const MENU = { newgame: 'newgame', save: 'save', load: 'load' };
    const menuItem = name => ({
      click() {
        const press = () => { const item = q('[data-ui="' + name + '"]'); if (!item) throw new Error('next driver: the settings menu did not show "' + name + '"'); item.click(); };
        if (q('[data-ui="' + name + '"]')) return press();
        const b = q('[data-ui="settings"]'); if (!b) throw new Error('next driver: no settings button');
        b.click();
        // React renders the menu in a microtask it queued during that click; ours runs right after it.
        queueMicrotask(press);
      }
    });

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
        const id = open.map(x => dialogId(x)).join('+');
        const ending = dialogId(d).indexOf('end:') === 0;
        // an ending offers one move, New run; its Skip / Replay button only drives the cutscene
        const btns = qa(ending ? '.d-footer [data-ui="newrun"]' : '.d-footer .btn', d).filter(usable);
        if (ending) {
          if (btns[0]) map.set('newrun', btns[0]);
        } else {
          btns.forEach((b, i) => map.set('dlg:' + i, b));                    // event options, or "Got it"
        }
        return { dialog: { id, options: btns.length }, map };
      }

      const acts = qa('[data-act]');
      if (acts.length !== ACTIONS.length) throw new Error('next driver: expected ' + ACTIONS.length + ' action buttons, found ' + acts.length);
      acts.forEach(b => { const id = b.getAttribute('data-act'); if (ACTIONS.indexOf(id) < 0) throw new Error('next driver: unknown action "' + id + '"'); add('act:' + id, b); });
      add('hail', q('[data-ui="hail"]'));
      add('end', q('[data-ui="end"]'));
      add('ui:rules', q('[data-ui="rules"]'));
      if (usable(q('[data-ui="settings"]'))) for (const name of Object.keys(MENU)) map.set(name, menuItem(name));

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

    // The e2e surface (drivers/interface.cjs). Where a control IS, whatever state it is in: a disabled End Week
    // still has to be on the screen. Same selectors as controls() above, without the "could a player press it".
    function locate(move) {
      const m = /^act:(.+)$/.exec(move);
      if (m) return q('[data-act="' + m[1] + '"]');
      if (move === 'hail') return q('[data-ui="hail"]');
      if (move === 'end') return q('[data-ui="end"]');
      if (move === 'ui:rules') return q('[data-ui="rules"]');
      if (MENU[move]) return q('[data-ui="' + move + '"]') || q('[data-ui="settings"]');   // the item if the menu is open, else its button
      const open = qa('dialog[open]');
      const btns = open.length ? qa('.d-footer .btn', open[open.length - 1]) : [];
      if (move === 'newrun') return (open.length && q('.d-footer [data-ui="newrun"]', open[open.length - 1])) || null;
      const d = /^dlg:(\d+)$/.exec(move);
      if (d) return btns[Number(d[1])] || null;
      const c = controls().map.get(move);                                    // the clAInk controls
      return c && c.nodeType === 1 ? c : null;
    }

    return {
      el(move) { return locate(move); },
      // The canonical move id of the control that has keyboard focus, or null (focus is on <body>, or on something
      // that is not a move: the sound controls, the workspace's grip, an ending's cutscene buttons).
      focused() {
        const a = document.activeElement;
        if (!a || a === document.body) return null;
        if (a.closest && a.closest('#boot')) return 'boot';
        for (const [move, el] of controls().map) if (el === a) return move;
        for (const name of Object.keys(MENU)) if (a === q('[data-ui="' + name + '"]')) return name;
        if (a === q('[data-ui="settings"]')) return 'settings';     // the way to Save, Load and New run (see `menu` below)
        return null;
      },
      region(name) {
        if (name === 'log') return qa('#root .activity');
        if (name === 'deals') return qa('#root .deals');
        if (name === 'dialog') return qa('dialog[open]');
        if (name === 'boot') return qa('#boot');
        if (name === 'ascii') return qa('pre');                              // the cutscene and the boot screen
        if (name === 'dock') return qa('.claink-ad, .claink-console');
        throw new Error('next driver: unknown region "' + name + '"');
      },
      // clAInk's window (ClainkDock, game.jsx:1871-2234)
      dock() {
        const ad = q('.claink-ad'), con = q('.claink-console');
        if (ad) return ad.classList.contains('is-mini') ? 'ad-pill' : q('.claink-policy', ad) ? 'ad+policy' : 'ad';
        if (!con) return 'none';
        if (con.classList.contains('is-end')) return q('.claink-offboarded', con) ? 'card:cancelled' : 'card:revoked';
        if (con.classList.contains('is-mini')) return 'workspace-pill';
        return q('.claink-report', con) ? 'workspace+report' : 'workspace';
      },

      mounted() { return !!q('#root .main'); },
      bootOpen() { return !!document.getElementById('boot'); },
      // "Clock in" starts the boot animation, the same button (now "Skip") ends it (shell.js:110, 129).
      bootDismiss() { const b = q('#boot .boot-btn'); if (b) b.click(); },

      observe() { const c = controls(); return { dialog: c.dialog, legal: Array.from(c.map.keys()) }; },
      // el.click() makes a click with detail === 0, which the game treats as a keyboard activation: it skips
      // the double-click shield (game.jsx:1790-1791), so the next move is never swallowed.
      // v2.1 asks before four things that cannot be taken back (a new run mid-quarter, the first Hail Mary of a
      // run, a quad shot that is certain to end the run, dismissing clAInk's offer). For the harness a move is one
      // move of the rules, so the driver answers "yes" in the same press; the confirmations themselves are tested
      // with real presses in test/e2e/confirm.cjs. React renders the question in a microtask queued by the click;
      // ours run after it (New run takes one more hop: the menu item is itself pressed in a microtask).
      act(move) {
        const el = controls().map.get(move);
        if (!el) throw new Error('next driver: move "' + move + '" is not available');
        el.click();
        if (/^(hail|act:coffee|ck:dismiss|newgame)$/.test(move)) {
          let hops = 0;
          const yes = () => { const b = q('[data-ui="confirm-yes"]'); if (b) b.click(); else if (++hops < 4) queueMicrotask(yes); };
          queueMicrotask(yes);
        }
      },

      readState() {
        const now = localStorage.getItem(AUTOSAVE_NOW);
        if (now) { const e = JSON.parse(now); return Object.assign({}, e.state, { pending: e.pendingEvents, rng: e.rngState }); }
        const raw = localStorage.getItem(AUTOSAVE); return raw ? JSON.parse(raw) : null;
      },
      // where: "manual" is what the Load button prefers (game.jsx:54-65); "autosave" is what a page load resumes.
      writeSave(where, json) { localStorage.setItem(where === 'manual' ? SAVE : AUTOSAVE, json); },

      // clAInk's joke stream decides token counts, which are saved. The game reads the property on every call
      // (game.jsx:1086), so replacing it after mount takes effect at once.
      pinFlavor(fn) {
        if (!window.TST_CLAINK || typeof window.TST_CLAINK.flavor !== 'function') throw new Error('next driver: window.TST_CLAINK.flavor is missing');
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
        if (!T || !T._A || !T.presets || !T.LINES) throw new Error('next driver: window.TST_AUDIO hooks are missing');
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
