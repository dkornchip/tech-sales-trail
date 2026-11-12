#!/usr/bin/env node
// The house style, checked on every string the copy modules can produce.
//
//   node scripts/lint-copy.mjs [copy-dir] [--strict] [--only rule,...] [--max n] [--allow word,...] [--json <file>]
//                                                                       (default copy-dir: src/copy)
//
// THE CONTRACT. Each <copy-dir>/*.js is an ES module that imports nothing from the DOM. Its exports are strings,
// arrays, plain objects, or functions that return those when called with one params object. The lint imports every
// module, walks every export, and calls every function several times with synthetic params (PROFILES below): counts
// of 0, 1, 2 and a large one, negative money, the longest account name, an empty and a long list. A params object
// answers any property by its name: list-ish names (names, lines, items...) get a list of names, money-ish ones
// (cash, fee, value...) the money, name-ish ones (account, who, trip...) a name, anything else the count; if the
// function throws, the unknown names are retried as a name, as a list, then as a nested object. It can also be
// called (it returns a name) and used as text (it reads as the count), so the older (n) => and (a) => `${a()}`
// shapes work too. Every string that comes out is checked.
//
// A module may export `lint` to steer this (it is not copy and is not checked):
//   export const lint = {
//     skip: true,                               // not a copy module (the variant engine)
//     skip: ["helperName"],                     // ...or just these exports
//     params: { "blitz.late": [{ n: 3 }] },     // call this path with exactly these params instead of the profiles
//                                               // ({ args: [a, b, c] } calls a function that takes several arguments)
//     spoken: true,                             // every string here is read aloud by the announcer
//     exempt: { "sentence-case": ["DESK_TEXT", "SCENE_COPY.club.title"] }   // rule -> path prefixes it does not
//                                               // apply to (say why in a comment next to it)
//   };
// engine.js and index.js are skipped by name.
//
// RULES (the style guide is the voice bible; ids are what --only takes)
//   emoji          no emoji, pictographs or decorative symbols (icons are drawn by the UI)
//   quotes         curly quotes and apostrophes only: no " and no '   (not asked of spoken `say` lines: ASCII there)
//   plural         real plurals: never "(s)"
//   minus          a true minus (U+2212): never a hyphen directly before a digit or "$"
//   ellipsis       no ellipsis made of three dots
//   banned         buff, mana, vibes, epic, lol   (the game's own long-standing lines are not on this list)
//   sentence-case  sentence case: a capital only starts a sentence, a quotation or a segment after a separator,
//                  or belongs to a proper noun on the allowlist (PROPER below; --allow adds to it)
//   len-spoken     announcer lines to be spoken: 6 words          (modules pa*, announcer*, voice*: their `say`
//                                                                  strings, or every string where there are no pairs)
//   len-caption    scene captions: 61 characters                  (modules scene*: strings under a cap* key)
//   len-log        log lines: 90 characters                       (modules log*: every string)
//   render         a string with undefined, NaN, [object Object] or a function's source in it: a template that did
//                  not get what it needed
//   callable       a function that threw for every way the lint knows to call it (add lint.params for it)
//
// MODES. Default: print the report, grouped by rule, and exit 0 (today's copy breaks most of these on purpose: it
// has not been rewritten yet). --strict: exit 1 on any violation. --only: just these rules. --max n: examples per
// rule (default 8; 0 for all). Exit 2: bad usage, a module that cannot be imported, or --strict with no copy to lint.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const RULES = {
  emoji: "emoji, pictographs or decorative symbols",
  quotes: "straight quotes or apostrophes",
  plural: "\"(s)\" plurals",
  minus: "a hyphen before a digit or $ (use the true minus, U+2212)",
  ellipsis: "an ellipsis made of three dots",
  banned: "banned words",
  "sentence-case": "capitals that are not sentence case",
  "len-spoken": "spoken announcer lines over 6 words",
  "len-caption": "scene captions over 61 characters",
  "len-log": "log lines over 90 characters",
  render: "templates that rendered undefined, NaN or an object",
  callable: "functions the lint could not call"
};

