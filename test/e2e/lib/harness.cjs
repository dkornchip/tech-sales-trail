'use strict';
/*
 * What the layout and keyboard tests share: opening a build the way the parity harness does (same request routing,
 * same seeded dice, same fake clock, the build's own driver), and the bookkeeping for failures that are known today.
 *
 * Why the parity harness's page and not a plain one: the tests have to reach particular states (an event dialog
 * needs one particular dice roll; an ending needs the cutscene to have played), and they have to be the same
 * states every time. The fake clock gives that. Layout itself is the browser's: nothing here changes the CSS (the
 * layout test opens its pages with calm:false, so even the harness's "no animations" stylesheet is left out).
 */
const path = require('path');
const { Side } = require('../../parity/lib/side.cjs');
const { loadBuild } = require('../../parity/lib/serve.cjs');
const { loadDriver, requireE2E, withReload } = require('../../parity/drivers/interface.cjs');
const { parseFx } = require('../../parity/lib/plan.cjs');
const { fnv } = require('../../parity/lib/runner.cjs');
const e2eInPage = require('./inpage.cjs');

const ROUND_MS = 2000, MAX_ROUNDS = 8;

const buildOf = arg => loadBuild(arg === 'baseline' ? { kind: 'baseline' } : { kind: 'file', file: path.resolve(arg) });
const driverOf = name => requireE2E(loadDriver(name || 'v121'));

/*
 * Opens one page. o:
 *   build, driver       from buildOf() / driverOf()
 *   viewport            { width, height }
 *   mobile              true: a phone context (touch, mobile viewport handling)
 *   storage             { localStorage key: raw string } in place before the game's first script, or null
 *   calm                false: leave CSS animations on (the layout test)
 *   boot                'manual': do not dismiss the boot overlay (the keyboard test presses a key instead)
 *   motion              'full' (default) | 'reduce'
 *   id                  seeds the dice
 * Resolves to { side, snap }: the Side (side.page is the Playwright page) and the first snapshot.
 */
async function open(browser, o) {
  const side = new Side({
    label: 'B', build: o.build, driver: o.driver, seed: fnv('e2e:' + (o.id || '')), fx: parseFx('seeded'), flavor: 0.5,
    motion: o.motion || 'full', roundMs: ROUND_MS, maxRounds: MAX_ROUNDS,
    viewport: o.viewport, calm: o.calm, boot: o.boot,
    contextOptions: o.mobile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {},
    initScripts: [`(${e2eInPage.toString()})();`]
  });
  const snap = await side.open(browser, null, o.storage || null);
  return { side, snap };
}

// One move through the driver, with an optional scripted draw queue. Throws if it could not be made cleanly.
async function step(side, snap, move, queue) {
  const legal = withReload(snap.legal, snap.dialog);
  if (!legal.includes(move)) throw new Error(`move ${move} is not legal here (legal: ${legal.join(' ')})`);
  const next = await side.step(move, queue || null);
  if (next.actError) throw new Error(`could not make the move ${move}: ${next.actError}`);
  return next;
}

// Page errors, console errors, refused requests, exceptions out of timers: anything that must fail a test.
const trouble = (side, snap) => side.drainTrouble().concat(snap && snap.thrown ? snap.thrown : []);

/*
 * Known failures. A test gives every result an id of the form  check@fixture@viewport  (the keyboard test:
 * check@stage). --expect-fail takes a list of patterns: a pattern names one to three of those parts, left to
 * right, and "*" stands for any one part. So "log-not-covered" covers that check everywhere,
 * "log-not-covered@fresh-ad" in one fixture, "min-font@*@1280x720" at one viewport.
 *
 *   a result that fails and matches a pattern        -> xfail   (known; does not fail the run)
 *   a result that fails and matches none             -> FAIL
 *   a pattern that no failing result matched         -> stale   (fails the run: the thing got fixed, or the id is
 *                                                                wrong; either way the list must say what is true)
 */
class Known {
  constructor(patterns) {
    this.patterns = (patterns || []).map(p => ({ text: p, parts: p.split('@'), used: 0 }));
  }
  match(id) {
    const parts = id.split('@');
    for (const p of this.patterns) {
      if (p.parts.length > parts.length) continue;
      if (p.parts.every((x, i) => x === '*' || x === parts[i])) return p;
    }
    return null;
  }
  // 'ok' | 'FAIL' | 'xfail' for one result
  judge(id, failed) {
    if (!failed) return 'ok';
    const p = this.match(id);
    if (p) { p.used++; return 'xfail'; }
    return 'FAIL';
  }
  stale() { return this.patterns.filter(p => !p.used).map(p => p.text); }
}

const parseList = v => String(v || '').split(',').map(s => s.trim()).filter(Boolean);

// Plain-text table: rows of cells, first row is the header.
function table(rows) {
  const w = rows[0].map((_, i) => Math.max(...rows.map(r => String(r[i] === undefined ? '' : r[i]).length)));
  return rows.map(r => r.map((c, i) => String(c === undefined ? '' : c).padEnd(w[i])).join('  ').replace(/\s+$/, '')).join('\n');
}

module.exports = { open, step, trouble, buildOf, driverOf, Known, parseList, table, ROUND_MS, MAX_ROUNDS };
