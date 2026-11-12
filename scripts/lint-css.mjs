#!/usr/bin/env node
// The design system's rules for stylesheets, as a to-do list.
//
//   node scripts/lint-css.mjs [styles-dir] [--strict] [--only rule,...] [--all] [--json <file>]
//                                                                       (default styles-dir: src/styles)
//
//   hex          a hex colour outside the files that may hold literals (tokens.css, and the in-world surfaces that keep their own palettes: crt.css, boot.css, claink.css, memo.css).
//                Everywhere else a colour is a var(--token)
//   gradient     linear-, radial- or conic-gradient( outside those files
//   text-shadow  text-shadow outside those files
//   glow         a shadow with no offset and a blur (box-shadow: 0 0 12px ..., drop-shadow(0 0 ...)) outside those
//                files. A ring (0 0 0 2px) is not a glow
//   font-size    a font size under 13px, anywhere (px, or rem at 16px; em and % cannot be judged here)
//   media        a media query with a condition outside the allowed set, anywhere:
//                  width   (max-width:640px) (min-width:641px) (max-width:1024px) (min-width:1025px) (min-width:1500px)
//                  height  (max-height:600px) (max-height:619px) (min-height:620px) (min-height:900px)
//                  motion  (prefers-reduced-motion:reduce) (prefers-reduced-motion:no-preference)
//
// Default: prints the report and exits 0 (today's single stylesheet breaks all of these; the report is the list of
// what the redesign has to remove). --strict: exit 1 on any finding. --only: just these rules. --all: every line,
// not the first few per rule.
import fs from "node:fs";
import path from "node:path";

const RULES = {
  hex: "hex colours outside tokens.css, crt.css, boot.css, claink.css, memo.css",
  gradient: "gradients outside those files",
  "text-shadow": "text-shadow outside those files",
  glow: "glow shadows (no offset, blurred) outside those files",
  "font-size": "font sizes under 13px",
  media: "media queries outside the allowed set"
};
const LITERALS_OK = new Set(["tokens.css", "crt.css", "boot.css", "claink.css", "memo.css"]);
const MIN_FONT = 13;
const MEDIA_OK = new Set([
  "(max-width:640px)", "(min-width:641px)", "(max-width:1024px)", "(min-width:1025px)", "(min-width:1500px)",
  "(max-height:600px)", "(max-height:619px)", "(min-height:620px)", "(min-height:900px)",
  "(prefers-reduced-motion:reduce)", "(prefers-reduced-motion:no-preference)",
  "(pointer:coarse)",  // only together with a stacked-layout condition: a thumb needs 44px
  "(orientation:landscape)"   // only together with max-height:600px: a phone on its side, whatever its width
]);

const argv = process.argv.slice(2);
const take = flag => { const i = argv.indexOf(flag); return i >= 0 ? argv.splice(i, 2)[1] : null; };
const has = flag => { const i = argv.indexOf(flag); if(i < 0) return false; argv.splice(i, 1); return true; };
const jsonFile = take("--json"), onlyArg = take("--only");
const strict = has("--strict"), all = has("--all");
if(argv.some(a => a.startsWith("--"))){ console.error("usage: node scripts/lint-css.mjs [styles-dir] [--strict] [--only rule,...] [--all] [--json <file>]"); process.exit(2); }
const only = onlyArg ? onlyArg.split(",").map(s => s.trim()).filter(Boolean) : null;
for(const r of only || []) if(!RULES[r]){ console.error(`lint-css: unknown rule ${r}. rules: ${Object.keys(RULES).join(", ")}`); process.exit(2); }
const root = path.resolve(argv[0] || "src/styles");
if(!fs.existsSync(root)){ console.error("lint-css: no such directory: " + root); process.exit(2); }

function files(dir){
  const out = [];
  for(const e of fs.readdirSync(dir, { withFileTypes: true })){
    const p = path.join(dir, e.name);
    if(e.isDirectory()) out.push(...files(p));
    else if(e.name.endsWith(".css")) out.push(p);
  }
  return out.sort();
}

