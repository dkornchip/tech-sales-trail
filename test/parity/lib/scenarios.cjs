'use strict';
/*
 * Scripted scenarios: the branches random play almost never reaches, each reached on purpose.
 *
 * A scenario is a crafted save (loaded in BOTH builds through the game's own Load button) plus a few moves, some
 * of them with a scripted draw queue: the values Math.random hands out, in order, before it falls back to the
 * seeded stream. Line numbers refer to src/legacy/game.jsx.
 *
 *   { name, save, steps: [ move | { m: move, q: [draws], x: {expectations} } ], probe?: [group, side] }
 *
 * Expectations (x) are checked against the BASELINE only and are about this file being right: if the baseline
 * did not go down the branch a scenario was written for, the run fails with kind "scenario".
 *   log: [text]      each text appears in a log line this step added      nolog: [text]   none of them does
 *   dialog: id|null  the dialog open after the step                       cause: endCause after the step
 *   hits: [key]      census keys this step must hit                       legal / illegal: [move]
 *   state: fn        predicate on the baseline's raw state                draws: n   draws the move consumed
 *
 * Probes: two scenarios that differ only in one scripted draw, placed just below and just above a threshold in
 * the game (0.19 and 0.21 around a 20% roll). The baseline must end in DIFFERENT states for the two sides (that
 * proves the scripted draw landed on the roll it was aimed at); a build whose threshold moved by more than the
 * gap then differs from the baseline on one of the two.
 *
 * HOW End Week DRAWS (game.jsx:2380-2530), which every "end" queue below relies on:
 *   1  Friday closes roll (<0.15); if it hits, tryCloseSome draws 1-2 per late deal
 *   13 one per fire() in randomEvents, in order: marketing .22, competitor .18 (modal), SE fumble .14, SE save .12,
 *      security .10 (modal), outage .12, champion .11, case study .10, meme .10, freeze .10, crud .10,
 *      rebalance .11, favors .09. A fire() does not draw once two events have fired, or if it is a modal and a
 *      modal is already queued. An event that fires draws its own extras right there.
 *   then ageAndGhost (per deal: one draw if age>6 and stage<2, one if skeptical), stale leads (one per lead if 6+
 *      leads and no Discovery), demo backlog (one per qualified deal if 5+ and no Demo), the weekend danger roll
 *      (only at stress 80+), the mid-quarter ladder and fire roll (weeks 5-12, behind pace), the QBR rolls (week
 *      13), the clAInk invoice (active seat).
 * 0.99 means "nothing happens" at every one of those rolls, so queues are written as the draws that matter
 * followed by 0.99 padding.
 */

const HI = 0.99, LO = 0;
const his = n => Array(n).fill(HI);
const q = (...xs) => [].concat(...xs.map(x => (Array.isArray(x) ? x : [x])), his(90));
const NO_EVENTS = his(14);                       // Friday closes: no. Thirteen events: no.
const event = k => [].concat(his(k), [LO]);      // Friday closes: no. Events before the k-th: no. The k-th: yes.

/* ---------------------------------------------------------------- crafted saves */
const NAMES = ['Acme Quantum', 'NebulaSoft', 'Feral Unicorn', 'DataRamen', 'ByteBazaar', 'Nimbus Forge', 'YakStack', 'HyperLobster', 'Pinecone Pizza', 'Mojo Metrics'];
let dealSeq = 0, runSeq = 0;
const D = (stage, value, mood, age, probNote) => ({ id: 'fx' + (++dealSeq).toString(36), account: NAMES[dealSeq % NAMES.length], value, stage, mood: mood || 'neutral', probNote: probNote || '', age: age || 0 });
const newClaink = () => ({ status: 'ad', hidden: false, deployed: false, strikes: 0, claims: 0, due: 0, weekTokens: 0, mgr: { noticed: false, yoinks: 0 },
  last: null, strikeLog: [], deploys: 0, miracles: 0, fakes: 0, incidents: 0, claimed: 0, delivered: 0, billed: 0, lastInvoice: 0, tokens: 0 });
const CK = over => { const c = Object.assign(newClaink(), over || {}); if (over && over.mgr) c.mgr = Object.assign({ noticed: false, yoinks: 0 }, over.mgr); return c; };

// A complete v1.21 save (game.jsx:309-360). Defaults: week 2 (no rent due), clAInk ad already closed, no deals.
function save(over) {
  over = over || {};
  const s = {
    week: 2, maxQuarters: 1, quartersSurvived: 0, slots: 5, maxSlots: 5, restedThisWeek: false, energy: 95, stress: 28,
    skills: { prospect: 45, discovery: 35, demo: 30, negotiate: 25 }, reputation: 40, manager: 50, product: 60, cash: 1200, quota: 160000,
    closedWon: 0, closedQuarter: 0, discounts: 0, pipeline: 0, meetings: 0, deals: [], logs: [], pip: false, pipLevel: 0,
    fired: false, burnedOut: false, win: false, missed: false, repo: false, repoWarned: false,
    modifiers: { conversion: 0, discount: 0, expiresIn: 0 }, achievements: [], perfWarnings: 0, coffeesThisWeek: 0, stressWarned: false,
    hygieneShield: false, trip: null, claink: CK({ status: 'dismissed' }), endCause: null, runId: 'fx-' + (++runSeq).toString(36),
    used: { prospect: false, cadence: false, discovery: false, demo: false, propose: false, close: false, network: false, recharge: false, crm: false }
  };
  for (const k of Object.keys(over)) {
    if (k === 'skills' || k === 'modifiers' || k === 'used') Object.assign(s[k], over[k]);
    else if (k === 'claink') s.claink = CK(over.claink);
    else s[k] = over[k];
  }
  if (!('pipeline' in over)) s.pipeline = s.deals.reduce((t, d) => t + d.value, 0);
  if (!('closedWon' in over)) s.closedWon = s.closedQuarter;
  return s;
}

const list = [];
const add = sc => { list.push(sc); return sc; };
// Two scenarios around one threshold. `mk(v)` builds the steps with the probing draw set to v.
const probe = (name, saveOf, mk, lo, hi) => {
  add({ name: name + '~lo', save: saveOf(), steps: mk(lo), probe: [name, 'lo'] });
  add({ name: name + '~hi', save: saveOf(), steps: mk(hi), probe: [name, 'hi'] });
};

