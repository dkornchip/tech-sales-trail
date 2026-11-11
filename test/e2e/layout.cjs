#!/usr/bin/env node
'use strict';
/*
 * Layout: does the game fit on one screen, with nothing covered and nothing cut off?
 *
 *   node test/e2e/layout.cjs <build.html> [options]
 *
 *   --driver <name>       the build's driver (default v121; test/parity/drivers/interface.cjs)
 *   --expect-fail <list>  comma-separated ids of failures that are known today (patterns: lib/harness.cjs, Known).
 *                         A listed failure is reported as xfail and does not fail the run; a failure that is not
 *                         listed does; so does a listed id that no longer fails
 *   --min-font <px>       enforce a minimum rendered font size (outside ASCII art). Without it the smallest size
 *                         is only reported
 *   --only <fixture,..>   only these fixtures          --viewport <WxH,..>   only these desktop viewports
 *   --no-phone            skip the 390x844 pass
 *   --workers <n>         pages open at a time (default 1)
 *   --shots <dir>         save a screenshot of every fixture at every viewport
 *   --json <file>         also write every result
 *   --selftest            break the page on purpose, one check at a time, and require each check to notice
 *   --list                print the check ids, fixtures and viewports and stop
 *
 * Desktop: at 1920x1080, 1920x950, 1536x864, 1366x768, 1280x720, 1280x800 and 1200x800, on seven states
 * (lib/fixtures.cjs: the plain main screen and six worst cases), each loaded fresh at that size:
 *   page-no-scroll          documentElement.scrollHeight === innerHeight, no horizontal overflow, and no box that
 *                           stands in for the page (<body>, or any box End Week sits in) scrolls instead
 *   controls-in-viewport    the twelve actions and End Week are whole and inside the viewport
 *   log-not-covered         nothing is on top of the activity log    } elementFromPoint on a 6 x 6 grid; not asked
 *   deals-not-covered       nothing is on top of the deal list       } while a modal dialog is open
 *   dialog-in-viewport      an open dialog and its buttons are inside the viewport
 *   text-not-clipped        no text is cut off by a box that does not scroll (or by the viewport, where the page
 *                           cannot be scrolled to it). ASCII art is exempt: a scene crops it on purpose
 *   min-font                the smallest rendered font size outside ASCII art (enforced with --min-font)
 *   no-infinite-animation   nothing outside an open dialog is running an animation with infinite iterations
 * Phone, 390x844, on the main-screen states:
 *   mobile-no-hscroll       the page is not wider than the viewport
 *   mobile-end-reachable    End Week can be scrolled into view and is not under anything there
 *
 * Every result has the id  check@fixture@viewport.  Exit code: 0 nothing unexpected; 1 an unexpected failure or a
 * stale --expect-fail entry; 2 bad usage, a broken fixture or a page error.
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { open, step, trouble, buildOf, driverOf, Known, parseList, table, ROUND_MS, MAX_ROUNDS } = require('./lib/harness.cjs');
const { FIXTURES, VIEWPORTS, PHONE, size } = require('./lib/fixtures.cjs');

const DESKTOP_CHECKS = ['page-no-scroll', 'controls-in-viewport', 'log-not-covered', 'deals-not-covered', 'dialog-in-viewport', 'text-not-clipped', 'min-font', 'no-infinite-animation'];
const PHONE_CHECKS = ['mobile-no-hscroll', 'mobile-end-reachable'];

function parseArgs(argv) {
  const o = { expect: [], minFont: null, phone: true };
  const need = (i, flag) => { if (i >= argv.length) { console.error(`${flag} needs a value`); process.exit(2); } return argv[i]; };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--driver') o.driver = need(++i, a);
    else if (a === '--expect-fail') o.expect = o.expect.concat(parseList(need(++i, a)));
    else if (a === '--min-font') o.minFont = Number(need(++i, a));
    else if (a === '--only') o.only = parseList(need(++i, a));
    else if (a === '--viewport') o.viewports = parseList(need(++i, a));
    else if (a === '--no-phone') o.phone = false;
    else if (a === '--workers') o.workers = Number(need(++i, a));
    else if (a === '--shots') o.shots = path.resolve(need(++i, a));
    else if (a === '--json') o.json = need(++i, a);
    else if (a === '--selftest') o.selftest = true;
    else if (a === '--list') o.list = true;
    else if (a === '--help' || a === '-h') { console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0].replace(/^#!.*\n'use strict';\n\/\*\n?/, '').replace(/^ \* ?/gm, '')); process.exit(0); }
    else if (a.indexOf('--') === 0) { console.error(`unknown option ${a} (try --help)`); process.exit(2); }
    else if (!o.target) o.target = a;
    else { console.error(`unexpected argument ${a}`); process.exit(2); }
  }
  if (o.minFont !== null && !(o.minFont > 0)) { console.error('--min-font needs a size in px'); process.exit(2); }
  for (const v of o.viewports || []) size(v);
  for (const f of o.only || []) if (!FIXTURES.some(x => x.id === f)) { console.error(`unknown fixture ${f}. fixtures: ${FIXTURES.map(x => x.id).join(', ')}`); process.exit(2); }
  return o;
}

// Let the page come to rest the way a player's would: fonts in, every CSS animation that ends by itself ended.
async function rest(side) {
  const page = side.page;
  await page.evaluate(() => document.fonts.ready.then(() => true));
  for (let i = 0; i < 60; i++) {
    if (!(await page.evaluate(() => window.__e2e.finiteAnimations()))) break;
    await page.waitForTimeout(100);
  }
  // one more pass of the fake clock, for anything a ResizeObserver or an animation's end set in motion
  await page.evaluate(([r, m]) => window.__parity.idle(r, m), [ROUND_MS, MAX_ROUNDS]);
  await page.waitForTimeout(60);
}

/*
 * Brings one fixture up at one viewport and measures it.
 * sabotage: optional source of an in-page function, run once the state is reached (the selftest's breakages).
 * Resolves to { checks, font, page } from window.__e2e.layout / mobile.
 */
