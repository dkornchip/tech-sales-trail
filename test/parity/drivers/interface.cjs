'use strict';
/*
 * THE DRIVER INTERFACE
 * ====================
 * A driver is everything the harness knows about one build's DOM and debug hooks. The runner, the policies, the
 * census and the normaliser never touch a selector; they speak in canonical move ids and canonical dialog ids.
 * To compare a build with new markup, add drivers/<name>.cjs with the surface below and pass --b-driver <name>.
 *
 * A driver module exports:
 *
 *   name      string. The file name without ".cjs".
 *
 *   benign    string[]. Names of rules in lib/allowlist.cjs (BENIGN_RULES) under which this build may offer fewer
 *             moves than the baseline. Empty unless a rule was reviewed and written down there.
 *
 *   canon     { probNote(text) -> code, trip(text) -> index|null }
 *             Pure Node functions that reduce copy stored in a save to a code, so two builds with different
 *             wording compare equal when they mean the same thing.
 *               probNote codes: 'empty' | 'peanut' | 'big' | 'whale' | 'roll:<x>:<y>' | 'ai' | 'discount'
 *                               (anything else must come back as 'unknown:<text>' so it fails loudly)
 *               trip: position in the TRIPS draw table (Japan 0, Whistler 1, Cancun 2, Thailand 3, Dubai 4),
 *                     null when there is no trip
 *
 *   inPage    function () -> object. Serialised with toString() and run inside the page before the game's own
 *             scripts, so it must be self-contained (no references to anything outside its own body). What it
 *             returns is kept as window.__drv and must have:
 *
 *     mounted()            -> boolean. The game has rendered.
 *     bootOpen()           -> boolean. The boot overlay is up (it makes the page inert).
 *     bootDismiss()        Press whatever a player presses to get past the boot overlay. Called repeatedly, with
 *                          fake time advanced in between, until bootOpen() is false. Both builds must end up in
 *                          the same place: boot dismissed, sound unlocked.
 *
 *     observe()            -> { dialog, legal }
 *        dialog  null, or { id, options } for the modal dialog a player is looking at.
 *                id is canonical:
 *                  'evt:competitor' | 'evt:security'      the two choice events (2 options each)
 *                  'ck:warning' | 'ck:lesson'             the clAInk manager warning / "Writing Lesson" (1 option)
 *                  'end:club' | 'end:missed' | 'end:fired' | 'end:meltdown' | 'end:ascension' | 'end:repo'
 *                  'help'                                 the Rules dialog (1 option)
 *                  'boot'                                 the boot overlay, if it is somehow still up
 *                options is the number of buttons the dialog offers.
 *                v1.21 derives the id from the title text; a newer build should read a data-dialog attribute.
 *        legal   string[] of canonical move ids a PLAYER could make right now, in any order:
 *                  act:prospect act:cadence act:discovery act:demo act:propose act:close act:network
 *                  act:conference act:recharge act:coffee act:politics act:crm     the twelve actions
 *                  hail                 Hail-Mary
 *                  end                  End Week
 *                  dlg:0 dlg:1          the open dialog's buttons, in order (event options, "Noted", "Got it")
 *                  newrun               the ending dialog's "New Run"
 *                  newgame save load    the header buttons
 *                  ck:cta               ad: "Activate seat" (opens the AI use policy; buys nothing)
 *                  ck:accept            ad: "Accept" (buys the seat)
 *                  ck:notnow            ad: "Not now" (closes the policy)
 *                  ck:dismiss           ad: x (clAInk is off for this run)
 *                  ck:ad-min ck:ad-expand    ad: minimize to a pill / expand again
 *                  ck:run               workspace: "Run agents"
 *                  ck:cancel            workspace: "Cancel seat" (opens the confirmation; cancels nothing)
 *                  ck:cancel-confirm    workspace: "Pay $x & cancel"
 *                  ck:keep              workspace: "Keep agents" (closes the confirmation)
 *                  ck:minimize ck:expand     workspace: minimize to a pill / expand again
 *                  ck:hide              x on the cancelled / revoked card
 *                  ui:rules             opens the Rules dialog
 *                Rules a driver must follow:
 *                  - A move is legal only if its control is enabled AND a player could reach it: not inside a
 *                    hidden or collapsed container, not behind a modal.
 *                  - While a modal dialog is open, its own buttons are the ONLY legal moves. (showModal() makes
 *                    the rest of the page inert for people, but a programmatic click still lands there.)
 *                  - Do not list 'reload': the harness adds it itself (it is not a DOM control), and only when
 *                    no dialog is open or the open dialog is an ending. v1.21 keeps a pending event only in React
 *                    state and loses it on reload; a newer build fixes that on purpose, so reloading under an
 *                    event dialog is deliberately never tested here.
 *                  - observe() and act() must share one lookup, so a move that is listed can always be made.
 *
 *     act(move)            Make the move with an in-page el.click() (a synthetic click has detail === 0, which
 *                          bypasses the game's double-click shield). Throw if the move is not legal right now.
 *
 *     readState()          -> the parsed autosave (localStorage "tst-autosave-v4-3"), or null. The harness calls
 *                          it only after the step has settled.
 *     writeSave(where, json)   Store a crafted save: where is 'manual' (what the Load button reads) or
 *                          'autosave' (what a page load resumes).
 *
 *     pinFlavor(fn)        Make fn the source of clAInk's joke stream (window.TST_CLAINK.flavor in v1.21). The
 *                          token counts in a save derive from it, so both builds get () => 0.5. A build must
 *                          read the hook at call time; the selftest proves that the baseline does.
 *
 *     audioState()         -> { on, voice, unlocked }, for the sound trace's "is anything being decided at all".
 *     soundInstall(sink)   Report sound intents to the sink, at these four moments and no others:
 *                            sink.playAttempt(name)   the game asked for preset `name` while sound is on and
 *                                                     unlocked (before any voice limiting)
 *                            sink.played(name)        that request was actually started
 *                            sink.sayAttempt(key)     the game asked the announcer for line bank `key`
 *                                                     (after meta remaps such as fired -> firedOrg)
 *                            sink.sayAccepted(key)    the announcer took it (not on cooldown, not busy)
 *                          `name` and `key` are the v1.21 identifiers (TST_AUDIO.presets / TST_AUDIO.LINES keys).
 *
 * The four functions the rest of the harness is written against are the Node-side wrappers below:
 *   legalMoves(page), doMove(page, move), readState(page), dialog(page).
 * The runner itself batches them into one round trip per step (window.__parity.step in lib/inpage.cjs), but it
 * goes through exactly the same window.__drv.observe / act / readState.
 */
