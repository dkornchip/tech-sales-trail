// What the engine tests share. They import the rules straight from src/game and drive them through the front door
// (src/game/run.js), the way the interface does.
//
// The dice: a run rolls its own seeded stream. To force a branch, a test scripts the mechanical rolls with
// script([..values], fallback): the values are handed out in order, then `fallback` (a number, or a function).
// That hook (globalThis.__TST_RNG) exists in Node and in test builds only; a release has none.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEngine, start, legalMoves, play, viewOf, isOver, dialogOf, endingOf, playRun, mulberry, fnv } from "../../sim/lib/harness.mjs";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
export { start, legalMoves, play, viewOf, isOver, dialogOf, endingOf, playRun, mulberry, fnv };

let engine = null;
export const E = async () => (engine || (engine = await loadEngine(ROOT, "working tree")));

export const HI = 0.99, LO = 0;
// Scripts the mechanical rolls. Returns { used(): how many were drawn, left(): scripted values not yet drawn }.
export function script(values = [], fallback = HI) {
  const queue = values.slice(); let n = 0;
  globalThis.__TST_RNG = () => { n++; if (queue.length) return queue.shift(); return typeof fallback === "function" ? fallback() : fallback; };
  return { used: () => n, left: () => queue.length };
}
// Back to the run's own stream.
export const unscript = () => { delete globalThis.__TST_RNG; };
// Runs fn with scripted rolls, and always restores the run's own stream.
export const withDice = (values, fallback, fn) => { const s = script(values, fallback); try { return fn(s); } finally { unscript(); } };

// A state with ids, clock times and the run id taken out: what "the same run" means.
// (keys are put in order, so two objects with the same fields compare equal however they were built)
const DROP = new Set(["id", "t", "runId"]);
const ordered = v => (Array.isArray(v) ? v.map(ordered) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).filter(k => !DROP.has(k) && v[k] !== undefined).sort().map(k => [k, ordered(v[k])])) : v);
export const normal = state => ordered(JSON.parse(JSON.stringify(state)));
export const digest = state => JSON.stringify(normal(state));
export const same = (a, b) => digest(a) === digest(b);

// A crafted run: a new game with fields laid over it. deals are given as [stage, value, mood?, age?].
let dealSeq = 0;
export const deal = (stage, value, mood = "neutral", age = 0, account) => ({ id: "t" + (++dealSeq), account: account || "Acct " + dealSeq, value, stage, mood, probNote: "", age });
export async function craft(over = {}, seed = 1) {
  const eng = await E();
  const base = start(eng, seed).s;
  const s = { ...base, ...over };
  if (over.deals) { s.deals = over.deals.map(d => (Array.isArray(d) ? deal(...d) : d)); s.pipeline = s.deals.reduce((t, d) => t + d.value, 0); }
  if (over.skills) s.skills = { ...base.skills, ...over.skills };
  if (over.used) s.used = { ...base.used, ...over.used };
  if (over.claink) s.claink = { ...base.claink, ...over.claink };
  return s;
}
// One move on a bare state (no dialog bookkeeping): returns what step() returns.
export async function move(s, m) { const eng = await E(); return eng.run.step(s, m); }
export const act = id => ({ t: "act", id });
export const END = { t: "end" }, HAIL = { t: "hail" };
export const tags = (before, after) => { const top = before.logs.length ? before.logs[0].id : null, out = []; for (const e of after.logs) { if (e.id === top) break; out.push(e.tag); } return out.reverse(); };

// The log lines a move wrote, oldest first, as {tag, kind, d (the line's params, with d.fx the real meter changes), msg, dl}.
export const lines = (before, after) => { const top = before.logs.length ? before.logs[0].id : null, out = []; for (const e of after.logs) { if (e.id === top) break; out.push({ tag: e.tag, kind: e.kind, d: e.d || {}, msg: e.msg, dl: e.dl || "" }); } return out.reverse(); };
// A state nobody may change: step() must build a new one. (Modules are strict, so a write to this throws.)
export const frozen = v => { if (v && typeof v === "object" && !Object.isFrozen(v)) { Object.freeze(v); for (const k of Object.keys(v)) frozen(v[k]); } return v; };

// The mechanical part of a state: everything the rules decided, with the words taken out. Rewording a line must not
// change it. The log is reduced to its tags (what happened, in order); clAInk's report and strike cards to their
// shape; deal notes and achievement labels are dropped.
export function mechanical(state) {
  const s = normal(state);
  s.logs = (s.logs || []).map(e => e.tag + (e.kind === "bad" ? "!" : ""));
  s.deals = (s.deals || []).map(({ probNote, ...d }) => d);
  s.achievements = (s.achievements || []).map(a => (a && a.key) || a);
  if (s.claink) {
    const c = { ...s.claink };
    if (c.last) { const { clear, farewell, ping, announce, lines, strike, ...L } = c.last; c.last = { ...L, lines: Array.isArray(lines) ? lines.length : 0, strike: strike ? { n: strike.n, hurt: !!strike.hurt } : null, farewell: !!farewell, ping: !!ping }; }
    c.strikeLog = (c.strikeLog || []).map(e => e.n);
    s.claink = c;
  }
  delete s.said;                                   // which wording a line used last: copy, not rules
  return s;
}
