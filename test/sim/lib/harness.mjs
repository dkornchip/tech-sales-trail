// The simulation harness: plays whole quarters through the rules' front door (src/game/run.js), headless, in Node.
//
// It drives an ENGINE TREE: a directory that holds src/game and src/copy. Two are used:
//   the working tree (the game as it is being changed), and
//   test/baseline/checkpoint-engine (the v2.0.1 rules, frozen at the commit where they were proven identical to
//   v1.21 move for move and already rolled a seeded stream: the balance baseline).
// Every run is played from a seed, so a candidate and the baseline can be given exactly the same list of seeds.
//
// A bot (policies.mjs) sees what a player sees: the run's state without its dice, the odds and previews the
// interface shows, and the list of moves that are legal right now. It never sees a roll before it lands.
import path from "node:path";
import { pathToFileURL } from "node:url";

export const mulberry = seed => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
export const fnv = text => { let h = 2166136261; for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

const ACTION_IDS = ["prospect", "cadence", "network", "discovery", "demo", "propose", "close", "conference", "crm", "recharge", "coffee", "politics"];
const CK_OPS = { "ck:buy": "buy", "ck:dismiss": "dismiss", "ck:deploy": "deploy", "ck:cancel": "cancel", "ck:hide": "hide" };

// Loads one engine tree. Each tree is its own set of module instances, so two trees never share a counter or a hook.
export async function loadEngine(dir, label) {
  const load = rel => import(pathToFileURL(path.join(dir, "src", rel)).href);
  const names = ["game/run.js", "game/state.js", "game/selectors.js", "game/rules.js", "game/claink.js", "game/events.js", "game/log.js", "game/stress.js", "game/constants.js", "game/rng.js"];
  const [run, state, selectors, rules, claink, events, log, stress, constants, rng] = await Promise.all(names.map(load));
  let effects = null; try { effects = await load("game/effects.js"); } catch { /* the baseline has no effects module */ }
  const E = { label: label || dir, dir, run, state, selectors, rules, claink, events, log, stress, constants, rng, effects };
  E.inState = typeof run.legalMoves === "function";       // newer rules keep the open choice inside the run
  return E;
}

// A game in progress: the run, and (for rules that keep it outside the run) the dialog that is waiting.
export function start(E, seed) {
  let s = E.state.newGame({ seed });
  if (!s.rng || s.rng.seed !== (seed >>> 0)) s = { ...s, rng: E.rng.newRng(seed) };   // rules whose newGame takes no seed
  return { s, dialog: null };
}

export const isOver = (E, g) => E.log.isRunOver(g.s);
export const dialogOf = (E, g) => (E.inState ? (g.s.pending && g.s.pending[0]) || null : g.dialog);

// What a player could press right now, as move ids:
//   act:<id>  hail  end  dlg:<option id>  ck:buy  ck:dismiss  ck:deploy  ck:cancel  ck:hide
const idOf = m => (m.t === "act" ? "act:" + m.id : m.t === "choose" ? "dlg:" + m.option : m.t === "ck" ? "ck:" + m.op : m.t);
export function legalMoves(E, g) {
  if (E.inState) return E.run.legalMoves(g.s).map(idOf);        // newer rules say for themselves what is legal
  const s = g.s, d = dialogOf(E, g);
  if (isOver(E, g)) return [];
  if (d) return E.events.EVENTS[d.id].options.map(o => "dlg:" + o.id);
  const out = [];
  const cost = E.rules.COST;
  for (const id of ACTION_IDS) {
    const used = id === "crm" ? !!(s.used && s.used.crm) : id === "recharge" ? !!s.restedThisWeek : false;
    if (!E.selectors.blocked(s, { energy: cost[id].energy, slots: cost[id].slots || 1, used })) out.push("act:" + id);
  }
  if (!E.selectors.blocked(s, { energy: cost.hail.energy, slots: 1 }) && E.selectors.lateDeals(s).length) out.push("hail");
  out.push("end");
  const C = E.claink, ck = s.claink;
  if (C.clainkCanInstall(s)) out.push("ck:buy");
  if (ck && ck.status === "ad" && E.selectors.weekOf(s) <= C.CLAINK.OFFER_LAST_WEEK) out.push("ck:dismiss");
  if (C.clainkCanDeploy(s)) out.push("ck:deploy");
  if (C.clainkCanCancel(s)) out.push("ck:cancel");
  if (ck && (ck.status === "cancelled" || ck.status === "revoked") && !ck.hidden) out.push("ck:hide");
  return out;
}

export function toMove(E, g, id) {
  if (id.indexOf("act:") === 0) return { t: "act", id: id.slice(4) };
  if (id === "hail") return { t: "hail" };
  if (id === "end") return { t: "end" };
  if (id.indexOf("dlg:") === 0) { const d = dialogOf(E, g); return { t: "choose", event: d.id, option: id.slice(4) }; }
  if (CK_OPS[id]) return { t: "ck", op: CK_OPS[id] };
  throw new Error("unknown move " + id);
}

// One move. Returns the game after it and the log lines it wrote (oldest first).
export function play(E, g, id) {
  const before = g.s, top = before.logs.length ? before.logs[0].id : null;
  const r = E.run.step(before, toMove(E, g, id));
  const s = r.state || r;                      // newer rules return the state itself
  let dialog = g.dialog;
  if (!E.inState) {
    if (id.indexOf("dlg:") === 0) dialog = null;
    const ev = r.events && r.events[r.events.length - 1];
    if (ev) dialog = { id: ev.id, params: ev.params };
    if (r.over || E.log.isRunOver(s)) dialog = null;
  }
  const fresh = [];
  for (const e of s.logs) { if (e.id === top) break; fresh.push(e); }
  fresh.reverse();
  return { g: { s, dialog }, logs: fresh, changed: s !== before };
}

// The six endings, as the game names them, and the cause under each.
export function endingOf(E, s) {
  if (!E.log.isRunOver(s)) return null;
  const cause = s.endCause || "?";
  const id = s.repo ? "repo" : s.burnedOut ? (cause === "caffeine" ? "ascension" : "meltdown") : s.win ? "club" : s.missed ? "missed" : "fired";
  return { id, cause };
}

// What a bot may look at: the run without its dice, and the numbers the interface shows for it.
export function viewOf(E, g, legal) {
  const { rng, ...s } = g.s;                   // a bot never sees the dice
  const sel = E.selectors;
  const c = [0, 0, 0, 0, 0];
  for (const d of s.deals) if (d.stage >= 0 && d.stage <= 4) c[d.stage]++;
  const late = s.deals.filter(d => d.stage >= 3);
  const odds = late.map(d => sel.closeChance(g.s, d, { trained: true }));
  const p = sel.pace(g.s);
  const dead = s.deals.filter(E.rules.isDeadLead).length;
  const ck = s.claink || {};
  return {
    s, legal, can: m => legal.includes(m), dialog: dialogOf(E, g),
    week: sel.weekOf(g.s), slots: s.slots, energy: s.energy, stress: s.stress, cash: s.cash, mgr: s.manager, rep: s.reputation, product: s.product,
    c, open: s.deals.length, late: late.length, odds, bestOdds: odds.length ? Math.max(...odds) : 0,
    lateValue: late.reduce((t, d) => t + d.value, 0), expected: late.reduce((t, d, i) => t + d.value * odds[i], 0),
    dead, rested: !!s.restedThisWeek, shots: s.coffeesThisWeek || 0, used: s.used || {}, warnings: s.perfWarnings || 0,
    done: p.done, gap: p.gap, behind: p.behind, reviewed: p.reviewed, rentDue: sel.rentDueThisWeek(g.s),
    quota: s.quota, closed: s.closedQuarter, cost: E.rules.COST,
    chance: { qualify: sel.qualifyChance(g.s), demo: sel.demoChance(g.s), propose: sel.PROPOSE_CHANCE },   // what the hint bar quotes
    ck: { status: ck.status, strikes: ck.strikes || 0, deployed: !!ck.deployed, due: ck.due || 0, deploys: ck.deploys || 0 },
    shot: sel.nextShot(g.s)
  };
}

// Plays one whole run. policy(view, ctx) returns a legal move id. Returns what happened.
export function playRun(E, seed, policy, opts = {}) {
  const maxMoves = opts.maxMoves || 400;
  let g = start(E, seed);
  const ctx = { rng: mulberry(fnv("bot:" + (opts.salt || "") + ":" + seed)), mem: {} };
  const tally = { moves: {}, tags: {}, weeks: 0, steps: 0, illegal: 0, stuck: false };
  for (let k = 0; k < maxMoves; k++) {
    if (isOver(E, g)) break;
    const legal = legalMoves(E, g);
    if (!legal.length) { tally.stuck = true; break; }
    let id = policy(viewOf(E, g, legal), ctx);
    if (!legal.includes(id)) { tally.illegal++; id = legal.includes("end") ? "end" : legal[0]; }
    const r = play(E, g, id);
    const kind = id.indexOf("dlg:") === 0 ? id + "@" + dialogOf(E, g).id : id;
    tally.moves[kind] = (tally.moves[kind] || 0) + 1;
    for (const e of r.logs) if (e.tag) tally.tags[e.tag] = (tally.tags[e.tag] || 0) + 1;
    if (id === "end") tally.weeks++;
    tally.steps++;
    if (opts.onStep) opts.onStep(g, id, r);
    g = r.g;
  }
  const s = g.s, end = endingOf(E, s);
  return {
    seed, ending: end ? end.id : "unfinished", cause: end ? end.cause : null, week: E.selectors.weekOf(s),
    closed: s.closedWon, attainment: s.quota > 0 ? s.closedWon / s.quota : 0, cash: s.cash, manager: s.manager, stress: s.stress,
    pipeline: s.pipeline, signed: s.story ? s.story.signed : null, warnings: s.perfWarnings || 0,
    ck: s.claink ? { status: s.claink.status, deploys: s.claink.deploys, miracles: s.claink.miracles, strikes: s.claink.strikes, billed: s.claink.billed, delivered: s.claink.delivered } : null,
    tally, state: opts.keepState ? s : undefined
  };
}
