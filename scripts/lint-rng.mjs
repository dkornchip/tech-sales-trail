#!/usr/bin/env node
// Where the dice, the clock and the test hooks may be read.
//
//   node scripts/lint-rng.mjs [src-dir] [--json <file>]        (default src-dir: src)
//
// The game's odds are only testable because every mechanical roll comes from the run's own seeded stream
// (<src>/game/rng.js), and everything cosmetic (particles, sound jitter, which joke) comes from somewhere else. So:
//
//   math-random   Math.random may be read only in <src>/fxrng.js (the one cosmetic stream). Never in <src>/game/**
//                 (the rules roll rnd() from rng.js, whose seed comes from crypto, not from Math.random), nor in
//                 <src>/copy/**, <src>/ui/**, <src>/engine/**, <src>/shell/**, or anywhere else.
//   math-alias    Math itself may not be handed around outside that file (const M = Math; f(Math)): what is then
//                 called on it cannot be seen from here.
//   copy-clock    <src>/copy/** may not read a clock: no Date.now, new Date, Date() or performance.now. Copy that
//                 depends on the time of day cannot be linted, and cannot be the same in two builds.
//   test-hook     A test hook (anything named __TST_... other than the build flag __TST_TEST__ itself, and the
//                 globals TST_CLAINK and TST_DEV) may be touched only inside a branch that tests __TST_TEST__:
//                   if (typeof __TST_TEST__ === "undefined" || __TST_TEST__) { ... globalThis.__TST_RNG ... }
//                 A release build defines the flag as false and the bundler drops the branch, so a hook outside
//                 one would ship.
//
// The files are parsed (with the Babel parser that is already a dev dependency), so a mention in a comment or a
// string is not an offence, and Math["random"] or const { random } = Math is.
// Prints every offender as file:line:column. Exit code: 0 clean; 1 offenders; 2 a file that does not parse.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { parser } = require("@babel/standalone").packages;

const args = process.argv.slice(2);
const jsonAt = args.indexOf("--json");
const jsonFile = jsonAt >= 0 ? args.splice(jsonAt, 2)[1] : null;
if(args.some(a => a.startsWith("--"))){ console.error("usage: node scripts/lint-rng.mjs [src-dir] [--json <file>]"); process.exit(2); }
const root = path.resolve(args[0] || "src");
if(!fs.existsSync(root)){ console.error("lint-rng: no such directory: " + root); process.exit(2); }

const rel = f => path.relative(root, f).split(path.sep).join("/");
const mayRoll = r => r === "fxrng.js";
const HOOK = /^(__TST_(?!TEST__$)\w+|TST_CLAINK|TST_DEV)$/;
const isCopy = r => r.startsWith("copy/");

function files(dir){
  const out = [];
  for(const e of fs.readdirSync(dir, { withFileTypes: true })){
    if(e.name === "node_modules" || e.name.startsWith(".")) continue;
    const p = path.join(dir, e.name);
    if(e.isDirectory()) out.push(...files(p));
    else if(/\.(js|jsx|mjs|cjs)$/.test(e.name)) out.push(p);
  }
  return out.sort();
}

// the name a member expression reads: Math.random, Math["random"], Math?.random
const propName = n => (n.computed ? (n.property.type === "StringLiteral" ? n.property.value : null) : n.property.name);
// Math, window.Math, globalThis.Math
const isNamed = (n, name) => !!n && ((n.type === "Identifier" && n.name === name) ||
  ((n.type === "MemberExpression" || n.type === "OptionalMemberExpression") && propName(n) === name));