async function measure(browser, env, fx, viewport, opts) {
  opts = opts || {};
  const { side, snap: first } = await open(browser, { build: env.build, driver: env.driver, viewport: size(viewport), mobile: !!opts.phone, storage: fx.storage, calm: false, id: fx.id });
  try {
    let snap = first;
    for (const st of fx.steps) snap = await step(side, snap, st.m, st.q);
    if (fx.rounds) snap = await side.extra(fx.rounds);
    const errs = trouble(side, snap);
    if (errs.length) throw new Error(`fixture ${fx.id} at ${viewport}: ${errs.join(' ; ')}`);
    const got = snap.dialog ? snap.dialog.id : null;
    if ('dialog' in fx.expect && got !== fx.expect.dialog) throw new Error(`fixture ${fx.id} at ${viewport}: expected dialog ${fx.expect.dialog}, the page shows ${got}`);
    // (on a phone clAInk's window may start as a pill; the desktop sizes are all taller than that rule)
    if ('dock' in fx.expect && !opts.phone && snap.dock !== fx.expect.dock) throw new Error(`fixture ${fx.id} at ${viewport}: expected clAInk dock ${fx.expect.dock}, the page shows ${snap.dock}`);
    await rest(side);
    if (opts.sabotage) { await side.page.evaluate(`(${opts.sabotage})()`); await side.page.waitForTimeout(120); }
    const res = opts.phone ? await side.page.evaluate(() => window.__e2e.mobile()) : await side.page.evaluate(o => window.__e2e.layout(o), { minFont: opts.minFont || null });
    if (opts.shots) { fs.mkdirSync(opts.shots, { recursive: true }); await side.page.screenshot({ path: path.join(opts.shots, `${fx.id}@${viewport}.png`) }); }
    const late = trouble(side, null);
    if (late.length) throw new Error(`fixture ${fx.id} at ${viewport}: ${late.join(' ; ')}`);
    return res;
  } finally { await side.close(); }
}

