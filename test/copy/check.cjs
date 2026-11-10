#!/usr/bin/env node
'use strict';
/*
 * Where the words live, and whether the tags are wired up.
 *
 *   node test/copy/check.cjs [--list] [--src <dir>]
 *
 * 1. PLACEMENT. src/game and src/engine must hold no player-facing English outside comments: the words are in
 *    src/copy. Every string literal, template chunk and regular expression in those two trees is read from the
 *    parsed source (so comments never count) and is a finding when it looks like something a person could read:
 *      - it has a character that is not plain ASCII and is not drawing material (box and block characters);
 *      - or it has two or more words (runs of two or more letters) around a space;
 *      - or it has a Capitalised or ALL-CAPS word of three letters or more;
 *      - or (scene engine) it is text handed straight to the grid, g.text(...) or g.center(...), with a word in it.
 *    Identifiers are not findings: tags, ids, CSS classes and other kebab-case tokens, camelCase names, single
 *    lower-case words, markup, CSS.
 *    What may stay, and why, is listed below (ALLOW): two whole files and a short list of technical strings, each
 *    with its reason. Anything else fails the check, and so does an entry of that list that no longer matches
 *    anything. --list prints what was allowed.
 *    --src <dir> runs this part alone on another copy of src (for example an older one, to see what it finds).
 *
 * 2. WIRING. Every tag the game logs has a line in src/copy/log.js and every line there is logged somewhere; the
 *    sound map only names tags and announcer lines that exist; every event dialog has its words, one label per
 *    option; every scene has its copy.
 *
 * Exit code: 0 clean; 1 a finding; 2 the check itself could not run.
 */
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..', '..');
const Babel = require(path.join(ROOT, 'node_modules', '@babel', 'standalone'));

/* ------------------------------------------------------------------ what may stay */
// Whole files.
const ALLOW_FILES = {
  'src/game/legacy.js': 'reads saves made before tags and causes existed, by the wording those saves contain',
  'src/engine/scenes/sprites.js': 'sprite art: the lettering is part of the drawing'
};
// Single literals: [file, exact value or RegExp, reason]. A literal is matched in its own file only.
const ALLOW = [
  ['src/game/claink.js', '^Closed \\(Q\\) \\+\\$', 'sanitizeClaink: recognises a line that v1.19 saves kept in a miracle report'],
  ['src/engine/audio/voice.js', /^(Google (UK|US) English( Male| Female)?|Microsoft [A-Z][a-z]+|Daniel|Arthur|Aaron|Alex|Fred|Samantha|Karen|Moira|Tessa|Victoria|Fiona)$/, 'the names of speech-synthesis voices, as browsers report them'],
  ['src/engine/scenes/core.js', '<span class="', 'markup the grid writes'],
  ['src/engine/scenes/player.js', /^<span class=|^position:absolute;/, 'markup and CSS the scene player writes'],
  ['src/engine/scenes/player.js', '(prefers-reduced-motion: reduce)', 'a media query']
];

/* ------------------------------------------------------------------ 1. placement */
function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else if (/\.(js|jsx)$/.test(e.name)) out.push(p);
  }
  return out;
}

