#!/usr/bin/env node
'use strict';
/*
 * Save compatibility: every save a player could have, loaded in the frozen v1.21 baseline (A) and in a build (B).
 *
 *   node test/saves/run.cjs --b <build.html> [options]
 *
 *   --a self            A is build B too. v2.1 changes rules on purpose, so after a save has loaded it no longer
 *                       plays move for move as v1.21 would; what is still checked for every fixture and way in is
 *                       that it loads without an error, shows the dialog and the clAInk window the manifest names,
 *                       meets the manifest's state expectations, and can be played on (the build against itself:
 *                       two pages given the same save and the same presses end in the same place). What a legacy
 *                       save turns into, field by field, is the engine tests' business (test/engine).

 *   --b <path>          the build under test (default ./index.html). "--b baseline": the baseline against itself,
 *                       which must always pass
 *   --b-driver <name>   driver for build B (default next; test/parity/drivers/interface.cjs)
 *   --only <text>       only the fixtures whose id contains <text>
 *   --moves <n>         moves played after loading a save that is not a finished run (default 30)
 *   --workers <w>       A/B pairs played at the same time (default 1)
 *   --mutant <name>     B is the baseline with one deliberate change to how it loads saves (names: --list-mutants).
 *                       This must FAIL
 *   --selftest          every mutant, each against the fixtures written to catch it: all must be caught
 *   --list              print the fixtures and stop
 *   --json <file>       also write a machine-readable summary
 *
 * For every fixture in test/saves/manifest.json, and both ways a save gets into the game
 *     page load     the save is the autosave when the page opens
 *     Load button   a run is already on screen; the save is under the manual-save key and Load is pressed
 * the two builds are put side by side by the parity runner (test/parity/lib/runner.cjs), which fails on the first
 * difference. That gives, per fixture and way in:
 *   (a) load-equivalence      the normalised state after the load is the same, field by field
 *   (b) continue-equivalence  a save that is not a finished run is then played for 30 seeded moves, in parity at
 *                             every move (state, draws, dialog, legal moves). A finished run is reloaded (the
 *                             ending must survive it) and then New Run must start a fresh game
 *   (c) render sanity         the dialog and the clAInk dock the manifest names are what both builds show, and
 *                             neither page logged an error, threw, or asked the network for anything
 *   (d) both ways in          as above. (A localStorage-image fixture has one way in; see lib/fixtures.cjs)
 *
 * Exit code: 0 all fixtures hold; 1 a difference or a failed expectation; 2 bad usage or a broken fixture.
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { loadBuild } = require('../parity/lib/serve.cjs');
const { loadDriver, requireE2E } = require('../parity/drivers/interface.cjs');
const { runSession, formatFailure, fnv } = require('../parity/lib/runner.cjs');
const { parseFx } = require('../parity/lib/plan.cjs');
const { POLICY_NAMES } = require('../parity/lib/policies.cjs');
const { KEYS, readRaw, loadManifest, toRunnerExpect } = require('./lib/fixtures.cjs');
const { MUTANTS } = require('./mutants.cjs');

function parseArgs(argv) {
  const o = { moves: 30, workers: 1 };
  const need = (i, flag) => { if (i >= argv.length) { console.error(`${flag} needs a value`); process.exit(2); } return argv[i]; };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--a') { const v = need(++i, a); if (v !== 'self') { console.error('--a takes only "self"'); process.exit(2); } o.a = 'self'; }
    else if (a === '--b') { const v = need(++i, a); o.b = v === 'baseline' ? { kind: 'baseline' } : { kind: 'file', file: path.resolve(v) }; }
    else if (a === '--b-driver') o.bDriver = need(++i, a);
    else if (a === '--only') o.only = need(++i, a);
    else if (a === '--moves') o.moves = Number(need(++i, a));
    else if (a === '--workers') o.workers = Number(need(++i, a));
    else if (a === '--mutant') o.mutant = need(++i, a);
    else if (a === '--selftest') o.selftest = true;
    else if (a === '--list') o.list = true;
    else if (a === '--list-mutants') o.listMutants = true;
    else if (a === '--json') o.json = need(++i, a);
    else if (a === '--help' || a === '-h') { console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0].replace(/^#!.*\n'use strict';\n\/\*\n?/, '').replace(/^ \* ?/gm, '')); process.exit(0); }
    else { console.error(`unknown option ${a} (try --help)`); process.exit(2); }
  }
  for (const k of ['moves', 'workers']) if (!(Number.isInteger(o[k]) && o[k] >= 0)) { console.error(`--${k} needs a whole number`); process.exit(2); }
  return o;
}

// The sessions one fixture is tested with: one per way in.
function sessionsFor(f, moves, n, now) {
  const x = toRunnerExpect(f.expect, now);
  // `said` (which line the announcer was asked for) can only be checked through the Load button: on a page load
  // the sound engine is still locked, as it is in a real browser before the first key or click, and says nothing.
  const xPage = Object.assign({}, x); delete xPage.said;
  const policies = f.policies || ['funnel', 'coffee'];
  for (const p of policies) if (!POLICY_NAMES.includes(p)) throw new Error(`fixture ${f.id}: unknown policy ${p}`);
  // A finished run: the ending is still there after a reload, and New Run starts a fresh game.
  const afterEnding = [{ m: 'reload', x: { dialog: f.expect.dialog } }, { m: 'newrun', x: { dialog: null, state: s => s.week === 1 && s.cash === 1200 && s.closedWon === 0 } }];
  const base = (way, k) => ({
    fixture: f.id, way, id: `${f.id} / ${way}`, seed: fnv('saves:' + f.id + ':' + way), motion: (n + k) % 2 ? 'reduce' : 'full', fx: parseFx('seeded'),
    // an ending's cutscene is only played to the end where the announcer's line is what is being checked
    playEndings: !!(x.said && way === 'Load button'),
    repro: () => `node test/saves/run.cjs --only ${f.id}`
  });
  const out = [];
  const storage = f.storage ? Object.fromEntries(Object.keys(f.storage).map(k => [k, readRaw(f.storage[k])])) : { [KEYS.autosave]: readRaw(f.file) };
  out.push(Object.assign(base('page load', 0), {
    startStorage: storage, expectOnLoad: xPage,
    policy: f.terminal ? null : policies[0], maxMoves: f.terminal ? afterEnding.length : moves,
    scenarios: f.terminal ? [{ name: f.id, steps: afterEnding }] : null
  }));
  if (f.file) {
    out.push(Object.assign(base('Load button', 1), {
      policy: f.terminal ? null : policies[1 % policies.length], maxMoves: 1 + (f.terminal ? afterEnding.length : moves),
      scenarios: [{ name: f.id, storage: { [KEYS.manual]: readRaw(f.file) }, onLoad: x, steps: f.terminal ? afterEnding : [] }]
    }));
  }
  return out;
}

/*
 * Runs the fixtures against one build B. Resolves to { ok, rows, failures, steps, sessions, ms }.
 * opts: b (build spec), bDriver, only (substring or array of exact ids), moves, workers, log
 */
