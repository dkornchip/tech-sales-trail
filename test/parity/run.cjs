#!/usr/bin/env node
'use strict';
/*
 * Mechanics parity: prove that build B plays exactly like the frozen v1.21 baseline.
 *
 *   node test/parity/run.cjs [options]
 *
 *   --b <path>          the build under test (default ./index.html). "--b baseline" plays the baseline against
 *                       itself, which must always pass
 *   --mutant <name>     play the baseline against the baseline with one deliberate change to its game logic
 *                       (names: test/parity/lib/mutants.cjs); this must always FAIL
 *   --a-driver <name>   driver for the baseline (default v121)
 *   --b-driver <name>   driver for build B (default next, the v2.0 markup; v121 when B is the baseline itself;
 *                       see test/parity/drivers/interface.cjs)
 *   --full              the long run set: more seeds, longer sessions, the scripted suite under both motion
 *                       settings, and floors on what the policy sessions reach on their own
 *   --seeds <n>         seeds per policy (default 2, or 14 with --full)
 *   --from <s>          first seed (default 1)
 *   --policy <a,b>      only these policies (funnel chaos coffee rider canceller dismisser miser politician neglecter)
 *   --max-moves <m>     moves per policy session (default 260, or 420 with --full)
 *   --workers <w>       A/B pairs played at the same time (default 1; each pair is two browser pages)
 *   --sound             also require identical sound intents; plays the run set three times, with the cosmetic
 *                       stream pinned to 0, pinned to 0.99, and seeded
 *   --fx <v>            the cosmetic stream for a single pass: "seeded" or a number such as 0 or 0.99
 *   --motion <m>        mix (default: sessions alternate), full, or reduce (prefers-reduced-motion)
 *   --scenario <text>   only the scripted scenarios whose name contains <text> (and no policy sessions)
 *   --no-scenarios      skip the scripted scenarios
 *   --no-floors         do not enforce census floors
 *   --strict-network    fail if build B requests anything but its own document (Google Fonts are otherwise
 *                       answered with an empty body and only counted)
 *   --strict-logs       also require identical log lines (text and kind) at every step: for refactors that must not
 *                       change a word. Off by default, since the rewrite changes the log on purpose
 *   --strict-text       also require identical visible page text at every step (same use)
 *   --census            print the full census table
 *   --json <file>       also write a machine-readable summary
 *
 * Exit code: 0 identical; 1 a divergence, an unmet census floor or a broken scenario; 2 bad usage.
 */
const fs = require('fs');
const path = require('path');
const { runAll, printSummary, parseFx } = require('./lib/plan.cjs');

function parseArgs(argv) {
  const o = { policies: [] };
  const need = (i, flag) => { if (i >= argv.length) { console.error(`${flag} needs a value`); process.exit(2); } return argv[i]; };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--b') { const v = need(++i, a); o.b = v === 'baseline' ? { kind: 'baseline' } : { kind: 'file', file: path.resolve(v) }; }
    else if (a === '--mutant') o.mutant = need(++i, a);
    else if (a === '--a-driver') o.aDriver = need(++i, a);
    else if (a === '--b-driver') o.bDriver = need(++i, a);
    else if (a === '--full') o.full = true;
    else if (a === '--seeds') o.seeds = Number(need(++i, a));
    else if (a === '--from') o.from = Number(need(++i, a));
    else if (a === '--policy') o.policies = need(++i, a).split(',').filter(Boolean);
    else if (a === '--max-moves') o.maxMoves = Number(need(++i, a));
    else if (a === '--workers') o.workers = Number(need(++i, a));
    else if (a === '--sound') o.sound = true;
    else if (a === '--fx') o.fxArg = need(++i, a);
    else if (a === '--motion') o.motion = need(++i, a);
    else if (a === '--scenario') o.scenarios = need(++i, a);
    else if (a === '--no-scenarios') o.scenarios = false;
    else if (a === '--no-floors') o.floors = false;
    else if (a === '--strict-network') o.strictNetwork = true;
    else if (a === '--strict-logs') o.strictLogs = true;
    else if (a === '--strict-text') o.strictText = true;
    else if (a === '--census') o.showCensus = true;
    else if (a === '--json') o.json = need(++i, a);
    else if (a === '--help' || a === '-h') { console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0].replace(/^#!.*\n'use strict';\n\/\*\n?/, '').replace(/^ \* ?/gm, '')); process.exit(0); }
    else { console.error(`unknown option ${a} (try --help)`); process.exit(2); }
  }
  for (const k of ['seeds', 'from', 'maxMoves', 'workers']) if (o[k] !== undefined && !(Number.isInteger(o[k]) && o[k] >= 0)) { console.error(`--${k} needs a whole number`); process.exit(2); }
  if (o.motion && !['mix', 'full', 'reduce'].includes(o.motion)) { console.error('--motion is mix, full or reduce'); process.exit(2); }
  if (o.fxArg !== undefined && o.fxArg !== 'seeded' && !(Number(o.fxArg) >= 0 && Number(o.fxArg) < 1)) { console.error('--fx is "seeded" or a number in [0, 1)'); process.exit(2); }
  return o;
}

