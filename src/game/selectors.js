// Numbers the interface shows before you commit to anything: odds, counts, what Friday will do.
// Each one mirrors a rule elsewhere in src/game; none of them draws from the dice or changes state.
import { QUARTER_WEEKS } from "./constants.js";
import { isRunOver } from "./log.js";
import { FRIDAY, PACE_GRACE, PAY, PROPOSE_ODDS, RENT_WEEKS, REVIEWS_FROM, closeOdds, crmGain, crmNukeOdds, demoOdds, expectedAttainment, isDeadLead, paceGap, qualifyOdds } from "./rules.js";
export { RENT_WEEKS, REVIEWS_FROM };
export { effectChips, convMod, discountRate } from "./effects.js";
import { CRASH_PER_SHOT, RECHARGE_ENERGY, coffeeEnergy, coffeeRisk, coffeeStress, rechargeMax, rechargeRelief } from "./stress.js";
import { clamp, getQuarterInfo } from "./util.js";

export const weekOf = s => getQuarterInfo(s.week).weekInQuarter;
export const rentDueThisWeek = s => RENT_WEEKS.includes(weekOf(s));
export const nextRentWeek = s => RENT_WEEKS.find(w => w >= weekOf(s)) || null;

// Where the run stands against what this week expects (rules.js, expectedAttainment: the share of quota expected
// to be closed by this Friday). The reviews read the same numbers (quarter.js, behindPace).
export const pace = s => {
  const target = expectedAttainment(weekOf(s));
  const done = s.quota > 0 ? s.closedQuarter / s.quota : 0;
  const gap = paceGap(s);                      // positive = behind
  return { target, done, gap, behind: gap > PACE_GRACE, ahead: gap < -PACE_GRACE, reviewed: weekOf(s) >= REVIEWS_FROM };
};

export const stageCount = (s, stage) => s.deals.filter(d => d.stage === stage).length;
export const lateDeals = s => s.deals.filter(d => d.stage >= 3);

// The chance one late-stage deal signs (rules.js). Close deals trains negotiation by 1 before it rolls, so the odds
// a player sees for that button include the point (pass trained: true).
export const closeChance = (s, d, { trained = false } = {}) => closeOdds(s, d, trained ? clamp(s.skills.negotiate + 1, 0, 100) : s.skills.negotiate);

// The chance each waiting deal moves up a stage, as a player should read it (never more than certain).
export const qualifyChance = s => Math.min(1, qualifyOdds(s));
export const demoChance = s => Math.min(1, demoOdds(s));
export const PROPOSE_CHANCE = PROPOSE_ODDS;

// actCoffee: what the next shot does
export const nextShot = s => {
  const n = s.coffeesThisWeek || 0, stress = coffeeStress(n);
  return { n: n + 1, energy: coffeeEnergy(n), stress, crash: CRASH_PER_SHOT, lethal: (s.stress || 0) + stress >= 100, risk: (s.stress || 0) + stress >= 100 ? 1 : coffeeRisk(n) };
};
// actRecharge: the range a nap can land in
export const rechargeRange = s => {
  const relief = rechargeRelief(s.coffeesThisWeek || 0);
  return { energy: [RECHARGE_ENERGY, rechargeMax(RECHARGE_ENERGY)], relief: [relief, rechargeMax(relief)] };
};
// actCrm: how many leads it would clear, what the manager makes of it, and the risk he clears a live one too
export const crmPreview = s => {
  const pruned = s.deals.filter(isDeadLead).length;
  const atRisk = s.deals.some(d => !isDeadLead(d) && (d.stage === 1 || d.stage === 2));
  return { pruned, gain: crmGain(pruned), nuke: atRisk ? crmNukeOdds(s.manager) : 0 };
};
// endWeek: the parts of Friday that are certain
export const fridayPreview = s => {
  const shots = s.coffeesThisWeek || 0;
  return { salary: PAY.salary, rent: rentDueThisWeek(s) ? PAY.rent : 0, energy: FRIDAY.energy, stress: shots > 0 ? CRASH_PER_SHOT * shots : -FRIDAY.relief };
};

// cost(): why an action can't be taken right now, or null. Same order of checks as the rule.
export const blocked = (s, { energy = 0, slots = 1, used = false } = {}) => {
  if (isRunOver(s)) return { why: "over" };
  if (s.slots < slots) return { why: "slots", need: slots, have: s.slots };
  if (s.energy < energy) return { why: "energy", need: energy, have: Math.round(s.energy) };
  if (used) return { why: "once" };
  return null;
};

// What the ending screen says about a run: the save's own totals, plus the run's story where it has one
// (game/story.js; saves from before v2.0 have none, and then `known` is false and the story fields are null).
export const runFacts = s => {
  const st = s.story && typeof s.story === "object" ? s.story : null, ck = s.claink || {};
  const k = key => (st ? st.n[key] || 0 : null);
  return {
    known: !!st,
    week: Math.min(weekOf(s), QUARTER_WEEKS), weeks: QUARTER_WEEKS,
    closed: s.closedWon, quotaPct: s.quota > 0 ? Math.floor((100 * s.closedWon) / s.quota) : 0,
    cash: s.cash, discounts: s.discounts || 0, pipeline: s.pipeline || 0,
    trip: s.trip || null,
    signed: st ? st.signed : null, top: st ? st.top : null, took: st ? st.took : null,
    shots: k("shots"), hails: k("hails"), lunches: k("lunches"), cadences: k("cadences"), lost: k("lost"),
    strikes: ck.strikes || 0, revoked: ck.status === "revoked", billed: ck.billed || 0
  };
};
