#!/usr/bin/env node
'use strict';
/*
 * Keyboard: can the whole game be played with Tab, Shift+Tab, Enter, Space and Escape, and can you see where you are?
 *
 *   node test/e2e/keyboard.cjs <build.html> [options]
 *
 *   --driver <name>       the build's driver (default v121; test/parity/drivers/interface.cjs)
 *   --expect-fail <list>  comma-separated ids of findings that are known today (patterns: lib/harness.cjs, Known)
 *   --trace               print every key press and where focus went
 *   --json <file>         also write every stage, finding and focus stop
 *   --selftest            break the page on purpose, one finding at a time, and require each to be reported
 *
 * No pointer and no programmatic click anywhere: every press is a real key event from Playwright's keyboard. The
 * only other things the test does to the page are what a test must (advance the fake clock, script a dice roll so
 * an event fires, put a late-game save where the Load button reads it) and ask the driver which control has focus.
 *
 * The journey, one stage after another on one page:
 *   boot      get past the boot screen
 *   week      take two actions (one with Enter, one with Space), then End Week
 *   event     End Week again, into a choice dialog; pick its second option
 *   rules     open the Rules; close them with Escape; open again; close with the dialog's button
 *   load      load a week-13 save with the Load button
 *   ending    End Week into an ending
 *   newrun    start a new run from the ending
 *   held      hold Enter on an action, hold Space on an action, hold Enter on End Week: does it fire twice?
 *
 * What is reported, each with the id  finding@stage:
 *   journey       the stage could not be completed with the keyboard
 *   focus-lost    after a key press, focus was on <body>
 *   no-focus-ring focus was on an element with no visible indicator: no outline, and no change in its border,
 *                 background, colour or shadow from how it looks unfocused
 *   held-key      a held key (auto-repeat) made the control act more than once
 *                 (ids: held-key@enter-on-action, held-key@space-on-action, held-key@enter-on-end-week)
 *
 * Exit code: 0 nothing unexpected; 1 an unexpected finding or a stale --expect-fail entry; 2 bad usage or a page error.
 */
const fs = require('fs');
const { chromium } = require('playwright');
const { open, trouble, buildOf, driverOf, Known, parseList, ROUND_MS, MAX_ROUNDS } = require('./lib/harness.cjs');
const { SCENARIOS, HI, LO } = require('../parity/lib/scenarios.cjs');
const { KEYS } = require('../saves/lib/fixtures.cjs');

const STAGES = ['boot', 'week', 'event', 'rules', 'load', 'ending', 'newrun', 'held'];
const his = n => Array(n).fill(HI);
const QUIET = his(110);                                  // every roll of an End Week: nothing happens
const COMPETITOR = [].concat(his(2), [LO], his(100));    // ...except the second event: the competitor's price cut
const lateSave = () => SCENARIOS.find(s => s.name === 'qbr-club').save;   // week 13, quota met

function parseArgs(argv) {
  const o = { expect: [] };
  const need = (i, flag) => { if (i >= argv.length) { console.error(`${flag} needs a value`); process.exit(2); } return argv[i]; };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--driver') o.driver = need(++i, a);
    else if (a === '--expect-fail') o.expect = o.expect.concat(parseList(need(++i, a)));
    else if (a === '--trace') o.trace = true;
    else if (a === '--json') o.json = need(++i, a);
    else if (a === '--selftest') o.selftest = true;
    else if (a === '--help' || a === '-h') { console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0].replace(/^#!.*\n'use strict';\n\/\*\n?/, '').replace(/^ \* ?/gm, '')); process.exit(0); }
    else if (a.indexOf('--') === 0) { console.error(`unknown option ${a} (try --help)`); process.exit(2); }
    else if (!o.target) o.target = a;
    else { console.error(`unexpected argument ${a}`); process.exit(2); }
  }
  return o;
}

class Stop extends Error {}       // a stage that cannot go on

/*
 * Plays the journey. opts.sabotage: source of an in-page function run right after the boot stage (the selftest).
 * Resolves to { stages: [{id, ok, note}], findings: [{id, check, stage, text}], stops: [...], errors: [...] }.
 */
