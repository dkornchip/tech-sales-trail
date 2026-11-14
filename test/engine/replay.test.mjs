// Golden replays: the same seeds and the same bots must end exactly where they ended when the golden file was
// written. A rule that changes on purpose changes these on purpose:  TST_GOLDEN=update node --test test/engine/replay.test.mjs
// rewrites the file, and the diff says what moved.
//   mech   the mechanical state (kit.mjs, mechanical()): must not move when only the words change
//   full   the whole state, words included (ids and clock times aside)
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { E, ROOT, playRun, digest, mechanical } from "./lib/kit.mjs";
import { CORE, PROBES } from "../sim/lib/policies.mjs";

const FILE = path.join(ROOT, "test/engine/golden/replay.json");
const sha = text => crypto.createHash("sha256").update(text).digest("hex").slice(0, 20);
const RUNS = [];
for (const name of Object.keys(CORE)) for (const seed of [11, 12, 13, 14, 15, 16]) RUNS.push([name, seed]);
for (const name of ["expert", "claink-weekly", "claink-budget", "hail-only", "mgr-farm", "ascend", "burn", "broke"]) for (const seed of [21, 22]) RUNS.push([name, seed]);

test("golden replays: every seeded run ends where it ended before", async () => {
  const eng = await E(), all = { ...CORE, ...PROBES };
  const now = {};
  for (const [name, seed] of RUNS) {
    const r = playRun(eng, seed, all[name], { salt: name, keepState: true });
    now[name + "#" + seed] = { ending: r.ending, cause: r.cause, week: r.week, closed: r.closed, cash: r.cash, moves: r.tally.steps, mech: sha(JSON.stringify(mechanical(r.state))), full: sha(digest(r.state)) };
  }
  if (process.env.TST_GOLDEN === "update") {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(now, null, 1) + "\n");
    return;
  }
  assert.ok(fs.existsSync(FILE), "no golden file: run with TST_GOLDEN=update");
  const was = JSON.parse(fs.readFileSync(FILE, "utf8"));
  assert.deepEqual(Object.keys(now).sort(), Object.keys(was).sort(), "the list of golden runs changed");
  const moved = Object.keys(now).filter(k => now[k].mech !== was[k].mech);
  assert.deepEqual(moved.map(k => `${k}: was ${was[k].ending} week ${was[k].week} closed ${was[k].closed}, now ${now[k].ending} week ${now[k].week} closed ${now[k].closed}`), [], "the rules play these seeds differently");
  const reworded = Object.keys(now).filter(k => now[k].full !== was[k].full);
  assert.deepEqual(reworded, [], "the words of these runs changed (the mechanics did not): update the golden file if that was meant");
});