/* ---------------------------------------------------------------- what the rules know */
// Proper nouns keep their capitals. The first block is the style guide's own list; the second is the rest of the
// game's world as the voice bible's continuity section names it; the third is all-caps text that is printed that way
// in the world (stamps, posters, system banners). Multi-word entries are matched as phrases.
const PROPER = [
  "Shitcorp, Inc.", "Shitcorp", "Scheisskorp", "clAInk", "President’s Club", "President's Club", "Cabo", "QBR", "PIP", "CRM", "SDR", "HR", "PA", "Friday",
  "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December",
  "Jan", "Feb", "Mar", "Apr", "Jun", "Jul", "Aug", "Sep", "Sept", "Oct", "Nov", "Dec",
  "Monday", "Tuesday", "Wednesday", "Thursday", "Saturday", "Sunday", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun",

  "Matt", "Associate Account Executive", "People & Culture", "Finance", "Collections", "Legal", "Procurement", "RevOps", "IT Security", "Facilities", "Marketing",
  "CRO", "AI Governance Council", "Council", "ChatGDP", "Autonomous Pipeline", "Enterprise Plus", "Enterprise", "Shitcorp AI Use Policy", "Rep of the Month",
  "Japan", "Whistler", "Cancun", "Thailand", "Dubai", "Wikipedia", "Hail Mary", "Hail Marys", "Esc", "SaaS", "AI", "SE", "OS", "IT", "OK", "CEO", "CFO", "VP", "SSO", "SPIFF", "SOC", "GA",

  "Tech Sales Trail", "Marketing Ops", "Customer Success", "Closed Won", "Chat GDP", "PDF", "API",
  "Slack", "Post-it", "PIPs", "ACV", "KPI", "PE",

  "SHITCORP", "SECURE", "ERROR", "OOO", "REVOKED", "WE’RE A FAMILY", "SDR*"
];
const BANNED = [
  ["buff", /\bbuff(?:ed|s|ing)?\b/i], ["mana", /\bmana\b/i], ["vibes", /\bvibes?\b/i], ["epic", /\bepic\b/i], ["lol", /\blol(?:s|z)?\b/i]
];
// Pictographs: everything Unicode calls one (minus the three legal marks that are text), the emoji machinery
// (variation selector, joiner, keycap, flags), and the symbol blocks that only ever decorate.
const PICTO = /(?![©®™])\p{Extended_Pictographic}|[️‍⃣]|[\u{1F1E6}-\u{1F1FF}]|[■-◿☀-➿⠀-⣿⬀-⯿]/gu;
const CAPS = [
  { rule: "len-spoken", module: /^(pa|announcer|voice)/i, unit: "words", max: 6 },
  { rule: "len-caption", module: /^scenes?/i, key: /^cap/i, unit: "characters", max: 61 },
  { rule: "len-log", module: /^logs?/i, unit: "characters", max: 90 }
];
const SKIP_FILES = new Set(["engine.js", "index.js"]);

/* ---------------------------------------------------------------- arguments */
const argv = process.argv.slice(2);
const take = flag => { const i = argv.indexOf(flag); if(i < 0) return null; if(i + 1 >= argv.length){ console.error(`${flag} needs a value`); process.exit(2); } return argv.splice(i, 2)[1]; };
const has = flag => { const i = argv.indexOf(flag); if(i < 0) return false; argv.splice(i, 1); return true; };
const jsonFile = take("--json"), onlyArg = take("--only"), maxArg = take("--max"), allowArg = take("--allow");
const strict = has("--strict");
if(argv.some(a => a.startsWith("--"))){ console.error("usage: node scripts/lint-copy.mjs [copy-dir] [--strict] [--only rule,...] [--max n] [--allow word,...] [--json <file>]"); process.exit(2); }
const only = onlyArg ? onlyArg.split(",").map(s => s.trim()).filter(Boolean) : null;
for(const r of only || []) if(!RULES[r]){ console.error(`lint-copy: unknown rule ${r}. rules: ${Object.keys(RULES).join(", ")}`); process.exit(2); }
const maxShown = maxArg === null ? 8 : Number(maxArg);
const dir = path.resolve(argv[0] || "src/copy");
const where = path.relative(process.cwd(), dir) || ".";

