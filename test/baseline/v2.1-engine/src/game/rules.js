import { QUARTER_WEEKS } from "./constants.js";
import { convMod } from "./effects.js";
import { clamp } from "./util.js";

// The numbers. Every cost and every chance the interface quotes is written here once. The rules charge and roll
// with them (actions.js, deals.js, week.js, quarter.js) and the interface shows them (selectors.js, the action
// grid, the copy), so the two can never disagree. Nothing here draws from the dice or changes state.

// What each action costs. `cash` is what it takes from your pocket; it is charged by the action itself.
export const COST = {
  prospect: { energy: 30, slots: 1 },
  cadence: { energy: 18, slots: 1 },
  network: { energy: 16, slots: 1 },
  discovery: { energy: 22, slots: 1 },
  demo: { energy: 28, slots: 1 },
  propose: { energy: 25, slots: 1 },
  close: { energy: 28, slots: 1 },
  conference: { energy: 40, slots: 2, cash: 800 },
  crm: { energy: 15, slots: 1 },
  recharge: { energy: 0, slots: 1 },
  coffee: { energy: 0, slots: 1, cash: 6 },
  politics: { energy: 20, slots: 1 },
  hail: { energy: 10, slots: 1 }
};

// Friday.
export const PAY = { salary: 1000, rent: 1600, commission: 0.12 };
export const RENT_WEEKS = [1, 5, 9];
export const CASH = { repoAt: -1500, warnAt: -1000 };   // Collections takes the jacket at repoAt or lower; Finance says so at warnAt
export const FRIDAY = { energy: 15, relief: 4 };   // energy back; stress eased in a week without quad shots
export const FRIDAY_CLOSE = 0.15;                  // the chance End Week makes a close attempt of its own

// The chance each waiting deal moves up a stage. (Above 1 means certain: the roll is a number below 1.)
export const qualifyOdds = s => 0.35 + s.skills.discovery / 200;
export const demoOdds = s => 0.30 + s.skills.demo / 220 + s.product / 350;
export const PROPOSE_ODDS = 0.38;

// A signing chance is never below ODDS_FLOOR or above ODDS_CAP, whatever is stacked on it.
export const ODDS_FLOOR = 0.03, ODDS_CAP = 0.88;

// The chance one late-stage deal signs. `negotiate` lets the interface ask about the skill as it will be after
// Close deals has trained it by a point. The order of the terms is the order the sum has always been taken in.
export const closeOdds = (s, d, negotiate = s.skills.negotiate) => {
  const pipPenalty = s.pip ? 0.05 * (s.pipLevel || 1) : 0;
  const chance =
    0.05 +
    0.26 * (negotiate / 100) +
    0.10 * (s.skills.discovery / 100) +
    0.07 * (s.manager / 100) +
    0.08 * (s.reputation / 100) +
    0.08 * (s.product / 100) -
    0.20 * (s.stress / 100) +
    convMod(s) +
    (d.stage >= 4 ? 0.05 : 0) +
    (d.mood === "happy" ? 0.08 : 0) -
    (d.mood === "skeptical" ? 0.06 : 0) -
    pipPenalty;
  return clamp(chance, ODDS_FLOOR, ODDS_CAP);
};

// The Hail Mary: one time in five it is a "last chance" blast (no deal walks); the other four it leans on every late
// deal, and each one that did not sign then has this chance to walk.
export const HAIL = { blast: 0.2, walk: 0.55 };
// A conference: the chance it also lifts this week's signing odds (the lift itself is EFFECT.conference), and what
// two days of lanyards do to your stress.
export const CONFERENCE_BUZZ = 0.30;
export const CONFERENCE_STRESS = 5;
// Referrals: the chance each introduction is a whale.
export const REFERRAL = { whale: 0.03 };

// CRM cleanup: which leads count as dead, what clearing them is worth to your manager, and the chance he closes
// out a live deal while he is in there (it depends on his mood before the cleanup).
export const isDeadLead = d => d.stage <= 1 && (d.mood === "skeptical" || d.age >= 5);
export const crmGain = pruned => Math.min(10, 5 + pruned);
export const crmNukeOdds = manager => (manager < 40 ? 0.25 : 0.15);

