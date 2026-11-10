'use strict';
/*
 * Turning options into a list of sessions, running them on a small pool of A/B pairs, and adding up the result.
 * run.cjs (the CLI) and selftest.cjs both go through runAll().
 */
const path = require('path');
const { chromium } = require('playwright');
const { loadBuild, REPO } = require('./serve.cjs');
const { loadDriver } = require('../drivers/interface.cjs');
const { runSession, formatFailure, fnv } = require('./runner.cjs');
const { Census, FLOORS, ORGANIC_FLOORS, SOUND_FLOORS } = require('./census.cjs');
const { POLICY_NAMES } = require('./policies.cjs');
const { SCENARIOS } = require('./scenarios.cjs');

const SCENARIO_CHUNK = 40;

const DEFAULTS = {
  quick: { seeds: 2, maxMoves: 260 },
  full: { seeds: 14, maxMoves: 420 }
};

const fxLabel = fx => (fx.mode === 'const' ? String(fx.value) : 'seeded');
const parseFx = v => (v === undefined || v === 'seeded' ? { mode: 'seeded', seed: 0x7e57f00d } : { mode: 'const', value: Number(v) });

/*
 * opts (all optional):
 *   a, b            build specs for serve.loadBuild; default A = the baseline, B = ./index.html
 *   aDriver, bDriver   driver names (default 'v121')
 *   full            long run set
 *   seeds, from, maxMoves, policies[]   the policy sessions
 *   scenarios       true (default) | false | 'substring'   the scripted sessions
 *   motion          'mix' (default) | 'full' | 'reduce'
 *   fx              { mode, ... } the cosmetic stream (default seeded)
 *   sound           compare sound traces as well
 *   workers         A/B pairs in flight (default 1, which is two browser pages)
 *   maxFailures     stop starting sessions after this many failures (default 3)
 *   floors          'auto' (default: enforce when the run set is the standard one) | true | false
 *   seedOffsetB, flavorB, fxB           selftest: deliberately different dice / flavor / cosmetic stream for B
 *   log(line)       progress output (default: none)
 *   reproFlags      extra flags to append to reproduce commands
 */
