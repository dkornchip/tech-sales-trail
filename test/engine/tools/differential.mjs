#!/usr/bin/env node
// Checkpoint proof, in Node: the engine as it was (a pristine copy of an earlier src/) against the engine as it is,
// on the same dice, move for move.
//
//   node test/engine/tools/differential.mjs --old <dir with src/ and package.json> [--seeds 400] [--from 1] [--moves 400]
//
// The old engine rolls Math.random; this script replaces it with a seeded stream while the old engine runs. The new
// engine rolls through src/game/rng.js; the same seeded stream is handed to it as globalThis.__TST_RNG. clAInk's
// flavor stream is pinned the same way on both sides. After every move the two states must be equal field for
// field (ids, clock times, the run id and the new `rng` key aside), the same dialogs must have been raised, and
// both sides must have drawn the same number of rolls.
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL, fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const args = process.argv.slice(2);
const take = (flag, dflt) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : dflt; };
const oldDir = take("--old", null), newDir = take("--new", ROOT);
const SEEDS = Number(take("--seeds", 400)), FROM = Number(take("--from", 1)), MOVES = Number(take("--moves", 400));
if (!oldDir) { console.error("usage: differential.mjs --old <dir> [--new <dir>] [--seeds n] [--from n] [--moves n]"); process.exit(2); }
const { choose, POLICY_NAMES } = require(path.join(ROOT, "test/parity/lib/policies.cjs"));

const mulberry = seed => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const fnv = text => { let h = 2166136261; for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const load = async (dir, rel) => import(pathToFileURL(path.join(dir, "src", rel)).href);

async function engine(dir) {
  const [actions, claink, events, week, stress, state, selectors, rules, log, list] = await Promise.all(
    ["game/actions.js", "game/claink.js", "game/events.js", "game/week.js", "game/stress.js", "game/state.js", "game/selectors.js", "game/rules.js", "game/log.js", "ui/app/actionList.js"].map(f => load(dir, f)));
  let run = null;
  try { run = await load(dir, "game/run.js"); } catch { /* the old engine has no front door */ }
  return { actions, claink, events, week, stress, state, selectors, rules, log, list, run };
}

// What a player could press, in the harness's own move ids (the ids test/parity's policies speak).
function legal(E, s, dialog) {
  if (dialog) return E.events.EVENTS[dialog.id].options.map((_, i) => "dlg:" + i);
  if (E.log.isRunOver(s)) return [];
  const out = [];
  for (const a of E.list.ACTIONS) {
    const used = a.id === "crm" ? !!(s.used && s.used.crm) : a.id === "recharge" ? !!s.restedThisWeek : false;
    if (!E.selectors.blocked(s, { energy: a.energy, slots: a.slots || 1, used })) out.push("act:" + a.id);
  }
  const late = E.selectors.lateDeals(s).length;
  if (!E.selectors.blocked(s, { energy: E.list.HAIL.energy, slots: 1 }) && late) out.push("hail");
  out.push("end");
  const C = E.claink;
  if (C.clainkCanInstall(s)) out.push("ck:accept");
  if (s.claink && s.claink.status === "ad" && E.selectors.weekOf(s) <= C.CLAINK.OFFER_LAST_WEEK) out.push("ck:dismiss");
  if (C.clainkCanDeploy(s)) out.push("ck:run");
  if (C.clainkCanCancel(s)) out.push("ck:cancel-confirm");
  if (s.claink && (s.claink.status === "cancelled" || s.claink.status === "revoked") && !s.claink.hidden) out.push("ck:hide");
  return out;
}

// One move in the old engine, glued the way src/ui/Game.jsx and src/ui/ClainkUi.jsx glued it in v2.0.1.
function stepOld(E, s, move, dialog) {
  const cb = E.stress.checkBurnout;
  if (move.indexOf("act:") === 0) { const a = E.list.ACTIONS.find(x => x.id === move.slice(4)); const ns = a.run(s); return { state: ns ? cb(ns) : s, events: [] }; }
  if (move === "hail") { const ns = E.actions.hailMary(s); return { state: ns || s, events: [] }; }
  if (move === "end") { const events = []; const r = E.week.endWeek(s, e => events.push(e)); return r ? { state: r.state, over: !!r.over, events: r.over ? [] : events } : { state: s, events: [] }; }
  if (move.indexOf("dlg:") === 0) { const opt = E.events.EVENTS[dialog.id].options[Number(move.slice(4))]; return { state: cb(opt.apply(s)), events: [] }; }
  const C = E.claink;
  if (move === "ck:run") { const r = C.deployClaink(s); return { state: cb(r.state), events: r.event ? [r.event] : [] }; }
  const fn = { "ck:accept": C.buyClaink, "ck:dismiss": C.dismissClaink, "ck:cancel-confirm": C.cancelClaink, "ck:hide": C.hideClainkCard }[move];
  return { state: cb(fn(s)), events: [] };
}
// The same move through the new engine's front door.
function stepNew(E, s, move, dialog) {
  const m = move.indexOf("act:") === 0 ? { t: "act", id: move.slice(4) } : move === "hail" ? { t: "hail" } : move === "end" ? { t: "end" }
    : move.indexOf("dlg:") === 0 ? { t: "choose", event: dialog.id, option: E.events.EVENTS[dialog.id].options[Number(move.slice(4))].id }
    : { t: "ck", op: { "ck:run": "deploy", "ck:accept": "buy", "ck:dismiss": "dismiss", "ck:cancel-confirm": "cancel", "ck:hide": "hide" }[move] };
  return E.run.step(s, m);
}

const norm = s => JSON.stringify(s, (k, v) => (k === "rng" || k === "runId" || k === "id" || k === "t" ? undefined : v));
const firstDiff = (a, b, at = "") => {
  if (a === b) return null;
  if (a && b && typeof a === "object" && typeof b === "object") {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (k === "rng" || k === "runId" || k === "id" || k === "t") continue;
      const d = firstDiff(a[k], b[k], at ? at + "." + k : k); if (d) return d;
    }
    return null;
  }
  return `${at}: old ${JSON.stringify(a)} new ${JSON.stringify(b)}`;
};

