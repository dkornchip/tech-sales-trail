// What is bending the signing odds, and for how long.
//
// A run carries a list of effects. Each one says where it came from, what it does, and the weeks it applies to:
//   { src, conv, disc, from, until }
//     src    what put it there (a key of EFFECT below, or "legacy" for one read from an old save)
//     conv   added to every deal's signing odds, as a fraction (0.12 is +12 percentage points)
//     disc   the discount on anything signed (0.20 is 20% off); 0 for most
//     from   the first week of the run it applies to
//     until  the last one (inclusive)
// Weeks are the run's own week numbers, so an effect ends when its last week's Friday close has been rolled and
// not a moment earlier or later, whatever else has started or ended meanwhile. (Up to v2.0.1 every bonus and
// penalty shared one number and one timer, so a second one could cut the first short, stretch it, or wipe it out.)
//
// One source holds one effect: the same thing happening again refreshes it instead of stacking.
// The sum of what is active is held to MAX_SWING either way before it reaches the odds (rules.js, closeOdds).
// Nothing here rolls dice.
import { clamp } from "./util.js";

export const MAX_SWING = 0.30;

// Every source: what it does and how many playable weeks it lasts. The rules apply these and the copy quotes them.
export const EFFECT = {
  competitorMatch: { conv: 0.12, disc: 0.20, weeks: 1 },   // "Match with 20% discount"
  competitorHold: { conv: -0.08, disc: 0, weeks: 1 },      // "Defend our value"
  securityOwn: { conv: -0.15, disc: 0, weeks: 2 },         // disclose the incident
  securitySpin: { conv: -0.08, disc: 0, weeks: 1 },        // the carefully worded statement
  caseStudy: { conv: 0.08, disc: 0, weeks: 1 },
  freeze: { conv: -0.12, disc: 0, weeks: 1 },
  conference: { conv: 0.08, disc: 0, weeks: 1 },           // the hallway conversation that goes somewhere (CONFERENCE_BUZZ)
  fullFunnel: { conv: 0.06, disc: 0, weeks: 1 },
  neglect: { conv: -0.06, disc: 0, weeks: 1 }
};
const list = s => (Array.isArray(s.effects) ? s.effects : []);

// The effects that apply to the week the run is in.
export const activeEffects = s => list(s).filter(e => e.from <= s.week && s.week <= e.until);
// The effects that are waiting for next week (set on a Friday, before the week turns).
export const comingEffects = s => list(s).filter(e => e.from > s.week);

// What all of it adds to a deal's signing odds right now, held to MAX_SWING either way.
export const convMod = s => clamp(activeEffects(s).reduce((t, e) => t + e.conv, 0), -MAX_SWING, MAX_SWING);
// The discount on anything signed right now: the largest one in force (they do not add up).
export const discountRate = s => activeEffects(s).reduce((m, e) => Math.max(m, e.disc || 0), 0);

// A copy of the run with the effect of `src` in force. when: "now" (this week counts as its first) or "next"
// (it starts when the week turns: for what a Friday decides before the week number moves).
export const addEffect = (s, src, when = "now") => {
  const def = EFFECT[src];
  if (!def) return s;
  const from = when === "next" ? s.week + 1 : s.week;
  // the same thing happening again starts its clock again; it does not stack on itself
  return { ...s, effects: [...list(s).filter(e => e.src !== src), { src, conv: def.conv, disc: def.disc, from, until: from + def.weeks - 1 }] };
};

// After a week's Friday close: what has served its last week goes.
export const expireEffects = s => {
  const kept = list(s).filter(e => e.until > s.week);
  return kept.length === list(s).length ? s : { ...s, effects: kept };
};

// What the status chips show: one entry per effect in force, with the playable weeks it has left (this one counts).
export const effectChips = s => activeEffects(s).map(e => ({ src: e.src, conv: e.conv, disc: e.disc || 0, weeksLeft: e.until - s.week + 1 }));

// A save from before v2.1 kept one number, one discount and one timer. What is left of them becomes one effect that
// lasts exactly as long as the old timer had left. Which events made it up is not recoverable, and does not need to be.
// A bonus with no time left on it (the old rules never wrote one) is honoured for the week it is in and no longer.
export const legacyEffects = (modifiers, week) => {
  const m = modifiers && typeof modifiers === "object" ? modifiers : {};
  const conv = Number.isFinite(m.conversion) ? clamp(m.conversion, -MAX_SWING, MAX_SWING) : 0;
  const disc = Number.isFinite(m.discount) ? clamp(m.discount, 0, 0.9) : 0;
  if (!conv && !disc) return [];
  const left = Number.isFinite(m.expiresIn) && m.expiresIn >= 1 ? Math.min(Math.floor(m.expiresIn), 13) : 1;
  return [{ src: "legacy", conv, disc, from: week, until: week + left - 1 }];
};

// Effects read back from a save: only the shape above survives, with numbers in range.
export const sanitizeEffects = (raw, week) => {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const e of raw.slice(0, 24)) {
    if (!e || typeof e !== "object") continue;
    const src = typeof e.src === "string" && (EFFECT[e.src] || e.src === "legacy") ? e.src : null;
    if (!src || !Number.isFinite(e.conv) || !Number.isInteger(e.from) || !Number.isInteger(e.until)) continue;
    if (e.until < e.from || e.until < week || e.from < 1 || e.until > 40) continue;      // spent, or not a span of weeks
    out.push({ src, conv: clamp(e.conv, -MAX_SWING, MAX_SWING), disc: Number.isFinite(e.disc) ? clamp(e.disc, 0, 0.9) : 0, from: e.from, until: e.until });
  }
  return out;
};
