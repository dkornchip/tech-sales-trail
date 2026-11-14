// The dice: a seeded stream carried in the run (src/game/rng.js), drawn only inside a step (src/game/run.js).
import test from "node:test";
import assert from "node:assert/strict";
import { E, start, legalMoves, play, viewOf, isOver, playRun, digest, same, script, unscript, mulberry, fnv } from "./lib/kit.mjs";
import { POLICIES } from "../sim/lib/policies.mjs";

const SEEDS = Array.from({ length: 24 }, (_, i) => 1001 + i * 37);

test("the stream is mulberry32, in [0, 1), and the two streams differ", async () => {
  const eng = await E();
  const { newRng, rolling, rnd, flavor } = eng.rng;
  const r0 = newRng(12345);
  assert.equal(r0.seed, 12345); assert.notEqual(r0.core, r0.fl);
  // reference: the generator the old harness used for Math.random, started at the stream's own position
  const ref = (() => { let a = r0.core >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();
  const [vals, after] = rolling({ rng: r0 }, () => Array.from({ length: 1000 }, () => rnd()));
  for (const v of vals) { assert.equal(v, ref()); assert.ok(v >= 0 && v < 1); }
  assert.equal(after.fl, r0.fl, "mechanical rolls do not move the flavor stream");
  assert.notEqual(after.core, r0.core);
  const [, after2] = rolling({ rng: r0 }, () => { for (let i = 0; i < 50; i++) flavor(); });
  assert.equal(after2.core, r0.core, "flavor rolls do not move the mechanical stream");
  assert.notEqual(after2.fl, r0.fl);
});

test("a new run gets dice of its own, and an explicit seed is honoured", async () => {
  const eng = await E();
  const a = eng.state.newGame(), b = eng.state.newGame();
  for (const s of [a, b]) { assert.equal(s.rng.v, 1); for (const k of ["seed", "core", "fl"]) assert.ok(Number.isInteger(s.rng[k]) && s.rng[k] >= 0 && s.rng[k] <= 0xFFFFFFFF, k); }
  assert.notDeepEqual(a.rng, b.rng, "two new runs do not share a seed");
  const c = start(eng, 77).s, d = start(eng, 77).s;
  assert.deepEqual(c.rng, d.rng); assert.equal(c.rng.seed, 77);
});

test("a generator read from a save is kept when sound and replaced when not", async () => {
  const eng = await E(), { sanitizeRng } = eng.rng;
  const good = { v: 1, seed: 5, core: 4000000000, fl: 7 };
  assert.deepEqual(sanitizeRng(good), good);
  for (const bad of [null, undefined, 7, "x", [], {}, { seed: 1, core: 2 }, { seed: -1, core: 2, fl: 3 }, { seed: 1.5, core: 2, fl: 3 }, { seed: 1, core: 2 ** 32, fl: 3 }, { seed: 1, core: NaN, fl: 3 }, { seed: "1", core: 2, fl: 3 }]) {
    const r = sanitizeRng(bad);
    assert.ok(Number.isInteger(r.seed) && Number.isInteger(r.core) && Number.isInteger(r.fl), JSON.stringify(bad));
  }
});

test("same seed, same moves: the same run, every time", async () => {
  const eng = await E();
  for (const name of ["balanced", "risk", "claink-weekly", "conference"]) for (const seed of SEEDS.slice(0, 8)) {
    const a = playRun(eng, seed, POLICIES[name], { salt: name, keepState: true }), b = playRun(eng, seed, POLICIES[name], { salt: name, keepState: true });
    assert.ok(same(a.state, b.state), `${name} seed ${seed}`);
    assert.deepEqual(a.state.rng, b.state.rng);
  }
  const x = playRun(eng, 1, POLICIES.balanced, { salt: "balanced", keepState: true }), y = playRun(eng, 2, POLICIES.balanced, { salt: "balanced", keepState: true });
  assert.ok(!same(x.state, y.state), "a different seed is a different run");
});

test("a run saved and read back mid-way carries on exactly as it would have", async () => {
  const eng = await E();
  // compared as a reload would read them: reading a save fills in what an older writer left out (a revoked seat's
  // last strike card carries no `hurt` until it has been through storage once)
  const asSaved = s => digest(eng.state.mergeSaved(JSON.parse(JSON.stringify(s))));
  for (const name of ["balanced", "claink-weekly", "risk"]) for (const seed of SEEDS.slice(0, 6)) {
    const policy = POLICIES[name];
    const straight = () => {
      let g = start(eng, seed); const ctx = { rng: mulberry(fnv("bot:" + seed)), mem: {} }; const trail = [];
      for (let k = 0; k < 300 && !isOver(eng, g); k++) { const legal = legalMoves(eng, g); let id = policy(viewOf(eng, g, legal), ctx); if (!legal.includes(id)) id = "end"; g = play(eng, g, id).g; trail.push(asSaved(g.s)); }
      return trail;
    };
    const reloaded = () => {
      let g = start(eng, seed); const ctx = { rng: mulberry(fnv("bot:" + seed)), mem: {} }; const trail = [];
      for (let k = 0; k < 300 && !isOver(eng, g); k++) {
        const legal = legalMoves(eng, g); let id = policy(viewOf(eng, g, legal), ctx); if (!legal.includes(id)) id = "end";
        g = play(eng, g, id).g; trail.push(asSaved(g.s));
        // every third move the run goes to storage and comes back, the way a reload does it
        if (k % 3 === 2) g = { s: eng.state.mergeSaved(JSON.parse(JSON.stringify(g.s))), dialog: g.dialog };
      }
      return trail;
    };
    const a = straight(), b = reloaded();
    assert.equal(a.length, b.length, `${name} seed ${seed}: same number of moves`);
    for (let i = 0; i < a.length; i++) assert.equal(b[i], a[i], `${name} seed ${seed}: move ${i}`);
  }
});

test("nothing draws outside a step: not a preview, not a legal-move list, not a loaded save", async () => {
  const eng = await E();
  const before = eng.rng.strayDraws();
  for (const seed of SEEDS.slice(0, 6)) {
    let g = start(eng, seed); const ctx = { rng: mulberry(seed), mem: {} };
    for (let k = 0; k < 200 && !isOver(eng, g); k++) {
      const legal = legalMoves(eng, g), v = viewOf(eng, g, legal);
      // everything the interface computes for a render
      eng.selectors.pace(g.s); eng.selectors.fridayPreview(g.s); eng.selectors.crmPreview(g.s); eng.selectors.rechargeRange(g.s); eng.selectors.nextShot(g.s); eng.selectors.runFacts(g.s);
      for (const d of g.s.deals) eng.selectors.closeChance(g.s, d, { trained: true });
      eng.state.mergeSaved(JSON.parse(JSON.stringify(g.s)));
      let id = POLICIES["claink-weekly"](v, ctx); if (!legal.includes(id)) id = "end";
      g = play(eng, g, id).g;
    }
  }
  assert.equal(eng.rng.strayDraws(), before, "no roll was made outside a step");
  const r = eng.rng.rnd();
  assert.ok(r >= 0 && r < 1); assert.equal(eng.rng.strayDraws(), before + 1, "a roll outside a step is counted as a stray");
});

test("a move that changes nothing rolls nothing, and a finished run takes no move", async () => {
  const eng = await E();
  let g = start(eng, 5);
  // no energy for anything that costs it
  g = { s: { ...g.s, energy: 0, slots: 0 }, dialog: null };
  for (const id of ["prospect", "close", "demo", "conference"]) { const r = eng.run.step(g.s, { t: "act", id }); assert.equal(r.state || r, g.s, id + " is refused"); }
  const done = playRun(eng, 3, POLICIES.ascend, { keepState: true }).state;
  assert.ok(eng.log.isRunOver(done));
  for (const m of [{ t: "act", id: "prospect" }, { t: "end" }, { t: "ck", op: "deploy" }, { t: "ck", op: "buy" }]) { const r = eng.run.step(done, m); assert.equal(r.state || r, done, JSON.stringify(m)); }
});

test("scripted rolls replace the mechanical stream and leave the run's own position alone", async () => {
  const eng = await E();
  const g = start(eng, 9);
  const s = script([0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 0.5);
  try {
    const r = play(eng, g, "act:prospect");
    assert.ok(s.used() > 0);
    assert.deepEqual(r.g.s.rng, g.s.rng, "the run's own stream did not move");
    assert.equal(r.g.s.deals.length, 2, "randi(1,4) at 0 is 1, plus the bonus lead at 0");
  } finally { unscript(); }
});
