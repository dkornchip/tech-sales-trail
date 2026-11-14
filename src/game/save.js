// A stored run: what is written, and how whatever is found in storage is read back.
//
// What is written (v2.1 on) is an envelope:
//   { app, schemaVersion, build, savedAt, state, pendingEvents, rngState }
// state is the run; the choices it is waiting on (pendingEvents) and its dice (rngState) sit beside it, so that all
// three are written in one piece and read in one piece: there is no moment at which a run exists without the choice
// it was waiting on, or with dice from another moment. The manual save and the autosave are each one such envelope,
// under their own keys, and neither is ever written from the other.
//
// What is read can be an envelope, or a bare run from v2.0.1 or earlier (the legacy keys). Either way it goes
// through the same door: parse, check that it is a run at all, rebuild it field by field (state.js, mergeSaved),
// check the result. Reading never writes anything.
//
// This module does not touch storage. The interface's side of it is src/ui/storage.js.
import { EVENTS } from "./events.js";
import { isRunOver } from "./log.js";
import { isRun, mergeSaved } from "./state.js";

export const APP = "tech-sales-trail";
export const SCHEMA = 5;

// The text to store for a run. build: the version that wrote it (for a bug report, not for reading it back).
export const encodeRun = (state, build) => {
  const { pending, rng, ...run } = state;
  return JSON.stringify({ app: APP, schemaVersion: SCHEMA, build: String(build || ""), savedAt: new Date().toISOString(), state: run, pendingEvents: pending || [], rngState: rng });
};

// Before anything is rebuilt: is this even the shape of a run? (A week that is a number, deals and a log that are
// lists.) Something else is not migrated into a run of defaults; it is reported as damaged.
const looksLikeRun = r => !!r && typeof r === "object" && !Array.isArray(r) && typeof r.week === "number" && Number.isFinite(r.week) && r.week >= 1
  && Array.isArray(r.deals) && Array.isArray(r.logs) && ["energy", "stress", "cash"].every(k => typeof r[k] === "number" && Number.isFinite(r[k]));

// Reads one stored text. Returns
//   { status: "ok", state, legacy }     a run this version can play (legacy: it was stored by v2.0.1 or earlier)
//   { status: "newer", schemaVersion }  written by a later version: left alone, never guessed at
//   { status: "damaged", why }          not JSON, not a run, or not one after rebuilding
// held (optional): the End Week choice v2.0 kept beside its autosave, as parsed JSON. It is honoured only for a
// legacy run, only when it names that run and week and a choice the rules know, and only if the run is still going.
export function decodeRun(raw, held) {
  let parsed;
  try { parsed = JSON.parse(raw); } catch { return { status: "damaged", why: "unreadable" }; }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { status: "damaged", why: "notrun" };
  let stored, legacy = true;
  if ("schemaVersion" in parsed || "app" in parsed) {
    if (parsed.app !== APP || !Number.isInteger(parsed.schemaVersion)) return { status: "damaged", why: "notrun" };
    if (parsed.schemaVersion > SCHEMA) return { status: "newer", schemaVersion: parsed.schemaVersion };
    if (!parsed.state || typeof parsed.state !== "object") return { status: "damaged", why: "notrun" };
    stored = { ...parsed.state, pending: parsed.pendingEvents, rng: parsed.rngState };
    legacy = false;
  } else stored = parsed;
  if (!looksLikeRun(stored)) return { status: "damaged", why: "notrun" };
  let state;
  try { state = mergeSaved(stored); } catch { return { status: "damaged", why: "notrun" }; }
  if (!isRun(state)) return { status: "damaged", why: "notrun" };
  if (legacy && held && typeof held === "object" && !isRunOver(state) && !state.pending.length
    && typeof held.id === "string" && held.id.indexOf("evt:") === 0 && Object.prototype.hasOwnProperty.call(EVENTS, held.id)
    && held.runId === state.runId && held.week === state.week) state = { ...state, pending: [{ id: held.id }] };
  return { status: "ok", state, legacy };
}
