#!/usr/bin/env node
'use strict';
/*
 * Regenerates the generated save fixtures: saves written by the frozen v1.21 baseline itself.
 *
 *   node test/saves/generate.cjs            rewrite test/saves/fixtures/generated/*.json and their manifest entries
 *   node test/saves/generate.cjs --check    regenerate in memory and fail if a committed file or entry differs
 *   node test/saves/generate.cjs --only id  just the recipes whose id contains <id> (not with --check)
 *
 * How a fixture is made. The baseline (test/baseline/v1.21/index.html, served and driven exactly as the parity
 * harness does it: seeded dice, a fake clock that starts at the same instant every time, a scripted draw queue) is
 * taken to a state, and the string it then holds under its autosave key is the fixture, byte for byte. Three kinds
 * of recipe (RECIPES below):
 *   fresh      open the game with empty storage
 *   scenario   one of the scripted scenarios in test/parity/lib/scenarios.cjs, played up to a step: its crafted
 *              save goes in through the game's own Load button, then the baseline plays the moves
 *   play       a seeded policy session from a fresh run, stopped the first time a condition holds
 *
 * Nothing here is random and nothing reads the real clock, so a second run writes the same bytes; --check is
 * that second run. The hand-written fixtures (kind "legacy" in the manifest) are never touched.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { chromium } = require('playwright');
const { Side } = require('../parity/lib/side.cjs');
const { loadBuild } = require('../parity/lib/serve.cjs');
const { loadDriver, withReload } = require('../parity/drivers/interface.cjs');
const { fnv } = require('../parity/lib/runner.cjs');
const { parseFx } = require('../parity/lib/plan.cjs');
const { choose, mulberry } = require('../parity/lib/policies.cjs');
const { SCENARIOS, save, D, HI } = require('../parity/lib/scenarios.cjs');
const { DIR, MANIFEST, KEYS, readRaw, writeRaw } = require('./lib/fixtures.cjs');

const his = n => Array(n).fill(HI);
const quiet = his(110);                                    // "nothing happens" at every roll of an End Week
const scenario = name => { const sc = SCENARIOS.find(s => s.name === name); if (!sc) throw new Error(`generate: no scenario named ${name}`); return sc; };
// The first n steps of a scripted scenario (all of them when n is omitted), then any extra steps.
const fromScenario = (name, n, extra) => { const sc = scenario(name); return { save: sc.save, dice: fnv('scenario:' + name), steps: sc.steps.slice(0, n === undefined ? sc.steps.length : n).concat(extra || []) }; };

// A crafted worst case for the board: 24 deals in every stage and mood, every status badge a live run can carry.
const MOODS = ['skeptical', 'neutral', 'curious', 'happy'];
const NOTES = ['', 'referral peanut', 'referral big', 'referral whale', 'roll 44% vs 21%', 'AI-touched', 'agent-promised discount'];
const bigBoard = () => save({
  week: 9, cash: 23456, closedQuarter: 96000, energy: 88, stress: 55, manager: 61, reputation: 58, product: 52, discounts: 4200, meetings: 31,
  pip: true, pipLevel: 2, perfWarnings: 1, coffeesThisWeek: 2, restedThisWeek: true, trip: 'Whistler', hygieneShield: true, stressWarned: true,
  modifiers: { conversion: 0.12, discount: 0.2, expiresIn: 2 }, used: { recharge: true },
  deals: Array.from({ length: 24 }, (_, i) => D(i % 5, 4000 + i * 3700, MOODS[i % 4], i % 8, NOTES[i % NOTES.length])),
  claink: { status: 'active', strikes: 2, deploys: 4, fakes: 3, miracles: 1, billed: 3100, claimed: 91000, delivered: 14000, tokens: 12400000, mgr: { noticed: true, yoinks: 1 },
    strikeLog: [{ n: 1, who: 'Finance', line: '2.7M tokens, $0 closed. “Explain.”' }, { n: 2, who: 'Legal', line: 'It wrote itself legal disclaimers.' }] }
});

/*
 * id        the fixture's name; its file is fixtures/generated/<id>.json
 * what      what the save is
 * make      how the baseline gets there (see the three kinds above); `how` is the same thing in words
 * expect    what must be on screen after loading it: the dialog (null for none), clAInk's dock, and state fields
 * policies  the two play policies for the 30 moves that follow a load (page load, Load button)
 */
