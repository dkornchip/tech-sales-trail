'use strict';
/*
 * Serving the two builds to the browser, entirely through Playwright request routing: no web server, no network.
 *
 *   A  the frozen baseline. It is one HTML file with three CDN <script src> tags, so the three cdnjs URLs are
 *      answered from node_modules. One documented patch is applied to its text on the way out (see patchBaseline).
 *   B  the build under test, served byte for byte.
 *
 * Every request a page makes is checked here. Anything that is not on the short list below is recorded as an
 * unexpected request, and an unexpected request fails the run.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const REPO = path.resolve(__dirname, '..', '..', '..');
const BASELINE = path.join(REPO, 'test', 'baseline', 'v1.21', 'index.html');
const BASELINE_SHA_FILE = path.join(REPO, 'test', 'baseline', 'v1.21', 'sha256.txt');
const ORIGIN = 'http://tst.test';

// The babel block of the frozen baseline (everything between <script type="text/babel"> and its </script>).
// Pinned so that a harness bug can never serve altered game logic as "the baseline" without saying so.
const BABEL_SHA256 = '04e9c3d4317abb1461c91367b2d66d4acd7f8749554ab7ec9554398fad41bcda';

const CDN = {
  'https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js': 'node_modules/react/umd/react.production.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js': 'node_modules/react-dom/umd/react-dom.production.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.28.4/babel.min.js': 'node_modules/@babel/standalone/babel.min.js'
};

const sha256 = text => crypto.createHash('sha256').update(text).digest('hex');
const count = (text, needle) => text.split(needle).length - 1;

// Replace `find` with `repl`, insisting that `find` occurs exactly once. Mutants are built from this, so a
// mutant whose target text has drifted is an error, never a silent no-op.
function replaceOnce(text, find, repl, label) {
  const n = count(text, find);
  if (n !== 1) throw new Error(`${label || 'patch'}: expected exactly 1 occurrence of ${JSON.stringify(find.slice(0, 70))}, found ${n}`);
  return text.replace(find, () => repl);
}

// The three script blocks of the baseline, as [start, end) offsets of their bodies.
function blocks(html) {
  const plainOpen = '<script>\n';
  const a0 = html.indexOf(plainOpen);
  const a1 = html.indexOf('</script>', a0);
  const babelOpen = '<script type="text/babel">';
  const b0 = html.indexOf(babelOpen);
  const b1 = html.indexOf('</script>', b0);
  if (a0 < 0 || a1 < 0 || b0 < 0 || b1 < 0 || !(a0 < a1 && a1 < b0 && b0 < b1)) throw new Error('baseline: could not find the plain and babel script blocks');
  if (count(html, babelOpen) !== 1) throw new Error('baseline: expected exactly one babel block');
  return { plain: [a0 + plainOpen.length, a1], babel: [b0 + babelOpen.length, b1] };
}

/*
 * The one patch the baseline gets: inside its first inline <script> (the scene engine, the sound engine and the
 * shell), every Math.random becomes (window.__TST_FX||Math.random). Those 47 call sites are cosmetic (particles,
 * sound jitter, the PA filler roll); left on Math.random they would eat thousands of draws from the mechanical
 * stream at moments that depend on animation frames. Build B already routes them through globalThis.__TST_FX.
 *
 * Asserted here: exactly 22 sites in the scene engine, 25 in the sound engine, 0 in the shell, and a babel block
 * that is byte-identical to the file on disk unless a mutant was asked for.
 */
