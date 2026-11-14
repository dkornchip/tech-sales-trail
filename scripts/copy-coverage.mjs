#!/usr/bin/env node
// Copydeck coverage: is every approved line of the editorial copydeck something the game can actually say?
//
//   node scripts/copy-coverage.mjs [--strict] [--verbose] [--md <file>]
//
// The deck (docs/2.1/TTST_2.1_Editorial_Copydeck.md) is read row by row. Every approved text in it is cut into
// sentences, and each sentence is looked for among the strings the copy modules render (scripts/lint-copy.mjs
// --strings: every string in src/copy, with every function called on the lint's synthetic params). A `{placeholder}`
// in the deck matches whatever the game puts there; typography is compared loosely (the build typesets quotes,
// apostrophes, minus signs and spaces; the deck is plain text).
//
// Each row comes out as one of
//   applied    every sentence of it is rendered somewhere
//   noted      not found as written, and docs/2.1/copy-coverage-notes.json says why (retained, typeset, conditional,
//              instruction, skipped), each with its reason
//   OPEN       not found and not explained: with --strict this fails
//
// This checks that the words exist in the build. It does not prove that every path that could print them was
// played: the engine tests, the render test and the browser tests do that for the paths they cover.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const strict = args.includes("--strict"), verbose = args.includes("--verbose");
const mdOut = args.includes("--md") ? args[args.indexOf("--md") + 1] : null;
const DECK = path.join(ROOT, "docs/2.1/TTST_2.1_Editorial_Copydeck.md");
const NOTES = path.join(ROOT, "docs/2.1/copy-coverage-notes.json");

// ---- what the game renders ----
const tmp = path.join(ROOT, "test-results/copy"); fs.mkdirSync(tmp, { recursive: true });
const stringsFile = path.join(tmp, "strings.json");
execFileSync(process.execPath, [path.join(ROOT, "scripts/lint-copy.mjs"), "--strings", stringsFile], { cwd: ROOT, stdio: "ignore" });
const norm = t => String(t)
  .replace(/[‘’]/g, "'").replace(/[“”"]/g, "").replace(/−/g, "-").replace(/[  ]/g, " ").replace(/[⁠​]/g, "")
  .replace(/…/g, "...").replace(/\s+/g, " ").trim();
const rendered = JSON.parse(fs.readFileSync(stringsFile, "utf8")).map(r => norm(r.text));
const HAY = rendered.join("\n");

// ---- the deck, row by row ----
const lines = fs.readFileSync(DECK, "utf8").split("\n");
const rows = [];            // { section, key, texts: [..] }
let section = "", sub = "";
const cells = line => line.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map(c => c.trim());
const quoted = text => [...text.matchAll(/“([^”]{4,})”/g)].map(m => m[1]);
const code = text => (text.match(/`([^`]+)`/) || [])[1] || text.replace(/[*`]/g, "").slice(0, 48);
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const h = line.match(/^(#{2,3})\s+(.*)$/);
  if (h) { if (h[1] === "##") { section = h[2].replace(/[`*]/g, ""); sub = ""; } else sub = h[2].replace(/[`*]/g, ""); continue; }
  const sec = parseInt(section, 10) || 0;
  if (sec < 2 || sec > 11) continue;                       // 1: the rules. 12, 13: optional art and sign-off notes
  if (/^\s*\|/.test(line)) {
    const c = cells(line);
    if (c.length < 2 || /^-+$/.test(c[1].replace(/[\s:]/g, "")) || /^(Key|Event key|Event \/ condition|Entering week|Ending key|key \/ branch|Title|Trigger|Key \/ location)\b/i.test(c[0])) continue;
    // section 4: key | message | notes (the notes are instructions). Elsewhere every cell after the first is copy.
    // The distinctions table (section 11) is title | condition | subtitle: the condition is a rule, not copy.
    const texts = sec === 4 ? [c[1]] : sec === 11 && /^Optional cosmetic/.test(sub) ? [c[0], c[2]] : c.slice(1);
    rows.push({ section, key: (sub ? "" : "") + code(c[0]) + (sec === 5 || sec === 11 ? "" : ""), texts, line: i + 1 });
    continue;
  }
  const b = line.match(/^\s*-\s+(.*)$/);
  if (b) {
    const m = b[1].match(/^`([^`]+)`(?:[^:]*)?:\s*(.*)$/);
    if (m && sec === 2) { rows.push({ section, key: m[1], texts: [m[2]], line: i + 1 }); continue; }
    if (sec === 8) { rows.push({ section, key: b[1].split(".")[0], texts: [b[1]], line: i + 1 }); continue; }
    const q = quoted(b[1]);
    if (q.length) rows.push({ section, key: code(b[1]), texts: q, line: i + 1 });
    else if (sec === 3 || sec === 9) rows.push({ section, key: b[1].split(":")[0].replace(/[`*]/g, ""), texts: [b[1].replace(/^[^:]+:\s*/, "")], line: i + 1 });
    continue;
  }
  // section 7: **Title:** x / **Body:** x / `match` label: x
  const t = line.match(/^(?:\*\*([^*]+):\*\*|`([a-z]+)`(?: (label|effect))?:)\s*(.+?)\s*$/);
  if (t && sec === 7) { rows.push({ section, key: `${sub} ${t[1] || t[2] + (t[3] ? " " + t[3] : "")}`.trim(), texts: [t[4]], line: i + 1 }); continue; }
  const q = sec >= 9 ? quoted(line) : [];
  if (q.length) rows.push({ section, key: code(line), texts: q, line: i + 1 });
}