async function journey(browser, env, opts) {
  opts = opts || {};
  const { side, snap: first } = await open(browser, { build: env.build, driver: env.driver, viewport: { width: 1440, height: 900 }, boot: 'manual', id: 'keyboard' });
  const page = side.page;
  const stages = [], findings = [], stops = [];
  let stage = 'boot', snap = first;
  const say = line => { if (opts.trace) console.log('    ' + line); };
  const finding = (check, text, at) => { const id = `${check}@${at || stage}`; if (!findings.some(f => f.id === id && f.text === text)) findings.push({ id, check, stage: at || stage, text }); };

  // One real key press, then let the page settle on the fake clock, then look at where focus is.
  // opts: queue (dice for this press), quiet (do not report where focus landed: the caller looks itself)
  const press = async (key, o) => {
    o = o || {};
    const was = await page.evaluate(([q, back]) => { window.__e2e.noteUnfocused(); window.__rngQueue = q || []; return { edge: window.__e2e.atEdge(back), desc: window.__e2e.focusInfo().desc }; }, [o.queue || null, key === 'Shift+Tab']);
    await page.keyboard.press(key);
    snap = await page.evaluate(([r, m]) => window.__parity.idle(r, m).then(s => { window.__rngQueue = []; return s; }), [ROUND_MS, MAX_ROUNDS]);
    const f = await page.evaluate(() => window.__e2e.focusInfo());
    // Tab off the last stop (Shift+Tab off the first): the browser's own toolbar has focus for one press
    f.wrapped = f.body && /Tab$/.test(key) && was.edge;
    f.from = was.desc;
    stops.push({ stage, key, desc: f.desc, move: f.move, body: f.body, wrapped: f.wrapped, indicator: f.indicator });
    say(`${key.padEnd(9)} -> ${f.move || '-'}  ${f.desc}${f.body ? (f.wrapped ? '  (round the end of the page)' : '  FOCUS LOST') : '  [' + (f.indicator || 'NO INDICATOR') + ']'}`);
    if (!o.quiet) {
      if (f.body) finding('focus-lost', `after ${key}, focus was on <body>${o.after ? ' (' + o.after + ')' : ''}`);
      else if (!f.indicator) finding('no-focus-ring', `${f.desc} shows nothing when it has focus`);
    }
    return f;
  };
  const state = () => JSON.parse(snap.state);
  const dialogId = () => (snap.dialog ? snap.dialog.id : null);

  // Tab (or Shift+Tab) until the control for `move` has focus.
  const tabTo = async (move, back) => {
    const key = back ? 'Shift+Tab' : 'Tab';
    const now = await page.evaluate(() => window.__e2e.focusInfo());
    if (now.move === move) return;
    const seen = [];
    for (let i = 0; i < 90; i++) {
      const f = await press(key, { quiet: true });
      if (f.body) { if (!f.wrapped) finding('focus-lost', `${key} from ${f.from} left focus on <body>`); }
      else if (!f.indicator) finding('no-focus-ring', `${f.desc} shows nothing when it has focus`);
      seen.push(f.body ? '<body>' : f.desc);
      if (f.move === move) return;
    }
    throw new Stop(`could not reach ${move} with ${key}: 90 presses went through ${Array.from(new Set(seen)).slice(0, 14).join(', ')}`);
  };
  const want = (cond, text) => { if (!cond) throw new Stop(text); };

  const run = async (id, fn) => {
    stage = id;
    try { const note = await fn(); stages.push({ id, ok: true, note: note || '' }); return true; }
    catch (e) {
      if (!(e instanceof Stop)) throw e;
      stages.push({ id, ok: false, note: e.message });
      finding('journey', e.message);
      return false;
    }
  };

  try {
    let ok = await run('boot', async () => {
      const b = await page.evaluate(() => ({ open: window.__drv.bootOpen(), f: window.__e2e.focusInfo() }));
      want(b.open, 'the boot screen is not up on a first visit');
      let presses = 0;
      for (; presses < 4 && (await page.evaluate(() => window.__drv.bootOpen())); presses++) {
        await press('Enter', { quiet: true });
        await page.evaluate(([r]) => window.__parity.extra(2, r), [ROUND_MS]);       // the boot animation plays
      }
      want(!(await page.evaluate(() => window.__drv.bootOpen())), 'Enter does not get past the boot screen');
      snap = await page.evaluate(([r, m]) => window.__parity.idle(r, m), [ROUND_MS, MAX_ROUNDS]);
      const f = await page.evaluate(() => window.__e2e.focusInfo());
      if (f.body) finding('focus-lost', 'when the boot screen closes, focus is left on <body>');
      return `${presses} press${presses === 1 ? '' : 'es'} of Enter; focus then on ${f.desc}`;
    });
    if (opts.sabotage) await page.evaluate(`(${opts.sabotage})()`);

    ok = ok && await run('week', async () => {
      const s0 = state();
      await tabTo('act:prospect'); await press('Enter', { after: 'Prospect Blitz' });
      want(state().slots === s0.slots - 1, `Enter on the first action did nothing (slots ${s0.slots} -> ${state().slots})`);
      await tabTo('act:cadence'); await press('Space', { after: 'Email Cadence' });
      want(state().slots === s0.slots - 2, `Space on the second action did nothing (slots ${state().slots})`);
      await tabTo('end', true); await press('Enter', { queue: QUIET, after: 'End Week' });       // backwards, round the top of the page
      want(state().week === s0.week + 1 && !dialogId(), `Enter on End Week did not start the next week (week ${state().week}, dialog ${dialogId()})`);
      return `two actions and End Week: week ${s0.week} -> ${state().week}`;
    });

    ok = ok && await run('event', async () => {
      await tabTo('end'); await press('Enter', { queue: COMPETITOR, after: 'End Week, an event dialog opens' });
      want(dialogId() === 'evt:competitor', `expected the competitor event dialog, got ${dialogId()}`);
      const f = await page.evaluate(() => window.__e2e.focusInfo());
      want(/^dlg:/.test(String(f.move)), `the dialog opened but focus is on ${f.desc}, not on one of its buttons`);
      await tabTo('dlg:1'); await press('Enter', { after: 'the dialog closes' });
      want(!dialogId(), `the dialog did not close (${dialogId()})`);
      return 'the event dialog opened with focus inside it; its second option was chosen';
    });

    ok = ok && await run('rules', async () => {
      await tabTo('ui:rules'); await press('Enter', { after: 'the Rules open' });
      want(dialogId() === 'help', `Enter on Rules opened ${dialogId()}`);
      await press('Escape', { after: 'the Rules close' });
      want(!dialogId(), 'Escape does not close the Rules');
      await tabTo('ui:rules'); await press('Space', { after: 'the Rules open' });
      want(dialogId() === 'help', `Space on Rules opened ${dialogId()}`);
      await tabTo('dlg:0', true); await press('Space', { after: 'the Rules close' });
      want(!dialogId(), 'the Rules dialog\'s own button does not close it');
      return 'opened twice; closed with Escape and with its button';
    });

    ok = ok && await run('load', async () => {
      await page.evaluate(([k, v]) => window.localStorage.setItem(k, v), [KEYS.manual, JSON.stringify(lateSave())]);
      await tabTo('load'); await press('Enter', { after: 'Load' });
      want(state().week === 13, `Enter on Load did not load the save (week ${state().week})`);
      return 'a week-13 save loaded with the Load button';
    });

    ok = ok && await run('ending', async () => {
      await tabTo('end'); await press('Enter', { queue: QUIET, after: 'End Week, the ending opens' });
      want(dialogId() === 'end:club', `expected the President's Club ending, got ${dialogId()}`);
      const f = await page.evaluate(() => window.__e2e.focusInfo());
      want(!f.body, 'the ending opened but focus is on <body>');
      return `the ending opened with focus on ${f.desc}`;
    });

    ok = ok && await run('newrun', async () => {
      await tabTo('newrun'); await press('Enter', { after: 'New Run' });
      want(!dialogId() && state().week === 1, `Enter on New Run did not start a run (week ${state().week}, dialog ${dialogId()})`);
      return 'a fresh run from the ending';
    });

    // Hold a key: the first keydown, then auto-repeats of it, then the key comes up. How often did the control act?
    if (ok) await run('held', async () => {
      const hold = async (move, key, count, id, label, queue) => {
        await tabTo(move);
        const before = count(state());
        await page.evaluate(q => { window.__e2e.noteUnfocused(); window.__rngQueue = q; }, queue);
        for (let i = 0; i < 3; i++) {          // Playwright marks a keydown for a key that is already down as a repeat
          await page.keyboard.down(key);
          await page.evaluate(([r]) => window.__parity.extra(1, r), [40]);            // 40 ms between repeats
        }
        await page.keyboard.up(key);
        snap = await page.evaluate(([r, m]) => window.__parity.idle(r, m).then(s => { window.__rngQueue = []; return s; }), [ROUND_MS, MAX_ROUNDS]);
        const n = count(state()) - before;
        say(`held ${key} on ${move}: acted ${n} time(s)`);
        if (n > 1) finding('held-key', `holding ${key} on ${label} made it act ${n} times`, id);
        want(n >= 1, `holding ${key} on ${label} did nothing at all`);
        if (dialogId() && /^end:/.test(dialogId())) throw new Stop(`holding ${key} on ${label} ended the run (${dialogId()})`);
        return n;
      };
      const spent = s => 5 - s.slots;
      const a = await hold('act:politics', 'Enter', spent, 'enter-on-action', 'an action', QUIET);
      const b = await hold('act:network', 'Space', spent, 'space-on-action', 'an action', his(3).concat(Array(60).fill(0.5)));
      const c = await hold('end', 'Enter', s => s.week, 'enter-on-end-week', 'End Week', QUIET);
      return `held Enter on an action: ${a} time(s); held Space on an action: ${b}; held Enter on End Week: ${c}`;
    });

    const errors = trouble(side, snap);
    return { stages, findings, stops, errors };
  } finally { await side.close(); }
}