/* ---------------------------------------------------------------- synthetic params */
// The game's own account names, when this is run in the repository (they are proper nouns, and the longest one is
// the "long name" case). Outside it, a list of the same kind.
let ACCOUNTS = ["Acme Quantum", "Feral Unicorn", "Pinecone Pizza", "Quasar Laundry", "Velvet Switchboard", "Caffeine Cathedral"];
try{
  const c = await import(pathToFileURL(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "copy", "names.js")).href);
  if(Array.isArray(c.ACCOUNT_NAMES) && c.ACCOUNT_NAMES.length) ACCOUNTS = c.ACCOUNT_NAMES.slice();
}catch{ /* not in the repository, or constants.js moved: the fallback list stands */ }
const LONGEST = ACCOUNTS.reduce((a, b) => (b.length > a.length ? b : a));
const PROFILES = [
  { id: "n=0", n: 0, money: 0, name: ACCOUNTS[0], list: [], band: "early", flag: false },
  { id: "n=1", n: 1, money: 1, name: ACCOUNTS[1 % ACCOUNTS.length], list: [ACCOUNTS[1 % ACCOUNTS.length]], band: "early", flag: true },
  { id: "n=2", n: 2, money: 2, name: ACCOUNTS[2 % ACCOUNTS.length], list: ACCOUNTS.slice(0, 2), band: "mid", flag: false },
  { id: "n=large", n: 1234567, money: 1234567, name: ACCOUNTS[3 % ACCOUNTS.length], list: ACCOUNTS.slice(0, 6), band: "late", flag: true },
  { id: "negative money", n: 3, money: -1600, name: ACCOUNTS[4 % ACCOUNTS.length], list: ACCOUNTS.slice(0, 3), band: "late", flag: false },
  { id: "long name", n: 3, money: 12400, name: LONGEST, list: [LONGEST, LONGEST, LONGEST], band: "final", flag: true }
];
const MONEY = /cash|money|dollar|amount|value|price|cost|fee|rent|salary|commission|invoice|bill|due|debt|revenue|won|closed|quota|pipeline|delta|net|total|sum|usd|true.?up|discount/i;
const NAME = /name|account|who|whom|company|customer|client|trip|place|city|dept|department|speaker|label|title|text|line$|msg|reason|why|kind|mood|stage|by$|from$|what/i;
const LIST = /names|accounts|lines|items|list|parts|rows|others|entries/i;      // (deals, leads: a count first, a list on a retry)
const FLAG = /^(is|has|can|did|was|should|not|no)[A-Z_]|ok$|yes$|hurt|warn|shielded|first$|again$/;
const NEST = /^(s|st|state|d|deal|ctx|context|meta|params|p|o|opts|facts|run|claink|last|strike|data|vars|v|x)$/;
const ARRAYISH = new Set(["map", "join", "filter", "forEach", "slice", "some", "every", "includes", "reduce", "find", "indexOf", "concat", "flatMap", "at"]);

