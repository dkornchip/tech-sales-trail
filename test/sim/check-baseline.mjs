// The frozen engines are frozen: in each, every file is the one its SHA256SUMS lists, and there is no file it does
// not list.
//   test/baseline/checkpoint-engine   the v2.0.1 rules: the balance baseline. If it drifts, every "before and after"
//                                     table is meaningless.
//   test/baseline/v2.1-engine         the v2.1 rules as released: what a patch release is compared with, move for
//                                     move (test/engine/tools/equivalence.mjs).
//
//   node test/sim/check-baseline.mjs          exit 0: intact; 1: a file changed, is missing or was added
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const BASE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "baseline");
export const FROZEN = ["checkpoint-engine", "v2.1-engine"];

export function checkBaseline(name = "checkpoint-engine") {
  const DIR = path.join(BASE, name);
  const listed = new Map(fs.readFileSync(path.join(DIR, "SHA256SUMS"), "utf8").split("\n").filter(Boolean).map(l => { const m = /^([0-9a-f]{64})\s+(.+)$/.exec(l); if (!m) throw new Error("SHA256SUMS: cannot read line: " + l); return [m[2], m[1]]; }));
  const found = [];
  const walk = d => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else found.push(path.relative(DIR, p).split(path.sep).join("/")); } };
  walk(path.join(DIR, "src"));
  const problems = [];
  for (const [file, sum] of listed) {
    if (!found.includes(file)) { problems.push(name + ": missing: " + file); continue; }
    const got = crypto.createHash("sha256").update(fs.readFileSync(path.join(DIR, file))).digest("hex");
    if (got !== sum) problems.push(name + ": changed: " + file);
  }
  for (const file of found) if (!listed.has(file)) problems.push(name + ": not listed: " + file);
  return { files: listed.size, problems };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const all = FROZEN.map(n => checkBaseline(n)), problems = all.flatMap(r => r.problems);
  for (const p of problems) console.log("  " + p);
  console.log(problems.length ? `BASELINE FAILED: ${problems.length} problems in test/baseline` : `BASELINE OK: ${FROZEN.map((n, i) => `${n} ${all[i].files} files`).join(", ")}, as frozen`);
  process.exit(problems.length ? 1 : 0);
}
