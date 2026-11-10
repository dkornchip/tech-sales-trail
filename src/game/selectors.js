// Numbers the interface shows before you commit to anything: odds, counts, what Friday will do.
// Each one mirrors a rule elsewhere in src/game; none of them draws from the dice or changes state.
import { QUARTER_WEEKS } from "./constants.js";
import { isRunOver } from "./log.js";
import { CRASH_PER_SHOT, RECHARGE_ENERGY, coffeeEnergy, coffeeRisk, coffeeStress, rechargeMax, rechargeRelief } from "./stress.js";
import { clamp, getQuarterInfo } from "./util.js";

export const weekOf = s => getQuarterInfo(s.week).weekInQuarter;
export const RENT_WEEKS = [1, 5, 9];          // salaryAndBills
export const REVIEWS_FROM = 5;                 // endWeek: mid-quarter reviews start
export const rentDueThisWeek = s => RENT_WEEKS.includes(weekOf(s));
export const nextRentWeek = s => RENT_WEEKS.find(w => w >= weekOf(s)) || null;

// behindPace(): pace is week / 13; more than 3 points behind is "behind"
export const pace = s => {
  const target = weekOf(s) / QUARTER_WEEKS;
  const done = s.quota > 0 ? s.closedQuarter / s.quota : 0;
  const gap = target - done;                   // positive = behind
  return { target, done, gap, behind: gap > 0.03, reviewed: weekOf(s) >= REVIEWS_FROM };
};

export const stageCount = (s, stage) => s.deals.filter(d => d.stage === stage).length;
export const lateDeals = s => s.deals.filter(d => d.stage >= 3);

// tryCloseSome(): the chance one late-stage deal signs. Close deals trains negotiation by 1 before it rolls,
// so the odds a player sees for that button include the point (pass trained: true).
export const closeChance = (s, d, { trained = false } = {}) => {
  const negotiate = trained ? clamp(s.skills.negotiate + 1, 0, 100) : s.skills.negotiate;
  const pipPenalty = s.pip ? 0.05 * (s.pipLevel || 1) : 0;
  const chance =
    0.05 +
    0.26 * (negotiate / 100) +
    0.10 * (s.skills.discovery / 100) +
    0.07 * (s.manager / 100) +
    0.08 * (s.reputation / 100) +
    0.08 * (s.product / 100) -
    0.20 * (s.stress / 100) +
    (s.modifiers.conversion || 0) +
    (d.stage >= 4 ? 0.05 : 0) +
    (d.mood === "happy" ? 0.08 : 0) -
    (d.mood === "skeptical" ? 0.06 : 0) -
    pipPenalty;
  return clamp(chance, 0.03, 0.88);
};

// actDiscovery / actDemo / actPropose: the chance each waiting deal moves up a stage
export const qualifyChance = s => Math.min(1, 0.35 + s.skills.discovery / 200);
export const demoChance = s => Math.min(1, 0.30 + s.skills.demo / 220 + s.product / 350);
export const PROPOSE_CHANCE = 0.38;

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
  const dead = d => d.stage <= 1 && (d.mood === "skeptical" || d.age >= 5);
  const pruned = s.deals.filter(dead).length;
  const atRisk = s.deals.some(d => !dead(d) && (d.stage === 1 || d.stage === 2));
  return { pruned, gain: Math.min(10, 5 + pruned), nuke: atRisk ? (s.manager < 40 ? 0.25 : 0.15) : 0 };
};
// endWeek: the parts of Friday that are certain
export const fridayPreview = s => {
  const shots = s.coffeesThisWeek || 0;
  return { salary: 1000, rent: rentDueThisWeek(s) ? 1600 : 0, energy: 15, stress: shots > 0 ? CRASH_PER_SHOT * shots : -4 };
};

// cost(): why an action can't be taken right now, or null. Same order of checks as the rule.
export const blocked = (s, { energy = 0, slots = 1, used = false } = {}) => {
  if (isRunOver(s)) return { why: "over" };
  if (s.slots < slots) return { why: "slots", need: slots, have: s.slots };
  if (s.energy < energy) return { why: "energy", need: energy, have: Math.round(s.energy) };
  if (used) return { why: "once" };
  return null;
};