// How unknown property names are answered: tried in this order until the function stops throwing.
const STRATEGIES = ["count", "name", "list", "nested"];
function makeParams(profile, strategy){
  const answer = key => {
    if(key === "n" || key === "count" || key === "num") return profile.n;
    if(key === "band") return profile.band;
    if(key === "rng" || key === "random" || key === "flavor") return () => 0.5;
    if(FLAG.test(key)) return profile.flag;
    if(LIST.test(key)) return profile.list.slice();
    if(MONEY.test(key)) return profile.money;
    if(NAME.test(key)) return profile.name;
    if(NEST.test(key)) return makeParams(profile, strategy);
    return strategy === "name" ? profile.name : strategy === "list" ? profile.list.slice() : strategy === "nested" ? makeParams(profile, "count") : profile.n;
  };
  // callable (returns a name), usable as text or a number (reads as the count), and iterable like the list
  return new Proxy(function synthetic(){ return profile.name; }, {
    apply: () => profile.name,
    has: () => true,
    get(_, key){
      if(key === Symbol.toPrimitive) return hint => (hint === "number" ? profile.n : String(profile.n));
      if(key === Symbol.iterator) return () => profile.list[Symbol.iterator]();
      if(typeof key === "symbol") return undefined;
      if(key === "then" || key === "toJSON" || key === "constructor" || key === "prototype") return undefined;
      if(key === "toString" || key === "valueOf") return () => String(profile.n);
      if(key === "toLocaleString") return (...a) => profile.n.toLocaleString(...a);
      if(key === "length") return profile.list.length;
      if(ARRAYISH.has(key)) return (...a) => profile.list[key](...a);
      if(/^\d+$/.test(key)) return profile.list[Number(key)];
      return answer(key);
    }
  });
}

/* ---------------------------------------------------------------- collecting strings */
const isPlain = v => v !== null && typeof v === "object" && (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);
const pathText = segs => segs.map((s, i) => (typeof s === "number" ? `[${s}]` : (i ? "." : "") + s)).join("");

// Every string under `value`: [{ segs, call, text, injected }]. `call` names the synthetic profile, if any.
function collect(value, segs, call, out, problems, hints, depth){
  if(depth > 14) return;
  if(typeof value === "string"){ out.push({ segs, call, text: value }); return; }
  if(Array.isArray(value)){ value.forEach((v, i) => collect(v, segs.concat(i), call, out, problems, hints, depth + 1)); return; }
  if(typeof value === "function"){
    if(call && depth > 10) return;
    const key = pathText(segs);
    const given = hints.params && hints.params[key];
    const runs = given ? given.map((p, i) => ({ id: `lint.params[${i}]`, args: isPlain(p) && Array.isArray(p.args) ? p.args : [p] })) : PROFILES.map(p => ({ id: p.id, profile: p }));
    let worked = 0, lastError = null;
    for(const run of runs){
      let result, ok = false;
      if(run.args){ try{ result = value(...run.args); ok = true; }catch(e){ lastError = e; } }
      else for(const strategy of STRATEGIES){
        const p = makeParams(run.profile, strategy);
        try{ result = value(...Array(Math.max(1, value.length)).fill(p)); ok = true; break; }catch(e){ lastError = e; }
      }
      if(!ok) continue;
      worked++;
      collect(result, segs, call ? call + " > " + run.id : run.id, out, problems, hints, depth + 1);
    }
    if(!worked) problems.push({ segs, text: `threw for every synthetic call: ${String(lastError && lastError.message || lastError).slice(0, 120)}` });
    return;
  }
  if(isPlain(value)){ for(const k of Object.keys(value)) collect(value[k], segs.concat(k), call, out, problems, hints, depth + 1); }
  // numbers, booleans, null, Maps, class instances: not copy
}

/* ---------------------------------------------------------------- the checks */
const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const allow = PROPER.concat(ACCOUNTS, allowArg ? allowArg.split(",").map(s => s.trim()).filter(Boolean) : []).sort((a, b) => b.length - a.length);
const allowRe = new RegExp("(?<![\\p{L}\\p{N}])(?:" + allow.map(escapeRe).join("|") + ")(?![\\p{L}\\p{N}])", "gu");