function scan(file){
  const r = rel(file), text = fs.readFileSync(file, "utf8"), lines = text.split("\n");
  let ast;
  try{ ast = parser.parse(text, { sourceType: "unambiguous", plugins: ["jsx"], errorRecovery: false }); }
  catch(e){ return { broken: `${r}: ${e.message}` }; }
  const found = [];
  const add = (rule, node, why) => found.push({ rule, file: r, line: node.loc.start.line, column: node.loc.start.column + 1, why, code: (lines[node.loc.start.line - 1] || "").trim().slice(0, 110) });
  // true inside a branch whose condition reads the build flag: if (...__TST_TEST__...) { here }, cond ? here : ..., a && here
  const mentionsFlag = n => { let hit = false; const see = x => { if(!x || typeof x.type !== "string" || hit) return; if(x.type === "Identifier" && x.name === "__TST_TEST__"){ hit = true; return; }
    for(const k of Object.keys(x)){ if(k === "loc" || k === "extra" || /Comments$/.test(k)) continue; const v = x[k]; if(Array.isArray(v)) v.forEach(see); else if(v && typeof v === "object") see(v); } }; see(n); return hit; };
  const walk = (node, parent, key, guarded) => {
    if(!node || typeof node.type !== "string") return;
    const member = node.type === "MemberExpression" || node.type === "OptionalMemberExpression";
    if(!guarded){
      const name = member ? propName(node) : node.type === "Identifier" && !(parent && (parent.type === "MemberExpression" || parent.type === "OptionalMemberExpression") && key === "property" && !parent.computed) ? node.name : null;
      if(typeof name === "string" && HOOK.test(name)) add("test-hook", node, `${name} outside a branch guarded by __TST_TEST__`);
    }
    if(member && propName(node) === "random" && isNamed(node.object, "Math") && !mayRoll(r)) add("math-random", node, "Math.random outside src/game and src/fxrng.js");
    if(node.type === "VariableDeclarator" && node.id.type === "ObjectPattern" && isNamed(node.init, "Math") && !mayRoll(r) &&
      node.id.properties.some(p => p.type === "RestElement" || (p.key && (p.key.name === "random" || p.key.value === "random")))) add("math-random", node, "random taken out of Math outside src/game and src/fxrng.js");
    // Math as a value: anything but the object of a member expression (Math.floor) and typeof Math
    if(node.type === "Identifier" && node.name === "Math" && !mayRoll(r)){
      const asObject = parent && (parent.type === "MemberExpression" || parent.type === "OptionalMemberExpression") && key === "object";
      const asKey = parent && (((parent.type === "MemberExpression" || parent.type === "OptionalMemberExpression") && key === "property" && !parent.computed) || (parent.type === "ObjectProperty" && key === "key" && !parent.computed));
      const destructured = parent && parent.type === "VariableDeclarator" && key === "init" && parent.id.type === "ObjectPattern";   // judged above
      const typeofed = parent && parent.type === "UnaryExpression" && parent.operator === "typeof";
      if(!asObject && !asKey && !destructured && !typeofed) add("math-alias", node, "Math handed around: what is called on it cannot be checked");
    }
    if(isCopy(r)){
      if(member && propName(node) === "now" && (isNamed(node.object, "Date") || isNamed(node.object, "performance"))) add("copy-clock", node, `${isNamed(node.object, "Date") ? "Date.now" : "performance.now"} in src/copy`);
      if((node.type === "NewExpression" || node.type === "CallExpression") && isNamed(node.callee, "Date")) add("copy-clock", node, `${node.type === "NewExpression" ? "new Date" : "Date()"} in src/copy`);
    }
    for(const k of Object.keys(node)){
      if(k === "loc" || k === "leadingComments" || k === "trailingComments" || k === "innerComments" || k === "extra") continue;
      const v = node[k];
      // what a condition on the build flag guards: the consequent of an if or a ?:, and the right side of an &&
      const g = guarded || ((node.type === "IfStatement" || node.type === "ConditionalExpression") && k === "consequent" && mentionsFlag(node.test))
        || (node.type === "LogicalExpression" && node.operator === "&&" && k === "right" && mentionsFlag(node.left));
      if(Array.isArray(v)) for(const c of v) walk(c, node, k, g);
      else if(v && typeof v === "object") walk(v, node, k, g);
    }
  };
  walk(ast.program, null, null, false);
  return { found };
}

const list = files(root);
const offenders = [], broken = [];
for(const f of list){ const s = scan(f); if(s.broken) broken.push(s.broken); else offenders.push(...s.found); }

const where = path.relative(process.cwd(), root) || ".";
for(const b of broken) console.error("lint-rng: cannot parse " + b);
for(const o of offenders) console.log(`${where}/${o.file}:${o.line}:${o.column}  ${o.rule.padEnd(11)} ${o.why}\n    ${o.code}`);
const rolling = list.map(rel).filter(mayRoll).length;
console.log(`${offenders.length || broken.length ? "LINT-RNG FAILED" : "LINT-RNG OK"}: ${list.length} files under ${where} (${rolling} may read Math.random), ${offenders.length} offender${offenders.length === 1 ? "" : "s"}` +
  (offenders.length ? ` (${["math-random", "math-alias", "copy-clock", "test-hook"].map(k => `${k} ${offenders.filter(o => o.rule === k).length}`).join(", ")})` : "") + (broken.length ? `, ${broken.length} unparsed` : ""));
if(jsonFile) fs.writeFileSync(jsonFile, JSON.stringify({ ok: !offenders.length && !broken.length, files: list.length, offenders, broken }, null, 1));
process.exit(broken.length ? 2 : offenders.length ? 1 : 0);
