#!/usr/bin/env node
// Where do the v2.1 rules play differently from the v2.0.1 rules, and is every difference one that was meant?
//
//   node test/engine/tools/integrity-diff.mjs [--seeds 300] [--from 1] [--policies all|core|a,b] [--show 5]
//
// The frozen checkpoint engine (test/baseline/checkpoint-engine: the v2.0.1 rules on seeded dice) and the working
// tree are played side by side from the same seeds, with the same moves (chosen by a policy bot looking at the old
// engine). After every move the two runs' mechanical state is compared: meters, cash, deals, flags, clAInk's books,
// what is bending the signing odds, the choice that is waiting, and the position of both dice streams.
//
// v2.1 changed how a Friday picks its events (every eligible event is rolled, then the ones that came up are put
// in a fair order). That alone moves every roll after the first Friday, so for this comparison the working tree is
// handed the old scan (in order, stop at two, a no-op still takes a slot), through the seam in src/game/events.js.
// What is left is everything else v2.1 changed, and the tool sorts each run by the FIRST thing that differs:
//
//   identical     nothing differs, start to finish
//   qbr           only the last Friday differs: the review no longer rolls for a run under 70% (it was fired either
//                 way), and a finished run keeps its quarter's total instead of zeroing it
//   effects       what is bending the odds differs first: two bonuses or penalties were in force together, which
//                 the old single number and single timer got wrong (overwritten, cut short, stretched, stacked on
//                 itself, or left unclamped). From there on the runs are different runs, as intended
//   other         anything else. There must be none: it would be a change nobody decided to make
//
// The Friday event order itself is measured where it belongs, in the balance simulations (test/sim).
// Exit code: 0 no "other"; 1 otherwise.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEngine, start, legalMoves, play, viewOf, isOver, dialogOf, toMove, mulberry, fnv } from "../../sim/lib/harness.mjs";
import { CORE, POLICIES } from "../../sim/lib/policies.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const args = process.argv.slice(2);
const take = (flag, dflt) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : dflt; };
const SEEDS = Number(take("--seeds", 300)), FROM = Number(take("--from", 1)), SHOW = Number(take("--show", 5));
const which = take("--policies", "all");
const names = which === "all" ? Object.keys(POLICIES) : which === "core" ? Object.keys(CORE) : which.split(",");

const OLD = await loadEngine(path.join(ROOT, "test/baseline/checkpoint-engine"), "v2.0.1 rules");
const NEW = await loadEngine(ROOT, "working tree");
// The balance tuning v2.1 ships (src/game/rules.js, TUNING_DEFAULTS) is a deliberate change of rules, measured on
// its own (test/sim). This tool is about everything else: it runs the working tree with the v2.0.1 settings.
NEW.rules.setTuning(NEW.rules.TUNING_V201);

// The scan the rules used up to v2.0.1, over the same event table.
NEW.events.setEventRoller((state, EVENTS, maxFires) => {
  let s = { ...state }, fired = 0, modal = false;
  for (const ev of EVENTS) {
    if (fired >= maxFires) break;                      // no roll once two have fired
    if (ev.modal && modal) continue;                   // a second choice is not even rolled
    if (NEW.rng.rnd() >= ev.p) continue;
    // it "fired": an event with nothing to act on did nothing and still took the slot; a choice on the last
    // Friday was queued and then dropped with the run
    if (!ev.can || ev.can(s)) s = ev.run({ ...s });
    fired++;
    if (ev.modal) modal = true;
  }
  return s;
});

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const r4 = x => Math.round(x * 1e4) / 1e4;
const ckKeys = ["status", "hidden", "deployed", "strikes", "claims", "due", "deploys", "miracles", "fakes", "incidents", "delivered", "billed", "lastInvoice", "claimed"];
function view(E, g) {
  const s = g.s, isNew = E === NEW, c = s.claink || {};
  const d = dialogOf(E, g);
  return {
    week: s.week, slots: s.slots, energy: s.energy, stress: s.stress, manager: s.manager, reputation: s.reputation, product: s.product, cash: s.cash,
    skills: JSON.stringify(s.skills), closedWon: s.closedWon, closedQuarter: s.closedQuarter, pipeline: s.pipeline, discounts: s.discounts, meetings: s.meetings,
    deals: s.deals.map(x => [x.account, x.value, x.stage, x.mood, x.age].join("/")).join(" "),
    flags: ["fired", "burnedOut", "win", "missed", "repo", "pip", "repoWarned", "stressWarned", "hygieneShield", "restedThisWeek"].filter(k => s[k]).join(","),
    pipLevel: s.pipLevel, perfWarnings: s.perfWarnings, shots: s.coffeesThisWeek, trip: s.trip, used: JSON.stringify(s.used), cause: s.endCause,
    ach: s.achievements.map(a => a.key).join(","),
    ck: ckKeys.map(k => c[k]).join("/") + "|" + JSON.stringify(c.mgr),
    conv: isNew ? r4(NEW.effects.convMod(s)) : r4(s.modifiers.conversion || 0),
    disc: isNew ? r4(NEW.effects.discountRate(s)) : r4(s.modifiers.discount || 0),
    waiting: d ? d.id : "",
    core: s.rng.core
    // not rng.fl: that is clAInk's joke stream (which outcomes, who files a strike, token counts). No rule reads it,
    // and v2.1's rewritten reports draw a different number of joke numbers. It is counted below, not compared.
  };
}
const diffKeys = (a, b) => Object.keys(a).filter(k => a[k] !== b[k]);
const ODDS = ["conv", "disc"];