/* ---------------------------------------------------------------- the thirteen events */
const mixed = () => [D(1, 10000), D(2, 12000), D(3, 15000), D(0, 8000)];
const EVENTS = [
  [1, 'marketing', {}, '📣'], [3, 'fumble', {}, '🛠️'], [4, 'saved', {}, '🧙'], [6, 'outage', {}, '🌩️'], [7, 'champion', {}, '🪜'],
  [8, 'casestudy', {}, '📘'], [9, 'meme', {}, '🐦'], [10, 'freeze', {}, '🥶'], [11, 'crud', { energy: 40 }, '🤒'],
  [12, 'rebalance', { manager: 30 }, '📉 Territory'], [13, 'favors-intros', { manager: 80 }, '🛡️ Manager called'],
  [13, 'favors-shred', { manager: 80, pip: true, pipLevel: 1 }, '🛡️ Manager shredded', [0.55]]
];
for (const [k, name, over, text, extra] of EVENTS) {
  add({ name: 'evt-' + name, save: save(Object.assign({ deals: mixed() }, over)), steps: [{ m: 'end', q: q(event(k), extra || []), x: { log: [text] } }] });
}
// favors with a PIP: the shred roll is 60% (game.jsx:746)
probe('evt-favors-shred-roll', () => save({ deals: mixed(), manager: 80, pip: true, pipLevel: 1 }), v => [{ m: 'end', q: q(event(13), v) }], 0.59, 0.61);
// each event's own probability: the scripted draw sits just under / just over it
const EVENT_P = [0.22, 0.18, 0.14, 0.12, 0.10, 0.12, 0.11, 0.10, 0.10, 0.10, 0.10, 0.11, 0.09];
EVENT_P.forEach((p, i) => {
  const over = i === 10 ? { energy: 40 } : i === 11 ? { manager: 30 } : i === 12 ? { manager: 80 } : {};
  probe('evt-p' + (i + 1), () => save(Object.assign({ deals: mixed() }, over)), v => [{ m: 'end', q: q(his(i + 1), v) }], p - 0.005, p + 0.005);
});
// An event whose precondition fails still uses up one of the week's two event slots (game.jsx:572-580, 627-641):
// with no deals, "SE fumble" and "SE save" both fire as no-ops and nothing after them draws.
add({ name: 'evt-noop-budget', save: save(), steps: [{ m: 'end', q: q(his(3), LO, LO), x: { draws: 5, nolog: ['🛠️', '🧙'] } }] });
// two events in one week, the second a modal: marketing (2 leads, 3 draws each) then competitor
add({ name: 'evt-two', save: save({ deals: mixed() }), steps: [{ m: 'end', q: q(HI, LO, 0, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, LO), x: { log: ['📣'], dialog: 'evt:competitor' } }, 'dlg:0'] });

// the two choice events, both options (game.jsx:590-673)
add({ name: 'competitor-match', save: save({ deals: mixed() }), steps: [{ m: 'end', q: q(event(2)), x: { dialog: 'evt:competitor' } }, { m: 'dlg:0', x: { log: ['💸 Matched'], dialog: null } }, 'act:close'] });
add({ name: 'competitor-hold', save: save({ deals: mixed() }), steps: [{ m: 'end', q: q(event(2)), x: { dialog: 'evt:competitor' } }, { m: 'dlg:1', x: { log: ['🧱 Held'], dialog: null } }, 'act:close'] });
add({ name: 'security-own', save: save({ deals: mixed() }), steps: [{ m: 'end', q: q(event(5)), x: { dialog: 'evt:security' } }, { m: 'dlg:0', q: q(LO, LO), x: { log: ['🔦 Came clean', '💀 Lost'], dialog: null } }] });
add({ name: 'security-spin', save: save({ deals: mixed() }), steps: [{ m: 'end', q: q(event(5)), x: { dialog: 'evt:security' } }, { m: 'dlg:1', q: q(LO, LO), x: { log: ['🌀 Spun it', '💀 Lost'], dialog: null } }] });
probe('security-own-kill', () => save({ deals: [D(2, 12000)] }), v => [{ m: 'end', q: q(event(5)) }, { m: 'dlg:0', q: q(v) }], 0.29, 0.31);
probe('security-spin-kill', () => save({ deals: [D(2, 12000)] }), v => [{ m: 'end', q: q(event(5)) }, { m: 'dlg:1', q: q(v) }], 0.14, 0.16);
probe('outage-kill', () => save({ deals: [D(2, 12000)] }), v => [{ m: 'end', q: q(event(6), v) }], 0.17, 0.19);