(async () => {
  const o = parseArgs(process.argv.slice(2));
  if (o.mutant) {
    const m = require('./lib/mutants.cjs').MUTANTS.find(x => x.name === o.mutant);
    if (!m) { console.error(`unknown mutant ${o.mutant}. mutants: ${require('./lib/mutants.cjs').MUTANTS.map(x => x.name).join(', ')}`); process.exit(2); }
    o.b = { kind: 'baseline', mutant: m };
  }
  const bFlag = o.mutant ? ` --mutant ${o.mutant}` : o.b ? ` --b ${o.b.kind === 'baseline' ? 'baseline' : path.relative(process.cwd(), o.b.file) || o.b.file}` : '';
  const drvFlag = (o.aDriver ? ` --a-driver ${o.aDriver}` : '') + (o.bDriver ? ` --b-driver ${o.bDriver}` : '');
  // --sound without --fx: three passes. Anything else: one pass.
  const passes = o.sound && o.fxArg === undefined ? ['0', '0.99', 'seeded'] : [o.fxArg === undefined ? 'seeded' : o.fxArg];
  const t0 = Date.now();
  let ok = true;
  const summaries = [];
  for (const fxArg of passes) {
    console.log(`parity: ${o.sound ? 'mechanics + sound' : 'mechanics'}, cosmetic stream ${fxArg === 'seeded' ? 'seeded' : 'pinned to ' + fxArg}${o.full ? ', full run set' : ''}`);
    const r = await runAll(Object.assign({}, o, { fx: parseFx(fxArg), log: line => console.log(line), reproFlags: bFlag + drvFlag }));
    if (o.showCensus || !r.ok) { console.log('\ncensus (baseline):'); console.log(r.census.table()); }
    if (o.sound && (o.showCensus || !r.ok)) { console.log('\nsound intents (baseline):'); console.log(r.census.table('sound')); }
    printSummary(r);
    console.log('');
    ok = ok && r.ok;
    summaries.push({ fx: r.fx, ok: r.ok, sessions: r.sessions, steps: r.steps, draws: r.draws, seconds: r.ms / 1000, failures: r.failures, problems: r.problems, unmet: r.unmet,
      census: r.census.counts, organic: r.organic.counts, notes: r.notes, builds: r.builds });
    if (!r.ok) break;
  }
  const seconds = (Date.now() - t0) / 1000;
  console.log(`${ok ? 'PARITY OK' : 'PARITY FAILED'} in ${seconds.toFixed(1)} s`);
  if (o.json) fs.writeFileSync(o.json, JSON.stringify({ ok, seconds, passes: summaries }, null, 1));
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e && e.stack || e); process.exit(2); });
