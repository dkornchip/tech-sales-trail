// Policy bots for the balance simulations.
//
// A bot is  (v, ctx) => move id.  v is what a player can see (harness.mjs, viewOf): the run without its dice, the
// odds the deal rows show, the counts on the buttons, and the list of legal moves. ctx = { rng, mem }: the bot's own
// random stream (never the game's) and a scratch object for the run.
//
// These are heuristics, not people. They are here so that a change to the rules can be measured against the same
// behaviour before and after, and so that strategies which differ in kind (where the leads come from, how much risk
// is taken, which tools are used) can be compared. What a human does with the game is a playtest's business.
//
// The seven core strategies:
//   novice      plays top-down, one deal at a time, no hygiene, rests too late, panics at the end
//   balanced    weighs every funnel action by what it is expected to add, per point of energy; rests on time;
//               cleans the CRM when reviews bite; keeps the manager on side
//   referral    balanced, but every lead is a referral
//   caller      balanced, but every lead is a cold call
//   conference  balanced, but its leads are bought: a conference whenever the cash is there, and otherwise it works
//               what it has (it only picks up the phone when there is nothing left to work)
//   risk        balanced's funnel on quad shots and Hail Marys
//   claink      balanced, with a clAInk seat from week 1, run every week, cancelled at two strikes (the third
//               revokes the seat and Finance takes the cash)
// and a set of probes (a stronger planner, spam one button, do nothing, farm the manager, aim for each ending).

const can = (v, m) => v.legal.includes(m);
const first = (v, moves) => moves.find(m => m && v.legal.includes(m)) || null;
const sum = (xs, f) => xs.reduce((t, x) => t + f(x), 0);

// ---- answers to dialogs ----
const answer = (v, { competitor, security }) => {
  const id = v.dialog.id;
  if (id === "evt:competitor") return "dlg:" + competitor(v);
  if (id === "evt:security") return "dlg:" + security(v);
  return v.legal[0];                             // an acknowledgement
};
const sensible = {
  // a discount only pays when there is something to sign this week
  competitor: v => (v.late >= 2 || v.lateValue >= 30000 ? "match" : "hold"),
  // owning it costs two weeks of odds and more of the pipeline; worth it only when little is at stake
  security: v => (v.c[2] + v.late >= 3 ? "spin" : "own")
};

// ---- what a funnel action is worth right now ----
// A deal is worth its value times the chance it still gets signed this quarter. The chance falls with the stages
// it has left and with the weeks left to cover them (each stage takes a couple of tries). A bot does not know the
// rules' internals: these weights are a player's rule of thumb, the same before and after any change to the rules.
const reach = (stage, weeksLeft) => {
  const need = [4.2, 3.2, 2.3, 1.2][Math.min(stage, 3)];           // weeks a deal at this stage typically still needs
  const base = [0.30, 0.42, 0.55, 0.72][Math.min(stage, 3)];        // the chance it signs, given the time
  return base * Math.max(0, Math.min(1, (weeksLeft + 0.6) / need));
};
const scoreActions = (v, opt = {}) => {
  const s = v.s, weeksLeft = 13 - v.week + 1, at = k => s.deals.filter(d => d.stage === k), cost = v.cost;
  const out = [];
  const gain = (k, chance) => sum(at(k), d => d.value * chance * (reach(k + 1, weeksLeft) - reach(k, weeksLeft)));
  if (can(v, "act:discovery") && v.c[0]) out.push(["act:discovery", gain(0, v.chance.qualify) / cost.discovery.energy]);
  if (can(v, "act:demo") && v.c[1]) out.push(["act:demo", gain(1, v.chance.demo) / cost.demo.energy]);
  if (can(v, "act:propose") && v.c[2]) out.push(["act:propose", gain(2, v.chance.propose) / cost.propose.energy]);
  if (can(v, "act:close") && v.late) {
    // A signature is the only thing that counts toward quota, so an attempt is worth the value it is expected to
    // sign now. Long shots are discounted: a miss can lose the deal (the hint says so).
    const late = s.deals.filter(d => d.stage >= 3);
    const worth = late.reduce((t, d, i) => { const p = v.odds[i]; return t + d.value * p * (p >= 0.2 ? 0.5 : 0.25); }, 0);
    out.push(["act:close", (worth * (opt.closeBias || 1)) / cost.close.energy]);
  }
  return out;
};
// the best funnel action, if any is worth its energy
const bestFunnel = (v, opt) => {
  const ranked = scoreActions(v, opt).filter(x => x[1] > (opt && opt.floor !== undefined ? opt.floor : 12)).sort((a, b) => b[1] - a[1]);
  return ranked.length ? ranked[0][0] : null;
};
// anything at all that moves a deal, however small the batch
const anyProgress = v => first(v, [v.late && v.bestOdds >= 0.2 ? "act:close" : null, v.c[2] ? "act:propose" : null, v.c[1] ? "act:demo" : null, v.c[0] ? "act:discovery" : null]);