function report(r, known, label) {
  console.log('');
  for (const s of r.stages) console.log(`  ${s.ok ? 'ok  ' : 'FAIL'} ${s.id.padEnd(8)} ${s.note}`);
  const skipped = STAGES.filter(id => !r.stages.some(s => s.id === id));
  for (const id of skipped) console.log(`  --   ${id.padEnd(8)} not reached`);
  const judged = r.findings.map(f => Object.assign({ status: known.judge(f.id, true) }, f));
  // one line per id; the same finding on many controls is shown with the first few and a count
  const show = (title, list) => {
    if (!list.length) return;
    const groups = new Map();
    for (const f of list) { if (!groups.has(f.id)) groups.set(f.id, []); groups.get(f.id).push(f.text); }
    console.log(`\n${title} (${groups.size} id${groups.size === 1 ? '' : 's'}, ${list.length} finding${list.length === 1 ? '' : 's'})`);
    for (const [id, texts] of groups) {
      console.log(`  ${id.padEnd(28)} ${texts[0]}`);
      for (const t of texts.slice(1, 4)) console.log(`  ${''.padEnd(28)} ${t}`);
      if (texts.length > 4) console.log(`  ${''.padEnd(28)} ... and ${texts.length - 4} more (--json has them all)`);
    }
  };
  show('KNOWN FINDINGS, listed in --expect-fail', judged.filter(f => f.status === 'xfail'));
  show('UNEXPECTED FINDINGS', judged.filter(f => f.status === 'FAIL'));
  const stale = known.stale();
  if (stale.length) { console.log(`\nSTALE --expect-fail ENTRIES (${stale.length}): listed, but not found this time. Remove them:`); for (const s of stale) console.log(`  ${s}`); }
  if (r.errors.length) { console.log(`\nPAGE ERRORS (${r.errors.length})`); for (const e of r.errors) console.log(`  ${e}`); }
  const bad = judged.filter(f => f.status === 'FAIL').length;
  const ok = !bad && !stale.length && !r.errors.length;
  const tabs = r.stops.filter(s => /Tab/.test(s.key)).length;
  console.log(`\n${ok ? 'KEYBOARD OK' : 'KEYBOARD FAILED'}: ${label}, ${r.stages.filter(s => s.ok).length}/${STAGES.length} stages, ${r.stops.length} key presses (${tabs} of them Tab or Shift+Tab), ${judged.filter(f => f.status === 'xfail').length} known findings, ${bad} unexpected, ${stale.length} stale entries`);
  return { ok, judged, stale };
}

