#!/usr/bin/env node
'use strict';
/*
 * The harness testing itself. A parity harness that passes when it should fail is worse than none, so before it is
 * trusted to compare two builds it has to show that:
 *
 *   1. unit      the normaliser ignores exactly the fields it says it ignores and nothing else; the census text
 *                still matches the baseline; the route-time patches refuse to apply to the wrong text
 *   2. same      the baseline against itself, same seed: identical at every step
 *   3. seed      the baseline against itself with the dice seeded one apart: MUST differ (the seed reaches the dice)
 *   4. cosmetic  the baseline against itself with a different cosmetic stream: identical (the 47 patched draws
 *                really are cosmetic)
 *   5. flavor    the baseline against itself with clAInk's joke stream pinned to a different value: MUST differ,
 *                and only in token counts (the game reads the hook at call time)
 *   6. mutants   the baseline against each deliberately broken copy of itself: every one MUST be caught, by a
 *                difference in state, draws, dialog or legal moves (not by a crash)
 *
 *   node test/parity/selftest.cjs [--only unit,same,seed,cosmetic,flavor,mutants] [--mutant name]
 *
 * Exit code 0 only if every item held.
 */
const fs = require('fs');
const { runAll } = require('./lib/plan.cjs');
const { MUTANTS } = require('./lib/mutants.cjs');
const { normalise, stripAllowed, diff, compareStates } = require('./lib/normalise.cjs');
const { LOG_RULES, plain } = require('./lib/census.cjs');
const serve = require('./lib/serve.cjs');
const { loadDriver, withReload } = require('./drivers/interface.cjs');
const { save, D, SCENARIOS } = require('./lib/scenarios.cjs');
const { pickWeighted, mulberry } = require('./lib/policies.cjs');

