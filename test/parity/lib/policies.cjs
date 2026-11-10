'use strict';
/*
 * Play policies. A policy turns "the baseline's state and legal moves" into weights; a Node-side PRNG picks a move
 * by weight. Uniform random play dies in a few weeks and never sees most of the game, so each policy leans on a
 * different part of it. None of them needs to play WELL; between them they need to go everywhere.
 *
 * A policy is  (v, w, ctx) => void  where
 *   v    a summary of the baseline's state (see view())
 *   w    { move: weight } pre-filled with 0 for every legal move; set what you want pressed
 *   ctx  { rng, mem, step }   mem is a scratch object that lives for one game (cleared on New Run / New Game)
 * Weights for moves that are not legal are ignored. Meta moves (save, load, reload, new game, Rules, minimize)
 * and dialog buttons are handled once, in choose(), for every policy.
 */

const mulberry = seed => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

function view(s) {
  const c = [0, 0, 0, 0, 0];
  for (const d of s.deals || []) if (d.stage >= 0 && d.stage <= 4) c[d.stage]++;
  const ck = s.claink || {};
  return {
    c, n: (s.deals || []).length, late: c[3] + c[4],
    energy: s.energy, slots: s.slots, stress: s.stress, cash: s.cash, mgr: s.manager, week: ((s.week - 1) % 13) + 1,
    rested: !!s.restedThisWeek, coffees: s.coffeesThisWeek || 0, used: s.used || {},
    ck: ck.status, ckStrikes: ck.strikes || 0, ckDeployed: !!ck.deployed, ckDeploys: ck.deploys || 0
  };
}

// The sensible player: work the funnel top to bottom, rest when tired, end the week when out of slots.
function funnel(v, w) {
  w['act:prospect'] = v.n < 5 ? 6 : 1.5;
  w['act:cadence'] = v.n < 5 ? 2 : 0.5;
  w['act:network'] = 2.5;
  w['act:conference'] = v.cash > 1400 && v.n < 8 ? 1.5 : 0.1;
  w['act:discovery'] = v.c[0] >= 3 ? 9 : v.c[0] >= 1 ? 3 : 0.05;
  w['act:demo'] = v.c[1] >= 2 ? 9 : v.c[1] >= 1 ? 4 : 0.05;
  w['act:propose'] = v.c[2] >= 1 ? 8 : 0.05;
  w['act:close'] = v.late >= 1 ? 10 : 0.05;
  w.hail = v.late >= 2 && v.week >= 9 ? 1 : 0.1;
  w['act:recharge'] = v.rested ? 0.03 : v.energy < 40 ? 14 : 1;
  w['act:coffee'] = v.energy < 16 && v.coffees < 2 ? 2 : 0.05;
  w['act:politics'] = v.mgr < 42 ? 2.5 : 0.3;
  w['act:crm'] = v.mgr < 55 ? 2 : 0.5;
  w.end = v.slots === 0 ? 60 : v.energy < 16 && v.rested ? 15 : 0.4;
  w['ck:dismiss'] = 0.2;
  w['ck:cta'] = 0.05;
}