/* ---------------------------------------------------------------- the QBR (week 13; game.jsx:761-870) */
const Q = over => save(Object.assign({ week: 13 }, over));
add({ name: 'qbr-club', save: Q({ closedQuarter: 160000 }), steps: [{ m: 'end', q: q(), x: { cause: 'club', dialog: 'end:club', hits: ['end.club', 'qbr.nods'] } }, { m: 'reload', x: { dialog: 'end:club' } }] });
add({ name: 'qbr-just-under-quota', save: Q({ closedQuarter: 159999 }), steps: [{ m: 'end', q: q(), x: { cause: 'missed', dialog: 'end:missed', hits: ['qbr.passive'] } }] });
add({ name: 'qbr-80', save: Q({ closedQuarter: 128000 }), steps: [{ m: 'end', q: q(), x: { cause: 'missed', hits: ['qbr.passive'], draws: 14 } }] });
add({ name: 'qbr-just-under-80', save: Q({ closedQuarter: 127999 }), steps: [{ m: 'end', q: q(), x: { cause: 'missed', hits: ['qbr.dodged'], draws: 15 } }] });
add({ name: 'qbr-exit-interview', save: Q({ closedQuarter: 127999 }), steps: [{ m: 'end', q: q(NO_EVENTS, LO), x: { cause: 'qbr', dialog: 'end:fired', hits: ['end.qbr.roll'] } }] });
add({ name: 'qbr-70', save: Q({ closedQuarter: 112000 }), steps: [{ m: 'end', q: q(), x: { cause: 'missed', hits: ['qbr.dodged'] } }] });
add({ name: 'qbr-just-under-70', save: Q({ closedQuarter: 111999 }), steps: [{ m: 'end', q: q(), x: { cause: 'qbr', hits: ['end.qbr.under70'] } }] });
add({ name: 'qbr-politics', save: Q({ closedQuarter: 160000, manager: 20 }), steps: [{ m: 'end', q: q(NO_EVENTS, LO), x: { cause: 'politics', dialog: 'end:fired', hits: ['end.politics'] } }] });
probe('qbr-politics-roll', () => Q({ closedQuarter: 160000, manager: 20 }), v => [{ m: 'end', q: q(NO_EVENTS, v) }], 0.055, 0.065);
// the politics firing needs manager under 25 going in; drift takes 20 -> 22 and 22.9 -> 24.9 (fired) but 23.1 -> 25.1 (safe)
add({ name: 'qbr-politics-mgr~lo', save: Q({ closedQuarter: 160000, manager: 22.9 }), steps: [{ m: 'end', q: q(NO_EVENTS, LO) }], probe: ['qbr-politics-mgr', 'lo'] });
add({ name: 'qbr-politics-mgr~hi', save: Q({ closedQuarter: 160000, manager: 23.1 }), steps: [{ m: 'end', q: q(NO_EVENTS, LO) }], probe: ['qbr-politics-mgr', 'hi'] });
add({ name: 'qbr-macro', save: Q({ closedQuarter: 130000, manager: 80 }), steps: [{ m: 'end', q: q(), x: { cause: 'missed', hits: ['qbr.macro'] } }] });
add({ name: 'qbr-soft-pip', save: Q({ closedQuarter: 130000, manager: 35 }), steps: [{ m: 'end', q: q(), x: { cause: 'missed', hits: ['qbr.softpip'] } }] });
add({ name: 'qbr-pip-tightens', save: Q({ closedQuarter: 130000, manager: 35, pip: true, pipLevel: 1 }), steps: [{ m: 'end', q: q(), x: { hits: ['qbr.pip-tightens'], state: s => s.pipLevel === 2 } }] });
add({ name: 'qbr-barely-kept', save: Q({ closedQuarter: 120000, pip: true, pipLevel: 1 }), steps: [{ m: 'end', q: q(), x: { cause: 'missed', hits: ['qbr.barely'] } }] });
const threeDeals = () => [D(2, 20000), D(2, 30000), D(1, 5000)];
add({ name: 'qbr-reassigned', save: Q({ closedQuarter: 130000, manager: 25, deals: threeDeals() }), steps: [{ m: 'end', q: q(NO_EVENTS, 0.3), x: { hits: ['qbr.reassigned'], state: s => s.deals.length === 1 } }] });
probe('qbr-reassign-roll', () => Q({ closedQuarter: 130000, manager: 25, deals: threeDeals() }), v => [{ m: 'end', q: q(NO_EVENTS, v) }], 0.34, 0.36);
add({ name: 'qbr-pip-vanishes', save: Q({ closedQuarter: 130000, manager: 80, pip: true, pipLevel: 1 }), steps: [{ m: 'end', q: q(NO_EVENTS, 0.4), x: { hits: ['qbr.pip-vanishes'], state: s => s.pip === false } }] });
probe('qbr-pip-vanish-roll', () => Q({ closedQuarter: 130000, manager: 80, pip: true, pipLevel: 1 }), v => [{ m: 'end', q: q(NO_EVENTS, v) }], 0.49, 0.51);
// QBR fire chance: 75% of quota, no PIP, manager 50, empty pipeline -> 0.25 + 0.10 (coverage) = 0.35
probe('qbr-fire-chance', () => Q({ closedQuarter: 120000 }), v => [{ m: 'end', q: q(NO_EVENTS, v) }], 0.34, 0.36);
// ...under 60%: +0.25 -> 0.60 (either way the run ends under 70%, but only one of them through the roll)
probe('qbr-fire-chance-60', () => Q({ closedQuarter: 90000 }), v => [{ m: 'end', q: q(NO_EVENTS, v) }], 0.59, 0.61);

/* ---------------------------------------------------------------- mid-quarter reviews (weeks 5-12; game.jsx:982-1039) */
const M = over => save(Object.assign({ week: 6 }, over));
add({ name: 'mid-warn-1', save: M(), steps: [{ m: 'end', q: q(NO_EVENTS, LO), x: { hits: ['mid.warn1'], state: s => s.perfWarnings === 1 && s.week === 7 } }] });
add({ name: 'mid-warn-2', save: M({ perfWarnings: 1 }), steps: [{ m: 'end', q: q(NO_EVENTS, LO), x: { hits: ['mid.warn2'], state: s => s.perfWarnings === 2 } }] });
add({ name: 'mid-warn-3', save: M({ perfWarnings: 2 }), steps: [{ m: 'end', q: q(NO_EVENTS, LO), x: { hits: ['mid.warn3'], state: s => s.perfWarnings === 3 } }] });
add({ name: 'mid-org', save: M(), steps: [{ m: 'end', q: q(NO_EVENTS, HI, LO), x: { cause: 'org', dialog: 'end:fired', hits: ['end.org'] } }] });
add({ name: 'mid-review', save: M({ perfWarnings: 2 }), steps: [{ m: 'end', q: q(NO_EVENTS, HI, LO), x: { cause: 'review', dialog: 'end:fired', hits: ['end.review'] } }] });
add({ name: 'mid-recurring', save: M({ perfWarnings: 1 }), steps: [{ m: 'end', q: q(NO_EVENTS, HI, HI, LO), x: { hits: ['mid.recurring'] } }] });
add({ name: 'mid-shielded', save: M({ perfWarnings: 1, hygieneShield: true }), steps: [{ m: 'end', q: q(NO_EVENTS, LO), x: { cause: 'review' } }] });
add({ name: 'mid-week-5-no-fire-roll', save: save({ week: 5 }), steps: [{ m: 'end', q: q(NO_EVENTS, LO), x: { hits: ['mid.warn1', 'week.rent'], draws: 15, state: s => s.week === 6 } }] });
probe('mid-ladder-1', () => M(), v => [{ m: 'end', q: q(NO_EVENTS, v) }], 0.69, 0.71);
probe('mid-ladder-2', () => M({ perfWarnings: 1 }), v => [{ m: 'end', q: q(NO_EVENTS, v) }], 0.59, 0.61);
probe('mid-ladder-3', () => M({ perfWarnings: 2 }), v => [{ m: 'end', q: q(NO_EVENTS, v) }], 0.49, 0.51);
// (No probe for the "recurring meeting" roll at 0.4, game.jsx:1034: it draws either way and its only effect is a
// log line, which no normalised state can see. With --sound its "hrSoft" cue makes it visible.)
// week 6, nothing closed, no warning: (0.03 + 0.8308*0.45 + 0.04 + 0.05) * 0.6 = 0.2963
probe('mid-fire-chance', () => M(), v => [{ m: 'end', q: q(NO_EVENTS, HI, v) }], 0.29, 0.30);
// ...with two warnings on file: 0.03 + 0.3738 + 0.12 + 0.04 + 0.05 = 0.6138
probe('mid-fire-chance-warned', () => M({ perfWarnings: 2 }), v => [{ m: 'end', q: q(NO_EVENTS, HI, v) }], 0.61, 0.62);