async function run(o) {
  const env = { build: buildOf(o.target), driver: driverOf(o.driver, o.target) };
  const fixtures = FIXTURES.filter(f => !o.only || o.only.includes(f.id));
  const viewports = o.viewports || VIEWPORTS;
  const known = new Known(o.expect);
  const results = [];     // { id, check, fixture, viewport, raw, status, detail }
  const fonts = [];
  // every (fixture, viewport) is its own page load; --workers of them are open at a time
  const jobs = [];
  for (const fx of fixtures) {
    for (const vp of viewports) jobs.push({ fx, vp, phone: false });
    if (o.phone && fx.mobile) jobs.push({ fx, vp: PHONE, phone: true });
  }
  const browser = await chromium.launch();
  const t0 = Date.now();
  let next = 0;
  const left = new Map(fixtures.map(f => [f.id, jobs.filter(j => j.fx === f).length]));
  const lane = async () => {
    for (;;) {
      const job = jobs[next++];
      if (!job) return;
      job.res = await measure(browser, env, job.fx, job.vp, { phone: job.phone, minFont: o.minFont, shots: o.shots });
      left.set(job.fx.id, left.get(job.fx.id) - 1);
      if (!left.get(job.fx.id)) console.log(`  measured ${job.fx.id.padEnd(13)} ${job.fx.what}`);
    }
  };
  try { await Promise.all(Array.from({ length: Math.max(1, o.workers || 1) }, lane)); } finally { await browser.close(); }
  for (const { fx, vp, phone, res } of jobs) {
    if (res.font) fonts.push(Object.assign({ fixture: fx.id, viewport: vp }, res.font));
    for (const check of phone ? PHONE_CHECKS : DESKTOP_CHECKS) {
      const c = res.checks[check];
      const id = `${check}@${fx.id}@${vp}`;
      const status = c.status === 'fail' ? known.judge(id, true) : c.status === 'ok' ? known.judge(id, false) : c.status;
      results.push({ id, check, fixture: fx.id, viewport: vp, raw: c.status, status, detail: c.detail });
    }
  }
  return { results, fonts, stale: known.stale(), fixtures, viewports, env, ms: Date.now() - t0 };
}

const CELL = { ok: 'ok', FAIL: 'FAIL', xfail: 'xfail', na: '-', info: 'info' };

