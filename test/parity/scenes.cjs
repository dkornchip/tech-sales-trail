#!/usr/bin/env node
'use strict';
/*
 * Scene parity: prove that build B draws every ASCII scene exactly as the frozen v1.21 baseline does
 * (with --art: the pictures; without it: the pictures and every word).
 *
 *   node test/parity/scenes.cjs --b <build.html> [options]
 *
 *   --b <path>        the build under test. "--b baseline" compares the baseline with itself (must pass)
 *   --step <ms>       distance between compared frames (default 250)
 *   --tail <ms>       how far past the end of each scene's timeline to keep comparing (default 11000: the idle loop
 *                     swaps the two caption sets every 5.2 s, so this sees both, and the idle-only art)
 *   --only <text>     only the cases whose name contains <text>
 *   --art             compare the pictures only: leave the caption band, the summaries and the caption schedule out,
 *                     and accept the words inside the pictures that v2.0 rewrote on purpose (REWRITTEN below).
 *                     This is the mode for v2.0 and later, whose captions were rewritten; without it the words
 *                     must match the baseline's too (which is how the copy was proved to have moved verbatim
 *                     before it was rewritten).
 *   --fx <v>          the value the cosmetic stream is pinned to, in [0, 1) (default 0.5)
 *   --verbose         print every case, not only the failures
 *
 * What is compared, for every case below (each ending by each cause that changes it, the boot screen, standby):
 *   - every frame from 0 to the scene's end (+ tail), in --step steps, as window.TST_SCENES.renderText(type, ms, meta)
 *     returns it: the characters (.text), the colour runs (.html) and the screen mode (.screen)
 *   - the one-line summary (window.TST_SCENES.summaryFor(type, meta))
 *   - the caption schedule the player sees typed out (title, both line sets, their timings and colours)
 *   - the title-card word(s) of the scene's cue list (the card is DOM, not grid, so renderText never draws it)
 *
 * The cosmetic stream (particles, glitches) is pinned: window.__TST_FX = () => 0.5 is installed before either engine
 * loads. The baseline reads it through the one patch lib/serve.cjs applies to it (its 47 cosmetic Math.random sites
 * become (window.__TST_FX||Math.random)); build B reads globalThis.__TST_FX by itself (src/fxrng.js).
 *
 * Exit code: 0 identical; 1 a difference; 2 bad usage or a page that did not load.
 */
const path = require('path');
const { chromium } = require('playwright');
const { loadBuild, route, ORIGIN } = require('./lib/serve.cjs');

// type and meta are what the game passes to the engine (src/ui/Game.jsx: type is club / fired / burnout / missed /
// repo, meta is {pct, cause, shots}; src/shell/shell.js: standby, then boot with {week}).
const CASES = [
  { name: 'club', type: 'club', meta: { pct: 1.06, cause: 'club', shots: 0 } },
  { name: 'club (no meta)', type: 'club' },
  { name: 'fired: qbr', type: 'fired', meta: { pct: 0.41, cause: 'qbr', shots: 0 } },
  { name: 'fired: politics', type: 'fired', meta: { pct: 1.02, cause: 'politics', shots: 0 } },
  { name: 'fired: org', type: 'fired', meta: { pct: 0.3, cause: 'org', shots: 1 } },
  { name: 'fired: review', type: 'fired', meta: { pct: 0.3, cause: 'review', shots: 0 } },
  { name: 'fired (no meta)', type: 'fired' },
  { name: 'ascension: shot 1', type: 'burnout', meta: { pct: 0.2, cause: 'caffeine', shots: 1 } },
  { name: 'ascension: shot 4', type: 'burnout', meta: { pct: 0.2, cause: 'caffeine', shots: 4 } },
  { name: 'ascension: no shot count', type: 'burnout', meta: { cause: 'caffeine' } },
  { name: 'meltdown: stress', type: 'burnout', meta: { pct: 0.6, cause: 'stress', shots: 2 } },
  { name: 'meltdown (no meta)', type: 'burnout' },
  { name: 'missed: 70%', type: 'missed', meta: { pct: 0.7, cause: 'missed', shots: 0 } },
  { name: 'missed: 85%', type: 'missed', meta: { pct: 0.85, cause: 'missed', shots: 0 } },
  { name: 'missed: 99.9%', type: 'missed', meta: { pct: 0.999, cause: 'missed', shots: 0 } },
  { name: 'missed (no meta)', type: 'missed' },
  { name: 'repo', type: 'repo', meta: { pct: 0.5, cause: 'repo', shots: 0 } },
  { name: 'repo: claink', type: 'repo', meta: { pct: 0.5, cause: 'claink', shots: 0 } },
  { name: 'boot: week 1', type: 'boot', meta: { week: 1 } },
  { name: 'boot: week 7', type: 'boot', meta: { week: 7 } },
  { name: 'boot: week 13', type: 'boot', meta: { week: 13 } },
  { name: 'boot (no meta)', type: 'boot' },
  { name: 'standby', type: 'standby' },
  { name: 'unknown type (falls back to club)', type: 'no-such-scene', meta: { cause: 'qbr' } }
];

