#!/usr/bin/env node
// The releases on record are still the files that shipped, and ./index.html is still the one the owner promoted.
//
//   node scripts/check-releases.mjs
//
// test/baseline/releases.json lists every release kept in the repository (file, size, sha256) and names the one
// that ./index.html, the file the public link serves, is a byte-for-byte copy of. Nothing in the build writes
// index.html or an earlier release; this fails if one of them changed anyway. Promoting a release is the owner's
// decision: it is made by copying that release over index.html and naming it under "promoted" here, in one commit.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const record = JSON.parse(fs.readFileSync(path.join(ROOT, "test/baseline/releases.json"), "utf8"));
const sha = buf => crypto.createHash("sha256").update(buf).digest("hex");
const bad = [];
for (const r of record.releases) {
  const file = path.join(ROOT, r.file);
  if (!fs.existsSync(file)) { bad.push(`${r.version}: ${r.file} is missing`); continue; }
  const buf = fs.readFileSync(file);
  if (buf.length !== r.bytes || sha(buf) !== r.sha256) bad.push(`${r.version}: ${r.file} is not the file that shipped (${buf.length} bytes, sha256 ${sha(buf).slice(0, 12)}…; on record: ${r.bytes} bytes, ${r.sha256.slice(0, 12)}…)`);
}
const promoted = record.releases.find(r => r.version === record.promoted);
if (!promoted) bad.push(`"promoted" names ${record.promoted}, which is not on the list`);
else {
  const index = fs.existsSync(path.join(ROOT, "index.html")) ? fs.readFileSync(path.join(ROOT, "index.html")) : null;
  if (!index) bad.push("index.html is missing");
  else if (index.length !== promoted.bytes || sha(index) !== promoted.sha256) bad.push(`index.html is not release ${promoted.version} (${index.length} bytes, sha256 ${sha(index).slice(0, 12)}…): it changed without a promotion being recorded`);
}
if (bad.length) { console.error("RELEASES FAILED:\n  " + bad.join("\n  ")); process.exit(1); }
console.log(`RELEASES OK: ${record.releases.map(r => r.version).join(", ")} are the files that shipped; index.html is ${record.promoted}`);