// Every literal in a file: {kind: 'str' | 'tpl' | 're' | 'drawn', value, line}. Import/export sources are not literals.
// 'drawn' is a string that also appears as 'str': one inside the text argument of a grid call.
function literals(file) {
  const code = fs.readFileSync(file, 'utf8');
  const ast = Babel.transform(code, { ast: true, code: false, filename: file, sourceType: 'module', babelrc: false, configFile: false, parserOpts: { plugins: ['jsx'] } }).ast;
  const out = [], seen = new Set();
  (function visit(n, key, parent) {
    if (!n || typeof n !== 'object' || seen.has(n)) return;
    seen.add(n);
    if (Array.isArray(n)) { for (const x of n) visit(x, key, parent); return; }
    if (typeof n.type === 'string') {
      const line = n.loc && n.loc.start.line;
      if (n.type === 'StringLiteral') {
        const isSource = parent && /^(Import|Export)/.test(parent.type) && key === 'source';
        if (!isSource) out.push({ kind: 'str', value: n.value, line });
      } else if (n.type === 'TemplateElement') out.push({ kind: 'tpl', value: n.value.cooked == null ? n.value.raw : n.value.cooked, line });
      else if (n.type === 'RegExpLiteral') out.push({ kind: 're', value: n.pattern, line });
      else if (n.type === 'CallExpression' && n.callee.type === 'MemberExpression' && !n.callee.computed && (n.callee.property.name === 'text' || n.callee.property.name === 'center')) {
        // g.text(x, y, TEXT, colour) / g.center(y, TEXT, colour): literals inside the TEXT argument
        const arg = n.arguments[n.callee.property.name === 'text' ? 2 : 1];
        (function inner(m) {
          if (!m || typeof m !== 'object') return;
          if (Array.isArray(m)) { m.forEach(inner); return; }
          if (m.type === 'StringLiteral') out.push({ kind: 'drawn', value: m.value, line: m.loc && m.loc.start.line });
          for (const k of Object.keys(m)) if (k !== 'loc' && k !== 'extra' && !/Comments$/.test(k) && m[k] && typeof m[k] === 'object') inner(m[k]);
        })(arg);
      }
    }
    for (const k of Object.keys(n)) {
      if (k === 'loc' || k === 'extra' || /Comments$/.test(k) || k === 'comments' || k === 'tokens' || k === 'errors') continue;
      if (n[k] && typeof n[k] === 'object') visit(n[k], k, n);
    }
  })(ast.program, null, null);
  return out;
}

// Drawing material: box drawing and block elements (U+2500-259F), and the sprite engine's "opaque blank" mark.
const ART = /[─-▟§]/g;
// A token that is plainly an identifier: kebab-case (CSS classes, storage keys), dotted or colon ids (tags, dialog ids).
const IDENT = /^[a-z0-9]+([-.:][a-zA-Z0-9]+)+$/;

function readable(value) {
  const v = value.replace(ART, '');
  if (/[^\x00-\x7f]/.test(v)) return 'has non-ASCII text';
  const tokens = v.split(/\s+/).filter(Boolean);
  const words = tokens.filter(t => !IDENT.test(t) && /[A-Za-z]{2,}/.test(t));
  if (tokens.length > 1 && words.length >= 2) return 'has several words';
  if (tokens.some(t => !IDENT.test(t) && /(^|[^A-Za-z])[A-Z][A-Za-z]{2,}/.test(t))) return 'has a capitalised word';
  return null;
}

function placement(srcDir) {
  const findings = [], allowed = [], hit = new Set();
  for (const dir of ['game', 'engine']) {
    for (const abs of walk(path.join(srcDir, dir), [])) {
      const file = 'src/' + path.relative(srcDir, abs).split(path.sep).join('/');
      for (const l of literals(abs)) {
        const why = l.kind === 'drawn' ? (/[A-Za-z]{2,}/.test(l.value) ? 'is drawn into a scene and has a word in it' : null) : readable(l.value);
        if (!why) continue;
        if (ALLOW_FILES[file]) { allowed.push({ file, line: l.line, value: l.value, because: ALLOW_FILES[file] }); continue; }
        const rule = ALLOW.find(([f, m]) => f === file && (m instanceof RegExp ? m.test(l.value) : m === l.value));
        if (rule) { hit.add(rule); allowed.push({ file, line: l.line, value: l.value, because: rule[2] }); continue; }
        findings.push({ file, line: l.line, kind: l.kind, value: l.value, why });
      }
    }
  }
  const unused = ALLOW.filter(r => !hit.has(r));
  return { findings, allowed, unused };
}

/* ------------------------------------------------------------------ 2. wiring */
const load = rel => import(pathToFileURL(path.join(ROOT, rel)).href);
const TAG = /^(act|close|deal|evt|week|pay|stress|coffee|mgr|risk|qbr|end|ck|ach|sys)\.[A-Za-z0-9.]+$/;