const RECIPES = [
  { id: 'fresh', what: 'A fresh run: week 1, nothing done, the clAInk ad showing.',
    make: { fresh: true }, how: 'Opened the baseline with empty storage and clocked in.',
    expect: { dialog: null, dock: 'ad', state: { week: 1, cash: 1200, 'claink.status': 'ad' } }, policies: ['funnel', 'rider'] },
  { id: 'midrun-seeded', what: 'Mid-run, played for real: week 7, eight live deals from leads to proposals, 52 log lines, the clAInk offer long gone.',
    make: { play: { policy: 'funnel', seed: 1, until: s => s.week >= 7 && s.deals.length >= 7 } },
    how: 'A seeded "funnel" policy session from a fresh run (no New Game, Load or reload), stopped at the first move after which the week is 7 or later and at least 7 deals are live.',
    expect: { dialog: null, dock: 'none' }, policies: ['funnel', 'coffee'] },
  { id: 'board-24-deals', what: 'A full board: 24 deals in every stage and mood, PIP level 2, a discount and a conversion modifier, rested, a trip approved, two quad shots, a clAInk seat on two strikes.',
    make: { save: bigBoard(), dice: fnv('saves:board-24-deals'), steps: [{ m: 'act:politics' }] },
    how: 'A crafted save loaded through the Load button, then one real move (Internal Politics) so the baseline wrote it out.',
    expect: { dialog: null, dock: 'workspace', state: { 'deals.length': 24, pip: true, 'claink.strikes': 2 } }, policies: ['funnel', 'rider'] },

  { id: 'ck-ad-week-3', what: 'The clAInk ad still up in week 3, the last week of the offer.',
    make: fromScenario('ck-offer-open-week-2'), how: 'Scenario ck-offer-open-week-2: End Week from week 2 with the ad open.',
    expect: { dialog: null, dock: 'ad', state: { week: 3, 'claink.status': 'ad' } }, policies: ['dismisser', 'rider'] },
  { id: 'ck-dismissed', what: 'The ad closed with x: clAInk is off for this run.',
    make: fromScenario('ck-dismiss'), how: 'Scenario ck-dismiss: the ad\'s close button.',
    expect: { dialog: null, dock: 'none', state: { 'claink.status': 'dismissed' } }, policies: ['funnel', 'coffee'] },
  { id: 'ck-expired', what: 'The offer ran out: End Week of week 3 with the ad unanswered.',
    make: fromScenario('ck-expire'), how: 'Scenario ck-expire.',
    expect: { dialog: null, dock: 'none', state: { 'claink.status': 'expired', week: 4 } }, policies: ['funnel', 'politician'] },
  { id: 'ck-active-0-strikes', what: 'A seat bought a moment ago: active, no run yet, the welcome card showing.',
    make: fromScenario('ck-install', 6), how: 'Scenario ck-install up to "Accept".',
    expect: { dialog: null, dock: 'workspace+report', state: { 'claink.status': 'active', 'claink.strikes': 0, 'claink.last.kind': 'onboarded' } }, policies: ['rider', 'canceller'] },
  { id: 'ck-active-1-strike', what: 'An active seat with one strike, the week after the run that earned it.',
    make: fromScenario('ck-strike-clean', undefined, [{ m: 'end', q: quiet }]), how: 'Scenario ck-strike-clean (a run that closed $0), then a quiet End Week.',
    expect: { dialog: null, dock: 'workspace+report', state: { 'claink.strikes': 1, 'claink.deployed': false } }, policies: ['rider', 'canceller'] },
  { id: 'ck-active-2-strikes', what: 'An active seat with two strikes: the next $0 run revokes it.',
    make: { save: save({ cash: 5000, closedQuarter: 30000, deals: [D(1, 7000), D(3, 18000, 'happy'), D(0, 6000), D(2, 9000)], claink: { status: 'active', strikes: 1, deploys: 1, fakes: 1 } }),
      dice: fnv('saves:ck-active-2-strikes'), steps: [{ m: 'ck:run', q: [HI, HI, HI, HI, 0, 0.5, 0.5].concat(quiet) }, { m: 'end', q: quiet }] },
    how: 'A crafted save with one strike, loaded through the Load button; "Run agents" with a scripted $0 run, then a quiet End Week.',
    expect: { dialog: null, dock: 'workspace+report', state: { 'claink.strikes': 2, 'claink.deployed': false } }, policies: ['rider', 'canceller'] },
  { id: 'ck-report-miracle', what: 'A run report on screen: the one run in five that closed real revenue.',
    make: fromScenario('ck-miracle', 1), how: 'Scenario ck-miracle, the run only (before End Week).',
    expect: { dialog: null, dock: 'workspace+report', state: { 'claink.last.kind': 'miracle', 'claink.deployed': true } }, policies: ['rider', 'funnel'] },
  { id: 'ck-report-strike-hurt', what: 'A run report on screen: a strike that came with damage (the follow-up spam incident).',
    make: fromScenario('ck-slop'), how: 'Scenario ck-slop.',
    expect: { dialog: null, dock: 'workspace+report', state: { 'claink.last.kind': 'strike', 'claink.last.strike.hurt': true, 'claink.incidents': 1 } }, policies: ['rider', 'canceller'] },
  { id: 'ck-revoked-card', what: 'Strike three: the seat revoked, the true-up paid, the REVOKED card showing.',
    make: fromScenario('ck-revoke', 1), how: 'Scenario ck-revoke, the third strike only.',
    expect: { dialog: null, dock: 'card:revoked', legal: ['ck:hide'], state: { 'claink.status': 'revoked', 'claink.hidden': false, cash: -520 } }, policies: ['funnel', 'rider'] },
  { id: 'ck-revoked-hidden', what: 'A revoked seat whose card has been closed.',
    make: fromScenario('ck-revoke', 3), how: 'Scenario ck-revoke up to the card\'s close button.',
    expect: { dialog: null, dock: 'none', illegal: ['ck:hide'], state: { 'claink.status': 'revoked', 'claink.hidden': true } }, policies: ['funnel', 'miser'] },
  { id: 'ck-cancelled', what: 'A seat cancelled for the fee, its goodbye card showing.',
    make: fromScenario('ck-cancel', 4), how: 'Scenario ck-cancel up to "Pay & cancel".',
    expect: { dialog: null, dock: 'card:cancelled', legal: ['ck:hide'], state: { 'claink.status': 'cancelled', cash: 4750 } }, policies: ['funnel', 'rider'] },
  { id: 'ck-cancelled-hidden', what: 'A cancelled seat whose card has been closed.',
    make: fromScenario('ck-cancel'), how: 'Scenario ck-cancel to the end.',
    expect: { dialog: null, dock: 'none', state: { 'claink.status': 'cancelled', 'claink.hidden': true } }, policies: ['funnel', 'coffee'] },

  { id: 'end-club', what: 'Ending: President\'s Club (quota met at the QBR).',
    make: fromScenario('qbr-club', 1), how: 'Scenario qbr-club, End Week of week 13.', expect: { dialog: 'end:club', dock: 'none', cause: 'club' } },
  { id: 'end-missed', what: 'Ending: quota missed, job kept.',
    make: fromScenario('qbr-just-under-quota'), how: 'Scenario qbr-just-under-quota.', expect: { dialog: 'end:missed', dock: 'none', cause: 'missed' } },
  { id: 'end-qbr', what: 'Ending: fired at the QBR.',
    make: fromScenario('qbr-exit-interview'), how: 'Scenario qbr-exit-interview.', expect: { dialog: 'end:fired', dock: 'none', cause: 'qbr' } },
  { id: 'end-review', what: 'Ending: fired mid-quarter with warnings on file.',
    make: fromScenario('mid-review'), how: 'Scenario mid-review.', expect: { dialog: 'end:fired', dock: 'none', cause: 'review' } },
  { id: 'end-org', what: 'Ending: fired mid-quarter with no warning (the "org update").',
    make: fromScenario('mid-org'), how: 'Scenario mid-org.', expect: { dialog: 'end:fired', dock: 'none', cause: 'org' } },
  { id: 'end-politics', what: 'Ending: quota met, fired anyway.',
    make: fromScenario('qbr-politics'), how: 'Scenario qbr-politics.', expect: { dialog: 'end:fired', dock: 'none', cause: 'politics' } },
  { id: 'end-stress', what: 'Ending: meltdown over the weekend.',
    make: fromScenario('stress-weekend'), how: 'Scenario stress-weekend.', expect: { dialog: 'end:meltdown', dock: 'none', cause: 'stress' } },
  { id: 'end-caffeine', what: 'Ending: one quad shot too many.',
    make: fromScenario('coffee-liftoff'), how: 'Scenario coffee-liftoff.', expect: { dialog: 'end:ascension', dock: 'none', cause: 'caffeine' } },
  { id: 'end-repo-rent', what: 'Ending: Collections, by rent.',
    make: fromScenario('repo-by-rent', 1), how: 'Scenario repo-by-rent, End Week of week 5.', expect: { dialog: 'end:repo', dock: 'none', cause: 'repo' } },
  { id: 'end-repo-claink', what: 'Ending: Collections, by clAInk\'s token true-up (the revoked card is still in the save).',
    make: fromScenario('ck-revoke-to-collections'), how: 'Scenario ck-revoke-to-collections.', expect: { dialog: 'end:repo', dock: 'card:revoked', cause: 'claink' } }
];