async function runSaves(opts) {
  const t0 = Date.now();
  const say = opts.log || (() => {});
  const manifest = loadManifest();
  const pickFixture = f => !opts.only || (Array.isArray(opts.only) ? opts.only.includes(f.id) : f.id.indexOf(opts.only) >= 0);
  // skipNow (manifest): a fixture whose contract with v1.21 the current build deliberately no longer keeps, with
  // the reason and where it is tested instead. It is left out of the build-against-itself run and named in the output.
  const skipped = opts.a === 'self' ? manifest.fixtures.filter(f => f.skipNow && pickFixture(f)) : [];
  for (const f of skipped) say(`  skip ${f.id}: ${f.skipNow}`);
  const fixtures = manifest.fixtures.filter(pickFixture).filter(f => !skipped.includes(f));
  if (!fixtures.length) throw new Error(`no fixture matches ${JSON.stringify(opts.only)}`);
  const buildB = loadBuild(opts.b || { kind: 'file', file: path.resolve(__dirname, '..', '..', 'index.html') });
  const buildA = opts.a === 'self' ? buildB : loadBuild({ kind: 'baseline' });
  // the baseline's driver must know the dock; B's too, or "the right dock state is showing" would be vacuous
  const driverB = requireE2E(loadDriver(opts.bDriver || (opts.b && opts.b.kind === 'baseline' ? 'v121' : 'next')));
  const driverA = opts.a === 'self' ? driverB : requireE2E(loadDriver('v121'));
  const env = { buildA, buildB, driverA, driverB, sound: false, self: opts.a === 'self' };
  const sessions = [];
  fixtures.forEach((f, n) => { for (const s of sessionsFor(f, opts.moves === undefined ? 30 : opts.moves, n, opts.a === 'self')) sessions.push(s); });

  const browser = await chromium.launch();
  const rows = [], failures = [];
  let next = 0, steps = 0;
  const lane = async () => {
    for (;;) {
      if (opts.stopAtFirst && failures.length) return;
      const spec = sessions[next++];
      if (!spec) return;
      const r = await runSession(browser, spec, env);
      steps += r.steps;
      rows.push({ fixture: spec.fixture, way: spec.way, ok: r.ok, steps: r.steps, ms: r.ms, kind: r.failure ? r.failure.kind : null, at: r.failure ? `step ${r.failure.step} ${r.failure.move}` : '' });
      if (r.failure) failures.push(r.failure);
      say(`  ${r.ok ? 'ok  ' : 'FAIL'} ${spec.id.padEnd(42)} ${String(r.steps).padStart(3)} moves ${String(r.ms).padStart(6)} ms${r.ok ? '' : '   [' + r.failure.kind + '] ' + (r.failure.step < 0 ? 'on load' : 'step ' + r.failure.step + ' ' + r.failure.move)}`);
    }
  };
  try { await Promise.all(Array.from({ length: Math.max(1, opts.workers || 1) }, lane)); } finally { await browser.close(); }
  return { ok: !failures.length, rows, failures, steps, sessions: rows.length, planned: sessions.length, fixtures: fixtures.length,
    builds: { A: buildA.label, B: buildB.label, shaB: buildB.sha256 }, ms: Date.now() - t0 };
}