async function runAll(opts) {
  opts = opts || {};
  const t0 = Date.now();
  const say = opts.log || (() => {});
  const mode = opts.full ? DEFAULTS.full : DEFAULTS.quick;
  const buildA = loadBuild(opts.a || { kind: 'baseline' });
  const buildB = loadBuild(opts.b || { kind: 'file', file: path.join(REPO, 'index.html') });
  const driverA = loadDriver(opts.aDriver || 'v121');
  const driverB = loadDriver(opts.bDriver || 'v121');
  const fx = opts.fx || parseFx('seeded');
  const motionOpt = opts.motion || 'mix';
  const seeds = opts.seeds === undefined ? mode.seeds : opts.seeds;
  const from = opts.from === undefined ? 1 : opts.from;
  const maxMoves = opts.maxMoves === undefined ? mode.maxMoves : opts.maxMoves;
  const policies = opts.policies && opts.policies.length ? opts.policies : POLICY_NAMES;
  for (const p of policies) if (!POLICY_NAMES.includes(p)) throw new Error(`unknown policy ${p}. policies: ${POLICY_NAMES.join(', ')}`);
  const motionFor = n => (motionOpt === 'mix' ? (n % 2 ? 'reduce' : 'full') : motionOpt);
  const flags = (opts.reproFlags || '') + (opts.sound ? ' --sound' : '') + (fx.mode === 'const' ? ` --fx ${fx.value}` : opts.sound ? ' --fx seeded' : '');

  /* ---- the plan ---- */
  const sessions = [];
  const wantScenarios = opts.scenarios === undefined ? true : opts.scenarios;
  let scenarioList = [];
  if (wantScenarios) {
    scenarioList = typeof wantScenarios === 'string' ? SCENARIOS.filter(s => s.name.indexOf(wantScenarios) >= 0) : SCENARIOS;
    if (!scenarioList.length) throw new Error(`no scenario matches ${JSON.stringify(wantScenarios)}`);
    // In --full the whole suite runs under both motion settings; otherwise chunks alternate.
    const motions = motionOpt === 'mix' ? (opts.full ? ['full', 'reduce'] : [null]) : [motionOpt];
    for (const m of motions) {
      for (let i = 0, c = 0; i < scenarioList.length; i += SCENARIO_CHUNK, c++) {
        const chunk = scenarioList.slice(i, i + SCENARIO_CHUNK);
        const motion = m || motionFor(c);
        const id = `scenarios[${c}]/${motion}`;
        sessions.push({
          id, kind: 'scenario', seed: fnv('dice:' + id), policy: null, scenarios: chunk, maxMoves: 100000, motion, fx,
          repro: (step, name) => `node test/parity/run.cjs --scenario '${name || chunk[0].name}' --motion ${motion}${flags}`
        });
      }
    }
  }
  if (typeof wantScenarios !== 'string' || (opts.policies && opts.policies.length)) {
    for (let s = from; s < from + seeds; s++) {
      for (const p of policies) {
        const motion = motionFor(s);
        const id = `${p}#${s}`;
        sessions.push({
          id, kind: 'policy', seed: fnv('dice:' + id), policy: p, scenarios: null, maxMoves, motion, fx,
          repro: step => `node test/parity/run.cjs --no-scenarios --policy ${p} --from ${s} --seeds 1 --max-moves ${step} --motion ${motion}${flags}`
        });
      }
    }
  }

  const env = { buildA, buildB, driverA, driverB, sound: !!opts.sound, roundMs: opts.roundMs, maxRounds: opts.maxRounds,
    seedOffsetB: opts.seedOffsetB, flavorB: opts.flavorB, fxB: opts.fxB };

  /* ---- the pool ---- */
  const browser = await chromium.launch();
  const census = new Census(), organic = new Census();
  const failures = [], done = [];
  const scenarioEnds = {};
  const notes = { earlyA: null, earlyB: null, fontsB: 0, fontsA: 0, flavorA: 0, flavorB: 0 };
  let next = 0, steps = 0, draws = 0;
  const maxFailures = opts.maxFailures === undefined ? 3 : opts.maxFailures;
  const lane = async () => {
    for (;;) {
      if (failures.length >= maxFailures) return;
      const spec = sessions[next++];
      if (!spec) return;
      const r = await runSession(browser, spec, env);
      done.push(r);
      steps += r.steps; draws += r.draws;
      census.merge(r.census);
      if (spec.kind === 'policy') organic.merge(r.census);
      Object.assign(scenarioEnds, r.scenarioEnds);
      if (r.notes.earlyA && !notes.earlyA) { notes.earlyA = r.notes.earlyA; notes.earlyB = r.notes.earlyB; }
      if (r.notes.net) { notes.fontsA += r.notes.net.A.fonts; notes.fontsB += r.notes.net.B.fonts; }
      if (r.notes.flavorCalls) { notes.flavorA += r.notes.flavorCalls[0]; notes.flavorB += r.notes.flavorCalls[1]; }
      if (r.failure) failures.push(r.failure);
      say(`  ${r.ok ? 'ok  ' : 'FAIL'} ${spec.id.padEnd(26)} ${String(r.steps).padStart(5)} steps ${String(r.ms).padStart(6)} ms${r.ok ? '' : '   [' + r.failure.kind + '] step ' + r.failure.step + ' ' + r.failure.move}`);
    }
  };
  try {
    await Promise.all(Array.from({ length: Math.max(1, opts.workers || 1) }, lane));
  } finally {
    await browser.close();
  }

  /* ---- checks on the run set as a whole ---- */
  const problems = [];      // things that fail the run without being a divergence between A and B
  // Probe pairs: the two sides of a threshold must have ended differently in the baseline.
  const groups = {};
  for (const sc of scenarioList) if (sc.probe) (groups[sc.probe[0]] = groups[sc.probe[0]] || {})[sc.probe[1]] = sc.name;
  let probes = 0;
  for (const g of Object.keys(groups)) {
    const lo = scenarioEnds[groups[g].lo], hi = scenarioEnds[groups[g].hi];
    if (lo === undefined || hi === undefined) continue;     // not run (a failure stopped the suite, or a filter)
    probes++;
    if (lo === hi) problems.push(`probe ${g}: the baseline ended in the same state on both sides of the threshold, so the scripted draw is not on the roll it was aimed at`);
  }
  // Floors.
  const standard = opts.scenarios === undefined && !(opts.policies && opts.policies.length) && opts.seeds === undefined && opts.from === undefined && opts.maxMoves === undefined;
  const enforce = opts.floors === true || (opts.floors !== false && (standard || opts.floors === 'force') && !failures.length);
  let unmet = [];
  if (enforce) {
    const floors = Object.assign({}, FLOORS);
    // a build that withholds a move under a benign rule cannot be asked to make it
    if (driverB.benign.includes('recharge-when-rested')) delete floors['act.recharge.again'];
    unmet = census.unmet(floors).map(u => Object.assign(u, { set: 'all sessions' }));
    if (opts.full) unmet = unmet.concat(organic.unmet(ORGANIC_FLOORS).map(u => Object.assign(u, { set: 'policy sessions only' })));
    if (opts.sound) unmet = unmet.concat(census.unmet(SOUND_FLOORS).map(u => Object.assign(u, { set: 'sound' })));
    if (opts.flavorB === undefined && (notes.flavorA === 0 || notes.flavorB === 0)) problems.push(`the pinned clAInk flavor stream was never read (A ${notes.flavorA} calls, B ${notes.flavorB}): token fields were compared vacuously`);
  }
  if (steps === 0 && !failures.length) problems.push('no step was compared');

  return {
    ok: !failures.length && !problems.length && !unmet.length,
    failures, problems, unmet, enforce,
    sessions: done.length, planned: sessions.length, steps, draws, probes, scenarios: scenarioList.length,
    census, organic, notes, ms: Date.now() - t0,
    builds: { A: buildA.label, B: buildB.label, shaA: buildA.sha256, shaB: buildB.sha256 }, fx: fxLabel(fx), sound: !!opts.sound, motion: motionOpt
  };
}