/* ---------------------------------------------------------------- stress and caffeine (game.jsx:369-393, 1591-1610, 2454-2472) */
add({ name: 'stress-instant', save: save({ stress: 99 }), steps: [{ m: 'act:politics', x: { cause: 'stress', dialog: 'end:meltdown', hits: ['end.stress.instant'] } }, 'reload'] });
add({ name: 'stress-warning', save: save({ stress: 69 }), steps: [{ m: 'act:politics', x: { hits: ['stress.warned'], state: s => s.stressWarned === true } }] });
add({ name: 'stress-weekend', save: save({ stress: 90 }), steps: [{ m: 'end', q: q(NO_EVENTS, LO), x: { cause: 'stress', dialog: 'end:meltdown', hits: ['end.stress.weekend'] } }] });
probe('stress-weekend-roll', () => save({ stress: 90 }), v => [{ m: 'end', q: q(NO_EVENTS, v) }], 0.32, 0.34);   // (86-75)*0.03 = 0.33
add({ name: 'coffee-liftoff', save: save({ coffeesThisWeek: 2, stress: 10 }), steps: [{ m: 'act:coffee', q: q(0.1), x: { cause: 'caffeine', dialog: 'end:ascension', hits: ['end.caffeine'] } }] });
[[2, 0.20], [3, 0.45], [4, 0.75], [5, 0.85], [6, 0.95]].forEach(([shots, risk]) => {
  probe('coffee-risk-shot-' + (shots + 1), () => save({ coffeesThisWeek: shots, stress: 5 }), v => [{ m: 'act:coffee', q: q(v) }], risk - 0.01, risk + 0.01);
});
add({ name: 'coffee-to-100', save: save({ stress: 90 }), steps: [{ m: 'act:coffee', x: { cause: 'caffeine', draws: 0 } }] });
add({ name: 'coffee-crash', save: save({ coffeesThisWeek: 1, stress: 30 }), steps: [{ m: 'end', q: q(), x: { hits: ['week.crash'], state: s => s.stress === 43 } }] });
add({ name: 'coffee-and-recharge', save: save({ energy: 40 }), steps: ['act:coffee', 'act:coffee', { m: 'act:recharge', q: q(0.1), x: { hits: ['act.recharge'] } }, { m: 'act:recharge', x: { hits: ['act.recharge.again'], draws: 0 } }] });

/* ---------------------------------------------------------------- cash (game.jsx:446-457, 960-971) */
add({ name: 'repo-by-rent', save: save({ week: 5, cash: -950, repoWarned: true }), steps: [{ m: 'end', q: q(), x: { cause: 'repo', dialog: 'end:repo', hits: ['end.repo.rent'], draws: 1 } }, 'reload'] });
add({ name: 'repo-warning', save: save({ week: 1, cash: -450 }), steps: [{ m: 'end', q: q(), x: { hits: ['cash.warned', 'week.rent'], state: s => s.cash === -1050 && s.repoWarned } }] });
add({ name: 'repo-by-spending', save: save({ cash: -700 }), steps: [{ m: 'act:conference', q: q(), x: { cause: 'repo', hits: ['end.repo.spend'] } }] });
// Collections comes at -$1,500 exactly: -900 before rent lands on it, -899 stops a dollar short
add({ name: 'repo-threshold~lo', save: save({ week: 5, cash: -900 }), steps: [{ m: 'end', q: q() }], probe: ['repo-threshold', 'lo'] });   // -1500: gone
add({ name: 'repo-threshold~hi', save: save({ week: 5, cash: -899, closedQuarter: 80000 }), steps: [{ m: 'end', q: q() }], probe: ['repo-threshold', 'hi'] });   // -1499: stays

/* ---------------------------------------------------------------- clAInk (game.jsx:1041-1449) */
const ckDeals = () => [D(3, 18000, 'happy'), D(2, 9000), D(1, 7000), D(0, 6000)];
const C = (ck, over) => save(Object.assign({ cash: 5000, closedQuarter: 30000, deals: ckDeals(), claink: Object.assign({ status: 'active' }, ck || {}) }, over || {}));
// run draws: miracle?, manager?, incident?, which incident, then sizes (game.jsx:1418)
const RUN = (miracle, mgr, inc, kind, rest) => q(miracle, mgr, inc, kind, rest === undefined ? [0, 0.5, 0.5] : rest);
add({ name: 'ck-install', save: save({ cash: 5000, deals: ckDeals(), claink: { status: 'ad' } }), steps: [
  'ck:ad-min', { m: 'ck:ad-expand', x: { legal: ['ck:cta', 'ck:dismiss'] } }, { m: 'ck:cta', x: { legal: ['ck:accept', 'ck:notnow'], illegal: ['ck:cta'] } }, 'ck:notnow', 'ck:cta',
  { m: 'ck:accept', x: { hits: ['ck.install'], legal: ['ck:run', 'ck:cancel', 'ck:minimize'], state: s => s.cash === 4500 && s.claink.status === 'active' } },
  { m: 'ck:minimize', x: { illegal: ['ck:run', 'ck:cancel'], legal: ['ck:expand'] } }, 'ck:expand', { m: 'reload', x: { hits: ['reload.with-seat'] } }] });