const results = [];
const check = (name, ok, detail) => { results.push({ name, ok: !!ok, detail: detail || '' }); console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? '   ' + detail : ''}`); return !!ok; };
const clone = o => JSON.parse(JSON.stringify(o));
const secs = t => ((Date.now() - t) / 1000).toFixed(1) + ' s';

/* ------------------------------------------------------------------ 1. unit tests */
function sampleState() {
  const s = save({
    week: 7, energy: 61, stress: 44, cash: 2345, manager: 48.276250000000005, reputation: 43, product: 57, closedQuarter: 52000, discounts: 1200, meetings: 9,
    pip: true, pipLevel: 1, perfWarnings: 2, coffeesThisWeek: 1, restedThisWeek: true, hygieneShield: true, stressWarned: true, repoWarned: true, trip: 'Whistler',
    modifiers: { conversion: 0.06, discount: 0.2, expiresIn: 1 }, used: { prospect: true, crm: true },
    deals: [D(3, 21000, 'happy', 2, 'roll 44% vs 21%'), D(0, 7000, 'skeptical', 0, 'referral peanut'), D(2, 12000, 'neutral', 1, 'AI-touched')],
    achievements: [{ key: 'whale', label: '🐋 Whale Hunter' }],
    claink: { status: 'active', deployed: true, strikes: 2, claims: 3, due: 669, weekTokens: 2676000, mgr: { noticed: true, yoinks: 1 }, deploys: 4, miracles: 1, fakes: 3,
      incidents: 1, claimed: 91000, delivered: 14000, billed: 3100, lastInvoice: 720, tokens: 12400000,
      strikeLog: [{ n: 1, who: 'Finance', line: 'tokens' }, { n: 2, who: 'Legal', line: 'discount' }],
      last: { kind: 'strike', week: 7, run: 4, tokens: 2676000, revenue: 0, lines: ['Influenced $40,000', 'Booked 3 meetings'], strike: { n: 2, who: 'Legal', why: 'because', fx: '-10 mgr', hurt: true },
        clear: '', farewell: '', ping: 'ChatGDP again?', yoink: true, warn: false, cashWarn: false, announce: 'Two outcomes billed.' } }
  });
  s.logs = [{ id: 'a-1', t: '09:00 AM', msg: '📞 Blitz: +2 lead(s). -30 energy.', kind: 'info' }];
  return s;
}

// Paths whose value is copy or an id: a difference there must NOT be reported.
const EXCLUDED = [/^logs/, /^runId$/, /^deals\[\d+\]\.id$/, /^deals\[\d+\]\.account$/, /^achievements\[\d+\]\.label$/,
  /^claink\.last\.lines\[\d+\]$/, /^claink\.last\.strike\.(who|why|fx)$/, /^claink\.last\.(clear|farewell|ping|announce)$/, /^claink\.strikeLog\[\d+\]\.(who|line)$/];

function leaves(node, at, out) {
  if (Array.isArray(node)) node.forEach((v, i) => leaves(v, `${at}[${i}]`, out));
  else if (node && typeof node === 'object') for (const k of Object.keys(node)) leaves(node[k], at ? `${at}.${k}` : k, out);
  else out.push(at);
  return out;
}
const getAt = (o, p) => p.replace(/\[(\d+)\]/g, '.$1').split('.').reduce((x, k) => x[k], o);
function setAt(o, p, v) { const ks = p.replace(/\[(\d+)\]/g, '.$1').split('.'); const last = ks.pop(); ks.reduce((x, k) => x[k], o)[last] = v; }
// A different value of the same kind (for strings, one the game could actually have written).
function other(path, v) {
  if (typeof v === 'number') return v + 1;
  if (typeof v === 'boolean') return !v;
  if (v === null) return 1;
  if (/probNote$/.test(path)) return v === 'referral whale' ? 'referral big' : 'referral whale';
  if (path === 'trip') return v === 'Dubai' ? 'Japan' : 'Dubai';
  if (/mood$/.test(path)) return v === 'happy' ? 'curious' : 'happy';
  return String(v) + ' (changed)';
}

function unitTests() {
  console.log('\n1. unit tests');
  const canon = loadDriver('v121').canon;
  const base = sampleState();
  const cmp = (a, b, allow) => compareStates(a, b, canon, canon, allow || []);
  check('normaliser: a state equals itself', cmp(base, clone(base)).length === 0);

  const paths = leaves(base, '', []);
  const excluded = paths.filter(p => EXCLUDED.some(r => r.test(p)));
  const included = paths.filter(p => !EXCLUDED.some(r => r.test(p)));
  const leaked = excluded.filter(p => { const b = clone(base); setAt(b, p, other(p, getAt(b, p))); return cmp(base, b).length !== 0; });
  check(`normaliser: a difference in an excluded field passes (${excluded.length} fields)`, excluded.length >= 15 && leaked.length === 0, leaked.length ? 'reported: ' + leaked.join(', ') : '');
  const missed = included.filter(p => { const b = clone(base); setAt(b, p, other(p, getAt(b, p))); return cmp(base, b).length === 0; });
  check(`normaliser: a difference in any included field fails (${included.length} fields)`, included.length >= 80 && missed.length === 0, missed.length ? 'NOT reported: ' + missed.join(', ') : '');

  const structural = {
    'deals in a different order': b => { b.deals.reverse(); },
    'one deal fewer': b => { b.deals.pop(); },
    'one deal more': b => { b.deals.push(D(0, 5000)); },
    'one report line more': b => { b.claink.last.lines.push('x'); },
    'one strike-log entry fewer': b => { b.claink.strikeLog.pop(); },
    'an achievement more': b => { b.achievements.push({ key: 'other', label: 'x' }); },
    'a key missing from B': b => { delete b.hygieneShield; },
    'an unknown top-level key in B': b => { b.story = { seen: {} }; },
    'an unknown key on a deal in B': b => { b.deals[0].tier = 'whale'; },
    'an unknown key in claink.last in B': b => { b.claink.last.more = 2; },
    'claink.last null in B': b => { b.claink.last = null; },
    'manager off by one ulp': b => { const f = new Float64Array([b.manager]); new BigUint64Array(f.buffer)[0] += 1n; b.manager = f[0]; },
    'a number as a string': b => { b.cash = '2345'; },
    'strike.hurt true in A, missing in B': b => { delete b.claink.last.strike.hurt; },
    'probNote the driver cannot classify': b => { b.deals[0].probNote = 'rolled 44 against 21'; },
    'a trip the driver cannot classify': b => { b.trip = 'Ibiza'; }
  };
  for (const name of Object.keys(structural)) { const b = clone(base); structural[name](b); check('normaliser: fails on ' + name, cmp(base, b).length > 0); }

  { const a = clone(base), b = clone(base); a.claink.last.strike.hurt = false; delete b.claink.last.strike.hurt;
    check('normaliser: strike.hurt false and missing are the same (v1.21 writes both)', cmp(a, b).length === 0); }
  { const b = clone(base); b.story = { seen: {} }; b.deals[1].tier = 'peanut';
    check('allowlist: listed additive keys in B pass', cmp(base, b, ['story', 'deals[].tier']).length === 0);
    check('allowlist: an unlisted additive key still fails', cmp(base, b, ['story']).length === 1); }
  { const a = clone(base), b = clone(base); b.deals[0].probNote = 'roll 44% vs 21%'; a.deals[0].probNote = 'roll 44% vs 22%';
    check('normaliser: probNote roll codes carry both numbers', cmp(a, b).length === 1); }
  check('driver v121: probNote codes', ['', 'referral peanut', 'referral big', 'referral whale', 'roll 3% vs 88%', 'AI-touched', 'agent-promised discount'].map(canon.probNote).join(',') === 'empty,peanut,big,whale,roll:3:88,ai,discount');
  check('driver v121: trip codes', [null, 'Japan', 'Dubai'].map(canon.trip).join(',') === ',0,4');
  check('legal moves: reload is added without a dialog and at an ending, never under an event',
    withReload(['end'], null).includes('reload') && withReload(['newrun'], { id: 'end:club', options: 1 }).includes('reload') && !withReload(['dlg:0', 'dlg:1'], { id: 'evt:competitor', options: 2 }).includes('reload'));

  // The census reads the baseline's log text. Every prefix it looks for must still be in the baseline's source.
  const html = fs.readFileSync(serve.BASELINE, 'utf8');
  const source = plain(html);
  const absent = LOG_RULES.filter(([, prefix, inSource]) => source.indexOf(plain(inSource || prefix)) < 0).map(r => r[0]);
  check(`census: all ${LOG_RULES.length} log prefixes occur in the baseline`, absent.length === 0, absent.join(', '));

  // The route-time patches.
  const built = serve.loadBuild({ kind: 'baseline' });
  check('serve: 22 + 25 cosmetic sites patched, none in the shell', built.cosmeticSites.join('+') === '22+25+0' && built.html.split('(window.__TST_FX||Math.random)').length - 1 === 47);
  check('serve: the babel block is the pinned one', built.babelSha256 === serve.BABEL_SHA256);
  const throws = fn => { try { fn(); return false; } catch (_) { return true; } };
  check('serve: a baseline that is not byte-identical to the frozen file is refused', throws(() => serve.patchBaseline(html.replace('energy:30', 'energy:31'), null)));
  check('serve: a patch whose target is missing is an error', throws(() => serve.replaceOnce('abc', 'x', 'y')));
  check('serve: a patch whose target occurs twice is an error', throws(() => serve.replaceOnce('abab', 'ab', 'y')));
  check('serve: a mutant that changes nothing is an error', throws(() => serve.patchBaseline(html, { name: 'noop', apply: s => s })));
  const names = MUTANTS.map(m => m.name);
  const broken = MUTANTS.filter(m => throws(() => serve.loadBuild({ kind: 'baseline', mutant: m }))).map(m => m.name);
  check(`mutants: all ${names.length} patches apply exactly once`, broken.length === 0 && new Set(names).size === names.length, broken.join(', '));
  { const r = mulberry(7); const w = { a: 1, b: 0, c: 3 }; const seen = new Set(); for (let i = 0; i < 200; i++) seen.add(pickWeighted(w, r));
    check('policies: weighted pick never returns a zero-weight move', seen.has('a') && seen.has('c') && !seen.has('b')); }
  check('scenarios: names are unique and every probe has both sides', (() => { const g = {}; for (const s of SCENARIOS) if (s.probe) (g[s.probe[0]] = g[s.probe[0]] || []).push(s.probe[1]); return Object.values(g).every(v => v.sort().join() === 'hi,lo'); })());
}

/* ------------------------------------------------------------------ 2-6. the browser items */
const BASE = { kind: 'baseline' };
const quiet = { log: () => {} };
// The run set the mutants are judged on is the default one of run.cjs (scripted suite first, then the policies).
const QUICK = {};
// A smaller set for the comparisons that are expected to pass.
const SMALL = { seeds: 1, maxMoves: 160, floors: false };

async function same() {
  console.log('\n2. baseline vs baseline, same seed');
  const t = Date.now();
  const r = await runAll(Object.assign({ b: BASE }, SMALL, quiet));
  check('identical at every step', r.ok && r.steps > 1500, `${r.steps} steps, ${r.draws} draws, ${r.sessions} sessions, ${secs(t)}${r.failures[0] ? '   first failure: [' + r.failures[0].kind + '] ' + r.failures[0].session + ' step ' + r.failures[0].step + ' ' + r.failures[0].lines.join(' ') : ''}${r.problems.join(' ; ')}`);
}

async function seed() {
  console.log('\n3. baseline vs baseline, dice seeded one apart');
  const t = Date.now();
  const r = await runAll(Object.assign({ b: BASE, seedOffsetB: 1, scenarios: false, policies: ['funnel', 'chaos'], maxFailures: 2 }, SMALL, quiet));
  const kinds = r.failures.map(f => f.kind);
  check('every session diverges, in state or in draws', r.failures.length === 2 && kinds.every(k => k === 'state' || k === 'draws'),
    r.failures.map(f => `${f.session} step ${f.step} [${f.kind}]`).join(', ') + `   ${secs(t)}`);
  // (most scripted moves are answered entirely from their queue; this scenario has no queue at all)
  const s = await runAll(Object.assign({ b: BASE, seedOffsetB: 1, scenarios: 'unscripted-moves', maxFailures: 1 }, quiet));
  check('a scripted scenario diverges too (the stream behind the scripted queue is seeded)', s.failures.length === 1 && ['state', 'draws'].includes(s.failures[0].kind), s.failures.map(f => `${f.scenario} step ${f.step} [${f.kind}]`).join(', '));
}

async function cosmetic() {
  console.log('\n4. baseline vs baseline, different cosmetic stream');
  const t = Date.now();
  for (const [label, fxB] of [['pinned to 0', { mode: 'const', value: 0 }], ['pinned to 0.99', { mode: 'const', value: 0.99 }], ['a different seed', { mode: 'seeded', seed: 12345 }]]) {
    const r = await runAll(Object.assign({ b: BASE, fxB, scenarios: 'ck-', policies: ['rider', 'coffee'] }, SMALL, quiet));
    check(`mechanics identical with B's cosmetic stream ${label}`, r.ok && r.steps > 300, `${r.steps} steps${r.failures[0] ? '   [' + r.failures[0].kind + '] ' + r.failures[0].session + ' step ' + r.failures[0].step : ''}`);
  }
  console.log(`  (${secs(t)})`);
}

