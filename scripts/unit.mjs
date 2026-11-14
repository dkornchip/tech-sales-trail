#!/usr/bin/env node
// Runs one folder of Node tests (node --test) and says how it went in one line, for scripts/verify.mjs.
//
//   node scripts/unit.mjs <name> <folder> [--verbose]        e.g. node scripts/unit.mjs engine test/engine
//
// Every <folder>/*.test.mjs is run. Failing tests are printed with their reasons; the last line is
//   <NAME> TESTS OK: n tests passed ...      or      <NAME> TESTS FAILED: n of m tests failed
// Exit code: 0 all passed; 1 a test failed; 2 bad usage or no test files.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2), verbose = args.includes("--verbose");
const [name, folder] = args.filter(a => !a.startsWith("--"));
if (!name || !folder) { console.error("usage: node scripts/unit.mjs <name> <folder> [--verbose]"); process.exit(2); }
const dir = path.resolve(ROOT, folder);
const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith(".test.mjs")).sort().map(f => path.join(folder, f)) : [];
if (!files.length) { console.error(`unit: no *.test.mjs in ${folder}`); process.exit(2); }

const t0 = Date.now();
const r = spawnSync(process.execPath, ["--test", "--test-reporter=tap", ...files], { cwd: ROOT, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
const out = (r.stdout || "") + (r.stderr || "");
const count = key => { const m = new RegExp("^# " + key + " (\\d+)$", "m").exec(out); return m ? Number(m[1]) : null; };
const tests = count("tests"), pass = count("pass"), fail = count("fail"), cancelled = count("cancelled"), skipped = count("skipped");
if (verbose) process.stdout.write(out);
else {
  // each failing test: its name, and the first lines of why
  const lines = out.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (!/^\s*not ok \d+ - /.test(lines[i])) continue;
    console.log(lines[i].trim());
    const indent = lines[i].match(/^\s*/)[0].length;
    for (let k = i + 1, shown = 0; k < lines.length && shown < 14 && !/^\s*(not ok|ok) \d+ - /.test(lines[k]); k++) {
      if (/^\s*(error|expected|actual|code|name|location|failureType):|^\s{2,}\S/.test(lines[k]) && lines[k].match(/^\s*/)[0].length > indent) { console.log("    " + lines[k].trim().slice(0, 300)); shown++; }
    }
  }
}
const label = name.toUpperCase();
const ok = r.status === 0 && fail === 0 && cancelled === 0 && tests !== null && tests > 0 && pass === tests - (skipped || 0);
if (ok) console.log(`${label} TESTS OK: ${pass} tests passed${skipped ? ", " + skipped + " skipped" : ""} in ${files.length} files, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
else console.log(`${label} TESTS FAILED: ${tests === null ? "the test runner did not finish" : `${(fail || 0) + (cancelled || 0)} of ${tests} tests failed`} (${files.length} files, exit ${r.status})`);
process.exit(ok ? 0 : 1);