add({ name: 'ck-dismiss', save: save({ claink: { status: 'ad' } }), steps: [{ m: 'ck:dismiss', x: { hits: ['ck.dismissed'], illegal: ['ck:cta'] } }] });
add({ name: 'ck-expire', save: save({ week: 3, claink: { status: 'ad' } }), steps: [{ m: 'end', q: q(), x: { hits: ['ck.expired'], state: s => s.claink.status === 'expired' } }] });
add({ name: 'ck-offer-open-week-2', save: save({ week: 2, claink: { status: 'ad' } }), steps: [{ m: 'end', q: q(), x: { state: s => s.claink.status === 'ad', legal: ['ck:cta'] } }] });
add({ name: 'ck-declined-cash-too-low', save: save({ cash: -1000, claink: { status: 'ad' } }), steps: [{ m: 'save', x: { illegal: ['ck:cta'], legal: ['ck:dismiss'] } }] });
add({ name: 'ck-miracle', save: C(), steps: [{ m: 'ck:run', q: RUN(0.1, HI, HI, HI, []), x: { hits: ['ck.miracle'], dialog: null, state: s => s.claink.miracles === 1 && s.claink.strikes === 0 } }, { m: 'end', q: q(), x: { hits: ['ck.invoice'] } }] });
add({ name: 'ck-strike-clean', save: C(), steps: [{ m: 'ck:run', q: RUN(HI, HI, HI, HI), x: { hits: ['ck.strike.clean'], state: s => s.claink.strikes === 1 && s.claink.incidents === 0 } }] });
add({ name: 'ck-slop', save: C(), steps: [{ m: 'ck:run', q: RUN(HI, HI, 0.1, 0.1), x: { hits: ['ck.strike.hurt', 'ck.incident.slop'] } }] });
add({ name: 'ck-discount', save: C(), steps: [{ m: 'ck:run', q: RUN(HI, HI, 0.1, 0.25), x: { hits: ['ck.incident.discount'] } }] });
add({ name: 'ck-leak', save: C(), steps: [{ m: 'ck:run', q: RUN(HI, HI, 0.1, 0.4), x: { hits: ['ck.incident.leak'] } }] });
add({ name: 'ck-churn', save: C(), steps: [{ m: 'ck:run', q: RUN(HI, HI, 0.1, 0.9), x: { hits: ['ck.incident.churn'] } }] });
add({ name: 'ck-churn-nothing-closed', save: C({}, { closedQuarter: 0 }), steps: [{ m: 'ck:run', q: RUN(HI, HI, 0.1, 0.9), x: { hits: ['ck.incident.slop'] } }] });
add({ name: 'ck-leak-no-deals', save: C({}, { deals: [] }), steps: [{ m: 'ck:run', q: RUN(HI, HI, 0.1, 0.4), x: { hits: ['ck.incident.churn'] } }] });
add({ name: 'ck-slop-empty-crm', save: C({}, { deals: [], closedQuarter: 0 }), steps: [{ m: 'ck:run', q: RUN(HI, HI, 0.1, 0.4), x: { hits: ['ck.incident.slop'] } }] });
add({ name: 'ck-warning', save: C(), steps: [{ m: 'ck:run', q: RUN(HI, 0.1, HI, HI), x: { hits: ['ck.mgr.warning'], dialog: 'ck:warning', state: s => s.claink.mgr.noticed && s.manager === 41 } }, { m: 'dlg:0', x: { dialog: null } }] });
add({ name: 'ck-warning-after-miracle', save: C(), steps: [{ m: 'ck:run', q: RUN(0.1, 0.1, HI, HI, []), x: { hits: ['ck.miracle', 'ck.mgr.warning'], dialog: 'ck:warning' } }, 'dlg:0'] });
add({ name: 'ck-yoink', save: C({ mgr: { noticed: true } }), steps: [{ m: 'ck:run', q: RUN(HI, 0.1, HI, HI), x: { hits: ['ck.mgr.yoink'], dialog: 'ck:lesson', state: s => s.claink.mgr.yoinks === 1 && s.deals.length === 3 } }, { m: 'dlg:0', x: { dialog: null } }] });
add({ name: 'ck-circle-back', save: C({ mgr: { noticed: true } }, { deals: [] }), steps: [{ m: 'ck:run', q: RUN(HI, 0.1, HI, HI), x: { hits: ['ck.mgr.circleback'], dialog: null } }] });
add({ name: 'ck-revoke', save: C({ strikes: 2 }), steps: [
  { m: 'ck:run', q: RUN(HI, HI, HI, HI, [0, 0.5, 0.5, 0.2]), x: { hits: ['ck.revoked', 'ck.farewell'], state: s => s.claink.status === 'revoked' && s.cash === -520 && s.deals.length === 3, legal: ['ck:hide'], illegal: ['ck:run'] } },
  'reload', { m: 'ck:hide', x: { hits: ['ck.card.hidden'], illegal: ['ck:hide'] } }, 'reload'] });
add({ name: 'ck-revoke-to-collections', save: C({ strikes: 2 }), steps: [{ m: 'ck:run', q: RUN(HI, HI, HI, HI, [0, 0.5, 0.5, HI]), x: { cause: 'claink', dialog: 'end:repo', hits: ['end.claink'] } }] });
add({ name: 'ck-cancel', save: C(), steps: [{ m: 'ck:cancel', x: { legal: ['ck:cancel-confirm', 'ck:keep'], illegal: ['ck:cancel'] } }, 'ck:keep', 'ck:cancel',
  { m: 'ck:cancel-confirm', x: { hits: ['ck.cancelled'], state: s => s.claink.status === 'cancelled' && s.cash === 4750 } }, 'reload', { m: 'ck:hide', x: { hits: ['ck.card.hidden'] } }] });
