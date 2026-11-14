#!/usr/bin/env node
// Balance simulations: whole quarters, headless, from seeds.
//
//   node test/sim/run.mjs [--engine baseline|current|<dir>] [--tuning '<json>'] [--policies core|probes|all|a,b,..]
//                         [--seeds 1000] [--from 1] [--label name] [--json out.json] [--quiet]
//
//   --engine    baseline: test/baseline/checkpoint-engine (the v2.0.1 rules). current: the working tree (default)
//   --tuning    a candidate: overrides for the working tree's TUNING table (src/game/rules.js), as JSON, on top of
//               the shipped defaults; or "v201" for the working tree's rules with the v2.0.1 balance settings
//   --seeds N   runs per policy; --from S the first seed. Every policy plays the same seeds
//
// Prints one row per policy and, with --json, writes everything it counted. These are automated heuristics
// (lib/policies.mjs); nothing here stands in for a person playing the game.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEngine, playRun } from "./lib/harness.mjs";
import { CORE, PROBES, POLICIES } from "./lib/policies.mjs";
import { summarise, table, strategyDistance } from "./lib/stats.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const args = process.argv.slice(2);
const take = (flag, dflt) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : dflt; };
const has = flag => args.includes(flag);

const engineArg = take("--engine", "current");
const dir = engineArg === "baseline" ? path.join(ROOT, "test/baseline/checkpoint-engine") : engineArg === "current" ? ROOT : path.resolve(engineArg);
const seeds = Number(take("--seeds", 1000)), from = Number(take("--from", 1));
const which = take("--policies", "core");
const names = which === "core" ? Object.keys(CORE) : which === "probes" ? Object.keys(PROBES) : which === "all" ? Object.keys(POLICIES) : which.split(",").map(s => s.trim()).filter(Boolean);
for (const n of names) if (!POLICIES[n]) { console.error(`unknown policy ${n}. policies: ${Object.keys(POLICIES).join(", ")}`); process.exit(2); }
// "v201": the working tree's rules with the v2.0.1 balance settings (TUNING_V201). JSON: overrides of the shipped defaults
const tuningArg = take("--tuning", null);
let tuning = tuningArg && tuningArg !== "v201" ? JSON.parse(tuningArg) : null;
const label = take("--label", engineArg + (tuningArg ? "+tuning" : ""));

const E = await loadEngine(dir, label);
if (tuningArg === "v201") tuning = { ...E.rules.TUNING_V201 };
if (tuning) {
  if (typeof E.rules.setTuning !== "function") { console.error(`${label}: this engine tree has no TUNING table to override`); process.exit(2); }
  E.rules.setTuning(tuning);
}
const t0 = Date.now();
const out = { label, engine: path.relative(ROOT, dir) || ".", tuning: E.rules.TUNING ? { ...E.rules.TUNING } : null /* the settings in force, in full */, seeds: { from, count: seeds }, policies: {} };
for (const name of names) {
  const runs = [];
  for (let seed = from; seed < from + seeds; seed++) runs.push(playRun(E, seed, POLICIES[name], { salt: name }));
  out.policies[name] = summarise(runs);
}
out.seconds = (Date.now() - t0) / 1000;
out.distance = strategyDistance(out.policies);
if (!has("--quiet")) {
  console.log(`${label}: ${names.length} policies x ${seeds} seeds (${from}..${from + seeds - 1}), ${out.seconds.toFixed(1)} s   [automated heuristics, not human play]`);
  console.log(table(out.policies));
}
const jsonFile = take("--json", null);
if (jsonFile) { fs.mkdirSync(path.dirname(path.resolve(jsonFile)), { recursive: true }); fs.writeFileSync(jsonFile, JSON.stringify(out, null, 1)); }
