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
//   balanced    a planner: builds a pipeline early, then each slot works the batch that is worth most per point of
//               energy (the actions move every waiting deal at once, so batches matter); rests on time; cleans the
//               CRM once the warnings have started; keeps the manager on side; leads from calls and referrals
//   referral    the same planner, every lead a referral
//   caller      the same planner, every lead a cold call (email when the phone has been used)
//   conference  the same planner, leads bought at conferences whenever the cash is there
//   risk        the same planner on quad shots and Hail Marys, with no time for hygiene
//   claink      balanced, with a clAInk seat from week 1, run every week, cancelled at two strikes (the third
//               revokes the seat and Finance takes the cash)
// and a set of probes (a planner with no hygiene at all, a slot-by-slot plodder, spam one button, do nothing, farm
// the manager, aim for each ending).

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

// ---- the planner ----
// What a player who has understood the funnel does. Every funnel action moves ALL the deals waiting at its stage, so
// the thing to maximise is the value of the batch moved per point of energy; and a batch needs a pipeline, so the
// first weeks go on building one. P:
//   lead(v)      where a new lead comes from (a move, or null when this player has no way to get one right now)
//   target/stop  keep finding leads until there are `target` open deals, up to week `stop`
//   minOpen      below this many open deals, leads come before anything else
//   crmAt        clean the CRM in a review week behind pace once this many warnings are on file (null: never)
//   shots        quad shots allowed in a week, and the stress it will not go past (shotStress)
//   hail         throw a Hail Mary when there are at least this many late deals and nothing better to do with 10 energy
//   first(v)     a move to make before anything else (clAInk), or null
const PLAN = { target: 14, stop: 8, minOpen: 6, leadOver: 250, floor: 60, wClose: 1.0, w2: 0.45, w1: 0.28, w0: 0.16, restBelow: 30, restStress: 65, crmAt: 2, mgrFloor: 40, shots: 1, shotStress: 60, hail: 0 };
const planner = (over = {}) => {
  const P = { ...PLAN, ...over };
  return (v, ctx) => {
    if (v.dialog) return answer(v, P.answers || sensible);
    if (P.first) { const m = P.first(v, ctx); if (m) return m; }
    if (v.slots <= 0) return "end";
    const cost = v.cost, weeksLeft = 13 - v.week, s = v.s;
    if (!v.rested && can(v, "act:recharge") && (v.energy < P.restBelow || v.stress >= P.restStress)) return "act:recharge";
    if (P.crmAt !== null && v.reviewed && v.behind && v.warnings >= P.crmAt && can(v, "act:crm")) return "act:crm";
    if (v.mgr < P.mgrFloor && can(v, "act:politics")) return "act:politics";
    const wantLeads = v.week <= P.stop && v.open < P.target;
    const at = k => s.deals.filter(d => d.stage === k), worth = ds => sum(ds, d => d.value);
    const opts = [];
    const late = s.deals.filter(d => d.stage >= 3);
    if (can(v, "act:close") && late.length) opts.push(["act:close", late.reduce((t, d, i) => t + d.value * v.odds[i], 0) * P.wClose / cost.close.energy]);
    if (can(v, "act:propose") && v.c[2]) opts.push(["act:propose", worth(at(2)) * v.chance.propose * P.w2 / cost.propose.energy]);
    if (can(v, "act:demo") && v.c[1] && weeksLeft >= 1) opts.push(["act:demo", worth(at(1)) * v.chance.demo * P.w1 / cost.demo.energy]);
    if (can(v, "act:discovery") && v.c[0] && weeksLeft >= 2) opts.push(["act:discovery", worth(at(0)) * v.chance.qualify * P.w0 / cost.discovery.energy]);
    opts.sort((a, b) => b[1] - a[1]);
    if (wantLeads && (v.open < P.minOpen || !opts.length || opts[0][1] < P.leadOver)) { const l = P.lead(v); if (l) return l; }
    if (P.hail && v.late >= P.hail && can(v, "hail") && v.energy < cost.close.energy) return "hail";
    if (opts.length && opts[0][1] > P.floor) return opts[0][0];
    if (wantLeads) { const l = P.lead(v); if (l) return l; }
    if (P.shots && can(v, "act:coffee") && v.shots < P.shots && v.energy < 22 && v.slots >= 2 && (P.shots > 1 ? v.shot.risk < 0.3 && v.stress + v.shot.stress < P.shotStress : v.stress + v.shot.stress + v.shot.crash < P.shotStress)) return "act:coffee";
    if (!v.rested && can(v, "act:recharge") && v.energy < 80) return "act:recharge";
    if (P.crmAt !== null && can(v, "act:crm") && v.dead >= 3) return "act:crm";
    return "end";
  };
};
const from = {
  mixed: v => first(v, v.used.prospect ? ["act:network", "act:prospect"] : ["act:prospect", "act:network"]),
  referral: v => first(v, ["act:network"]),
  caller: v => first(v, v.used.prospect ? ["act:cadence", "act:prospect"] : ["act:prospect", "act:cadence"]),
  // a conference whenever the cash is there (with rent kept back); otherwise the phone, but only for an empty desk
  conference: v => {
    const c = v.cost.conference, buffer = v.rentDue ? 900 : 300;
    if (can(v, "act:conference") && v.cash - c.cash >= buffer) return "act:conference";
    return v.open < 4 ? first(v, ["act:prospect", "act:cadence", "act:network"]) : null;
  }
};
const balanced = planner({ lead: from.mixed });
const referral = planner({ lead: from.referral });
const caller = planner({ lead: from.caller });
const conference = planner({ lead: from.conference, target: 16 });
// the same plan with no hygiene at all: what the rules ask of a player who never touches the CRM
const expert = planner({ lead: from.mixed, crmAt: null, mgrFloor: 0 });
// the slot-by-slot plodder (the first bot these simulations had): competent moves, no plan for the pipeline
const steady = worker(leads.mixed);

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
const claink = planner({ lead: from.mixed, first: clainkFirst({ careful: true, budget: false }) });
const clainkWeekly = planner({ lead: from.mixed, first: clainkFirst({ careful: false, budget: false }) });
const clainkBudget = planner({ lead: from.mixed, first: clainkFirst({ careful: true, budget: true }) });

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

// The plan, run hot: up to three shots a week for another action, a Hail Mary when the energy for a proper close is
// gone, the cheap answer to every choice, rest only when the heart complains, and no time for the CRM.
const risk = planner({ lead: from.mixed, shots: 3, shotStress: 78, hail: 2, restBelow: 16, restStress: 72, crmAt: null, answers: { competitor: () => "match", security: () => "spin" } });

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
  expert, steady, "claink-weekly": clainkWeekly, "claink-budget": clainkBudget, idle, "spam-prospect": spam("act:prospect"), "spam-network": spam("act:network"), "spam-cadence": spam("act:cadence"),
  "spam-politics": spam("act:politics"), "mgr-farm": mgrFarm, "hail-only": hailOnly, emailer, ascend, burn, broke
};
export const POLICIES = { ...CORE, ...PROBES };