add({ name: 'ck-cancel-after-run', save: C(), steps: [{ m: 'ck:run', q: RUN(HI, HI, HI, HI) }, 'ck:cancel', { m: 'ck:cancel-confirm', x: { hits: ['ck.cancelled'], state: s => s.claink.lastInvoice > 250 } }] });
add({ name: 'ck-cancel-cannot-afford', save: C({}, { cash: -1300 }), steps: [{ m: 'ck:cancel', x: { illegal: ['ck:cancel-confirm'], legal: ['ck:keep'] } }, 'ck:keep'] });
add({ name: 'ck-invoice-idle', save: C(), steps: [{ m: 'end', q: q(NO_EVENTS, 0.5, HI), x: { hits: ['ck.invoice', 'ck.invoice.idle'], draws: 16 } }] });
add({ name: 'ck-invoice-overage', save: C(), steps: [{ m: 'end', q: q(NO_EVENTS, 0.5, 0.05, 0.5), x: { hits: ['ck.invoice.overage'], draws: 17 } }] });
add({ name: 'ck-invoice-to-collections', save: C({}, { week: 1, cash: -700 }), steps: [{ m: 'end', q: q(), x: { cause: 'claink', hits: ['end.claink'] } }] });
add({ name: 'ck-frozen-week-13', save: C({}, { week: 13 }), steps: [{ m: 'save', x: { illegal: ['ck:run', 'ck:cancel'], legal: ['ck:minimize'] } }] });
add({ name: 'ck-run-then-week', save: C(), steps: [{ m: 'ck:run', q: RUN(HI, HI, HI, HI), x: { illegal: ['ck:run'] } }, { m: 'end', q: q(), x: { hits: ['ck.invoice'], legal: ['ck:run'] } }] });
probe('ck-miracle-roll', () => C(), v => [{ m: 'ck:run', q: RUN(v, HI, HI, HI) }], 0.19, 0.21);
probe('ck-manager-roll', () => C(), v => [{ m: 'ck:run', q: RUN(HI, v, HI, HI) }], 0.24, 0.26);
probe('ck-incident-roll', () => C(), v => [{ m: 'ck:run', q: RUN(HI, HI, v, 0.1) }], 0.37, 0.39);
probe('ck-kind-slop-discount', () => C(), v => [{ m: 'ck:run', q: RUN(HI, HI, 0.1, v) }], 0.19, 0.21);
probe('ck-kind-discount-leak', () => C(), v => [{ m: 'ck:run', q: RUN(HI, HI, 0.1, v) }], 0.34, 0.36);
probe('ck-kind-leak-churn', () => C(), v => [{ m: 'ck:run', q: RUN(HI, HI, 0.1, v) }], 0.49, 0.51);
probe('ck-overage-roll', () => C(), v => [{ m: 'end', q: q(NO_EVENTS, 0.5, v, 0.5) }], 0.09, 0.11);

/* ---------------------------------------------------------------- closing (game.jsx:498-566, 2587-2633) */
const late = () => [D(3, 20000), D(4, 30000)];
add({ name: 'hail-miracle-win', save: save({ deals: late() }), steps: [{ m: 'hail', q: q(0.1, LO, LO), x: { hits: ['act.hail', 'hail.miracle.win'], state: s => s.deals.length === 0 && s.closedWon === 50000 } }] });
add({ name: 'hail-miracle-fail', save: save({ deals: late() }), steps: [{ m: 'hail', q: q(0.1, HI, HI, HI, HI), x: { hits: ['hail.miracle.fail'], state: s => s.deals.length === 2 } }] });
add({ name: 'hail-torched', save: save({ deals: late() }), steps: [{ m: 'hail', q: q(0.9, HI, HI, HI, HI, LO, LO), x: { hits: ['hail.torched', 'deals.killed'], state: s => s.deals.length === 0 && s.closedWon === 0 } }] });
add({ name: 'hail-ink', save: save({ deals: late() }), steps: [{ m: 'hail', q: q(0.9, LO, LO), x: { hits: ['hail.ink'] } }] });
add({ name: 'hail-needs-late-deal', save: save({ deals: [D(2, 9000)] }), steps: [{ m: 'save', x: { illegal: ['hail'] } }] });
probe('hail-miracle-roll', () => save({ deals: late() }), v => [{ m: 'hail', q: q(v, LO, LO) }], 0.19, 0.21);
probe('hail-kill-roll', () => save({ deals: [D(3, 20000)] }), v => [{ m: 'hail', q: q(0.9, HI, HI, v) }], 0.54, 0.56);
add({ name: 'close-whale', save: save({ deals: [D(3, 70000)] }), steps: [{ m: 'act:close', q: q(LO), x: { hits: ['achievement.whale'], state: s => s.achievements.length === 1 && s.cash === 9600 } }] });
add({ name: 'close-nothing-late', save: save({ deals: [D(1, 9000)] }), steps: [{ m: 'act:close', x: { log: ['no late-stage deals'], draws: 0 } }] });
add({ name: 'close-lost', save: save({ deals: [D(3, 20000)] }), steps: [{ m: 'act:close', q: q(HI, LO), x: { log: ['nobody signed', '💀 Lost 1 late-stage'] } }] });
// base close chance with starting stats, stage 3, neutral: .05+.26*.26+.10*.35+.07*.5+.08*.4+.08*.6-.20*.28 = 0.2116 (negotiate is 26 after the +1)
probe('close-chance', () => save({ deals: [D(3, 20000)] }), v => [{ m: 'act:close', q: q(v, HI) }], 0.21, 0.22);
probe('close-chance-stage-4-happy', () => save({ deals: [D(4, 20000, 'happy')] }), v => [{ m: 'act:close', q: q(v, HI) }], 0.34, 0.35);       // 0.3416
probe('close-chance-skeptical', () => save({ deals: [D(3, 20000, 'skeptical')] }), v => [{ m: 'act:close', q: q(v, HI) }], 0.15, 0.16);     // 0.1516
probe('close-lose-stage-3', () => save({ deals: [D(3, 20000)] }), v => [{ m: 'act:close', q: q(HI, v) }], 0.13, 0.15);
probe('close-lose-stage-4', () => save({ deals: [D(4, 20000)] }), v => [{ m: 'act:close', q: q(HI, v) }], 0.21, 0.23);
probe('close-mood-drop', () => save({ deals: [D(3, 20000)] }), v => [{ m: 'act:close', q: q(v, HI) }], 0.89, 0.91);
add({ name: 'friday-closes', save: save({ deals: late() }), steps: [{ m: 'end', q: q(0.1, LO, LO), x: { hits: ['week.friday'], state: s => s.closedWon === 50000 } }] });
probe('friday-roll', () => save({ deals: late() }), v => [{ m: 'end', q: q(v, LO, LO) }], 0.14, 0.16);