function parseArgs(argv) {
  const o = { step: 250, tail: 11000, only: null, verbose: false, b: null, fx: 0.5, art: false };
  const need = (i, flag) => { if (i >= argv.length) { console.error(`${flag} needs a value`); process.exit(2); } return argv[i]; };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--b') { const v = need(++i, a); o.b = v === 'baseline' ? { kind: 'baseline' } : { kind: 'file', file: path.resolve(v) }; }
    else if (a === '--step') o.step = Number(need(++i, a));
    else if (a === '--tail') o.tail = Number(need(++i, a));
    else if (a === '--only') o.only = need(++i, a);
    else if (a === '--fx') o.fx = Number(need(++i, a));
    else if (a === '--art') o.art = true;
    else if (a === '--verbose') o.verbose = true;
    else { console.error(`unknown option ${a}`); process.exit(2); }
  }
  if (!o.b) { console.error('usage: node test/parity/scenes.cjs --b <build.html>'); process.exit(2); }
  if (!(o.step >= 50) || !(o.tail >= 0)) { console.error('--step must be at least 50 and --tail at least 0'); process.exit(2); }
  if (!(o.fx >= 0 && o.fx < 1)) { console.error('--fx is a number in [0, 1)'); process.exit(2); }
  return o;
}

// Runs inside the page (Playwright serialises it, so it must not use anything outside its own body).
// Returns, per case: the frames, the summary, the caption schedule and the title cards.
function inPage([cases, step, tail]) {
  const T = window.TST_SCENES;
  if (!T || typeof T.renderText !== 'function' || !T.SCENES) throw new Error('window.TST_SCENES.renderText is missing');
  const keyOf = (type, meta) => (type === 'burnout' ? (meta && meta.cause === 'caffeine' ? 'ascension' : 'meltdown') : (T.SCENES[type] ? type : 'club'));
  return cases.map(c => {
    const key = keyOf(c.type, c.meta), sc = T.SCENES[key];
    const meta = c.meta || {};
    const frames = [];
    for (let t = 0; t <= sc.dur + tail; t += step) {
      const f = T.renderText(c.type, t, c.meta);
      frames.push({ t, text: f.text, html: f.html, screen: f.screen });
    }
    // the caption as capFor() resolves it: capBy[cause] over cap, a line set may be a function of meta
    let cap = null;
    if (sc.cap) {
      cap = Object.assign({}, sc.cap, (sc.capBy && sc.capBy[meta.cause]) || {});
      if (typeof cap.a === 'function') cap.a = cap.a(meta);
      if (typeof cap.b === 'function') cap.b = cap.b(meta);
    }
    return {
      name: c.name, key, dur: sc.dur, frames, band: sc.band !== false,
      summary: T.summaryFor(c.type, c.meta),
      cap: JSON.stringify(cap),
      cards: JSON.stringify((sc.cues || []).filter(q => q.card).map(q => ({ t: q.t, card: q.card, ms: q.ms, k: q.k, cause: q.cause, notCause: q.notCause })))
    };
  });
}

async function render(browser, build, label, cases, o) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'en-US', timezoneId: 'UTC' });
  const url = `${ORIGIN}/${label}/index.html`;
  const net = { unexpected: [], fonts: 0, cdn: 0 };
  await route(context, build, url, net);
  await context.addInitScript(`window.__TST_FX = () => ${o.fx};`);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e && e.message || e)));
  await page.goto(url, { waitUntil: 'load' });
  const pinned = await page.evaluate(v => typeof window.__TST_FX === 'function' && window.__TST_FX() === v, o.fx);
  if (!pinned) throw new Error(`${label}: the cosmetic stream is not pinned`);
  const out = await page.evaluate(inPage, [cases, o.step, o.tail]);
  await context.close();
  if (net.unexpected.length) throw new Error(`${label}: unexpected request(s): ${net.unexpected.join(', ')}`);
  if (errors.length) throw new Error(`${label}: page error(s): ${errors.join(' ; ')}`);
  return out;
}

// Words drawn inside the pictures that v2.0 rewrote on purpose (src/copy/scenes.js `text`). --art accepts exactly
// these, on the scene named, and nothing else.
const REWRITTEN = [
  { scene: 'meltdown', was: 'Stop code: SOUL_NOT_FOUND', now: 'Stop code: QUOTA_EXCEPTION_NOT_HANDLED' }
];

// Rows 0 to 12 of the grid are the picture; row 13 is the rule and rows 14 to 16 the caption band (ART in the engine's core.js).
const ART_ROWS = 13;

// The first place two frames differ, for the report.
function firstDiff(a, b) {
  const la = a.split('\n'), lb = b.split('\n');
  for (let y = 0; y < Math.max(la.length, lb.length); y++) {
    if (la[y] !== lb[y]) return { row: y, a: la[y] === undefined ? '(missing)' : la[y], b: lb[y] === undefined ? '(missing)' : lb[y] };
  }
  return null;
}

