'use strict';
/*
 * The save fixtures: what is in test/saves/manifest.json and the files it names.
 *
 * A fixture is what a player's browser had in localStorage when they closed the tab. Two shapes:
 *   { file }      one save (a raw string, usually JSON). The test puts it where a save can come from: under the
 *                 autosave key before the page loads, and under the manual-save key before pressing Load.
 *   { storage }   a whole localStorage image, { key: file }. Used when the KEYS are the point (a player who last
 *                 played v4-2 has only the v4-2 keys). Page load only: the Load button never reads those keys
 *                 once a run is on screen, because by then the v4-3 autosave exists.
 *
 * The four key names are the compatibility contract. They are written out here, on purpose, and not asked of the
 * driver: a build that renamed one would lose every existing run, and its own driver would never notice.
 */
const fs = require('fs');
const path = require('path');

const DIR = path.resolve(__dirname, '..');
const MANIFEST = path.join(DIR, 'manifest.json');
const KEYS = { autosave: 'tst-autosave-v4-3', manual: 'tst-save-v4-3', legacy: ['tst-save-v4-2', 'tst-autosave-v4-2'] };
const ALL_KEYS = [KEYS.autosave, KEYS.manual].concat(KEYS.legacy);

const EXPECT_KEYS = ['dialog', 'dock', 'cause', 'said', 'legal', 'illegal', 'state'];

// A fixture file holds exactly the string that was in localStorage, plus one trailing newline.
const readRaw = file => fs.readFileSync(path.join(DIR, file), 'utf8').replace(/\n$/, '');
const writeRaw = (file, raw) => { fs.mkdirSync(path.dirname(path.join(DIR, file)), { recursive: true }); fs.writeFileSync(path.join(DIR, file), raw + '\n'); };

const getAt = (o, p) => p.split('.').reduce((x, k) => (x === null || x === undefined ? undefined : x[k]), o);

function loadManifest() {
  const m = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  if (!m || !Array.isArray(m.fixtures)) throw new Error('test/saves/manifest.json: expected { fixtures: [...] }');
  const seen = new Set();
  for (const f of m.fixtures) {
    const where = `manifest fixture ${JSON.stringify(f.id)}`;
    if (!/^[a-z0-9][a-z0-9.-]*$/.test(String(f.id))) throw new Error(`${where}: bad id`);
    if (seen.has(f.id)) throw new Error(`${where}: duplicate id`);
    seen.add(f.id);
    if (f.kind !== 'generated' && f.kind !== 'legacy') throw new Error(`${where}: kind must be "generated" or "legacy"`);
    if (!f.what || !f.how) throw new Error(`${where}: needs "what" and "how"`);
    if (!!f.file === !!f.storage) throw new Error(`${where}: needs exactly one of "file" and "storage"`);
    if (f.storage) for (const k of Object.keys(f.storage)) if (!ALL_KEYS.includes(k)) throw new Error(`${where}: ${k} is not one of the game's storage keys`);
    for (const file of f.file ? [f.file] : Object.values(f.storage)) if (!fs.existsSync(path.join(DIR, file))) throw new Error(`${where}: ${file} does not exist`);
    if (!f.expect || typeof f.expect !== 'object') throw new Error(`${where}: needs "expect"`);
    for (const k of Object.keys(f.expect)) if (!EXPECT_KEYS.includes(k)) throw new Error(`${where}: unknown expectation "${k}"`);
    if (!('dialog' in f.expect) || !('dock' in f.expect)) throw new Error(`${where}: expect needs both "dialog" and "dock" (what must be on screen once it has loaded)`);
    if (typeof f.terminal !== 'boolean') throw new Error(`${where}: needs "terminal" (true when the save is a finished run)`);
    if (f.terminal !== /^end:/.test(String(f.expect.dialog))) throw new Error(`${where}: terminal must be true exactly when an ending dialog is expected`);
  }
  return m;
}

// The manifest's expectations in the form the parity runner checks (lib/runner.cjs, "expectations").
// expect.state is { 'dotted.path': value }: every path must hold exactly that value in the BASELINE's state after
// loading (and the build's state is compared with the baseline's field by field, as always).
function toRunnerExpect(expect) {
  const x = {};
  for (const k of ['dialog', 'dock', 'cause', 'said', 'legal', 'illegal']) if (k in expect) x[k] = expect[k];
  if (expect.state) {
    const want = expect.state;
    const fn = s => Object.keys(want).every(p => JSON.stringify(getAt(s, p)) === JSON.stringify(want[p]));
    fn.toString = () => 'state has ' + JSON.stringify(want);
    x.state = fn;
  }
  return x;
}

module.exports = { DIR, MANIFEST, KEYS, ALL_KEYS, readRaw, writeRaw, loadManifest, toRunnerExpect, getAt };
