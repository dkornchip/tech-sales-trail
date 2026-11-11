#!/usr/bin/env node
// The three lints, proved against fixtures: a folder each one must pass and a folder that breaks every rule.
//
//   node test/lint-fixtures/selftest.mjs
//
// A lint that reports nothing on its "fail" folder, or anything on its "pass" folder, is a broken lint. For the
// failing folders the expectation is exact: every rule, the number of findings planted for it, and (for lint-rng)
// the very lines marked OFFENCE.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tst-lint-"));
let failed = 0, n = 0;
const check = (name, ok, detail) => { n++; if(!ok) failed++; console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${detail ? "   " + detail : ""}`); };

function run(script, args){
  const json = path.join(tmp, `${path.basename(script)}-${n}-${Math.abs(args.join(" ").length)}.json`);
  const r = spawnSync(process.execPath, [path.join(ROOT, "scripts", script), ...args, "--json", json], { cwd: ROOT, encoding: "utf8" });
  let out = null;
  try{ out = JSON.parse(fs.readFileSync(json, "utf8")); }catch{ /* the script stopped before writing it */ }
  return { code: r.status, out, text: r.stdout + r.stderr };
}
const fx = name => path.join("test", "lint-fixtures", name);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

console.log("lint-copy");
{
  const pass = run("lint-copy.mjs", [fx("copy-pass"), "--strict"]);
  check("the passing modules pass under --strict", pass.code === 0 && pass.out && pass.out.violations.length === 0, pass.out ? `${pass.out.strings} strings, ${pass.out.violations.length} violations` : pass.text.slice(0, 200));
  check("the variant engine next to them is skipped, not called", !!pass.out && pass.out.skipped.includes("engine.js"));
  const fail = run("lint-copy.mjs", [fx("copy-fail"), "--strict"]);
  // what was planted in test/lint-fixtures/copy-fail, rule by rule (a place that is wrong for several of the
  // synthetic params counts once)
  const want = { emoji: 3, quotes: 2, plural: 1, minus: 3, ellipsis: 1, banned: 12, "sentence-case": 6, "len-spoken": 1, "len-caption": 1, "len-log": 2, render: 2, callable: 1 };
  check("the failing modules fail under --strict", fail.code === 1);
  check("every rule fires, with exactly the planted number of findings", !!fail.out && same(fail.out.counts, want), fail.out ? JSON.stringify(fail.out.counts) : "");
  const words = fail.out ? fail.out.violations.filter(v => v.rule === "banned").map(v => v.why).sort() : [];
  check("each of the twelve banned words is named", same(words, ["buff", "cooked", "drip", "epic", "flex", "gorillionaire", "lol", "mana", "nerfed", "obliterated", "please clap", "vibes"]), words.join(", "));
  const byParams = fail.out ? fail.out.violations.filter(v => v.call).map(v => `${v.rule}:${v.path}(${v.call})`) : [];
  check("violations that only exist for some params are found (negative money, a long list)", byParams.some(s => s.startsWith("minus:rent(negative money")) && byParams.some(s => s.startsWith("len-log:ghosted(")), byParams.join(" "));
  const soft = run("lint-copy.mjs", [fx("copy-fail")]);
  check("without --strict the same report exits 0", soft.code === 0 && /LINT-COPY REPORT: 35 violations/.test(soft.text));
  const only = run("lint-copy.mjs", [fx("copy-fail"), "--strict", "--only", "plural,ellipsis"]);
  check("--only limits the report to those rules", only.code === 1 && /LINT-COPY FAILED: 2 violations/.test(only.text));
  const none = run("lint-copy.mjs", [fx("no-such-folder")]);
  const noneStrict = run("lint-copy.mjs", [fx("no-such-folder"), "--strict"]);
  check("a missing copy folder is not an error by default, and is one under --strict", none.code === 0 && noneStrict.code === 2);
}

console.log("lint-rng");
{
  const pass = run("lint-rng.mjs", [fx("rng-pass")]);
  check("the passing tree passes (comments, strings, the rest of Math and JSX text are not offences)", pass.code === 0 && pass.out && pass.out.offenders.length === 0, pass.text.trim().split("\n").pop());
  const fail = run("lint-rng.mjs", [fx("rng-fail")]);
  // the truth is in the fixture: every line that ends in "// OFFENCE <rule>"
  const planted = [];
  const walk = d => { for(const e of fs.readdirSync(d, { withFileTypes: true })){ const p = path.join(d, e.name); if(e.isDirectory()) walk(p); else fs.readFileSync(p, "utf8").split("\n").forEach((line, i) => { const m = /\/\/ OFFENCE (\S+)\s*$/.exec(line); if(m) planted.push(`${path.relative(path.join(ROOT, fx("rng-fail")), p).split(path.sep).join("/")}:${i + 1} ${m[1]}`); }); } };
  walk(path.join(ROOT, fx("rng-fail")));
  const got = fail.out ? fail.out.offenders.map(o => `${o.file}:${o.line} ${o.rule}`) : [];
  check("the failing tree fails", fail.code === 1);
  check(`exactly the ${planted.length} marked lines are reported, each with its rule`, planted.length >= 10 && same(got.slice().sort(), planted.slice().sort()), `reported ${got.length}` + (same(got.slice().sort(), planted.slice().sort()) ? "" : `: missing [${planted.filter(p => !got.includes(p)).join("; ")}] extra [${got.filter(p => !planted.includes(p)).join("; ")}]`));
  const real = run("lint-rng.mjs", ["src"]);
  check("the game's own source is clean today", real.code === 0, real.text.trim().split("\n").pop());
}

console.log("lint-css");
{
  const pass = run("lint-css.mjs", [fx("css-pass"), "--strict"]);
  check("the passing stylesheets pass under --strict", pass.code === 0 && pass.out && pass.out.findings.length === 0, pass.out ? JSON.stringify(pass.out.counts) : pass.text.slice(0, 200));
  const fail = run("lint-css.mjs", [fx("css-fail"), "--strict"]);
  // planted in css-fail/app.css, plus the two rules that also apply inside an allowlisted file (css-fail/claink.css)
  const want = { hex: 2, gradient: 1, "text-shadow": 1, glow: 2, "font-size": 5, media: 4 };
  check("the failing stylesheets fail under --strict", fail.code === 1);
  check("every rule fires, with exactly the planted number of findings", !!fail.out && same(fail.out.counts, want), fail.out ? JSON.stringify(fail.out.counts) : "");
  check("literals in an allowlisted file are not findings; font sizes and media queries there are", !!fail.out && same(fail.out.findings.filter(f => f.file === "claink.css").map(f => f.rule).sort(), ["font-size", "media"]));
  const soft = run("lint-css.mjs", [fx("css-fail")]);
  check("without --strict the same report exits 0", soft.code === 0 && /LINT-CSS REPORT: 15 findings/.test(soft.text));
  const real = run("lint-css.mjs", ["src/styles"]);
  check("today's stylesheet gets a report, not an error", real.code === 0 && !!real.out && real.out.findings.length > 100, real.text.trim().split("\n").pop());
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${failed ? "LINT SELFTEST FAILED" : "LINT SELFTEST OK"}: ${n - failed}/${n} checks held`);
process.exit(failed ? 1 : 0);