async function wiring() {
  const problems = [];
  const { LOG, CLOSE_SOURCE } = await load('src/copy/log.js');
  const { EVENT_COPY } = await load('src/copy/events.js');
  const { ENDINGS } = await load('src/copy/endings.js');
  const { LINES } = await load('src/copy/pa.js');
  const { SCENE_COPY } = await load('src/copy/scenes.js');
  const { ACHIEVEMENTS } = await load('src/copy/names.js');
  const { EVENTS } = await load('src/game/events.js');
  const map = await load('src/engine/audio/tagmap.js');

  // tags: logged <-> worded
  const used = new Map();
  for (const abs of walk(path.join(ROOT, 'src/game'), [])) {
    for (const l of literals(abs)) if (l.kind === 'str' && TAG.test(l.value)) used.set(l.value, path.relative(ROOT, abs) + ':' + l.line);
  }
  const keys = Object.keys(LOG);
  for (const k of keys) {
    if (!TAG.test(k)) problems.push(`src/copy/log.js: "${k}" is not a tag (lower-case group, a dot, a name)`);
    if (typeof LOG[k] !== 'function') problems.push(`src/copy/log.js: "${k}" is not a function of its params`);
    if (!used.has(k)) problems.push(`src/copy/log.js: "${k}" has a line but the game never logs it`);
  }
  for (const [t, at] of used) if (!Object.prototype.hasOwnProperty.call(LOG, t)) problems.push(`${at}: logs "${t}", which has no line in src/copy/log.js`);
  for (const s of ['negotiations', 'close', 'friday', 'hail']) if (typeof CLOSE_SOURCE[s] !== 'string') problems.push(`src/copy/log.js: CLOSE_SOURCE has no "${s}"`);

  // the sound map names real tags, real announcer lines and real dialogs
  for (const [name, table] of [['TAG_SOUND', map.TAG_SOUND], ['CLOSE_TAGS', map.CLOSE_TAGS], ['RUN_TAGS', map.RUN_TAGS]]) {
    for (const t of Object.keys(table)) if (!Object.prototype.hasOwnProperty.call(LOG, t)) problems.push(`src/engine/audio/tagmap.js: ${name} names "${t}", which is not a tag`);
  }
  if (!Object.prototype.hasOwnProperty.call(LOG, map.CASH_WARN_TAG)) problems.push(`src/engine/audio/tagmap.js: CASH_WARN_TAG "${map.CASH_WARN_TAG}" is not a tag`);
  for (const [t, r] of Object.entries(map.TAG_SOUND)) if (r[2] && !Array.isArray(LINES[r[2]])) problems.push(`src/engine/audio/tagmap.js: "${t}" asks the announcer for "${r[2]}", which src/copy/pa.js does not have`);
  for (const [id, line] of Object.entries(map.MODAL_SAY)) {
    if (!EVENTS[id]) problems.push(`src/engine/audio/tagmap.js: MODAL_SAY names dialog "${id}", which src/game/events.js does not have`);
    if (!Array.isArray(LINES[line])) problems.push(`src/engine/audio/tagmap.js: dialog "${id}" asks the announcer for "${line}", which src/copy/pa.js does not have`);
  }
  for (const [k, bank] of Object.entries(LINES)) if (!Array.isArray(bank) || !bank.length || bank.some(x => typeof x !== 'string' || !x)) problems.push(`src/copy/pa.js: "${k}" must be a non-empty list of lines`);

  // event dialogs: rules <-> words
  for (const id of Object.keys(EVENTS)) {
    const words = EVENT_COPY[id];
    if (!words) { problems.push(`src/copy/events.js: no words for dialog "${id}"`); continue; }
    for (const part of ['title', 'body']) if (typeof words[part] !== 'function') problems.push(`src/copy/events.js: "${id}".${part} must be a function of the event's params`);
    const ids = EVENTS[id].options.map(o => o.id);
    for (const o of EVENTS[id].options) {
      if (typeof o.apply !== 'function') problems.push(`src/game/events.js: "${id}" option "${o.id}" has no apply(state)`);
      if (!words.options || typeof words.options[o.id] !== 'function') problems.push(`src/copy/events.js: "${id}" has no label for option "${o.id}"`);
    }
    for (const o of Object.keys(words.options || {})) if (!ids.includes(o)) problems.push(`src/copy/events.js: "${id}" has a label for "${o}", which is not one of its options`);
  }
  for (const id of Object.keys(EVENT_COPY)) if (!EVENTS[id]) problems.push(`src/copy/events.js: words for "${id}", which src/game/events.js does not have`);

  // endings and scenes
  for (const id of ['club', 'ascension', 'meltdown', 'missed', 'repo', 'fired']) {
    if (!ENDINGS[id] || typeof ENDINGS[id].title !== 'function' || typeof ENDINGS[id].body !== 'function') problems.push(`src/copy/endings.js: "${id}" needs title(p) and body(p)`);
    const sc = SCENE_COPY[id];
    if (!sc || typeof sc.title !== 'string' || !sc.a || !sc.b || typeof sc.card !== 'string' || typeof sc.summary !== 'string') problems.push(`src/copy/scenes.js: "${id}" needs title, a, b, card and summary`);
    else if (!/^[SHITCORPLUBFEDNMAW]+$/.test(sc.card)) problems.push(`src/copy/scenes.js: "${id}".card "${sc.card}" uses a letter the block font does not have`);
  }
  for (const id of ['boot', 'standby']) if (!SCENE_COPY[id] || typeof SCENE_COPY[id].summary !== 'string') problems.push(`src/copy/scenes.js: "${id}" needs a summary`);
  if (typeof ACHIEVEMENTS.whale !== 'string') problems.push('src/copy/names.js: ACHIEVEMENTS has no "whale"');

  return { problems, tags: keys.length, events: Object.keys(EVENTS).length, lines: Object.keys(LINES).length, sounds: Object.keys(map.TAG_SOUND).length };
}