/* ------------------------------------------------------------------ the selftest */
// One breakage per kind of finding, applied through the driver after the boot screen. `want` is the finding that
// must appear and is not there on the untouched page; `gone` is one that must disappear.
const SABOTAGE = [
  { what: 'End Week is taken out of the tab order', want: 'journey@week',
    js: `() => { window.__drv.el('end').tabIndex = -1; }` },
  { what: 'the first action gives focus away as soon as it gets it', want: 'focus-lost@week',
    js: `() => { window.__drv.el('act:prospect').addEventListener('focus', e => e.target.blur()); }` },
  { what: 'the first action has its focus outline removed', want: 'no-focus-ring@week',
    js: `() => { window.__drv.el('act:prospect').style.outline = 'none'; }` },
  { what: 'the Rules dialog cannot be closed with Escape', want: 'journey@rules',
    js: `() => { document.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); } }, true);
                 document.addEventListener('cancel', e => { e.preventDefault(); e.stopImmediatePropagation(); }, true);
                 document.addEventListener('close', e => { e.stopImmediatePropagation(); }, true); }` }
];
// held-key is shown in whichever direction today's page allows: if a held key already repeats, a page-wide guard
// against repeats must make the finding go away; if it does not, a control that clicks itself on a repeat must
// make it appear.
const HELD = {
  guard: { what: 'every auto-repeated Enter and Space is swallowed page-wide', gone: 'held-key',
    js: `() => { document.addEventListener('keydown', e => { if (e.repeat && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); e.stopImmediatePropagation(); } }, true); }` },
  repeat: { what: 'an action is made to act again on every auto-repeat', want: 'held-key',
    js: `() => { const b = window.__drv.el('act:politics'); b.addEventListener('keydown', e => { if (e.repeat) b.click(); }); }` }
};