const O = await engine(oldDir), N = await engine(newDir);
if (!N.run) { console.error("the new engine has no src/game/run.js"); process.exit(2); }
const realRandom = Math.random;
let runs = 0, moves = 0, draws = 0, endings = {}, failures = 0;
const t0 = Date.now();
outer: for (let seed = FROM; seed < FROM + SEEDS; seed++) {
  for (const policy of POLICY_NAMES) {
    const id = policy + "#" + seed;
    const diceO = mulberry(fnv("dice:" + id)), diceN = mulberry(fnv("dice:" + id));
    let nO = 0, nN = 0;
    const rollO = () => { nO++; return diceO(); }, rollN = () => { nN++; return diceN(); };
    const flO = mulberry(fnv("flavor:" + id)), flN = mulberry(fnv("flavor:" + id));
    O.claink.CLAINK.flavor = flO; N.claink.CLAINK.flavor = flN;
    const pick = mulberry(fnv("pick:" + id));
    Math.random = rollO; let sO = O.state.newGame(); Math.random = realRandom;
    globalThis.__TST_RNG = rollN; let sN = N.state.newGame(); delete globalThis.__TST_RNG;
    let dialog = null, mem = {};
    runs++;
    for (let k = 0; k < MOVES; k++) {
      const lO = legal(O, sO, dialog), lN = legal(N, sN, dialog);
      if (lO.join(" ") !== lN.join(" ")) { failures++; console.log(`FAIL ${id} move ${k}: legal moves differ\n  old ${lO.join(" ")}\n  new ${lN.join(" ")}`); break outer; }
      if (!lO.length) break;
      const move = choose(policy, { legal: lO, state: sO, dialog, rng: pick, mem, step: k });
      Math.random = rollO; const rO = stepOld(O, sO, move, dialog); Math.random = realRandom;
      globalThis.__TST_RNG = rollN; const rN = stepNew(N, sN, move, dialog); delete globalThis.__TST_RNG;
      moves++;
      const evO = JSON.stringify(rO.events || []), evN = JSON.stringify(rN.events || []);
      if (nO !== nN || norm(rO.state) !== norm(rN.state) || evO !== evN || !!rO.over !== !!rN.over) {
        failures++;
        console.log(`FAIL ${id} move ${k} (${move}): draws old ${nO} new ${nN}; events old ${evO} new ${evN}; over ${!!rO.over}/${!!rN.over}\n  ${firstDiff(JSON.parse(JSON.stringify(rO.state)), JSON.parse(JSON.stringify(rN.state))) || "(states equal)"}`);
        break outer;
      }
      sO = rO.state; sN = rN.state;
      if (move.indexOf("dlg:") === 0) dialog = null;
      const ev = (rO.events || [])[rO.events.length - 1];
      if (ev) dialog = { id: ev.id, params: ev.params };
      if (rO.over || O.log.isRunOver(sO)) { const c = sO.endCause || "?"; endings[c] = (endings[c] || 0) + 1; break; }
    }
    draws += nO;
  }
}
Math.random = realRandom;
console.log(`${failures ? "DIFFERENTIAL FAILED" : "DIFFERENTIAL OK"}: ${runs} runs (${SEEDS} seeds x ${POLICY_NAMES.length} policies), ${moves} moves, ${draws} rolls compared, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
console.log("  endings reached: " + Object.entries(endings).sort().map(([k, v]) => `${k} ${v}`).join(", "));
process.exit(failures ? 1 : 0);