/* ---------------------------------------------------------------- the weekly housekeeping (game.jsx:462-478, 2400-2452) */
add({ name: 'ghosts', save: save({ deals: [D(0, 5000, 'skeptical'), D(1, 6000, 'neutral', 7), D(2, 9000)] }), steps: [{ m: 'end', q: q(NO_EVENTS, LO, LO), x: { hits: ['week.ghost'], state: s => s.deals.length === 1 && s.deals[0].age === 1 } }] });
probe('ghost-skeptical', () => save({ deals: [D(2, 5000, 'skeptical')] }), v => [{ m: 'end', q: q(NO_EVENTS, v) }], 0.14, 0.16);
probe('ghost-too-old', () => save({ deals: [D(1, 5000, 'neutral', 7)] }), v => [{ m: 'end', q: q(NO_EVENTS, v) }], 0.24, 0.26);
// "too old" means older than 6 weeks: a 6-week-old lead draws nothing, a 7-week-old one draws once
add({ name: 'ghost-age-6-no-draw', save: save({ deals: [D(1, 5000, 'neutral', 6)] }), steps: [{ m: 'end', q: q(), x: { draws: 14 } }] });
add({ name: 'ghost-age-7-draws', save: save({ deals: [D(1, 5000, 'neutral', 7)] }), steps: [{ m: 'end', q: q(), x: { draws: 15 } }] });
const leads = (n, stage) => Array.from({ length: n }, (_, i) => D(stage, 4000 + i * 500));
add({ name: 'stale-leads', save: save({ deals: leads(6, 0) }), steps: [{ m: 'end', q: q(NO_EVENTS, 0.1, HI, 0.1, HI, HI, HI), x: { hits: ['week.stale'], state: s => s.deals.length === 4 } }] });
add({ name: 'stale-needs-six', save: save({ deals: leads(5, 0) }), steps: [{ m: 'end', q: q(), x: { draws: 14 } }] });
add({ name: 'stale-not-after-discovery', save: save({ deals: leads(6, 0), used: { discovery: true } }), steps: [{ m: 'end', q: q(), x: { draws: 14 } }] });
probe('stale-roll', () => save({ deals: leads(6, 0) }), v => [{ m: 'end', q: q(NO_EVENTS, v) }], 0.19, 0.21);
add({ name: 'demo-backlog', save: save({ deals: leads(5, 1) }), steps: [{ m: 'end', q: q(NO_EVENTS, 0.1, HI, HI, HI, HI), x: { hits: ['week.backlog'], state: s => s.deals.filter(d => d.stage === 0 && d.mood === 'skeptical').length === 1 } }] });
add({ name: 'backlog-needs-five', save: save({ deals: leads(4, 1) }), steps: [{ m: 'end', q: q(), x: { draws: 14 } }] });
probe('backlog-roll', () => save({ deals: leads(5, 1) }), v => [{ m: 'end', q: q(NO_EVENTS, v) }], 0.17, 0.19);
add({ name: 'full-funnel-week', save: save({ deals: mixed(), used: { prospect: true, discovery: true, demo: true } }), steps: [{ m: 'end', q: q(), x: { hits: ['week.fullfunnel'], state: s => s.modifiers.conversion === 0.06 } }] });
add({ name: 'funnel-neglected', save: save({ deals: mixed(), used: { network: true } }), steps: [{ m: 'end', q: q(), x: { hits: ['week.neglected'], state: s => s.modifiers.conversion === -0.06 } }] });
add({ name: 'two-motions-neither', save: save({ deals: mixed(), used: { network: true, demo: true } }), steps: [{ m: 'end', q: q(), x: { nolog: ['🧩', '🪫'], state: s => s.modifiers.conversion === 0 } }] });
add({ name: 'cadence-penalty', save: save({ used: { cadence: true } }), steps: [{ m: 'end', q: q(), x: { hits: ['week.cadence-penalty'], state: s => s.manager === 45 } }] });
add({ name: 'cadence-with-calls', save: save({ used: { cadence: true, prospect: true } }), steps: [{ m: 'end', q: q(), x: { nolog: ['📵'], state: s => s.manager === 48 } }] });
// the manager stat is a float: closing 12,345 of 160,000 drifts it by (0.07715625 - 0.5) * 4
add({ name: 'manager-drift-float', save: save({ closedQuarter: 12345 }), steps: [{ m: 'end', q: q(), x: { state: s => s.manager === 50 + (12345 / 160000 - 0.5) * 4 && !Number.isInteger(s.manager) } }, { m: 'end', q: q() }, 'reload'] });
add({ name: 'modifier-expires', save: save({ modifiers: { conversion: 0.12, discount: 0.2, expiresIn: 1 } }), steps: [{ m: 'end', q: q(), x: { state: s => s.modifiers.conversion === 0 && s.modifiers.discount === 0 } }] });
add({ name: 'rent-week-1', save: save({ week: 1 }), steps: [{ m: 'end', q: q(), x: { hits: ['week.rent'], state: s => s.cash === 600 } }] });

