#!/usr/bin/env node
// The balance baseline (test/baseline/checkpoint-engine) is frozen: every file is the one SHA256SUMS lists, and
// there is no file it does not list. A baseline that drifts makes every "before and after" table meaningless.
//
//   node test/sim/check-baseline.mjs          exit 0: intact; 1: a file changed, is missing or was added
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "baseline", "checkpoint-engine");

export function checkBaseline() {
  const listed = new Map(fs.readFileSync(path.join(DIR, "SHA256SUMS"), "utf8").split("\n").filter(Boolean).map(l => { const m = /^([0-9a-f]{64})\s+(.+)$/.exec(l); if (!m) throw new Error("SHA256SUMS: cannot read line: " + l); return [m[2], m[1]]; }));
  const found = [];
  const walk = d => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else found.push(path.relative(DIR, p).split(path.sep).join("/")); } };
  walk(path.join(DIR, "src"));
  const problems = [];
  for (const [file, sum] of listed) {
    if (!found.includes(file)) { problems.push("missing: " + file); continue; }
    const got = crypto.createHash("sha256").update(fs.readFileSync(path.join(DIR, file))).digest("hex");
    if (got !== sum) problems.push("changed: " + file);
  }
  for (const file of found) if (!listed.has(file)) problems.push("not listed: " + file);
  return { files: listed.size, problems };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const r = checkBaseline();
  for (const p of r.problems) console.log("  " + p);
  console.log(r.problems.length ? `BASELINE FAILED: ${r.problems.length} problems in test/baseline/checkpoint-engine` : `BASELINE OK: ${r.files} files, as frozen`);
  process.exit(r.problems.length ? 1 : 0);
}