// Capitalised words that are not where sentence case puts a capital.
function notSentenceCase(text){
  // proper nouns become lower-case filler of the same length, so positions stay true
  const masked = text.replace(allowRe, m => "x".repeat(m.length));
  const bad = [];
  let start = true;                                   // the next word may take a capital
  const re = /([\p{L}][\p{L}\p{N}’'*-]*)|([.!?…:;]+["”’)\]]*(?=\s|$))|(["“‘(\[]|\s[·•|/—–-]\s|\n)|(\S)/gu;
  for(let m; (m = re.exec(masked));){
    if(m[1]){
      const word = m[1];
      if(/^\p{Lu}/u.test(word) && !start && word.length > 1) bad.push(text.substr(m.index, word.length));
      start = false;
    } else if(m[2] || m[3]) start = true;             // sentence end, opening quote or bracket, separator
    else start = false;                               // a digit or symbol: "3 Leads" is not a sentence start
  }
  return bad;
}

function check(entry, moduleName, hints, moduleHasSay){
  const { text, segs } = entry;
  const found = [];
  const add = (rule, why) => found.push({ rule, why });
  const keys = segs.filter(s => typeof s === "string");
  const underSay = keys.some(k => /^say$/i.test(k)), underShow = keys.some(k => /^show$/i.test(k));

  const pict = text.match(PICTO);
  if(pict) add("emoji", [...new Set(pict)].map(c => `${c.trim() || "?"} U+${c.codePointAt(0).toString(16).toUpperCase()}`).join(" "));
  if(!underSay && /["']/.test(text)) add("quotes", `${(text.match(/["']/g) || []).length} straight`);
  if(/\(s\)/i.test(text)) add("plural", "(s)");
  const hy = text.match(/-(?=[\d$])/g);
  if(hy) add("minus", `${hy.length} hyphen${hy.length === 1 ? "" : "s"} before a digit or $`);
  if(/\.\.\./.test(text)) add("ellipsis", "...");
  const words = BANNED.filter(([, re]) => re.test(text)).map(([w]) => w);
  if(words.length) add("banned", words.join(", "));
  const caps = notSentenceCase(text);
  if(caps.length) add("sentence-case", [...new Set(caps)].join(", "));
  if(/\bundefined\b|\bNaN\b|\[object [A-Z]\w*\]|=>\s|\bfunction\s*\(/.test(text)) add("render", "looks unrendered");

  for(const cap of CAPS){
    if(!cap.module.test(moduleName) && !(cap.rule === "len-spoken" && hints.spoken)) continue;
    if(cap.rule === "len-spoken"){
      // {say, show} pairs: only `say` is spoken. No pairs in the module: every string is.
      if(underShow || (moduleHasSay && !underSay)) continue;
    } else if(cap.key && !keys.some(k => cap.key.test(k))) continue;
    const size = cap.unit === "words" ? text.trim().split(/\s+/).filter(Boolean).length : [...text].length;
    if(size > cap.max) add(cap.rule, `${size} ${cap.unit} (limit ${cap.max})`);
  }
  return found;
}

/* ---------------------------------------------------------------- run */
if(!fs.existsSync(dir)){
  console.log(`lint-copy: ${where} does not exist: there is no copy to lint${strict ? "" : " (nothing to report)"}.`);
  process.exit(strict ? 2 : 0);
}
const files = fs.readdirSync(dir).filter(f => /\.(js|mjs)$/.test(f)).sort();
const violations = [];        // { rule, module, path, call, text, why }
const broken = [];
let modules = 0, entries = 0, strings = 0;
const skipped = [];
for(const file of files){
  if(SKIP_FILES.has(file)){ skipped.push(file); continue; }
  let mod;
  try{ mod = await import(pathToFileURL(path.join(dir, file)).href); }
  catch(e){ broken.push(`${file}: cannot be imported in Node (${String(e && e.message || e).split("\n")[0].slice(0, 140)}). A copy module must not touch the DOM or import anything that does.`); continue; }
  const hints = isPlain(mod.lint) ? mod.lint : {};
  if(hints.skip === true){ skipped.push(file); continue; }
  modules++;
  const name = file.replace(/\.(js|mjs)$/, "");
  const out = [], problems = [];
  for(const key of Object.keys(mod)){
    if(key === "lint" || (Array.isArray(hints.skip) && hints.skip.includes(key))) continue;
    entries++;
    collect(mod[key], [key], null, out, problems, hints, 0);
  }
  for(const p of problems) violations.push({ rule: "callable", module: file, path: pathText(p.segs), call: null, text: "", why: p.text, variants: 1 });
  const moduleHasSay = out.some(e => e.segs.some(s => typeof s === "string" && /^say$/i.test(s)));
  // One violation per place and rule, however many of the synthetic calls produce it: a template that is wrong for
  // six profiles is one thing to fix. The first string that showed it is the example; `variants` counts the rest.
  const seen = new Set(), at = new Map();
  for(const e of out){
    const k = pathText(e.segs) + "\u0001" + e.text;
    if(seen.has(k)) continue;
    seen.add(k);
    strings++;
    for(const f of check(e, name, hints, moduleHasSay)){
      const here = pathText(e.segs);
      if(isPlain(hints.exempt) && Array.isArray(hints.exempt[f.rule]) && hints.exempt[f.rule].some(prefix => here === prefix || here.startsWith(prefix + ".") || here.startsWith(prefix + "["))) continue;
      const id = f.rule + "\u0001" + pathText(e.segs);
      if(at.has(id)){ at.get(id).variants++; continue; }
      const v = { rule: f.rule, module: file, path: pathText(e.segs), call: e.call, text: e.text, why: f.why, variants: 1 };
      at.set(id, v);
      violations.push(v);
    }
  }
}

const shown = only ? violations.filter(v => only.includes(v.rule)) : violations;
for(const b of broken) console.error("lint-copy: " + b);
console.log(`lint-copy: ${where} (${modules} module${modules === 1 ? "" : "s"}, ${entries} exports, ${strings} distinct strings checked${skipped.length ? "; skipped " + skipped.join(", ") : ""})${only ? "   only: " + only.join(", ") : ""}\n`);
console.log("  violations  rule           what");
for(const r of Object.keys(RULES)){ if(only && !only.includes(r)) continue; console.log(`  ${String(shown.filter(v => v.rule === r).length).padStart(10)}  ${r.padEnd(14)} ${RULES[r]}`); }
const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
for(const r of Object.keys(RULES)){
  const mine = shown.filter(v => v.rule === r);
  if(!mine.length) continue;
  const per = new Map(); for(const v of mine) per.set(v.module, (per.get(v.module) || 0) + 1);
  console.log(`\n${r}: ${mine.length} in ${[...per.entries()].map(([m, c]) => `${m} (${c})`).join(", ")}`);
  const list = maxShown > 0 ? mine.slice(0, maxShown) : mine;
  for(const v of list) console.log(`  ${v.module}  ${clip(v.path + (v.call ? " (" + v.call + ")" : ""), 44).padEnd(44)}  ${v.text ? "“" + clip(v.text.replace(/\n/g, "\\n"), 70) + "”  " : ""}${v.why}${v.variants > 1 ? `   (and in ${v.variants - 1} more of its renderings)` : ""}`);
  if(mine.length > list.length) console.log(`  ... and ${mine.length - list.length} more (--max 0 lists every one, --only ${r} just this rule)`);
}
const total = shown.length;
console.log(`\n${total ? (strict ? "LINT-COPY FAILED" : "LINT-COPY REPORT") : "LINT-COPY OK"}: ${total} violation${total === 1 ? "" : "s"}${total && !strict ? " (not enforced; --strict makes them an error)" : ""}${broken.length ? `, ${broken.length} module(s) could not be imported` : ""}`);
if(jsonFile) fs.writeFileSync(jsonFile, JSON.stringify({ ok: !total && !broken.length, modules, entries, strings, counts: Object.fromEntries(Object.keys(RULES).map(r => [r, violations.filter(v => v.rule === r).length])), violations, broken, skipped }, null, 1));
process.exit(broken.length ? 2 : strict && (total || !modules) ? (modules ? 1 : 2) : 0);