const stepOf = st => (typeof st === 'string' ? { m: st } : st);

async function make(browser, r, build, driver) {
  const A = new Side({ label: 'A', build, driver, seed: fnv('saves:' + r.id), fx: parseFx('seeded'), flavor: 0.5, motion: 'reduce', roundMs: 2000, maxRounds: 8 });
  const bad = (snap, what) => {
    const t = A.drainTrouble().concat(snap.thrown || []);
    if (snap.actError) t.push('could not make the move: ' + snap.actError);
    if (snap.settled === false) t.push('did not settle');
    if (t.length) throw new Error(`recipe ${r.id}, ${what}: ${t.join(' ; ')}`);
  };
  try {
    let snap = await A.open(browser, null);
    bad(snap, 'loading');
    const m = r.make;
    if (m.save) {
      await A.inject(m.save, m.dice);
      snap = await A.step('load'); bad(snap, 'load');
      for (const st of m.steps.map(stepOf)) {
        if (st.m === 'reload') snap = await A.reload();
        else {
          const legal = withReload(snap.legal, snap.dialog);
          if (!legal.includes(st.m)) throw new Error(`recipe ${r.id}: ${st.m} is not legal here (legal: ${legal.join(' ')})`);
          snap = await A.step(st.m, st.q || null);
        }
        bad(snap, st.m);
      }
    } else if (m.play) {
      const rng = mulberry(fnv('pick:saves:' + r.id + ':' + m.play.seed));
      const mem = {};
      let done = false;
      for (let i = 0; i < 600 && !done; i++) {
        const state = JSON.parse(snap.state);
        if (snap.dialog && /^end:/.test(snap.dialog.id)) throw new Error(`recipe ${r.id}: the run ended (${snap.dialog.id}) before the condition held; pick another seed`);
        // one run, start to finish: no New Game, no Load, no reload, no Save
        const legal = snap.legal.filter(x => !['newgame', 'load', 'save'].includes(x));
        const move = choose(m.play.policy, { legal, state, dialog: snap.dialog, rng, mem, step: i });
        snap = await A.step(move, null); bad(snap, move);
        const now = JSON.parse(snap.state);
        done = !snap.dialog && m.play.until(now);
      }
      if (!done) throw new Error(`recipe ${r.id}: the condition never held within 600 moves`);
    }
    // what the baseline wrote, byte for byte
    const raw = await A.page.evaluate(k => window.localStorage.getItem(k), KEYS.autosave);
    if (!raw) throw new Error(`recipe ${r.id}: the baseline has no autosave`);
    const state = JSON.parse(raw);
    const x = r.expect;
    const got = snap.dialog ? snap.dialog.id : null;
    if (got !== x.dialog) throw new Error(`recipe ${r.id}: expected dialog ${x.dialog}, the baseline shows ${got}`);
    if ('cause' in x && state.endCause !== x.cause) throw new Error(`recipe ${r.id}: expected endCause ${x.cause}, the baseline has ${state.endCause}`);
    return raw;
  } finally { await A.close(); }
}

