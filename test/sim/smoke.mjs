#!/usr/bin/env node
// A quick check that the simulation kit still measures something (a gate of `npm run verify`, a few seconds):
//
//   1. the frozen balance baseline is intact (check-baseline.mjs)
//   2. every policy plays whole quarters on the baseline rules and on the working tree: each run ends in one of
//      the six endings, no policy asks for a move that is not legal, none is left with nothing to press
//   3. the same seeds give the same table twice (a simulation that cannot be repeated cannot be compared)
//   4. the core policies are different players: any two differ in what they press, where their leads come from, or whether they use clAInk
//
//   node test/sim/smoke.mjs [--seeds 40]
// The balance figures themselves come from test/sim/run.mjs with a thousand seeds or more, not from here.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEngine, playRun } from "./lib/harness.mjs";
import { CORE, POLICIES } from "./lib/policies.mjs";
import { summarise, strategyDistance } from "./lib/stats.mjs";
import { checkBaseline } from "./check-baseline.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const at = process.argv.indexOf("--seeds");
const SEEDS = at >= 0 ? Number(process.argv[at + 1]) : 40;
// Two core policies count as different players when their action mixes are at least MIN_MIX apart, or their leads
// come from sources at least MIN_SOURCES apart (total-variation distances), or one puts clAInk to work in at least
// MIN_TOOLS more of its runs than the other (lib/stats.mjs).
const MIN_MIX = 0.05, MIN_SOURCES = 0.2, MIN_TOOLS = 0.5;
const rows = [];
const check = (name, ok, detail) => { rows.push(!!ok); console.log("  " + (ok ? "ok  " : "FAIL") + "  " + name + (detail ? "  (" + detail + ")" : "")); return !!ok; };
const t0 = Date.now();

const base = checkBaseline();
check("the frozen baseline is intact", base.problems.length === 0, base.problems.length ? base.problems.join("; ") : base.files + " files");

const engines = [await loadEngine(path.join(ROOT, "test/baseline/checkpoint-engine"), "baseline"), await loadEngine(ROOT, "working tree")];
for (const E of engines) {
  const play = () => Object.fromEntries(Object.keys(POLICIES).map(name => [name, Array.from({ length: SEEDS }, (_, i) => playRun(E, 9000 + i, POLICIES[name], { salt: name }))]));
  const runs = play();
  const all = Object.values(runs).flat();
  const unfinished = all.filter(r => r.ending === "unfinished"), stuck = all.filter(r => r.tally.stuck), illegal = all.reduce((t, r) => t + r.tally.illegal, 0);
  check(`${E.label}: ${Object.keys(POLICIES).length} policies x ${SEEDS} seeds, every run reaches an ending`, unfinished.length === 0 && stuck.length === 0, `${unfinished.length} unfinished, ${stuck.length} stuck`);
  check(`${E.label}: no policy asks for a move that is not legal`, illegal === 0, illegal + " illegal requests");
  const again = play();
  const key = set => JSON.stringify(Object.values(set).flat().map(r => [r.seed, r.ending, r.cause, r.week, r.closed, r.cash, r.tally.steps]));
  check(`${E.label}: the same seeds give the same runs twice`, key(runs) === key(again));
  const core = Object.fromEntries(Object.keys(CORE).map(name => [name, summarise(runs[name])]));
  const d = Object.entries(strategyDistance(core)), alike = d.filter(([, x]) => x.mix < MIN_MIX && x.sources < MIN_SOURCES && x.tools < MIN_TOOLS);
  const far = x => Math.max(x.mix / MIN_MIX, x.sources / MIN_SOURCES, x.tools / MIN_TOOLS);
  const least = d.slice().sort((a, b) => far(a[1]) - far(b[1]))[0];
  check(`${E.label}: the ${Object.keys(CORE).length} core policies are different players`, alike.length === 0, `closest pair ${least[0]}: action mix ${least[1].mix.toFixed(3)} apart, lead sources ${least[1].sources.toFixed(3)} apart, clAInk use ${least[1].tools.toFixed(2)} apart (floors ${MIN_MIX}, ${MIN_SOURCES}, ${MIN_TOOLS}); ${far(least[1]).toFixed(1)}x the floor`);
  const endings = new Set(all.map(r => r.ending));
  check(`${E.label}: between them the policies reach at least five of the six endings`, endings.size >= 5, [...endings].sort().join(", "));
}
const bad = rows.filter(ok => !ok).length;
console.log(bad ? `\nSIM SMOKE FAILED: ${bad} of ${rows.length} checks` : `\nSIM SMOKE OK: all ${rows.length} checks passed, ${((Date.now() - t0) / 1000).toFixed(1)} s   [automated heuristics, not human play]`);
process.exit(bad ? 1 : 0);
