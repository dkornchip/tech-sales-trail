// The front door of the rules. Everything that changes a run goes through step(): the interface dispatches a move
// to it, and the tests and the balance simulations drive it directly, so both play exactly the same game.
//
//   step(state, move) -> { state, events, over }
//
// state   the run after the move: the same object when the move did nothing
// events  dialogs the move raised, as {id, params} (an End Week choice; clAInk's manager)
// over    true when End Week ended the run
//
// A move is one of
//   { t: "act", id }                 one of the twelve actions (ACTS below)
//   { t: "hail" }                    the Hail Mary
//   { t: "end" }                     End Week
//   { t: "choose", event, option }   an answer to an event dialog (EVENTS in events.js)
//   { t: "ck", op }                  clAInk: buy, dismiss, deploy, cancel, hide
//
// step is a pure function of its arguments: the dice are part of the state (rng.js), so the same state and the same
// move always give the same result.
import { actCadence, actClose, actCoffee, actConference, actCrm, actDemo, actDiscovery, actNetwork, actPolitics, actPropose, actProspect, actRecharge, hailMary } from "./actions.js";
import { buyClaink, cancelClaink, deployClaink, dismissClaink, hideClainkCard } from "./claink.js";
import { EVENTS } from "./events.js";
import { rolling } from "./rng.js";
import { checkBurnout } from "./stress.js";
import { endWeek } from "./week.js";

export const ACTS = {
  prospect: actProspect, cadence: actCadence, network: actNetwork, discovery: actDiscovery, demo: actDemo, propose: actPropose,
  close: actClose, conference: actConference, crm: actCrm, recharge: actRecharge, coffee: actCoffee, politics: actPolitics
};
const CK = { buy: buyClaink, dismiss: dismissClaink, cancel: cancelClaink, hide: hideClainkCard };
const own = (o, k) => typeof k === "string" && Object.prototype.hasOwnProperty.call(o, k);

// Where the burnout check sits is part of the rules: after an action, an answer and anything clAInk does, and not
// after the Hail Mary or End Week, which make their own.
const apply = (s, m) => {
  if (m.t === "act") { const ns = own(ACTS, m.id) ? ACTS[m.id](s) : null; return { state: ns ? checkBurnout(ns) : s }; }
  if (m.t === "hail") { const ns = hailMary(s); return { state: ns || s }; }
  if (m.t === "end") {
    const events = [];
    const r = endWeek(s, e => { events.push(e); });
    return r ? { state: r.state, over: !!r.over, events: r.over ? [] : events } : { state: s };
  }
  if (m.t === "choose") {
    const def = own(EVENTS, m.event) ? EVENTS[m.event] : null, opt = def ? def.options.find(o => o.id === m.option) : null;
    return { state: opt ? checkBurnout(opt.apply(s)) : s };
  }
  if (m.t === "ck") {
    if (m.op === "deploy") { const r = deployClaink(s); return { state: checkBurnout(r.state), events: r.event ? [r.event] : [] }; }
    return { state: own(CK, m.op) ? checkBurnout(CK[m.op](s)) : s };
  }
  return { state: s };
};

export const step = (s, move) => {
  const [r, rng] = rolling(s, () => apply(s, move || {}));
  // the dice go back into the state that comes out (a move that changed nothing rolled nothing)
  const state = r.state !== s && rng && r.state.rng !== rng ? { ...r.state, rng } : r.state;
  return { state, events: r.events || [], over: !!r.over };
};