async function flavor() {
  console.log('\n5. baseline vs baseline, clAInk flavor stream pinned to 0.5 in A and 0.25 in B');
  const r = await runAll(Object.assign({ b: BASE, flavorB: 0.25, scenarios: 'ck-strike-clean', maxFailures: 1 }, quiet));
  const f = r.failures[0];
  const paths = f ? f.diffs.map(d => d.path) : [];
  check('the run diverges, and only in token counts', !!f && f.kind === 'state' && paths.length > 0 && paths.every(p => /tokens$/i.test(p)), f ? `step ${f.step} ${f.move}: ${paths.join(', ')}` : 'no divergence: the game is not reading TST_CLAINK.flavor at call time');
}

async function mutants(only) {
  console.log('\n6. mutants (baseline vs a deliberately broken baseline; each must be caught)');
  const rows = [];
  for (const m of MUTANTS) {
    if (only && m.name !== only) continue;
    const t = Date.now();
    const b = { kind: 'baseline', mutant: m };
    // (a) the default run set, stopping at the first divergence
    const r = await runAll(Object.assign({ b, maxFailures: 1 }, QUICK, quiet));
    const f = r.failures[0];
    const caught = !!f && ['state', 'draws', 'dialog', 'legal'].includes(f.kind);
    const where = f ? `${f.scenario ? 'scenario ' + f.scenario : f.session}, step ${f.step} (${f.move}), ${f.kind}${f.diffs[0] ? ': ' + f.diffs[0].path : ''}` : 'NOT CAUGHT';
    // (b) the policy sessions alone (no scripted scenarios): which seed finds it first, if any
    const p = await runAll(Object.assign({ b, maxFailures: 1, scenarios: false, seeds: 1, maxMoves: 200 }, quiet));
    const pf = p.failures[0];
    const byPolicy = pf ? `${pf.session} step ${pf.step} (${pf.move}), ${pf.kind}` : `not within ${p.steps} random moves`;
    check(`${m.name.padEnd(18)} ${m.what}`, caught, `${where}   ${secs(t)}`);
    console.log(`         random play alone: ${byPolicy}`);
    rows.push({ name: m.name, what: m.what, caught, where, byPolicy });
  }
  return rows;
}