const path = require('path');

const IN_PAGE = ['mounted', 'bootOpen', 'bootDismiss', 'observe', 'act', 'readState', 'writeSave', 'pinFlavor', 'audioState', 'soundInstall'];

function loadDriver(name) {
  if (!/^[a-z0-9_-]+$/i.test(name)) throw new Error(`driver: bad name ${JSON.stringify(name)}`);
  const d = require(path.join(__dirname, name + '.cjs'));
  if (d.name !== name) throw new Error(`driver ${name}: exports name ${JSON.stringify(d.name)}`);
  if (!Array.isArray(d.benign)) throw new Error(`driver ${name}: benign must be an array`);
  if (!d.canon || typeof d.canon.probNote !== 'function' || typeof d.canon.trip !== 'function') throw new Error(`driver ${name}: canon.probNote and canon.trip are required`);
  if (typeof d.inPage !== 'function') throw new Error(`driver ${name}: inPage must be a function`);
  const src = d.inPage.toString();
  for (const fn of IN_PAGE) if (!new RegExp('\\b' + fn + '\\s*\\(').test(src)) throw new Error(`driver ${name}: inPage() does not define ${fn}()`);
  return d;
}

// 'reload' is legal when nothing modal is open, or when the open dialog is an ending (an ending survives a reload
// in every build). It is never legal under an event dialog; see the note in the interface above.
const reloadAllowed = dialog => !dialog || /^end:/.test(dialog.id);
const withReload = (legal, dialog) => (reloadAllowed(dialog) ? legal.concat('reload').sort() : legal.slice().sort());

async function legalMoves(page) {
  const o = await page.evaluate(() => window.__drv.observe());
  return withReload(o.legal, o.dialog);
}
async function dialog(page) { return (await page.evaluate(() => window.__drv.observe())).dialog; }
async function readState(page) { return page.evaluate(() => window.__drv.readState()); }
async function doMove(page, move) { await page.evaluate(m => window.__drv.act(m), move); }

module.exports = { loadDriver, legalMoves, dialog, readState, doMove, reloadAllowed, withReload, IN_PAGE };