// ---- looking after yourself ----
// Recharge once it will not be wasted (it gives 35 or more), or when stress wants it.
const rest = (v, { energyBelow = 50, stressAbove = 62 } = {}) =>
  (!v.rested && can(v, "act:recharge") && (v.energy < energyBelow || v.stress >= stressAbove) ? "act:recharge" : null);
// one careful shot: only when it buys another action and Friday's crash stays out of the danger zone
const carefulShot = v => (can(v, "act:coffee") && v.shots < 1 && v.energy < 16 && v.slots >= 2 && v.stress + v.shot.stress + v.shot.crash < 60 ? "act:coffee" : null);

// ---- the office ----
const hygiene = v => (can(v, "act:crm") && ((v.reviewed && v.behind) || v.dead >= 4) ? "act:crm" : null);
const manageUp = (v, below = 42) => (v.mgr < below && can(v, "act:politics") ? "act:politics" : null);

// ---- where the leads come from ----
// A full enough funnel needs no more leads; late in the quarter a new lead cannot close in time.
const wantsLeads = (v, cap) => v.week <= 9 && v.open < cap;
const leads = {
  mixed: v => (wantsLeads(v, 12) ? first(v, v.used.prospect || v.energy < 30 ? ["act:network", "act:cadence", "act:prospect"] : ["act:prospect", "act:network"]) : null),
  referral: v => (wantsLeads(v, 14) ? first(v, ["act:network"]) : null),
  caller: v => (wantsLeads(v, 12) ? first(v, ["act:prospect"]) : null),
  conference: v => {
    const c = v.cost.conference, buffer = v.rentDue ? 900 : 300;
    if (v.week <= 8 && v.open < 16 && can(v, "act:conference") && v.cash - c.cash >= buffer) return "act:conference";
    return v.open < 4 && v.week <= 9 ? first(v, ["act:prospect", "act:cadence", "act:network"]) : null;
  }
};

// The competent player, parameterised by where the leads come from.
const worker = (lead, extra = {}) => (v, ctx) => {
  if (v.dialog) return answer(v, sensible);
  if (extra.first) { const m = extra.first(v, ctx); if (m) return m; }
  if (v.slots <= 0) return "end";
  // a review week behind pace: the CRM comes first (it holds the warning ladder still for that Friday)
  const shield = v.reviewed && v.behind ? hygiene(v) : null;
  const empty = v.open < 4 && v.week <= 9 ? lead(v) : null;       // nothing to work: find something first
  return rest(v) || shield || empty || bestFunnel(v) || manageUp(v) || lead(v) || hygiene(v) || anyProgress(v) || carefulShot(v) || rest(v, { energyBelow: 70, stressAbove: 45 }) || "end";
};

const balanced = worker(leads.mixed);
const referral = worker(leads.referral);
const caller = worker(leads.caller);
const conference = worker(leads.conference);

// A clAInk seat from week 1. `careful` cancels at two strikes (the third revokes the seat and Finance takes the
// cash). `budget` reads the price list before pressing: the seat is bought, and the agent run, only in a week whose
// worst invoice (the platform fee and five outcomes at the top rate, about $1,650) and rent, if due, are covered.
const WORST_RUN = 1650;
const clainkFirst = ({ careful, budget }) => v => {
  const rent = v.rentDue ? 1600 : 0;
  if (can(v, "ck:buy") && (!budget || v.cash - 500 - WORST_RUN - rent >= 0)) return "ck:buy";
  if (careful && v.ck.strikes >= 2 && can(v, "ck:cancel")) return "ck:cancel";
  if (can(v, "ck:deploy") && (!budget || v.cash - v.ck.due - WORST_RUN - rent >= 0)) return "ck:deploy";
  if (can(v, "ck:hide")) return "ck:hide";
  return null;
};
const claink = worker(leads.mixed, { first: clainkFirst({ careful: true, budget: false }) });
const clainkWeekly = worker(leads.mixed, { first: clainkFirst({ careful: false, budget: false }) });
const clainkBudget = worker(leads.mixed, { first: clainkFirst({ careful: true, budget: true }) });