function report(r, o) {
  const cols = r.viewports.concat(o.phone && r.fixtures.some(f => f.mobile) ? [PHONE] : []);
  console.log('');
  for (const check of DESKTOP_CHECKS.concat(PHONE_CHECKS)) {
    const mine = r.results.filter(x => x.check === check);
    if (!mine.length) continue;
    const rows = [[check].concat(cols)];
    for (const fx of r.fixtures) {
      const cells = cols.map(vp => { const x = mine.find(y => y.fixture === fx.id && y.viewport === vp); return x ? CELL[x.status] : ''; });
      if (cells.some(Boolean)) rows.push(['  ' + fx.id].concat(cells));
    }
    console.log(table(rows));
    console.log('');
  }
  if (r.fonts.length) {
    const min = r.fonts.reduce((a, b) => (b.size < a.size ? b : a));
    console.log(`smallest rendered font size outside ASCII art: ${min.size}px  (${min.where} “${min.text}”, in ${min.fixture} at ${min.viewport})${o.minFont ? `   enforced minimum: ${o.minFont}px` : '   not enforced (pass --min-font 13)'}`);
    const per = r.fixtures.map(fx => { const f = r.fonts.filter(x => x.fixture === fx.id); return f.length ? `${fx.id} ${Math.min(...f.map(x => x.size))}px` : null; }).filter(Boolean);
    console.log(`  by fixture: ${per.join(', ')}`);
    console.log('');
  }
  const show = (label, list) => {
    if (!list.length) return;
    // the same finding at several viewports is printed once, with the viewports it was seen at
    const groups = new Map();
    for (const x of list) { const k = `${x.check}@${x.fixture}\u0001${x.detail.join('\u0002')}`; if (!groups.has(k)) groups.set(k, { x, vps: [] }); groups.get(k).vps.push(x.viewport); }
    console.log(`${label} (${list.length} result${list.length === 1 ? '' : 's'})`);
    for (const g of groups.values()) {
      console.log(`  ${g.x.check}@${g.x.fixture}   at ${g.vps.join(', ')}`);
      for (const d of g.x.detail.slice(0, 6)) console.log(`      ${d}`);
      if (g.x.detail.length > 6) console.log(`      ... and ${g.x.detail.length - 6} more`);
    }
    console.log('');
  };
  const fails = r.results.filter(x => x.status === 'FAIL'), xfails = r.results.filter(x => x.status === 'xfail');
  show('KNOWN FAILURES, listed in --expect-fail', xfails);
  show('UNEXPECTED FAILURES', fails);
  // a partial run (--only, --viewport, --no-phone) cannot tell a fixed failure from one it did not look at
  const partial = !!(o.only || o.viewports || !o.phone);
  if (r.stale.length && partial) { console.log(`(${r.stale.length} --expect-fail entr${r.stale.length === 1 ? 'y' : 'ies'} matched nothing in this partial run: ${r.stale.join(', ')})\n`); r.stale = []; }
  if (r.stale.length) {
    console.log(`STALE --expect-fail ENTRIES (${r.stale.length}): listed as failing, but nothing that matches them failed. Remove them:`);
    for (const s of r.stale) console.log(`  ${s}`);
    console.log('');
  }
  const count = s => r.results.filter(x => x.status === s).length;
  const ok = !fails.length && !r.stale.length;
  console.log(`${ok ? 'LAYOUT OK' : 'LAYOUT FAILED'}: ${r.env.build.label}, ${r.fixtures.length} fixtures x ${r.viewports.length} viewports${o.phone ? ' + phone' : ''}: ${count('ok')} ok, ${count('xfail')} known failures, ${fails.length} unexpected failures, ${r.stale.length} stale entries, ${((r.ms) / 1000).toFixed(1)} s`);
  return ok;
}

/* ------------------------------------------------------------------ the selftest */
// One deliberate breakage per check, applied through the driver so it works on any build. `at` lists where to try
// it: the first [fixture, viewport] where the check passes on the untouched page is used.
const cover = name => `() => { const r = window.__drv.region('${name}')[0].getBoundingClientRect(); const d = document.createElement('div');
  d.style.cssText = 'position:fixed;z-index:2147483647;background:#f0f;left:' + r.left + 'px;top:' + r.top + 'px;width:' + (r.width / 2) + 'px;height:' + r.height + 'px'; document.body.appendChild(d); }`;
const MAIN = [['midrun', '1920x1080'], ['midrun', '1280x720'], ['board-24', '1920x1080'], ['fresh-ad', '1920x1080'], ['ck-report', '1920x1080']];
const ANY = MAIN.concat([['rules', '1920x1080'], ['event-dialog', '1920x1080'], ['ending', '1920x1080']]);
const SABOTAGE = [
  { check: 'page-no-scroll', what: 'a 3000px block is added to the page', at: ANY,
    js: `() => { const d = document.createElement('div'); d.style.cssText = 'height:3000px'; document.body.appendChild(d); }` },
  { check: 'controls-in-viewport', what: 'End Week is pushed 3000px down', at: ANY,
    js: `() => { window.__drv.el('end').style.transform = 'translateY(3000px)'; }` },
  { check: 'log-not-covered', what: 'a box is laid over half of the activity log', at: MAIN, js: cover('log') },
  { check: 'deals-not-covered', what: 'a box is laid over half of the deal list', at: MAIN, js: cover('deals') },
  { check: 'dialog-in-viewport', what: 'the open dialog is shifted most of a screen to the right', at: [['rules', '1920x1080'], ['event-dialog', '1920x1080'], ['ending', '1920x1080'], ['event-dialog', '1280x720']],
    js: `() => { const d = window.__drv.region('dialog')[0]; d.style.translate = '70vw 0'; }` },
  { check: 'text-not-clipped', what: 'the first action is squeezed to 50px with its overflow hidden', at: ANY,
    js: `() => { const b = window.__drv.el('act:prospect'); b.style.cssText += ';overflow:hidden;width:50px;min-width:0;white-space:nowrap;justify-self:start'; }` },
  { check: 'min-font', what: 'End Week is set in 5px type (enforced minimum: 6px)', at: ANY, minFont: 6,
    js: `() => { window.__drv.el('end').style.fontSize = '5px'; }` },
  { check: 'no-infinite-animation', what: 'End Week is given a pulse that never stops', at: ANY,
    js: `() => { window.__drv.el('end').animate([{ opacity: 1 }, { opacity: 0.6 }], { duration: 900, iterations: Infinity }); }` },
  { check: 'mobile-no-hscroll', what: 'a 900px-wide block is added to the page', phone: true, at: [['midrun', PHONE], ['fresh-ad', PHONE], ['board-24', PHONE]],
    js: `() => { const d = document.createElement('div'); d.style.cssText = 'width:900px;height:10px'; document.body.appendChild(d); }` },
  { check: 'mobile-end-reachable', what: 'a fixed sheet is laid over the whole screen', phone: true, at: [['midrun', PHONE], ['fresh-ad', PHONE], ['board-24', PHONE]],
    js: `() => { const d = document.createElement('div'); d.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:#f0f'; document.body.appendChild(d); }` }
];

