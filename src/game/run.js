// The front door of the rules. Everything that changes a run goes through step(): the interface dispatches a move
// to it, and the tests and the balance simulations drive it directly, so both play exactly the same game.
//
//   legalMoves(state)   -> the moves that would do something right now
//   step(state, move)   -> { state, events, over, refused }
//
// state    the run after the move: the same object when the move was refused
// events   choices the move put on the run's pending list, as {id, params} (an End Week choice; clAInk's manager)
// over     true when End Week ended the run
// refused  null, or why nothing happened: "over" (the run has ended), "pending" (a choice is waiting and this is
//          not an answer to it), "illegal" (no slot, no energy, already used, nothing to act on, not a move)
//
// A move is one of
//   { t: "act", id }                 one of the twelve actions (ACTS below)
//   { t: "hail" }                    the Hail Mary
//   { t: "end" }                     End Week
//   { t: "choose", event, option }   an answer to the choice at the head of the pending list (EVENTS in events.js)
//   { t: "ck", op }                  clAInk: buy, dismiss, deploy, cancel, hide
//
// The rules decide what is legal, not the interface: a move that is not in legalMoves() changes nothing, however it
// arrives (a double click, a held key, a second tab, a test).
//
// A waiting choice blocks everything else. While the pending list is not empty the only legal moves are the options
// of its first entry; each answer removes that entry, exactly once. A finished run has nothing pending.
//
// step is a pure function of its arguments: the dice are part of the state (rng.js), so the same state and the same
// move always give the same result.
import { actCadence, actClose, actCoffee, actConference, actCrm, actDemo, actDiscovery, actNetwork, actPolitics, actPropose, actProspect, actRecharge, hailMary } from "./actions.js";
import { CLAINK, buyClaink, cancelClaink, clainkCanCancel, clainkCanDeploy, clainkCanInstall, deployClaink, dismissClaink, hideClainkCard } from "./claink.js";
import { EVENTS, queueChoice } from "./events.js";
import { isRunOver } from "./log.js";
import { rolling } from "./rng.js";
import { COST } from "./rules.js";
import { blocked, lateDeals, weekOf } from "./selectors.js";
import { checkBurnout } from "./stress.js";
import { endWeek } from "./week.js";

export const ACTS = {
  prospect: actProspect, cadence: actCadence, network: actNetwork, discovery: actDiscovery, demo: actDemo, propose: actPropose,
  close: actClose, conference: actConference, crm: actCrm, recharge: actRecharge, coffee: actCoffee, politics: actPolitics
};
const CK = { buy: buyClaink, dismiss: dismissClaink, cancel: cancelClaink, hide: hideClainkCard };
const own = (o, k) => typeof k === "string" && Object.prototype.hasOwnProperty.call(o, k);

export const pendingOf = s => (Array.isArray(s.pending) ? s.pending : []);
// The choice that has to be answered before anything else, or null.
export const waiting = s => (isRunOver(s) ? null : pendingOf(s)[0] || null);

// Why an action cannot be taken right now, or null: the same checks, in the same order, as the action itself.
export const actBlock = (s, id) => {
  if (!own(ACTS, id)) return { why: "unknown" };
  const used = id === "crm" ? !!(s.used && s.used.crm) : id === "recharge" ? !!s.restedThisWeek : false;
  return blocked(s, { energy: COST[id].energy, slots: COST[id].slots || 1, used });
};
// Why the Hail Mary cannot be thrown right now, or null.
export const hailBlock = s => blocked(s, { energy: COST.hail.energy, slots: COST.hail.slots || 1 }) || (lateDeals(s).length ? null : { why: "none" });

const ckLegal = (s, op) => {
  const c = s.claink;
  if (!c) return false;
  if (op === "buy") return clainkCanInstall(s);
  if (op === "dismiss") return c.status === "ad" && weekOf(s) <= CLAINK.OFFER_LAST_WEEK;
  if (op === "deploy") return clainkCanDeploy(s);
  if (op === "cancel") return clainkCanCancel(s);
  if (op === "hide") return (c.status === "cancelled" || c.status === "revoked") && !c.hidden;
  return false;
};

// Why a move would be refused, or null when it is legal.
export const refusal = (s, m) => {
  if (!m || typeof m !== "object") return "illegal";
  if (isRunOver(s)) return "over";
  const head = waiting(s);
  if (head) {
    if (m.t !== "choose") return "pending";
    const def = own(EVENTS, head.id) ? EVENTS[head.id] : null;
    return m.event === head.id && def && def.options.some(o => o.id === m.option) ? null : "pending";
  }
  if (m.t === "act") return actBlock(s, m.id) ? "illegal" : null;
  if (m.t === "hail") return hailBlock(s) ? "illegal" : null;
  if (m.t === "end") return null;
  if (m.t === "ck") return ckLegal(s, m.op) ? null : "illegal";
  return "illegal";            // an answer with nothing waiting, or not a move at all
};

// Every move that would do something right now, in the order the interface lays them out.
export const legalMoves = s => {
  if (isRunOver(s)) return [];
  const head = waiting(s);
  if (head) return (own(EVENTS, head.id) ? EVENTS[head.id].options : []).map(o => ({ t: "choose", event: head.id, option: o.id }));
  const out = [];
  for (const id of Object.keys(ACTS)) if (!actBlock(s, id)) out.push({ t: "act", id });
  if (!hailBlock(s)) out.push({ t: "hail" });
  out.push({ t: "end" });
  for (const op of ["buy", "dismiss", "deploy", "cancel", "hide"]) if (ckLegal(s, op)) out.push({ t: "ck", op });
  return out;
};

// Where the burnout check sits is part of the rules: after an action, an answer and anything clAInk does, and not
// after the Hail Mary or End Week, which make their own.
const apply = (s, m) => {
  if (m.t === "act") { const ns = ACTS[m.id](s); return { state: ns ? checkBurnout(ns) : s }; }
  if (m.t === "hail") { const ns = hailMary(s); return { state: ns || s }; }
  if (m.t === "end") { const r = endWeek(s); return r ? { state: r.state, over: !!r.over } : { state: s }; }
  if (m.t === "choose") {
    const opt = EVENTS[m.event].options.find(o => o.id === m.option);
    // the answer takes the choice off the list in the same step that applies it: it can never be applied twice
    return { state: checkBurnout(opt.apply({ ...s, pending: pendingOf(s).slice(1) })) };
  }
  if (m.op === "deploy") {
    const r = deployClaink(s);
    return { state: checkBurnout(r.event ? queueChoice(r.state, r.event.id, r.event.params) : r.state) };
  }
  return { state: checkBurnout(CK[m.op](s)) };
};

export const step = (s, move) => {
  const refused = refusal(s, move);
  if (refused) return { state: s, events: [], over: false, refused };
  const [r, rng] = rolling(s, () => apply(s, move));
  let state = r.state;
  if (state === s) return { state: s, events: [], over: false, refused: "illegal" };
  // the dice go back into the state that comes out
  if (rng && state.rng !== rng) state = { ...state, rng };
  // nothing waits on a finished run
  if (isRunOver(state) && pendingOf(state).length) state = { ...state, pending: [] };
  const before = pendingOf(s).length - (move.t === "choose" ? 1 : 0);
  return { state, events: pendingOf(state).slice(Math.max(0, before)), over: !!r.over, refused: null };
};