// ---- pace ----
// How much of quota is expected to be closed by the END of each week of the quarter (index 0 is week 1). The HUD,
// the behind-pace reviews and the firing risk all read this one curve, so they can never disagree about "behind".
// "linear" is the rule up to v2.0.1: a thirteenth of quota every week from the first Friday.
export const PACE_GRACE = 0.03;                 // this far behind is still "on pace"
export const REVIEWS_FROM = 5;                  // behind-pace reviews start this week
export const FIRING_FROM = 6;                   // ...and can end the run from this one
const PACE = {
  linear: Array.from({ length: QUARTER_WEEKS }, (_, i) => (i + 1) / QUARTER_WEEKS),
  ramp: [0, 0.02, 0.05, 0.10, 0.18, 0.27, 0.36, 0.46, 0.57, 0.68, 0.79, 0.90, 1]
};

// ---- tuning ----
// The balance knobs. Each one is a rule that can be switched or scaled without touching the code that reads it, so
// a candidate can be measured against the same seeds as the rules it would replace (test/sim). Nothing in the game
// changes them while it runs: setTuning is for the simulations and the tests.
export const TUNING_DEFAULTS = {
  pace: "ramp",              // which curve above ("linear" is the v2.0.1 one: week/13)
  relief: 0.12,              // the most a healthy pipeline can take off the behind-pace gap (0: off)
  reliefRate: 0.25,          // how much of the weighted pipeline coverage counts as relief
  reliefWeights: [0.05, 0.12, 0.25, 0.45, 0.60],   // what a live deal at each stage is worth toward coverage
  caps: [[6, 0.12], [8, 0.20], [10, 0.35]],        // the most a review may fire at, as [fromWeek, cap] (null: no cap)
  fireFloor: 0.02,           // a behind-pace review is never safer than this
  drift: "pace",             // "pace": the manager drifts by attainment against the curve. "half": by (attainment - 0.5) * 4, as in v2.0.1
  driftCap: 2                // "pace" only: the most the manager drifts in a week, either way
};
// The rules as they were up to v2.0.1, for the tools that measure against them (test/sim, test/engine/tools).
export const TUNING_V201 = { pace: "linear", relief: 0, caps: null, drift: "half" };
export const TUNING = { ...TUNING_DEFAULTS };
export const setTuning = over => { Object.assign(TUNING, TUNING_DEFAULTS, over || {}); return TUNING; };

// The share of quota expected to be closed by the end of this week of the quarter.
export const expectedAttainment = week => { const c = PACE[TUNING.pace] || PACE.linear; return c[clamp(Math.floor(week) || 1, 1, QUARTER_WEEKS) - 1]; };
// How far behind that the run is, as a share of quota (negative: ahead).
export const paceGap = s => { const w = ((s.week - 1) % QUARTER_WEEKS) + 1; return expectedAttainment(w) - (s.quota > 0 ? s.closedQuarter / s.quota : 0); };
// What a healthy pipeline takes off that gap in a mid-quarter review: a share of the live deals' weighted value
// against quota, fading as the quarter runs out. Pipeline can soften a review; it is never counted as revenue.
export const pipelineRelief = s => {
  if (!TUNING.relief) return 0;
  const w = ((s.week - 1) % QUARTER_WEEKS) + 1;
  if (w < REVIEWS_FROM || w >= QUARTER_WEEKS || !(s.quota > 0)) return 0;
  const weights = TUNING.reliefWeights;
  const coverage = s.deals.reduce((t, d) => t + d.value * (weights[clamp(d.stage, 0, weights.length - 1)] || 0), 0) / s.quota;
  return Math.min(TUNING.relief, coverage * TUNING.reliefRate) * Math.max(0, (QUARTER_WEEKS - w) / 8);
};
// The most a review in this week may fire at, or 1 when there is no cap.
export const fireCap = week => {
  if (!TUNING.caps) return 1;
  let cap = 1;
  for (const [from, c] of TUNING.caps) if (week >= from) cap = c;
  return cap;
};
