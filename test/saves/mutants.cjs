'use strict';
/*
 * Save mutants: small, deliberate breakages in how the baseline LOADS a save. `node test/saves/run.cjs --selftest`
 * plays the real baseline against each one and requires the save test to notice. Same mechanism as the parity
 * mutants (test/parity/lib/mutants.cjs): a text patch on the baseline's babel block at route time, which throws
 * unless its target occurs exactly once, so a mutant can never quietly become a no-op.
 *
 *   caughtBy   the fixtures the selftest runs the mutant against (it must fail on at least one of them)
 */
const MUTANTS = [
  { name: 'load-prefers-autosave', what: 'the Load button reads the autosave before the manual save',
    caughtBy: ['ck-revoked-card'],
    apply: (s, { replaceOnce: once }) => once(s, 'const v=readStoredRun(false);', 'const v=readStoredRun(true);') },

  { name: 'legacy-keys-ignored', what: 'the v4-2 storage keys are no longer read',
    caughtBy: ['legacy-v42-keys-only'],
    apply: (s, { replaceOnce: once }) => once(s, 'const LEGACY_KEYS = ["tst-save-v4-2", "tst-autosave-v4-2"];', 'const LEGACY_KEYS = [];') },

  { name: 'legacy-keys-swapped', what: 'the v4-2 autosave is preferred over the v4-2 manual save',
    caughtBy: ['legacy-v42-keys-only'],
    apply: (s, { replaceOnce: once }) => once(s, 'const LEGACY_KEYS = ["tst-save-v4-2", "tst-autosave-v4-2"];', 'const LEGACY_KEYS = ["tst-autosave-v4-2", "tst-save-v4-2"];') },

  { name: 'quota-kept', what: 'an old save keeps its own quota instead of the current one',
    caughtBy: ['legacy-v42-keys-only'],
    apply: (s, { replaceOnce: once }) => once(s, 'quota: base.quota, // force current difficulty', '') },

  { name: 'claink-not-sanitised', what: 'the clAInk part of a save is taken as it is',
    caughtBy: ['legacy-claink-string', 'legacy-missing-optional-fields'],
    apply: (s, { replaceOnce: once }) => once(s, 'claink:sanitizeClaink(parsed.claink,parsed.week),', 'claink:parsed.claink||base.claink,') },

  { name: 'rugged-not-revoked', what: 'v1.19\'s "rugged" seat is read as cancelled, not revoked',
    caughtBy: ['legacy-v119-rugged'],
    apply: (s, { replaceOnce: once }) => once(s, 'raw.status==="rugged" ? "revoked" : null', 'raw.status==="rugged" ? "cancelled" : null') },

  { name: 'prototype-not-mapped', what: 'the v1.16 prototype\'s {active, runs, ...} shape is read as a fresh ad',
    caughtBy: ['legacy-v116-claink-prototype'],
    apply: (s, { replaceOnce: once }) => once(s, 'status=raw.active===true ? "active" : history ? "cancelled" : "ad";', 'status="ad";') },

  { name: 'stale-ad-kept', what: 'an ad saved before the week-3 deadline existed stays up past it',
    caughtBy: ['legacy-ad-past-week-3'],
    apply: (s, { replaceOnce: once }) => once(s, 'if(status==="ad" && pastOffer) status="expired";', '') },

  { name: 'card-not-hidden', what: 'a closed end card comes back after a load',
    caughtBy: ['ck-revoked-hidden'],
    apply: (s, { replaceOnce: once }) => once(s, 'hidden:ended && !!raw.hidden,', 'hidden:false,') },

  { name: 'legacy-cause-lost', what: 'a pre-v1.15 "org update" firing is no longer recognised from its log line',
    caughtBy: ['legacy-no-endcause-org'],
    apply: (s, { replaceOnce: once }) => once(s, 'lastBad.msg.indexOf("🪓")===0 ? "org"', 'lastBad.msg.indexOf("🪓")===0 ? "qbr"') },

  { name: 'ending-unrecognisable', what: 'a firing opens a dialog that is not the "fired" ending',
    caughtBy: ['end-org'],
    apply: (s, { replaceOnce: once }) => once(s, '"Terminated 💼";', '"Let go 💼";') },

  { name: 'report-not-drawn', what: 'a loaded seat does not show its last run report (the state is right, the screen is not)',
    caughtBy: ['ck-report-miracle'],
    apply: (s, { replaceOnce: once }) => once(s, '{L && c.status!=="cancelled" && (isRun || L.kind==="onboarded") && <ClainkReport', '{false && <ClainkReport') },

  { name: 'error-on-load', what: 'loading a save logs a console error',
    caughtBy: ['fresh'],
    apply: (s, { replaceOnce: once }) => once(s, 'const mergeSaved=(parsed)=>{', 'const mergeSaved=(parsed)=>{ console.error("merge: unexpected shape");') }
];

module.exports = { MUTANTS };
