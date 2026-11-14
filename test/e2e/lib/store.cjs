// Where the game keeps a run, for the browser tests.
// v2.1 writes an envelope { schemaVersion, state, pendingEvents, rngState } under its own keys; earlier versions
// wrote the bare run under theirs, and those keys are still read (which is how a test hands the page a crafted run).
"use strict";
const KEYS = { autosave: "tst-autosave-v5", save: "tst-save-v5", legacyAutosave: "tst-autosave-v4-3", legacySave: "tst-save-v4-3", legacyPending: "tst-pending-v2", setAside: "tst-set-aside-v5" };
// Runs in the page: the run the page last autosaved (envelope unwrapped), or the legacy autosave, or null.
const readRun = () => {
  const unwrap = raw => { const e = JSON.parse(raw); return e && e.schemaVersion ? Object.assign({}, e.state, { pending: e.pendingEvents, rng: e.rngState }) : e; };
  try {
    const now = window.localStorage.getItem("tst-autosave-v5");
    if (now) return unwrap(now);
    const old = window.localStorage.getItem("tst-autosave-v4-3");
    return old ? JSON.parse(old) : null;
  } catch (e) { return null; }
};
// A run as v2.1 would store it (for a test that wants to hand the page a v2.1 save).
const envelope = state => { const { pending, rng, ...run } = state; return JSON.stringify({ app: "tech-sales-trail", schemaVersion: 5, build: "test", savedAt: "2026-01-05T09:00:00.000Z", state: run, pendingEvents: pending || [], rngState: rng }); };
module.exports = { KEYS, readRun, envelope };