function patchBaseline(html, mutant, adapt) {
  const onDisk = sha256(html);
  const want = fs.readFileSync(BASELINE_SHA_FILE, 'utf8').trim().split(/\s+/)[0];
  if (onDisk !== want) throw new Error(`baseline: sha256 ${onDisk} does not match ${path.relative(REPO, BASELINE_SHA_FILE)} (${want})`);

  const b = blocks(html);
  const plain = html.slice(b.plain[0], b.plain[1]);
  const babel = html.slice(b.babel[0], b.babel[1]);
  if (sha256(babel) !== BABEL_SHA256) throw new Error(`baseline: babel block sha256 is ${sha256(babel)}, expected ${BABEL_SHA256}`);

  const audioAt = plain.indexOf('/* ===== Tech Sales Trail v1.14: sound engine');
  const shellAt = plain.indexOf('/* ===== Tech Sales Trail v1.14: header sound controls');
  if (!(audioAt > 0 && shellAt > audioAt)) throw new Error('baseline: could not find the three IIFEs in the plain script');
  const parts = [plain.slice(0, audioAt), plain.slice(audioAt, shellAt), plain.slice(shellAt)];
  const sites = parts.map(p => count(p, 'Math.random'));
  if (sites[0] !== 22 || sites[1] !== 25 || sites[2] !== 0) throw new Error(`baseline: expected 22 + 25 + 0 Math.random sites in scenes / audio / shell, found ${sites.join(' + ')}`);
  const patchedPlain = plain.split('Math.random').join('(window.__TST_FX||Math.random)');
  if (count(patchedPlain, '(window.__TST_FX||Math.random)') !== 47) throw new Error('baseline: the cosmetic patch did not land 47 times');

  let outBabel = babel;
  let applied = null;
  if (mutant) {
    outBabel = mutant.apply(babel, { replaceOnce: (t, f, r) => replaceOnce(t, f, r, 'mutant ' + mutant.name) });
    if (outBabel === babel) throw new Error(`mutant ${mutant.name}: the patch changed nothing`);
    applied = mutant.name;
  }
  // Adaptations: named, documented changes to the baseline that a newer build's driver asks for, so that a
  // difference the build made on purpose does not hide everything after it (see soundAdaptations in
  // drivers/next.cjs). An adapted baseline says so in its label; it is never served silently.
  const adapted = [];
  for (const a of adapt || []) {
    const next = a.apply(outBabel, { replaceOnce: (t, f, r) => replaceOnce(t, f, r, 'adaptation ' + a.name) });
    if (next === outBabel) throw new Error(`adaptation ${a.name}: the patch changed nothing`);
    outBabel = next;
    adapted.push(a.name);
  }
  const out = html.slice(0, b.plain[0]) + patchedPlain + html.slice(b.plain[1], b.babel[0]) + outBabel + html.slice(b.babel[1]);

  // Re-read what is about to be served and check the babel block again.
  const served = out.slice(blocks(out).babel[0], blocks(out).babel[1]);
  if (!applied && !adapted.length && sha256(served) !== BABEL_SHA256) throw new Error('baseline: the babel block changed while patching');
  if ((applied || adapted.length) && sha256(served) === BABEL_SHA256) throw new Error(`${applied ? 'mutant ' + applied : 'adaptation ' + adapted.join(', ')}: the served babel block is still the original`);
  return { html: out, cosmeticSites: sites, babelSha256: sha256(served), mutant: applied, adapted };
}

/*
 * A build ready to serve.
 *   kind 'baseline'  test/baseline/v1.21/index.html + the cosmetic patch (+ an optional mutant, + optional named
 *                    adaptations: spec.adapt, a list of { name, apply })
 *   kind 'file'      any other index.html, untouched
 */
function loadBuild(spec) {
  if (spec.kind === 'baseline') {
    const html = fs.readFileSync(BASELINE, 'utf8');
    const p = patchBaseline(html, spec.mutant || null, spec.adapt || null);
    return { kind: 'baseline', label: (spec.mutant ? 'baseline+' + spec.mutant.name : 'baseline v1.21') + (p.adapted.length ? ' (adapted: ' + p.adapted.join(', ') + ')' : ''), adapted: p.adapted, file: BASELINE, html: p.html, sha256: sha256(html), babelSha256: p.babelSha256, cosmeticSites: p.cosmeticSites, allowCdn: true };
  }
  const file = path.resolve(spec.file);
  const html = fs.readFileSync(file, 'utf8');
  return { kind: 'file', label: path.relative(REPO, file) || file, file, html, sha256: sha256(html), allowCdn: false };
}

/*
 * Routes every request of one browser context. `log` collects what happened:
 *   log.unexpected  URLs that were refused (each one fails the run)
 *   log.fonts       how many Google Fonts requests were answered with an empty body
 *   log.cdn         how many CDN scripts were answered from node_modules
 */
async function route(context, build, pageUrl, log) {
  const cdnBodies = {};
  await context.route('**/*', async r => {
    const url = r.request().url();
    if (url === pageUrl) return r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: build.html });
    if (url === ORIGIN + '/blank.html') return r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: '<!doctype html><meta charset="utf-8"><title>blank</title>' });
    if (build.allowCdn && CDN[url]) {
      if (!cdnBodies[url]) cdnBodies[url] = fs.readFileSync(path.join(REPO, CDN[url]));
      log.cdn++;
      return r.fulfill({ status: 200, contentType: 'application/javascript; charset=utf-8', body: cdnBodies[url] });
    }
    // Google Fonts: answered with nothing, so no console error is logged and no font is ever fetched.
    if (/^https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(url)) {
      log.fonts++;
      return r.fulfill({ status: 200, contentType: /googleapis/.test(url) ? 'text/css' : 'font/woff2', body: '' });
    }
    log.unexpected.push(url);
    return r.abort();
  });
}

module.exports = { REPO, BASELINE, ORIGIN, BABEL_SHA256, sha256, replaceOnce, patchBaseline, loadBuild, route };