async function selftest(browser, env) {
  const t0 = Date.now();
  console.log(`keyboard selftest on ${env.build.label}: the journey on an untouched page, then on the same page broken on purpose`);
  const clean = await journey(browser, env, {});
  const ids = r => new Set(r.findings.map(f => f.id));
  const has = (set, prefix) => Array.from(set).some(id => id.indexOf(prefix) === 0);
  const base = ids(clean);
  console.log(`  untouched page: ${clean.stages.filter(s => s.ok).length}/${STAGES.length} stages, findings: ${Array.from(base).join(', ') || 'none'}\n`);
  const list = SABOTAGE.concat([has(base, 'held-key') ? HELD.guard : HELD.repeat]);
  let ok = true;
  for (const s of list) {
    const r = await journey(browser, env, { sabotage: s.js });
    const now = ids(r);
    let caught, line;
    if (s.want) {
      if (has(base, s.want)) { caught = false; line = `cannot be shown: ${s.want} is already reported on the untouched page`; }
      else { caught = has(now, s.want); const f = r.findings.find(x => x.id.indexOf(s.want) === 0); line = caught ? `reported: ${f.id}  ${f.text.slice(0, 150)}` : `NOT NOTICED: no ${s.want} finding`; }
    } else { caught = !has(now, s.gone); line = caught ? `${s.gone} is no longer reported` : `STILL REPORTED: ${Array.from(now).filter(id => id.indexOf(s.gone) === 0).join(', ')}`; }
    ok = ok && caught;
    console.log(`  ${caught ? 'ok  ' : 'FAIL'} ${s.what}\n         ${line}`);
  }
  console.log(`\n${ok ? 'KEYBOARD SELFTEST OK' : 'KEYBOARD SELFTEST FAILED'}: ${list.length} breakages, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  return ok;
}

(async () => {
  const o = parseArgs(process.argv.slice(2));
  if (!o.target) { console.error('usage: node test/e2e/keyboard.cjs <build.html> [options]   (try --help)'); process.exit(2); }
  const env = { build: buildOf(o.target), driver: driverOf(o.driver) };
  const browser = await chromium.launch();
  try {
    if (o.selftest) { const ok = await selftest(browser, env); await browser.close(); process.exit(ok ? 0 : 1); }
    console.log(`keyboard: ${o.target}`);
    const t0 = Date.now();
    const r = await journey(browser, env, { trace: o.trace });
    const out = report(r, new Known(o.expect), env.build.label);
    console.log(`(${((Date.now() - t0) / 1000).toFixed(1)} s)`);
    if (o.json) fs.writeFileSync(o.json, JSON.stringify({ ok: out.ok, stages: r.stages, findings: out.judged, stale: out.stale, stops: r.stops, errors: r.errors }, null, 1));
    await browser.close();
    process.exit(out.ok ? 0 : r.errors.length ? 2 : 1);
  } finally { try { await browser.close(); } catch (_) {} }
})().catch(e => { console.error(e && e.stack || e); process.exit(2); });
