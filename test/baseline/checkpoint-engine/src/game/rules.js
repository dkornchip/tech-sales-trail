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
export const FRIDAY = { energy: 15, relief: 4 };   // energy back; stress eased in a week without quad shots

// The chance each waiting deal moves up a stage. (Above 1 means certain: the roll is a number below 1.)
export const qualifyOdds = s => 0.35 + s.skills.discovery / 200;
export const demoOdds = s => 0.30 + s.skills.demo / 220 + s.product / 350;
export const PROPOSE_ODDS = 0.38;

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
    (s.modifiers.conversion || 0) +
    (d.stage >= 4 ? 0.05 : 0) +
    (d.mood === "happy" ? 0.08 : 0) -
    (d.mood === "skeptical" ? 0.06 : 0) -
    pipPenalty;
  return clamp(chance, 0.03, 0.88);
};

// CRM cleanup: which leads count as dead, what clearing them is worth to your manager, and the chance he closes
// out a live deal while he is in there (it depends on his mood before the cleanup).
export const isDeadLead = d => d.stage <= 1 && (d.mood === "skeptical" || d.age >= 5);
export const crmGain = pruned => Math.min(10, 5 + pruned);
export const crmNukeOdds = manager => (manager < 40 ? 0.25 : 0.15);