const entryOf = r => {
  const e = { id: r.id, kind: 'generated', file: `fixtures/generated/${r.id}.json`, what: r.what, how: r.how, terminal: /^end:/.test(String(r.expect.dialog)), expect: r.expect };
  if (r.policies) e.policies = r.policies;
  return e;
};

(async () => {
  const args = process.argv.slice(2);
  const check = args.includes('--check');
  const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
  if (check && only) { console.error('--only cannot be combined with --check'); process.exit(2); }
  const build = loadBuild({ kind: 'baseline' });
  const driver = loadDriver('v121');
  const manifest = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) : { fixtures: [] };
  const browser = await chromium.launch();
  const diffs = [];
  let made = 0;
  try {
    for (const r of RECIPES) {
      if (only && r.id.indexOf(only) < 0) continue;
      const raw = await make(browser, r, build, driver);
      const file = `fixtures/generated/${r.id}.json`;
      const sha = crypto.createHash('sha256').update(raw).digest('hex').slice(0, 12);
      if (check) {
        const on = fs.existsSync(path.join(DIR, file)) ? readRaw(file) : null;
        if (on !== raw) diffs.push(`${file}: ${on === null ? 'missing' : 'differs from what the baseline writes now'}`);
        const e = manifest.fixtures.find(f => f.id === r.id);
        if (JSON.stringify(e) !== JSON.stringify(entryOf(r))) diffs.push(`manifest entry ${r.id}: ${e ? 'differs from the recipe' : 'missing'}`);
      } else writeRaw(file, raw);
      made++;
      console.log(`  ${check ? 'checked' : 'wrote  '} ${r.id.padEnd(24)} ${String(raw.length).padStart(6)} bytes  sha256 ${sha}`);
    }
  } finally { await browser.close(); }

  if (check) {
    const ids = new Set(RECIPES.map(r => r.id));
    for (const f of manifest.fixtures) if (f.kind === 'generated' && !ids.has(f.id)) diffs.push(`manifest entry ${f.id}: is "generated" but has no recipe`);
    if (diffs.length) { console.error(`\nFIXTURES OUT OF DATE (${diffs.length}):\n  ` + diffs.join('\n  ') + '\n  run: node test/saves/generate.cjs'); process.exit(1); }
    console.log(`\n${made} generated fixtures are exactly what the baseline writes.`);
    return;
  }
  // Generated entries first, in recipe order; the hand-written ones stay as they are.
  const mine = new Map(RECIPES.map(r => [r.id, entryOf(r)]));
  const kept = manifest.fixtures.filter(f => f.kind !== 'generated');
  const gen = RECIPES.map(r => (only && r.id.indexOf(only) < 0 ? manifest.fixtures.find(f => f.id === r.id) : mine.get(r.id))).filter(Boolean);
  const out = { about: 'Save fixtures for test/saves/run.cjs. "generated" entries are rewritten by test/saves/generate.cjs (edit the recipe there); "legacy" entries and their files are hand-written (edit them here).', fixtures: gen.concat(kept) };
  fs.writeFileSync(MANIFEST, JSON.stringify(out, null, 1) + '\n');
  console.log(`\nwrote ${made} fixture(s) and test/saves/manifest.json (${gen.length} generated, ${kept.length} hand-written entries).`);
})().catch(e => { console.error(e && e.stack || e); process.exit(2); });