// ---- matching ----
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// a sentence of the deck as a pattern: placeholders match anything short
// (a sentence's last full stop is typesetting: a button label has none)
const pattern = s => new RegExp(norm(s).replace(/[.!?]$/, "").split(/\{[^}]*\}/).map(esc).join(".{0,80}?"));
const sentences = text => {
  // editorial notes in brackets are not copy; " / " divides alternatives or parts
  const clean = text.replace(/\bEffect:\s*/g, " / ").replace(/\((?:[A-Z][^()]* [^()]*|[^()]*(?:actual|retain|only if|if |use |dynamic|optional|existing|preserve|keep )[^()]*)\)/g, " ").replace(/[“”"]/g, "");
  return clean.split(/\s+\/\s+|(?<=[.!?])\s+(?=[A-Z{“])/).map(s => s.trim()).filter(s => s.replace(/\{[^}]*\}/g, "").replace(/[^A-Za-z]/g, "").length >= 6);
};
const notes = fs.existsSync(NOTES) ? JSON.parse(fs.readFileSync(NOTES, "utf8")) : {};
const KINDS = ["retained", "typeset", "conditional", "instruction", "skipped"];
const out = [];
for (const r of rows) {
  const want = r.texts.flatMap(sentences);
  if (!want.length) continue;
  const missing = want.filter(s => !pattern(s).test(HAY));
  const id = `${parseInt(r.section, 10)}:${r.key}`;
  const note = notes[id] || notes[`L${r.line}`];
  out.push({ ...r, id, want: want.length, missing, status: !missing.length ? "applied" : note ? "noted" : "OPEN", note });
}

// ---- report ----
const bySection = {};
for (const r of out) { const s = (bySection[r.section] = bySection[r.section] || { applied: 0, noted: 0, OPEN: 0, sentences: 0, found: 0 }); s[r.status]++; s.sentences += r.want; s.found += r.want - r.missing.length; }
const pad = (s, n) => String(s).padEnd(n), num = (s, n) => String(s).padStart(n);
const report = [];
report.push(`copy coverage: ${out.length} deck rows, ${out.reduce((t, r) => t + r.want, 0)} sentences, against ${rendered.length} rendered strings`);
report.push("");
report.push(`  ${pad("deck section", 58)} ${num("rows", 5)} ${num("applied", 8)} ${num("noted", 6)} ${num("open", 5)}   sentences found`);
for (const [name, s] of Object.entries(bySection)) report.push(`  ${pad(name.slice(0, 58), 58)} ${num(s.applied + s.noted + s.OPEN, 5)} ${num(s.applied, 8)} ${num(s.noted, 6)} ${num(s.OPEN, 5)}   ${s.found}/${s.sentences}`);
const tot = out.reduce((t, r) => { t[r.status]++; return t; }, { applied: 0, noted: 0, OPEN: 0 });
report.push(`  ${pad("total", 58)} ${num(out.length, 5)} ${num(tot.applied, 8)} ${num(tot.noted, 6)} ${num(tot.OPEN, 5)}`);
const byKind = {};
for (const r of out) if (r.status === "noted") byKind[r.note.kind] = (byKind[r.note.kind] || 0) + 1;
report.push("");
report.push("  noted rows by kind: " + (KINDS.filter(k => byKind[k]).map(k => `${k} ${byKind[k]}`).join(", ") || "none"));
for (const [id, n] of Object.entries(notes)) if (!KINDS.includes(n.kind) || !n.why) report.push(`  BAD NOTE ${id}: a note needs a kind (${KINDS.join(", ")}) and a why`);
const stale = Object.keys(notes).filter(id => !out.some(r => (r.id === id || `L${r.line}` === id) && r.status === "noted"));
for (const id of stale) report.push(`  STALE NOTE ${id}: that row is applied as written (or is not a row); remove the note`);
if (verbose || tot.OPEN) {
  report.push("");
  for (const r of out) if (r.status === "OPEN" || (verbose && r.status === "noted")) {
    report.push(`  ${r.status === "OPEN" ? "OPEN " : "noted"} ${r.id}   (deck line ${r.line})${r.note ? `   [${r.note.kind}] ${r.note.why}` : ""}`);
    for (const m of r.missing) report.push(`          not rendered: ${m.slice(0, 150)}`);
  }
}
const bad = tot.OPEN || stale.length || report.some(l => l.includes("BAD NOTE"));
report.push("");
report.push(bad ? `COPY COVERAGE ${strict ? "FAILED" : "REPORT"}: ${tot.OPEN} open row(s), ${stale.length} stale note(s)` : `COPY COVERAGE OK: ${tot.applied} rows applied as written, ${tot.noted} noted with a reason, 0 open`);
console.log(report.join("\n"));
if (mdOut) {
  const md = ["| Deck section | Rows | Applied as written | Noted (with reason) | Open |", "|---|---:|---:|---:|---:|"];
  for (const [name, s] of Object.entries(bySection)) md.push(`| ${name} | ${s.applied + s.noted + s.OPEN} | ${s.applied} | ${s.noted} | ${s.OPEN} |`);
  md.push(`| **Total** | **${out.length}** | **${tot.applied}** | **${tot.noted}** | **${tot.OPEN}** |`, "", "Rows noted, with the reason on file:", "");
  md.push("| Row | Kind | Reason |", "|---|---|---|");
  for (const r of out) if (r.status === "noted") md.push(`| ${r.id.replace(/\|/g, "/")} | ${r.note.kind} | ${r.note.why.replace(/\|/g, "/")} |`);
  fs.writeFileSync(path.resolve(mdOut), md.join("\n") + "\n");
}
process.exit(bad && strict ? 1 : 0);