async function selftest(o) {
  const env = { build: buildOf(o.target), driver: driverOf(o.driver, o.target) };
  const browser = await chromium.launch();
  let ok = true;
  const t0 = Date.now();
  console.log(`layout selftest on ${env.build.label}: each check on an untouched page, then on the same page broken on purpose\n`);
  try {
    for (const s of SABOTAGE) {
      let line = null;
      for (const [fid, vp] of s.at) {
        const fx = FIXTURES.find(f => f.id === fid);
        const opts = { phone: !!s.phone, minFont: s.minFont || null };
        const clean = (await measure(browser, env, fx, vp, opts)).checks[s.check];
        if (clean.status !== 'ok') continue;          // already failing here: nothing to show; try the next place
        const broken = (await measure(browser, env, fx, vp, Object.assign({ sabotage: s.js }, opts))).checks[s.check];
        const caught = broken.status === 'fail';
        ok = ok && caught;
        line = `  ${caught ? 'ok  ' : 'FAIL'} ${s.check.padEnd(22)} ${s.what} (${fid} at ${vp})\n         ${caught ? 'reported: ' + broken.detail[0] : 'NOT NOTICED: the check still says ' + broken.status}`;
        break;
      }
      if (!line) { ok = false; line = `  FAIL ${s.check.padEnd(22)} could not be shown: the check does not pass on the untouched page at any of ${s.at.map(a => a.join('@')).join(', ')}`; }
      console.log(line);
    }
  } finally { await browser.close(); }
  console.log(`\n${ok ? 'LAYOUT SELFTEST OK' : 'LAYOUT SELFTEST FAILED'}: ${SABOTAGE.length} checks, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  return ok;
}

(async () => {
  const o = parseArgs(process.argv.slice(2));
  if (o.list) {
    console.log('checks:    ' + DESKTOP_CHECKS.concat(PHONE_CHECKS).join(', '));
    console.log('viewports: ' + VIEWPORTS.join(', ') + '; phone ' + PHONE);
    for (const f of FIXTURES) console.log(`fixture    ${f.id.padEnd(13)} ${f.what}${f.mobile ? ' (also on the phone)' : ''}`);
    return;
  }
  if (!o.target) { console.error('usage: node test/e2e/layout.cjs <build.html> [options]   (try --help)'); process.exit(2); }
  if (o.selftest) process.exit((await selftest(o)) ? 0 : 1);
  console.log(`layout: ${o.target}`);
  const r = await run(o);
  const ok = report(r, o);
  if (o.json) fs.writeFileSync(o.json, JSON.stringify({ ok, seconds: r.ms / 1000, results: r.results, fonts: r.fonts, stale: r.stale }, null, 1));
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e && e.stack || e); process.exit(2); });