// Every mutant against the fixtures written to catch it. A mutant that survives means the test cannot fail there.
async function selftest(opts) {
  let ok = true;
  const t0 = Date.now();
  console.log('save-compatibility selftest: the baseline against a baseline that loads saves wrongly; each must be caught\n');
  for (const m of MUTANTS) {
    const r = await runSaves({ b: { kind: 'baseline', mutant: m }, only: m.caughtBy, moves: 4, workers: opts.workers, stopAtFirst: true });
    const f = r.failures[0];
    // caught means: by a difference the test is there to see, not by the harness falling over
    const caught = !!f && f.kind !== 'harness';
    ok = ok && caught;
    console.log(`  ${caught ? 'ok  ' : 'FAIL'} ${m.name.padEnd(24)} ${m.what}`);
    console.log(`         ${f ? `caught by ${f.session}: [${f.kind}] ${(f.lines[0] || '').slice(0, 150)}${f.diffs[0] ? ' (' + f.diffs[0].path + ')' : ''}` : 'NOT CAUGHT by ' + m.caughtBy.join(', ')}`);
  }
  console.log(`\n${ok ? 'SAVES SELFTEST OK' : 'SAVES SELFTEST FAILED'}: ${MUTANTS.length} mutants, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  return ok;
}

if (require.main === module) (async () => {
  const o = parseArgs(process.argv.slice(2));
  if (o.listMutants) { for (const m of MUTANTS) console.log(`${m.name.padEnd(24)} ${m.what}   (caught by: ${m.caughtBy.join(', ')})`); return; }
  if (o.list) {
    for (const f of loadManifest().fixtures) console.log(`${f.id.padEnd(30)} ${f.kind.padEnd(9)} ${f.terminal ? 'finished' : 'live    '}  ${f.what}`);
    return;
  }
  if (o.selftest) { process.exit((await selftest(o)) ? 0 : 1); }
  if (o.mutant) {
    const m = MUTANTS.find(x => x.name === o.mutant);
    if (!m) { console.error(`unknown mutant ${o.mutant}. mutants: ${MUTANTS.map(x => x.name).join(', ')}`); process.exit(2); }
    o.b = { kind: 'baseline', mutant: m };
  }
  console.log('save compatibility: every fixture, loaded on page load and through the Load button, ' + (o.a === 'self' ? 'the build against itself and the manifest' : 'baseline vs build'));
  const r = await runSaves(Object.assign({}, o, { log: line => console.log(line) }));
  for (const f of r.failures) { console.log(''); console.log(formatFailure(f).replace(/^PARITY FAILURE/, 'SAVE FAILURE')); }
  const bad = r.rows.filter(x => !x.ok);
  console.log('');
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  A = ${r.builds.A}   B = ${r.builds.B} (sha256 ${r.builds.shaB.slice(0, 12)})`);
  console.log(`  ${r.fixtures} fixtures, ${r.sessions}/${r.planned} loads (${r.rows.filter(x => x.way === 'page load').length} on page load, ${r.rows.filter(x => x.way === 'Load button').length} through the Load button), ${r.steps} moves compared after loading, ${(r.ms / 1000).toFixed(1)} s`);
  if (bad.length) console.log(`  failed: ${bad.map(x => `${x.fixture} (${x.way})`).join(', ')}`);
  console.log(`\n${r.ok ? 'SAVES OK' : 'SAVES FAILED'} in ${(r.ms / 1000).toFixed(1)} s`);
  if (o.json) fs.writeFileSync(o.json, JSON.stringify({ ok: r.ok, seconds: r.ms / 1000, fixtures: r.fixtures, sessions: r.sessions, steps: r.steps, rows: r.rows, failures: r.failures }, null, 1));
  process.exit(r.ok ? 0 : 1);
})().catch(e => { console.error(e && e.stack || e); process.exit(2); });

module.exports = { runSaves, sessionsFor };
