#!/usr/bin/env node
// Does the working tree play as v2.1 did?
//
//   node test/engine/tools/equivalence.mjs [--seeds 60] [--from 1] [--policies all|core|a,b] [--show 5]
//
// The frozen v2.1 rules (test/baseline/v2.1-engine: src/game and src/copy as released) and the working tree are
// played side by side from the same seeds. A policy bot chooses each move from what the WORKING TREE allows, and
// the same move is made on both. After every move the two runs must be the same run: the whole mechanical state
// (test/engine/lib/kit.mjs, mechanical(): every meter, the cash, every deal, every flag and counter, clAInk's
// books, the effects in force, the choice that is waiting, the log's tags in order, and the position of both dice
// streams). Words are not compared: a patch release may correct a line of copy.
//
// So a move v2.1.1 offers does exactly what it did in v2.1, roll for roll. What is left is the moves themselves.
// At every step the moves v2.1 allowed are compared with the moves the working tree allows, and every difference
// must be a correction that was decided, individually:
//
//   propose-idle   Proposals with no demoed deal, in a week whose proposal-or-close work is already marked as
//                  done (by Proposals or by Close deals). v2.1 took the move: it cost a slot and 25 energy, moved
//                  nothing, trained nothing and counted for nothing. v2.1.1 refuses it (src/game/actions.js,
//                  proposeIdle). At every step where v2.1 had it on offer, the move is made on the v2.1 run and
//                  what it changed there is checked: slots, energy, a mark that no rule reads any differently
//                  for it, one log line, and nothing else; no roll.
//                  (The same press in a week without the mark is still a move: it counts toward a full-funnel
//                  week, as it did in v2.1.)
//
// A move only the working tree allows, a move it refuses for any other reason, or a state that differs after a
// move both made: FAILED. Exit code 0 only if there is none.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEngine, start, legalMoves, play, viewOf, isOver, toMove, mulberry, fnv } from "../../sim/lib/harness.mjs";
import { CORE, POLICIES } from "../../sim/lib/policies.mjs";
import { mechanical } from "../lib/kit.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const args = process.argv.slice(2);
const take = (flag, dflt) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : dflt; };
const SEEDS = Number(take("--seeds", 60)), FROM = Number(take("--from", 1)), SHOW = Number(take("--show", 5));
const which = take("--policies", "all");
const names = which === "all" ? Object.keys(POLICIES) : which === "core" ? Object.keys(CORE) : which.split(",");

const OLD = await loadEngine(path.join(ROOT, "test/baseline/v2.1-engine"), "v2.1 rules");
const NEW = await loadEngine(ROOT, "working tree");

const key = s => JSON.stringify(mechanical(s));
// where two mechanical states differ, by path (the first few)
const diff = (a, b, at = "", out = []) => {
  if (out.length >= 4 || a === b) return out;
  if (a && b && typeof a === "object" && typeof b === "object") { for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) diff(a[k], b[k], at ? at + "." + k : k, out); return out; }
  out.push(`${at}: ${String(JSON.stringify(a)).slice(0, 50)} -> ${String(JSON.stringify(b)).slice(0, 50)}`);
  return out;
};

// The corrections that were decided. Each says whether a move v2.1 allowed and the working tree refuses is its
// case, and proves on the v2.1 run that the move was worth nothing there.
const CORRECTIONS = {
  "propose-idle": {
    what: "Proposals with no demoed deal, the week's proposal-or-close work already counted: v2.1 took a slot and 25 energy for it and gave nothing back; refused now",
    is: (id, s) => id === "act:propose" && !s.deals.some(d => d.stage === 2) && !!(s.used.propose || s.used.close),
    // on the v2.1 rules: only slots, energy, the week's mark and the log move; no deal, no skill, no cash, no roll.
    // (Every action is followed by the stress check, src/game/stress.js: if a warning at 70 or the meltdown at 100
    // was already due when the move was made, this move was the one it followed. Any other move would have been.)
    worthless: (before, after) => {
      const a = mechanical(before), b = mechanical(after);
      const moved = Object.keys(b).filter(k => JSON.stringify(a[k]) !== JSON.stringify(b[k]));
      const extra = moved.filter(k => !["energy", "logs", "slots", "used", "stressWarned", "burnedOut", "endCause"].includes(k));
      if (extra.length) return "it changed " + extra.join(", ");
      if (b.slots !== a.slots - 1 || b.energy !== a.energy - OLD.rules.COST.propose.energy) return "it did not cost one slot and the energy of a proposal";
      if (JSON.stringify({ ...a.used, propose: true }) !== JSON.stringify(b.used)) return "it changed this week's marks beyond its own";
      if (!(a.used.propose || a.used.close)) return "the week's proposal-or-close work was not yet counted: the press counted for something";
      const added = b.logs.slice(0, b.logs.length - a.logs.length).reverse().join(" ");          // newest first in the log
      const due = a.stress >= 100 ? " end.meltdown.stress!" : a.stress >= OLD.stress.STRESS_WARN && !a.stressWarned ? " stress.warn" : "";
      if (added !== "act.propose" + due) return "it wrote " + added;
      if ((moved.includes("stressWarned") || moved.includes("burnedOut")) && !due) return "it set off a stress check that was not due";
      return null;
    },
    also: (before) => (before.stress >= OLD.stress.STRESS_WARN && !before.stressWarned) || before.stress >= 100
  }
};