(async () => {
  const list = process.argv.includes('--list');
  const at = process.argv.indexOf('--src');
  const other = at >= 0 ? path.resolve(process.argv[at + 1] || '') : null;
  const p = placement(other || path.join(ROOT, 'src'));
  const w = other ? { problems: [], skipped: true } : await wiring();
  if (!other) for (const r of p.unused) w.problems.push(`test/copy/check.cjs: the ALLOW entry for ${r[0]} (${r[2]}) no longer matches anything; remove it`);
  if (list) {
    console.log('allowed to stay:');
    const by = new Map();
    for (const a of p.allowed) { const k = a.file + '  (' + a.because + ')'; by.set(k, (by.get(k) || 0) + 1); }
    for (const [k, n] of by) console.log(`  ${String(n).padStart(4)}  ${k}`);
    console.log('');
  }
  for (const f of p.findings) console.log(`WORDS  ${f.file}:${f.line}  ${f.kind === 're' ? '/' + f.value + '/' : JSON.stringify(f.value)}  (${f.why})`);
  for (const m of w.problems) console.log(`WIRING ${m}`);
  const ok = !p.findings.length && !w.problems.length;
  console.log(`${ok ? 'PASS' : 'FAIL'}  placement: ${p.findings.length} finding(s) in src/game and src/engine (${p.allowed.length} literal(s) allowed to stay${list ? '' : ', --list shows them'})`);
  console.log(w.skipped ? '      wiring: not checked (--src)' : `      wiring: ${w.problems.length} problem(s); ${w.tags} log tags, ${w.sounds} of them with a sound, ${w.events} event dialogs, ${w.lines} announcer keys`);
  console.log(ok ? 'COPY CHECK OK' : 'COPY CHECK FAILED');
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e && e.stack || e); process.exit(2); });