(async () => {
  const o = parseArgs(process.argv.slice(2));
  const cases = o.only ? CASES.filter(c => c.name.indexOf(o.only) >= 0) : CASES;
  if (!cases.length) { console.error(`no case matches ${JSON.stringify(o.only)}`); process.exit(2); }
  const buildA = loadBuild({ kind: 'baseline' }), buildB = loadBuild(o.b);
  const t0 = Date.now();
  const browser = await chromium.launch();
  let A, B;
  try {
    A = await render(browser, buildA, 'a', cases, o);
    B = await render(browser, buildB, 'b', cases, o);
  } finally { await browser.close(); }

  let frames = 0, failed = 0;
  const problems = [];
  for (let i = 0; i < cases.length; i++) {
    const a = A[i], b = B[i], bad = [];
    if (a.key !== b.key) bad.push(`plays scene "${b.key}", the baseline plays "${a.key}"`);
    if (a.dur !== b.dur) bad.push(`timeline is ${b.dur} ms, the baseline's is ${a.dur} ms`);
    if (!o.art && a.summary !== b.summary) bad.push(`summary differs\n      A: ${JSON.stringify(a.summary)}\n      B: ${JSON.stringify(b.summary)}`);
    if (!o.art && a.cap !== b.cap) bad.push(`caption schedule differs\n      A: ${a.cap}\n      B: ${b.cap}`);
    // --art: the caption band (the rule and the three lines under it) is left out of every frame; a scene with no
    // band (the boot screen) is compared whole
    const rows = o.art && a.band ? ART_ROWS : Infinity;
    const cut = text => (rows === Infinity ? text : text.split('\n').slice(0, rows).join('\n'));
    // --art also knows the words inside the pictures that v2.0 rewrote on purpose (REWRITTEN below): a row that
    // holds one of them in the baseline and its replacement in the build is not a difference
    const excused = (ra, rb) => o.art && REWRITTEN.some(w => w.scene === a.key && ra.indexOf(w.was) >= 0 && rb.indexOf(w.now) >= 0 && ra.replace(w.was, '').trim() === rb.replace(w.now, '').trim());
    const sameRows = (ta, tb, check) => {
      const la = cut(ta).split('\n'), lb = cut(tb).split('\n');
      if (la.length !== lb.length) return { row: Math.min(la.length, lb.length), a: '(row count ' + la.length + ')', b: '(row count ' + lb.length + ')' };
      for (let y = 0; y < la.length; y++) if (la[y] !== lb[y] && !check(y, la[y], lb[y])) return { row: y, a: la[y], b: lb[y] };
      return null;
    };
    if (a.cards !== b.cards) bad.push(`title cards differ\n      A: ${a.cards}\n      B: ${b.cards}`);
    if (a.frames.length !== b.frames.length) bad.push(`${b.frames.length} frames, the baseline has ${a.frames.length}`);
    for (let k = 0; k < Math.min(a.frames.length, b.frames.length); k++) {
      const fa = a.frames[k], fb = b.frames[k];
      frames++;
      const skip = new Set();   // rows excused in the text are not compared for colour either
      const d = sameRows(fa.text, fb.text, (y, ra, rb) => { if (excused(ra, rb)) { skip.add(y); return true; } return false; });
      if (d) { bad.push(`frame at ${fa.t} ms: the text differs on row ${d.row}\n      A: ${JSON.stringify(d.a)}\n      B: ${JSON.stringify(d.b)}`); break; }
      if (sameRows(fa.html, fb.html, y => skip.has(y))) { bad.push(`frame at ${fa.t} ms: same characters, different colours`); break; }
      if (fa.screen !== fb.screen) { bad.push(`frame at ${fa.t} ms: screen mode ${JSON.stringify(fb.screen)}, the baseline's is ${JSON.stringify(fa.screen)}`); break; }
    }
    if (bad.length) { failed++; problems.push(`FAIL ${cases[i].name}\n    ` + bad.join('\n    ')); }
    if (bad.length || o.verbose) console.log(`  ${bad.length ? 'FAIL' : 'ok  '} ${cases[i].name.padEnd(36)} ${String(a.frames.length).padStart(3)} frames  scene ${a.key}`);
  }
  if (problems.length) console.log('\n' + problems.join('\n\n') + '\n');
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`${failed ? 'FAIL' : 'PASS'}  A = ${buildA.label}   B = ${buildB.label} (sha256 ${buildB.sha256.slice(0, 12)})   cosmetic stream pinned to ${o.fx}`);
  console.log(`  ${cases.length - failed}/${cases.length} scene cases identical, ${frames} frames compared (every ${o.step} ms, ${o.tail} ms past each timeline), ` +
    (o.art ? `pictures and title cards compared; caption bands, summaries and caption schedules left out; ${REWRITTEN.length} rewritten word(s) inside pictures accepted` : 'summaries, caption schedules and title cards compared') + `, ${secs} s`);
  console.log(failed ? 'SCENES FAILED' : 'SCENES OK');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e && e.stack || e); process.exit(2); });