const tally = { runs: 0, moves: 0, same: 0, differs: 0 }, corrected = {}, problems = [], examples = [];
const t0 = Date.now();
for (const name of names) {
  for (let seed = FROM; seed < FROM + SEEDS; seed++) {
    let a = start(OLD, seed), b = start(NEW, seed);
    const ctx = { rng: mulberry(fnv("equiv:" + name + ":" + seed)), mem: {} };
    let ok = key(a.s) === key(b.s);
    if (!ok) problems.push(`${name}#${seed}: the two runs do not even start the same: ${diff(mechanical(a.s), mechanical(b.s)).join("; ")}`);
    for (let k = 0; ok && k < 400 && !isOver(NEW, b); k++) {
      const was = legalMoves(OLD, a), now = legalMoves(NEW, b);
      for (const id of now) if (!was.includes(id)) { ok = false; problems.push(`${name}#${seed} move ${k}: the working tree allows ${id}, v2.1 did not`); }
      for (const id of was) if (!now.includes(id)) {
        const c = Object.keys(CORRECTIONS).find(n => CORRECTIONS[n].is(id, a.s));
        if (!c) { ok = false; problems.push(`${name}#${seed} move ${k} (week ${a.s.week}): v2.1 allowed ${id}, the working tree refuses it, and no correction covers that`); continue; }
        const bad = CORRECTIONS[c].worthless(a.s, play(OLD, a, id).g.s);
        if (bad) { ok = false; problems.push(`${name}#${seed} move ${k}: ${id} is refused as ${c}, but on v2.1 ${bad}`); continue; }
        corrected[c] = corrected[c] || { times: 0, runs: new Set(), also: 0 };
        corrected[c].times++; corrected[c].runs.add(name + "#" + seed);
        if (CORRECTIONS[c].also(a.s)) corrected[c].also++;
        if (examples.length < SHOW) examples.push(`${name}#${seed} step ${k} (week ${a.s.week}): ${id} with ${a.s.deals.length} deals on the board, none demoed, after ${a.s.used.close ? "Close deals" : "Proposals"} this week: on offer in v2.1, not now`);
      }
      if (!ok || !now.length) break;
      let id = POLICIES[name](viewOf(NEW, b, now), ctx);
      if (!now.includes(id)) id = now.includes("end") ? "end" : now[0];
      a = play(OLD, a, id).g; b = play(NEW, b, id).g; tally.moves++;
      if (key(a.s) !== key(b.s)) { ok = false; problems.push(`${name}#${seed} move ${k} ${id} (week ${a.s.week}): ${diff(mechanical(a.s), mechanical(b.s)).join("; ")}`); }
    }
    if (ok && isOver(OLD, a) !== isOver(NEW, b)) { ok = false; problems.push(`${name}#${seed}: one run is over and the other is not`); }
    tally.runs++; tally[ok ? "same" : "differs"]++;
  }
}
console.log(`equivalence with v2.1: ${names.length} policies x ${SEEDS} seeds (${FROM}..${FROM + SEEDS - 1}), ${tally.runs} runs, ${tally.moves} moves made on both, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
console.log(`  the same run after every move      ${String(tally.same).padStart(6)} of ${tally.runs}`);
console.log(`  differs                            ${String(tally.differs).padStart(6)}`);
for (const [n, c] of Object.entries(corrected)) {
  console.log(`  ${n}: ${CORRECTIONS[n].what}`);
  console.log(`      v2.1 had it on offer at ${c.times} steps of ${c.runs.size} runs. At each one it was made on the v2.1 run: it changed slots, energy, the week's mark and its log line, and nothing else`);
  if (c.also) console.log(`      (at ${c.also} of those steps a stress warning was already due, and on v2.1 it followed this move as it would have followed any other)`);
}
if (!Object.keys(corrected).length) console.log("  no move v2.1 allowed is refused now, in any of these runs");
for (const e of examples) console.log("  e.g. " + e);
for (const p of problems.slice(0, 12)) console.log("  DIFFERS " + p);
if (problems.length > 12) console.log(`  ... and ${problems.length - 12} more`);
console.log(problems.length ? "\nEQUIVALENCE FAILED: the working tree does not play as v2.1 did" : "\nEQUIVALENCE OK: every move the working tree allows does what it did in v2.1, and every move it no longer allows is a decided correction");
process.exit(problems.length ? 1 : 0);