function printSummary(r, out) {
  out = out || console.log;
  for (const f of r.failures) { out(''); out(formatFailure(f)); }
  for (const p of r.problems) { out(''); out('PROBLEM  ' + p); }
  if (r.unmet.length) {
    out('');
    out(`UNMET CENSUS FLOORS (${r.unmet.length})`);
    for (const u of r.unmet) out(`  ${u.key.padEnd(30)} needed ${u.need}, got ${u.got}   (${u.set})`);
  }
  out('');
  out(`${r.ok ? 'PASS' : 'FAIL'}  A = ${r.builds.A}   B = ${r.builds.B} (sha256 ${r.builds.shaB.slice(0, 12)})   fx ${r.fx}   motion ${r.motion}${r.sound ? '   sound traces compared' : ''}`);
  out(`  ${r.sessions}/${r.planned} sessions, ${r.steps} steps compared, ${r.draws} mechanical draws compared, ${r.scenarios} scripted scenarios (${r.probes} threshold probes), ${(r.ms / 1000).toFixed(1)} s`);
  if (r.notes.earlyA) {
    out(`  draws before the first reset: A ${r.notes.earlyA.draws}, B ${r.notes.earlyB.draws}   (B: ${r.notes.earlyB.by.map(s => s.replace(/^at /, '').slice(0, 60)).join(' ; ') || 'none'})`);
  }
  out(`  Google Fonts requests answered with an empty body: A ${r.notes.fontsA}, B ${r.notes.fontsB}.  Pinned clAInk flavor stream read ${r.notes.flavorA} times in A, ${r.notes.flavorB} in B.`);
  out(`  census floors: ${r.enforce ? (r.unmet.length ? r.unmet.length + ' UNMET' : 'all met') : 'not enforced for this run set'}`);
}

module.exports = { runAll, printSummary, parseFx, fxLabel, DEFAULTS };