const tally = { identical: 0, qbr: 0, effects: 0, other: 0 }, kinds = {}, examples = { effects: [], other: [] };
let runs = 0, moves = 0, jokes = 0;
const t0 = Date.now();
for (const name of names) {
  for (let seed = FROM; seed < FROM + SEEDS; seed++) {
    let a = start(OLD, seed), b = start(NEW, seed);
    const ctx = { rng: mulberry(fnv("diff:" + name + ":" + seed)), mem: {} };
    let verdict = "identical", joked = false;
    for (let k = 0; k < 400 && !isOver(OLD, a); k++) {
      const legal = legalMoves(OLD, a);
      let id = POLICIES[name](viewOf(OLD, a, legal), ctx);
      if (!legal.includes(id)) id = legal.includes("end") ? "end" : legal[0];
      const before = view(OLD, a);
      // the same move must be legal in the new rules
      const refused = NEW.run.refusal(b.s, toMove(NEW, b, id));
      if (refused) { verdict = "other"; if (examples.other.length < SHOW) examples.other.push(`${name}#${seed} move ${k} ${id}: legal before, refused now (${refused})`); break; }
      a = play(OLD, a, id).g; b = play(NEW, b, id).g; moves++;
      if (a.s.rng.fl !== b.s.rng.fl) joked = true;
      const va = view(OLD, a), vb = view(NEW, b), keys = diffKeys(va, vb);
      if (!keys.length) continue;
      // A run that has just ended, the same way and with the same books, in both. What differs then is bookkeeping
      // on a finished run: an effect set for a week that will not come (the old rules wrote it into the odds at
      // once, the new ones date it), and on the last Friday the review's own changes (no roll and no reprieve for
      // a run under 70%, so no manager hit and no PIP on the way out; the quarter's total kept).
      const ended = isOver(OLD, a) && isOver(NEW, b) && va.cause === vb.cause && ["closedWon", "cash", "deals", "stress", "energy", "ck"].every(x => va[x] === vb[x]);
      if (ended && keys.every(x => ODDS.includes(x))) break;                       // identical in everything that is the run
      const lastFriday = id === "end" && before.week % 13 === 0 && ended;
      if (lastFriday && keys.every(x => ["closedQuarter", "core", "manager", "flags", "pipLevel", "conv", "disc"].includes(x))) { verdict = "qbr"; break; }
      if (keys.every(x => ODDS.includes(x)) || keys.some(x => ODDS.includes(x)) && keys.every(x => ODDS.includes(x) || x === "closedQuarter" || x === "core")) {
        verdict = "effects";
        // where the old single number went wrong
        const at = id.indexOf("dlg:") === 0 ? (id === "dlg:own" || id === "dlg:spin" ? "a security choice replaced what was already in force (now they add up)" : "a pricing choice reset the shared timer or the total (now each runs its own clock)")
          : id === "act:conference" ? "a second conference in one week stacked its bonus (now it refreshes)"
            : id === "end" ? "a Friday: the shared timer ended something early or carried it over (now each ends on its own week)"
              : "other move: " + id;
        const kind = Math.abs(va.conv) > 0.30 + 1e-9 || Math.abs(vb.conv) >= 0.30 - 1e-9 && va.conv !== vb.conv && Math.abs(va.conv) > Math.abs(vb.conv) ? "the total went past 30 points (now held to 30)" : at;
        kinds[kind] = (kinds[kind] || 0) + 1;
        if (examples.effects.length < SHOW) examples.effects.push(`${name}#${seed} move ${k} ${id} (week ${before.week}): odds ${va.conv} -> ${vb.conv}, discount ${va.disc} -> ${vb.disc}   [${kind}]`);
        break;
      }
      verdict = "other";
      if (examples.other.length < SHOW) examples.other.push(`${name}#${seed} move ${k} ${id} (week ${before.week}): ${keys.map(x => `${x}: ${String(va[x]).slice(0, 60)} -> ${String(vb[x]).slice(0, 60)}`).join("; ")}`);
      break;
    }
    tally[verdict]++; runs++; if (joked) jokes++;
  }
}
const pct = n => (100 * n / runs).toFixed(1) + "%";
console.log(`integrity diff: ${names.length} policies x ${SEEDS} seeds (${FROM}..${FROM + SEEDS - 1}), ${runs} runs, ${moves} moves compared, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
console.log(`  identical start to finish        ${String(tally.identical).padStart(6)}  ${pct(tally.identical)}`);
console.log(`  only the last Friday differs     ${String(tally.qbr).padStart(6)}  ${pct(tally.qbr)}   (under-70% review no longer rolls; the quarter's total is kept)`);
console.log(`  odds effects differ first        ${String(tally.effects).padStart(6)}  ${pct(tally.effects)}   (the shared number and timer, fixed)`);
for (const [k, n] of Object.entries(kinds).sort((x, y) => y[1] - x[1])) console.log(`      ${String(n).padStart(6)}  ${k}`);
console.log(`  anything else                    ${String(tally.other).padStart(6)}  ${pct(tally.other)}`);
console.log(`  (the joke stream moved in        ${String(jokes).padStart(6)}  ${pct(jokes)}   of those runs: clAInk's rewritten reports draw different joke numbers; no rule reads that stream)`);
for (const e of examples.effects) console.log("  e.g. " + e);
for (const e of examples.other) console.log("  OTHER " + e);
console.log(tally.other ? "\nINTEGRITY DIFF FAILED: the rules differ somewhere nobody decided they should" : "\nINTEGRITY DIFF OK: every difference from the v2.0.1 rules is one of the fixes");
process.exit(tally.other ? 1 : 0);