/* ---------------------------------------------------------------- the actions' own rolls (game.jsx:1456-1672) */
add({ name: 'recharge-trip', save: save({ energy: 30 }), steps: [{ m: 'act:recharge', q: q(0.81, HI), x: { hits: ['recharge.trip'], state: s => s.trip === 'Dubai' } }, 'reload'] });
probe('recharge-trip-roll', () => save({ energy: 30 }), v => [{ m: 'act:recharge', q: q(v, 0.5) }], 0.79, 0.81);
const crmDeals = () => [D(1, 9000, 'curious'), D(2, 12000), D(0, 4000, 'skeptical'), D(0, 3000, 'neutral', 6)];
add({ name: 'crm-nuke', save: save({ deals: crmDeals() }), steps: [{ m: 'act:crm', q: q(0.1), x: { hits: ['act.crm', 'act.crm.nuke'], illegal: ['act:crm'], state: s => s.deals.length === 1 && s.manager === 57 && s.hygieneShield } }] });
probe('crm-nuke-roll', () => save({ deals: crmDeals() }), v => [{ m: 'act:crm', q: q(v) }], 0.14, 0.16);
probe('crm-nuke-roll-low-manager', () => save({ deals: crmDeals(), manager: 30 }), v => [{ m: 'act:crm', q: q(v) }], 0.24, 0.26);
add({ name: 'crm-nothing-to-nuke', save: save({ deals: [D(3, 9000)] }), steps: [{ m: 'act:crm', x: { draws: 0, state: s => s.manager === 55 } }] });
// Prospect Blitz: 1 lead + a bonus lead at 45/100*0.4 = 0.18; a cold lead is skeptical at 0.25
probe('prospect-bonus', () => save(), v => [{ m: 'act:prospect', q: q(0, v, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5) }], 0.17, 0.19);
probe('prospect-cold-mood', () => save(), v => [{ m: 'act:prospect', q: q(0, HI, 0.5, v, 0.5, 0.5) }], 0.24, 0.26);
// Email Cadence: 0.3 -> one warm lead; warm leads are curious at 0.6
probe('cadence-warm-mood', () => save(), v => [{ m: 'act:cadence', q: q(0.3, 0.5, v, 0.5, 0.5) }], 0.59, 0.61);
// Referrals: one intro; tier roll 0.70 / 0.90 / 0.97
probe('referral-tier-peanut', () => save(), v => [{ m: 'act:network', q: q(0, v, 0.5, 0.5, 0.5) }], 0.69, 0.71);
probe('referral-tier-big', () => save(), v => [{ m: 'act:network', q: q(0, v, 0.5, 0.5, 0.5) }], 0.89, 0.91);
probe('referral-tier-whale', () => save(), v => [{ m: 'act:network', q: q(0, v, 0.5, 0.5, 0.5) }], 0.96, 0.98);
// Discovery 0.35 + 35/200 = 0.525; Demo 0.30 + 30/220 + 60/350 = 0.6078; Proposals 0.38
probe('discovery-roll', () => save({ deals: [D(0, 5000)] }), v => [{ m: 'act:discovery', q: q(v) }], 0.52, 0.53);
probe('demo-roll', () => save({ deals: [D(1, 5000)] }), v => [{ m: 'act:demo', q: q(v) }], 0.60, 0.61);
probe('propose-roll', () => save({ deals: [D(2, 5000)] }), v => [{ m: 'act:propose', q: q(v) }], 0.37, 0.39);
// Conference: 3 leads (4 draws each: big?, base, mood, name), then the 30% conversion boost
probe('conference-boost', () => save({ cash: 3000 }), v => [{ m: 'act:conference', q: q(0, his(12), v) }], 0.29, 0.31);
probe('conference-big-lead', () => save({ cash: 3000 }), v => [{ m: 'act:conference', q: q(0, v, 0.5, 0.5, 0.5, his(8), HI) }], 0.39, 0.41);
// every action once, from a rested start, in an order that leaves energy for each
add({ name: 'actions-energy-limits', save: save({ energy: 29 }), steps: [{ m: 'save', x: { illegal: ['act:prospect', 'act:conference'], legal: ['act:demo', 'act:close', 'act:propose', 'act:cadence'] } }] });
add({ name: 'actions-slot-limits', save: save({ slots: 1 }), steps: [{ m: 'save', x: { illegal: ['act:conference'], legal: ['act:prospect'] } }, { m: 'act:politics', x: { illegal: ['act:prospect', 'act:coffee', 'act:recharge', 'hail'], legal: ['end'] } }] });
add({ name: 'rules-dialog', save: save(), steps: [{ m: 'ui:rules', x: { dialog: 'help' } }, { m: 'dlg:0', x: { dialog: null } }] });
add({ name: 'new-game-from-header', save: save({ week: 7, cash: 9000 }), steps: [{ m: 'newgame', x: { state: s => s.week === 1 && s.cash === 1200 && s.claink.status === 'ad' } }, 'save', 'act:prospect', { m: 'load', x: { state: s => s.week === 1 && s.deals.length === 0 } }] });

/* ---------------------------------------------------------------- saves from older versions (game.jsx:68-88, 1136-1200) */
// Loaded through the same merge as any save; both builds must coerce them to the same state.
const legacy = (name, sv, steps) => add({ name: 'legacy-' + name, save: sv, steps: steps || ['save', 'reload', { m: 'end', q: q() }] });
legacy('v1.14-no-new-fields', (() => { const s = save({ week: 4, deals: mixed() }); for (const k of ['coffeesThisWeek', 'stressWarned', 'trip', 'hygieneShield', 'claink', 'endCause', 'perfWarnings', 'repoWarned']) delete s[k]; return s; })());
legacy('v1.16-claink-prototype', Object.assign(save({ week: 4, deals: mixed() }), { claink: { active: true, usedThisWeek: true, runs: 3, totalBilled: 1400, outcomesThisWeek: 4, incidents: 1, lastReport: 'ok' } }));
legacy('v1.19-rugged', Object.assign(save({ week: 6, deals: mixed() }), { claink: { status: 'rugged', flags: 3, billed: 2100, lastInvoice: 900, deploys: 3, last: { kind: 'rug', week: 5, lines: ['x'], incident: 'It emailed everyone.', flags: 3 } } }));
legacy('ad-past-week-3', Object.assign(save({ week: 6 }), { claink: { status: 'ad' } }), [{ m: 'save', x: { state: s => s.claink.status === 'expired' } }]);
legacy('junk-claink', Object.assign(save({ week: 2 }), { claink: 'constructor' }), [{ m: 'save', x: { state: s => s.claink.status === 'ad' } }]);
legacy('wrong-quota', Object.assign(save({ week: 2 }), { quota: 999 }), [{ m: 'save', x: { state: s => s.quota === 160000 } }]);
legacy('ended-run', save({ week: 9, fired: true, endCause: 'org' }), [{ m: 'newrun', x: { state: s => s.week === 1 } }]);
legacy('ended-run-no-cause', (() => { const s = save({ week: 13, burnedOut: true }); delete s.endCause; return s; })(), [{ m: 'reload', x: { dialog: 'end:meltdown' } }]);

for (const sc of list) if (!sc.save) throw new Error('scenario ' + sc.name + ' has no save');
const names = new Set();
for (const sc of list) { if (names.has(sc.name)) throw new Error('duplicate scenario ' + sc.name); names.add(sc.name); }

module.exports = { SCENARIOS: list, save, D, CK, HI, LO };