// The beginner: top-down, one deal at a time, no hygiene, rests when it is already too late.
const novice = (v, ctx) => {
  if (v.dialog) return answer(v, { competitor: () => "match", security: () => "spin" });
  if (v.slots <= 0) return "end";
  if (ctx.rng() < 0.2) {                                    // one press in five is whatever is under the pointer
    const any = v.legal.filter(m => m.indexOf("act:") === 0 && m !== "act:coffee");
    if (any.length) return any[Math.floor(ctx.rng() * any.length)];
  }
  if (v.week >= 11 && v.behind && can(v, "hail") && ctx.rng() < 0.5) return "hail";
  if (v.energy < 16) {
    if (!v.rested && can(v, "act:recharge") && ctx.rng() < 0.7) return "act:recharge";
    if (can(v, "act:coffee") && v.shots < 1 && v.stress < 55) return "act:coffee";
    return "end";
  }
  if (v.open < 8 && can(v, "act:prospect")) return "act:prospect";
  return first(v, [v.c[0] ? "act:discovery" : null, v.c[1] ? "act:demo" : null, v.c[2] ? "act:propose" : null, v.late ? "act:close" : null]) || "end";
};

// Balanced's funnel, run hot: a second and third shot for another action, a Hail Mary for a cheap signature,
// rest only when the heart complains.
const risk = v => {
  if (v.dialog) return answer(v, { competitor: () => "match", security: () => "spin" });
  if (v.slots <= 0) return "end";
  if (!v.rested && can(v, "act:recharge") && (v.stress >= 70 || v.energy < 16)) return "act:recharge";
  if (v.late >= 2 && v.week >= 5 && can(v, "hail")) return "hail";
  const move = (v.open < 4 && v.week <= 9 ? leads.mixed(v) : null) || bestFunnel(v, { closeBias: 1.3, floor: 6 }) || leads.mixed(v) || anyProgress(v);
  if (move) return move;
  if (can(v, "act:coffee") && v.shots < 3 && v.shot.risk < 0.3 && v.stress + v.shot.stress < 78) return "act:coffee";
  return "end";
};

// A stronger planner than `balanced`: referrals first for the reputation they build, the manager kept above the
// thresholds a review reads, a close held until it is worth the risk. A ceiling probe, not a human.
const expert = (v, ctx) => {
  if (v.dialog) return answer(v, sensible);
  if (v.slots <= 0) return "end";
  const shield = v.reviewed && v.behind ? hygiene(v) : null;
  const early = v.week <= 3 && v.open < 12 ? first(v, ["act:network", "act:prospect"]) : null;
  return rest(v) || shield || (v.open < 5 ? early : null) || bestFunnel(v, { floor: 14 }) || manageUp(v, v.week >= 4 ? 50 : 40) || early || leads.mixed(v)
    || hygiene(v) || anyProgress(v) || carefulShot(v) || rest(v, { energyBelow: 75, stressAbove: 40 }) || "end";
};

// ---- probes ----
const spam = move => v => (v.dialog ? v.legal[0] : can(v, move) ? move : "end");
const idle = v => (v.dialog ? v.legal[0] : "end");
// politics and CRM every week, the funnel only with what is left
const mgrFarm = v => {
  if (v.dialog) return answer(v, sensible);
  if (v.slots <= 0) return "end";
  return rest(v) || (can(v, "act:crm") ? "act:crm" : null) || (v.mgr < 95 && can(v, "act:politics") ? "act:politics" : null) || bestFunnel(v) || leads.mixed(v) || "end";
};
// never closes: every signature is a Hail Mary
const hailOnly = v => {
  if (v.dialog) return answer(v, sensible);
  if (v.slots <= 0) return "end";
  if (v.late >= 1 && can(v, "hail")) return "hail";
  const ranked = scoreActions(v).filter(x => x[0] !== "act:close").sort((a, b) => b[1] - a[1]);
  return rest(v) || (ranked.length ? ranked[0][0] : null) || leads.mixed(v) || "end";
};
const emailer = v => (v.dialog ? answer(v, sensible) : v.slots <= 0 ? "end" : rest(v) || bestFunnel(v) || (v.open < 12 && can(v, "act:cadence") ? "act:cadence" : null) || anyProgress(v) || "end");
// on purpose: one shot after another
const ascend = v => (v.dialog ? v.legal[0] : can(v, "act:coffee") ? "act:coffee" : "end");
// on purpose: calls and coffee, never a rest
const burn = v => (v.dialog ? v.legal[0] : v.slots <= 0 ? "end" : first(v, ["act:prospect", "act:coffee"]) || "end");
// on purpose: every dollar on conferences and seats
const broke = v => (v.dialog ? v.legal[0] : first(v, ["ck:buy", "ck:deploy", "act:conference", "act:coffee"]) || "end");

export const CORE = { novice, balanced, referral, caller, conference, risk, claink };
export const PROBES = {
  expert, "claink-weekly": clainkWeekly, "claink-budget": clainkBudget, idle, "spam-prospect": spam("act:prospect"), "spam-network": spam("act:network"), "spam-cadence": spam("act:cadence"),
  "spam-politics": spam("act:politics"), "mgr-farm": mgrFarm, "hail-only": hailOnly, emailer, ascend, burn, broke
};
export const POLICIES = { ...CORE, ...PROBES };