const POLICIES = {
  funnel,

  // Presses anything.
  chaos(v, w) { for (const m of Object.keys(w)) w[m] = 1; },

  // Lives on Quad Shots: palpitations, the Friday crash, the weekend danger roll, Ascension.
  coffee(v, w) {
    funnel(v, w);
    w['act:coffee'] = 12;
    w['act:recharge'] = v.rested ? 0.03 : 2;
    w.end = v.slots === 0 ? 60 : 1;
  },

  // Buys the clAInk seat at once and runs the agents every week until the Council revokes it.
  rider(v, w) {
    funnel(v, w);
    w['ck:cta'] = 30; w['ck:accept'] = 40; w['ck:notnow'] = 0.5; w['ck:dismiss'] = 0;
    w['ck:run'] = 40; w['ck:cancel'] = 0; w['ck:keep'] = 5; w['ck:cancel-confirm'] = 0;
    w['ck:hide'] = 1; w['ck:expand'] = 6; w['ck:minimize'] = 0.2;
  },

  // Buys the seat, runs it once or twice, then pays to get out.
  canceller(v, w) {
    funnel(v, w);
    w['ck:cta'] = 30; w['ck:accept'] = 40; w['ck:notnow'] = 1; w['ck:dismiss'] = 0;
    w['ck:run'] = v.ckDeploys < 2 ? 25 : 2;
    w['ck:cancel'] = v.ckDeploys >= 1 ? 12 : 1; w['ck:cancel-confirm'] = 25; w['ck:keep'] = 4;
    w['ck:hide'] = 6; w['ck:expand'] = 6; w['ck:minimize'] = 0.3;
  },

  // Never buys. Half the games it closes the ad, the other half it lets the offer run out at the end of week 3.
  dismisser(v, w, ctx) {
    funnel(v, w);
    if (ctx.mem.closeAd === undefined) ctx.mem.closeAd = ctx.rng() < 0.5;
    w['ck:dismiss'] = ctx.mem.closeAd ? 4 : 0;
    w['ck:cta'] = 1.5; w['ck:notnow'] = 20; w['ck:accept'] = 0;
    w['ck:ad-min'] = 1.5; w['ck:ad-expand'] = 1.5;
  },

  // Spends: conferences and coffee until Collections comes for the jacket.
  miser(v, w) {
    funnel(v, w);
    w['act:conference'] = 14;
    w['act:coffee'] = 2;
    w['act:recharge'] = v.rested ? 0.03 : v.energy < 45 ? 10 : 1;
    w['ck:cta'] = 4; w['ck:accept'] = 10; w['ck:run'] = 10; w['ck:dismiss'] = 0;
    w.end = v.slots === 0 ? 60 : 1.5;
  },

  // Manages up: politics and CRM hygiene every week, so the manager stat climbs past 75.
  politician(v, w) {
    funnel(v, w);
    w['act:politics'] = v.mgr < 92 ? 9 : 1;
    w['act:crm'] = 7;
  },

  // Annoys the manager: emails without calls, Hail-Marys, no politics, no hygiene.
  neglecter(v, w) {
    funnel(v, w);
    w['act:prospect'] = 0; w['act:politics'] = 0; w['act:crm'] = 0;
    w['act:cadence'] = 7; w['act:network'] = 4;
    w.hail = 8;
  }
};

// Moves every policy makes now and then, whatever it is doing.
const META = { save: 0.25, load: 0.2, reload: 0.12, newgame: 0.05, 'ui:rules': 0.06, 'ck:minimize': 0.15, 'ck:expand': 0.5, 'ck:ad-min': 0.15, 'ck:ad-expand': 0.4 };

function pickWeighted(weights, rng) {
  const keys = Object.keys(weights).filter(k => weights[k] > 0).sort();
  let total = 0;
  for (const k of keys) total += weights[k];
  if (!(total > 0)) return null;
  let r = rng() * total;
  for (const k of keys) { r -= weights[k]; if (r < 0) return k; }
  return keys[keys.length - 1];
}

/*
 * choose(policyName, ctx) -> move
 *   ctx.legal    moves that may be chosen (the baseline's legal set, minus anything a benign rule withholds from B)
 *   ctx.state    the baseline's raw state
 *   ctx.dialog   the baseline's open dialog, or null
 *   ctx.rng      the Node-side PRNG of this run
 *   ctx.mem      per-game scratch
 */
function choose(policyName, ctx) {
  const policy = POLICIES[policyName];
  if (!policy) throw new Error(`unknown policy ${policyName}`);
  const legal = ctx.legal;
  if (!legal.length) return null;
  const w = {};
  for (const m of legal) w[m] = 0;

  if (ctx.dialog) {
    // Only the dialog's buttons are legal. Take any option; at an ending, usually start a new run, sometimes
    // reload first (an ending must survive a reload).
    for (const m of legal) w[m] = m === 'reload' ? 0.06 : 1;
    return pickWeighted(w, ctx.rng);
  }

  policy(view(ctx.state), w, ctx);
  for (const m of legal) {
    if (!(m in w)) continue;
    if (META[m] !== undefined && policyName !== 'chaos') w[m] = Math.max(w[m], META[m]);
    if (!(w[m] >= 0)) w[m] = 0;
  }
  if (policyName === 'chaos') { w.newgame = 0.05; w.load = 0.2; w.reload = 0.08; w.save = 0.2; w['ui:rules'] = 0.1; }
  // Nothing but meta moves left to press: end the week instead of saving and loading for ever.
  const real = legal.filter(m => /^(act:|hail$|ck:run$)/.test(m) && w[m] > 0.2);
  if (!real.length && legal.includes('end')) w.end = Math.max(w.end || 0, 60);
  const out = {};
  for (const m of legal) out[m] = w[m] || 0;
  return pickWeighted(out, ctx.rng) || legal[0];
}

module.exports = { POLICIES, POLICY_NAMES: Object.keys(POLICIES), choose, view, mulberry, pickWeighted };