// Comments become spaces (newlines kept), so offsets and line numbers stay true.
const blank = css => css.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, " "));
// Split on top-level commas (not inside parentheses).
function layers(value){
  const out = []; let depth = 0, cur = "";
  for(const ch of value){ if(ch === "(") depth++; else if(ch === ")") depth--; if(ch === "," && depth === 0){ out.push(cur); cur = ""; } else cur += ch; }
  out.push(cur);
  return out.map(s => s.trim()).filter(Boolean);
}
// The lengths of one shadow, in order: x, y, blur, spread. Colours and keywords are dropped.
const lengths = shadow => (shadow.replace(/(rgba?|hsla?|color-mix|var|oklch|oklab)\([^()]*(\([^()]*\)[^()]*)*\)/g, " ").match(/(?<![\w#.-])-?\d*\.?\d+(px|rem|em)?(?![\w%.])/g) || []).map(parseFloat);
const isGlow = shadow => { const n = lengths(shadow); return n.length >= 3 && n[0] === 0 && n[1] === 0 && n[2] > 0; };
// Font sizes named in a value, in px. clamp(11px, 1vw, 14px) names 11 and 14; the smallest is what can be rendered.
const pxSizes = value => [...value.matchAll(/(?<![\w.-])(\d*\.?\d+)(px|rem)\b/g)].map(m => parseFloat(m[1]) * (m[2] === "rem" ? 16 : 1));

function scan(file){
  const name = path.basename(file), css = blank(fs.readFileSync(file, "utf8"));
  const literalsOk = LITERALS_OK.has(name);
  const found = [];
  const lineAt = i => { let n = 1; for(let k = 0; k < i; k++) if(css.charCodeAt(k) === 10) n++; return n; };
  const stack = [];           // open blocks: the text before each "{"
  let start = 0;              // where the current declaration or prelude began
  const selector = () => { for(let k = stack.length - 1; k >= 0; k--) if(!stack[k].startsWith("@")) return stack[k]; return stack.length ? stack[stack.length - 1] : ""; };
  const add = (rule, at, what, detail) => found.push({ rule, file: name, line: lineAt(at), selector: selector().slice(0, 70), what, detail });

  const declaration = (text, at) => {
    const m = /^\s*([\w-]+)\s*:\s*([\s\S]+?)\s*$/.exec(text);
    if(!m) return;
    const prop = m[1].toLowerCase(), value = m[2].replace(/\s+/g, " "), pos = at + text.indexOf(m[1]);
    const show = `${prop}:${value}`.slice(0, 90);
    // a mask is not paint: its gradient and its #000 decide what shows, not what colour it is
    const mask = /^(-webkit-)?mask(-image)?$/.test(prop);
    if(!literalsOk && !mask){
      if(!/url\(\s*["']?#/.test(value)) for(const h of value.match(/#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![0-9a-zA-Z_-])/g) || []) add("hex", pos, show, h.toLowerCase());
      for(const g of value.match(/(?:repeating-)?(?:linear|radial|conic)-gradient(?=\()/g) || []) add("gradient", pos, show, g);
      if(prop === "text-shadow" && !/^(none|0|initial|inherit|unset)$/i.test(value)) add("text-shadow", pos, show, "text-shadow");
      if(prop === "box-shadow" || prop === "-webkit-box-shadow") for(const l of layers(value)) if(isGlow(l)) add("glow", pos, show, "box-shadow");
      if(prop === "filter" || prop === "backdrop-filter") for(const d of value.match(/drop-shadow\(([^()]|\([^()]*\))*\)/g) || []) if(isGlow(d.slice(12, -1))) add("glow", pos, show, "drop-shadow");
    }
    if(prop === "font-size" || prop === "font"){
      // in the shorthand the size is the first length (the weight has no unit; a length after "/" is the line height)
      const first = prop === "font" ? /(?<![\w.\/-])(\d*\.?\d+)(px|rem)\b/.exec(value) : null;
      const sizes = prop === "font" ? (first ? pxSizes(first[0]) : []) : pxSizes(value);
      if(sizes.length && Math.min(...sizes) < MIN_FONT) add("font-size", pos, show, Math.min(...sizes) + "px");
    }
  };

  let quote = null;
  for(let i = 0; i < css.length; i++){
    const ch = css[i];
    if(quote){ if(ch === "\\") i++; else if(ch === quote) quote = null; continue; }
    if(ch === '"' || ch === "'"){ quote = ch; continue; }
    if(ch === "{"){
      const prelude = css.slice(start, i).trim().replace(/\s+/g, " ");
      if(/^@media\b/i.test(prelude)){
        const conds = (prelude.match(/\([^()]*\)/g) || []).map(c => c.toLowerCase().replace(/\s+/g, ""));
        const bad = conds.filter(c => !MEDIA_OK.has(c));
        stack.push(prelude);
        for(const c of bad) add("media", start + css.slice(start, i).search(/\S/), prelude.slice(0, 90), c);
      } else stack.push(prelude);
      start = i + 1;
    } else if(ch === "}"){
      if(stack.length) declaration(css.slice(start, i), start);
      stack.pop();
      start = i + 1;
    } else if(ch === ";"){
      if(stack.length) declaration(css.slice(start, i), start);
      start = i + 1;
    }
  }
  return found;
}

const list = files(root);
let found = [];
let lineCount = 0;
for(const f of list){ found.push(...scan(f)); lineCount += fs.readFileSync(f, "utf8").split("\n").length; }
if(only) found = found.filter(x => only.includes(x.rule));

const where = path.relative(process.cwd(), root) || ".";
const tally = (items, key) => { const m = new Map(); for(const x of items) m.set(key(x), (m.get(key(x)) || 0) + 1); return [...m.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]))); };
const top = (pairs, n) => pairs.slice(0, n).map(([k, c]) => `${k} x${c}`).join(", ") + (pairs.length > n ? `, and ${pairs.length - n} more` : "");

console.log(`lint-css: ${where} (${list.length} file${list.length === 1 ? "" : "s"}, ${lineCount} lines)${only ? "   only: " + only.join(", ") : ""}\n`);
console.log("  findings  rule         what");
for(const r of Object.keys(RULES)){ if(only && !only.includes(r)) continue; console.log(`  ${String(found.filter(x => x.rule === r).length).padStart(8)}  ${r.padEnd(12)} ${RULES[r]}`); }
for(const r of Object.keys(RULES)){
  const mine = found.filter(x => x.rule === r);
  if(!mine.length) continue;
  console.log(`\n${r}: ${mine.length} in ${tally(mine, x => x.file).map(([f, c]) => `${f} (${c})`).join(", ")}`);
  if(r === "hex") console.log(`  most used: ${top(tally(mine, x => x.detail), 12)}`);
  if(r === "font-size") console.log(`  by size: ${top(tally(mine, x => x.detail).sort((a, b) => parseFloat(a[0]) - parseFloat(b[0])), 20)}`);
  if(r === "media") console.log(`  by condition: ${top(tally(mine, x => x.detail), 20)}`);
  if(r === "gradient") console.log(`  by kind: ${top(tally(mine, x => x.detail), 6)}`);
  if(r !== "media") console.log(`  rules with the most: ${top(tally(mine, x => x.selector || "(top level)"), 6)}`);
  // one line per declaration (a background with five gradients is one thing to fix, five findings)
  const places = new Map();
  for(const x of mine){ const k = `${x.file}:${x.line}:${x.what}`; if(!places.has(k)) places.set(k, { x, n: 0, details: new Set() }); const p = places.get(k); p.n++; p.details.add(x.detail); }
  const rows = [...places.values()], lines = all ? rows : rows.slice(0, 8);
  for(const { x, n, details } of lines){
    const body = r === "media" ? `${x.what}   not allowed: ${[...details].join(" ")}` : `${x.selector ? x.selector + " { " : ""}${x.what}${x.selector ? " }" : ""}${n > 1 ? "   x" + n : ""}`;
    console.log(`  ${where}/${x.file}:${x.line}  ${body}`);
  }
  if(rows.length > lines.length) console.log(`  ... and ${rows.length - lines.length} more places (--all lists every one, --only ${r} just this rule)`);
}
console.log(`\n${found.length ? (strict ? "LINT-CSS FAILED" : "LINT-CSS REPORT") : "LINT-CSS OK"}: ${found.length} finding${found.length === 1 ? "" : "s"}${found.length && !strict ? " (not enforced; --strict makes them an error)" : ""}`);
if(jsonFile) fs.writeFileSync(jsonFile, JSON.stringify({ ok: !found.length, files: list.length, counts: Object.fromEntries(Object.keys(RULES).map(r => [r, found.filter(x => x.rule === r).length])), findings: found }, null, 1));
process.exit(strict && found.length ? 1 : 0);