(async () => {
  const args = process.argv.slice(2);
  const onlyArg = args.indexOf('--only') >= 0 ? args[args.indexOf('--only') + 1].split(',') : null;
  const mutantArg = args.indexOf('--mutant') >= 0 ? args[args.indexOf('--mutant') + 1] : null;
  const want = k => !onlyArg || onlyArg.includes(k);
  const t0 = Date.now();
  console.log('parity selftest');
  if (want('unit')) unitTests();
  if (want('same')) await same();
  if (want('seed')) await seed();
  if (want('cosmetic')) await cosmetic();
  if (want('flavor')) await flavor();
  let rows = [];
  if (want('mutants')) rows = await mutants(mutantArg);
  const failed = results.filter(r => !r.ok);
  console.log('');
  if (rows.length) console.log(`mutants caught: ${rows.filter(r => r.caught).length}/${rows.length}`);
  console.log(`${failed.length ? 'SELFTEST FAILED' : 'SELFTEST OK'}: ${results.length - failed.length}/${results.length} checks held, ${secs(t0)}`);
  for (const f of failed) console.log(`  FAILED: ${f.name}   ${f.detail}`);
  if (process.env.PARITY_SELFTEST_JSON) fs.writeFileSync(process.env.PARITY_SELFTEST_JSON, JSON.stringify({ ok: !failed.length, seconds: (Date.now() - t0) / 1000, results, mutants: rows }, null, 1));
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error(e && e.stack || e); process.exit(2); });
