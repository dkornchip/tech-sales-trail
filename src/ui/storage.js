// The browser's storage, as the game uses it: two slots (the autosave and the manual save), read once and written
// whole. Rules of the house:
//   - a slot is written only with a v2.1 envelope, under a v2.1 key. Keys of earlier versions are read and never
//     written or removed;
//   - reading never writes. A run that cannot be opened stays exactly where it is until the player decides;
//   - before a run that could not be opened is replaced by a new one, it is copied to a key of its own;
//   - a browser that refuses storage is still a browser you can play in: every call here says whether it worked.
import { AUTOSAVE_KEY, LEGACY_AUTOSAVE_KEYS, LEGACY_PENDING_KEY, LEGACY_SAVE_KEYS, SAVE_KEY, SET_ASIDE_KEY } from "../game/constants.js";
import { decodeRun, encodeRun } from "../game/save.js";

const BUILD = typeof __BUILD_VERSION__ === "undefined" ? "dev" : __BUILD_VERSION__;
const get = key => { try { return window.localStorage.getItem(key); } catch { return null; } };
const set = (key, value) => { try { window.localStorage.setItem(key, value); return true; } catch { return false; } };
const held = () => { try { return JSON.parse(get(LEGACY_PENDING_KEY) || "null"); } catch { return null; } };

// Can this browser store anything at all? (Asked once, when the page opens.)
export const storageWorks = () => {
  try { const k = "tst-probe"; window.localStorage.setItem(k, "1"); window.localStorage.removeItem(k); return true; } catch { return false; }
};

const SLOTS = {
  autosave: [AUTOSAVE_KEY, ...LEGACY_AUTOSAVE_KEYS],
  save: [SAVE_KEY, ...LEGACY_SAVE_KEYS]
};
// Every stored run there is, in the order given: [{ key, slot, status, state?, legacy? }] (empty keys left out).
const found = order => {
  const out = [];
  for (const [slot, key] of order) {
    const raw = get(key);
    if (!raw) continue;
    out.push({ key, slot, ...decodeRun(raw, held()) });
  }
  return out;
};
const keysOf = (...slots) => slots.flatMap(slot => SLOTS[slot].map(key => [slot, key]));

// When the page opens: the autosave if there is one, else the manual save (newest version's key first).
// Returns { state, problem, others }:
//   state    the run to play, or null when there is none to resume, or when the first one found could not be opened
//   problem  null, or { key, slot, status } for that first one ("damaged" or "newer")
//   others   when there is a problem: the other stored runs that DO open, as [{ key, slot, state, legacy }]
export function readOnOpen() {
  const all = found([[ "autosave", AUTOSAVE_KEY ], ...LEGACY_AUTOSAVE_KEYS.slice(0, 1).map(k => ["autosave", k]), ...keysOf("save"), ...LEGACY_AUTOSAVE_KEYS.slice(1).map(k => ["autosave", k])]);
  if (!all.length) return { state: null, problem: null, others: [] };
  const first = all[0];
  if (first.status === "ok") return { state: first.state, problem: null, others: [] };
  return { state: null, problem: { key: first.key, slot: first.slot, status: first.status }, others: all.slice(1).filter(x => x.status === "ok") };
}

// The Load button: the manual save if there is one, else the autosave.
// Returns { status: "none" } | { status: "ok", state } | { status: "damaged" | "newer" }.
export function readForLoad() {
  const all = found([...keysOf("save"), ...keysOf("autosave")]);
  if (!all.length) return { status: "none" };
  return all[0].status === "ok" ? { status: "ok", state: all[0].state } : { status: all[0].status };
}

// Was anything ever stored here (by any version)? A browser with a run in it is not a new player's.
export const hasStoredRun = () => [...SLOTS.autosave, ...SLOTS.save].some(k => !!get(k));

export const writeAutosave = state => set(AUTOSAVE_KEY, encodeRun(state, BUILD));
export const writeSave = state => set(SAVE_KEY, encodeRun(state, BUILD));

// A stored run that could not be opened is about to be replaced (the player chose a new run, or another save):
// keep what was there. Only v2.1's own keys are ever replaced, so only those need it.
export const setAside = problem => {
  if (!problem || (problem.key !== AUTOSAVE_KEY && problem.key !== SAVE_KEY)) return;
  const raw = get(problem.key);
  if (raw) set(SET_ASIDE_KEY, raw);
};
