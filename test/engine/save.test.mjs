// Stored runs (src/game/save.js, state.js mergeSaved): what is written, and how anything found in storage is read.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { E, ROOT, craft, start, legalMoves, play, viewOf, isOver, digest, mulberry, fnv } from "./lib/kit.mjs";
import { loadEngine } from "../sim/lib/harness.mjs";
import { POLICIES } from "../sim/lib/policies.mjs";

const S = await import("../../src/game/save.js");
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "test/saves/manifest.json"), "utf8"));
const rawOf = file => fs.readFileSync(path.join(ROOT, "test/saves", file), "utf8").replace(/\n$/, "");

test("what is written: one envelope, with the choices and the dice beside the run", async () => {
  const s = await craft({ week: 2, pending: [{ id: "evt:competitor" }], deals: [[2, 9000]] }, 77);
  const env = JSON.parse(S.encodeRun(s, "2.1.0"));
  assert.deepEqual(Object.keys(env), ["app", "schemaVersion", "build", "savedAt", "state", "pendingEvents", "rngState"]);
  assert.deepEqual([env.app, env.schemaVersion, env.build], ["tech-sales-trail", 5, "2.1.0"]); assert.ok(!Number.isNaN(Date.parse(env.savedAt)));
  assert.deepEqual(env.pendingEvents, [{ id: "evt:competitor" }]); assert.deepEqual(env.rngState, s.rng);
  assert.ok(!("pending" in env.state) && !("rng" in env.state), "they are not also inside the run");
  const back = S.decodeRun(S.encodeRun(s, "2.1.0"));
  assert.equal(back.status, "ok"); assert.equal(back.legacy, false); assert.equal(digest(back.state), digest(s)); assert.deepEqual(back.state.rng, s.rng);
  assert.equal(back.state.runId, s.runId);
});

test("what cannot be opened is reported, never guessed at", async () => {
  for (const raw of ["", "{not json", "null", "7", '"run"', "[]", "{}", '{"week":"x","deals":[],"logs":[]}', '{"week":3,"deals":"nope","logs":7}', '{"week":3,"deals":[],"logs":[],"energy":"lots","stress":1,"cash":1}',
    '{"week":0,"deals":[],"logs":[],"energy":1,"stress":1,"cash":1}', '{"app":"other-game","schemaVersion":5,"state":{}}', '{"app":"tech-sales-trail","schemaVersion":"5","state":{}}', '{"app":"tech-sales-trail","schemaVersion":5}',
    '{"app":"tech-sales-trail","schemaVersion":5,"state":{"week":2}}', '{"schemaVersion":5,"state":{"week":2,"deals":[],"logs":[]}}'])
    assert.equal(S.decodeRun(raw).status, "damaged", raw.slice(0, 50));
  assert.deepEqual(S.decodeRun('{"app":"tech-sales-trail","schemaVersion":6,"state":{"anything":true}}'), { status: "newer", schemaVersion: 6 });
  assert.equal(S.decodeRun('{"app":"tech-sales-trail","schemaVersion":99}').status, "newer");
});

test("a run is rebuilt field by field: junk dropped, numbers in range, lists that are lists", async () => {
  const eng = await E();
  const junk = { week: 6.9, slots: 99, maxSlots: 50, energy: 400, stress: -5, cash: 1e12, manager: "high", reputation: NaN, product: 61.5, quota: 1, closedWon: -50, closedQuarter: 2e10, pipeline: 123456, meetings: -3,
    skills: { prospect: 500, demo: "x", evil: 1 }, used: { prospect: "yes", crm: true, evil: true }, pip: "true", pipLevel: 9, perfWarnings: 12, coffeesThisWeek: -2, restedThisWeek: 1, hygieneShield: true, trip: "x".repeat(500),
    deals: [{ id: "a", account: "Good", value: 5000.7, stage: 2, mood: "happy", age: 3, probNote: "n".repeat(300) }, { id: "a", account: "SameId", value: 100, stage: 0, mood: "furious", age: -4 },
      { id: "b", account: "", value: 100, stage: 0 }, { id: "c", account: "NoValue", value: 0, stage: 0 }, { id: "d", account: "BadStage", value: 10, stage: 9 }, null, "deal", { account: "NoId", value: 7, stage: 4.2 }],
    logs: [{ id: "l1", t: "09:00", msg: "<b>hi</b>", kind: "bad", tag: "end.repo", wk: 3, dl: "x", v: 1, d: { n: 2, fx: { energy: -5 }, top: { account: "A", value: 3 }, deep: { a: { b: { c: { d: 1 } } } }, fn: "x".repeat(999) } },
      { id: "l1", msg: "dup id", kind: "shouting" }, { msg: 7 }, null, { id: "l3", msg: "", tag: "week.next" }, { id: "l4", msg: "bad tag", tag: "<script>" }],
    fired: true, win: true, repo: "yes", endCause: "club", achievements: [{ key: "whale", label: "Whale hunter" }, { key: "whale" }, { key: "godmode", label: "x" }, "whale"], effects: "all of them", pending: { id: "evt:competitor" },
    lastConference: 99, runId: 42, rng: "dice", story: 5, claink: 5, evil: "<img onerror=x>", __proto__: { polluted: true }, constructor: "x", modifiers: { conversion: 0.12, discount: 0.2, expiresIn: 2 } };
  const s = eng.state.mergeSaved(junk), base = eng.state.newGame();
  assert.deepEqual(Object.keys(s).sort(), Object.keys(base).sort(), "exactly the fields of a run, no more and no fewer");
  assert.deepEqual([s.week, s.slots, s.maxSlots, s.energy, s.stress, s.cash, s.manager, s.reputation, s.product, s.quota], [6, 5, 5, 100, 0, 1e9, 50, 40, 61.5, 160000]);
  assert.deepEqual([s.closedWon, s.closedQuarter, s.meetings, s.perfWarnings, s.coffeesThisWeek, s.pipLevel, s.pip, s.restedThisWeek], [0, 1e9, 0, 3, 0, 0, false, false]);
  assert.deepEqual(s.skills, { prospect: 100, discovery: 35, demo: 30, negotiate: 25 }); assert.deepEqual(s.used, { ...base.used, crm: true });
  assert.equal(s.trip.length, 40);
  assert.deepEqual(s.deals.map(d => [d.account, d.value, d.stage, d.mood, d.age]), [["Good", 5000, 2, "happy", 3], ["SameId", 100, 0, "neutral", 0], ["NoId", 7, 4, "neutral", 0]]);
  assert.equal(new Set(s.deals.map(d => d.id)).size, 3, "no two deals share an id"); assert.equal(s.deals[0].probNote.length, 80);
  assert.equal(s.pipeline, 5107, "the pipeline is the sum of the deals, whatever the save claimed");
  assert.deepEqual(s.logs.map(e => [e.msg, e.kind, e.tag]), [["<b>hi</b>", "bad", "end.repo"], ["dup id", "info", undefined], ["", "info", "week.next"], ["bad tag", "info", undefined]]);
  assert.equal(new Set(s.logs.map(e => e.id)).size, 4); assert.deepEqual(s.logs[0].d.fx, { energy: -5 }); assert.equal(s.logs[0].d.fn.length, 160); assert.deepEqual(s.logs[0].d.deep, { a: {} }, "nesting stops three levels down");
  // two endings claimed, and a cause that names one of them: that one, alone
  assert.deepEqual([s.fired, s.win, s.repo, s.burnedOut, s.missed, s.endCause], [false, true, false, false, false, "club"]);
  assert.deepEqual(s.achievements, [{ key: "whale", label: "Whale hunter" }], "known achievements once; none invented");
  assert.deepEqual(s.effects, [{ src: "legacy", conv: 0.12, disc: 0.2, from: 6, until: 7 }], "effects that are not a list are not effects: the old shared bonus is read instead"); assert.deepEqual(s.pending, []);
  assert.equal(s.lastConference, 6); assert.equal(typeof s.runId, "string"); assert.ok(Number.isInteger(s.rng.core)); assert.equal(s.story, null); assert.equal(s.claink.status, "expired");
  assert.equal({}.polluted, undefined); assert.ok(eng.state.isRun(s));
  for (const bad of [null, undefined, 5, "x", []]) assert.ok(eng.state.isRun(eng.state.mergeSaved(bad)), "even nothing at all comes back as a drawable run");
});

test("an ending is kept only as the save tells it: one flag, and a cause only if it fits", async () => {
  const { mergeSaved } = (await E()).state;
  const end = over => { const s = mergeSaved({ week: 9, deals: [], logs: [], ...over }); return [["repo", "burnedOut", "win", "missed", "fired"].filter(k => s[k]).join("+"), s.endCause]; };
  assert.deepEqual(end({ fired: true, endCause: "review" }), ["fired", "review"]);
  assert.deepEqual(end({ fired: true }), ["fired", null], "an old save with no cause is not given one");
  assert.deepEqual(end({ fired: true, endCause: "club" }), ["fired", null], "a cause that does not fit the ending is dropped");
  assert.deepEqual(end({ burnedOut: true, repo: true }), ["repo", null], "two endings: the one the interface would have shown");
  assert.deepEqual(end({ burnedOut: true, repo: true, endCause: "caffeine" }), ["burnedOut", "caffeine"]);
  assert.deepEqual(end({ endCause: "review" }), ["", null], "a live run has no cause");
  assert.deepEqual(end({ repo: true, endCause: "claink" }), ["repo", "claink"]);
});

test("the choice v2.0 kept beside its autosave is honoured once, for that run and week only", async () => {
  const bare = JSON.stringify({ week: 7, runId: "abc-1", deals: [], logs: [], energy: 50, stress: 30, cash: 100 });
  const got = held => S.decodeRun(bare, held).state.pending;
  assert.deepEqual(got({ runId: "abc-1", week: 7, id: "evt:security" }), [{ id: "evt:security" }]);
  assert.deepEqual(got({ runId: "abc-1", week: 8, id: "evt:security" }), []); assert.deepEqual(got({ runId: "other", week: 7, id: "evt:security" }), []);
  assert.deepEqual(got({ runId: "abc-1", week: 7, id: "ck:warning" }), [], "only End Week choices were ever kept there");
  assert.deepEqual(got({ runId: "abc-1", week: 7, id: "evt:nope" }), []); assert.deepEqual(got(null), []); assert.deepEqual(got("x"), []);
  const done = JSON.stringify({ week: 7, runId: "abc-1", fired: true, deals: [], logs: [], energy: 50, stress: 30, cash: 100 });
  assert.deepEqual(S.decodeRun(done, { runId: "abc-1", week: 7, id: "evt:security" }).state.pending, []);
  // a v2.1 save says for itself what it is waiting on: the old key is not consulted
  const s = await craft({ week: 7 }); const env = S.encodeRun(s, "t");
  assert.deepEqual(S.decodeRun(env, { runId: s.runId, week: 7, id: "evt:security" }).state.pending, []);
});

test("every legacy fixture (v1.14 to v2.0.1, 38 of them) opens as the run it was", async () => {
  const eng = await E(), OLD = await loadEngine(path.join(ROOT, "test/baseline/checkpoint-engine"), "v2.0.1");
  let opened = 0, damaged = [];
  for (const f of manifest.fixtures) {
    const files = f.file ? [f.file] : Object.values(f.storage);
    for (const file of files) {
      const raw = rawOf(file), r = S.decodeRun(raw);
      let parsed = null; try { parsed = JSON.parse(raw); } catch { /* the corrupt-JSON fixture */ }
      if (!parsed) { assert.equal(r.status, "damaged", f.id); damaged.push(f.id); continue; }
      assert.equal(r.status, "ok", `${f.id}: ${r.why || ""}`); assert.equal(r.legacy, true); opened++;
      const now = r.state, was = OLD.state.mergeSaved(parsed);
      assert.ok(eng.state.isRun(now), f.id);
      // what the v2.0.1 rules read from the same save, field for field, wherever the two versions keep the same field
      for (const k of ["week", "slots", "energy", "stress", "cash", "manager", "reputation", "product", "closedWon", "discounts", "perfWarnings", "coffeesThisWeek", "pip", "pipLevel", "repoWarned",
        "fired", "burnedOut", "win", "missed", "repo", "restedThisWeek", "hygieneShield", "trip", "runId"]) assert.deepEqual(now[k], was[k], `${f.id}: ${k}`);
      assert.deepEqual(now.skills, was.skills, f.id + " skills"); assert.deepEqual(now.used, was.used, f.id + " used");
      assert.deepEqual(now.deals.map(d => [d.id, d.account, d.value, d.stage, d.mood, d.age]), was.deals.map(d => [d.id, d.account, d.value, d.stage, d.mood, d.age]), f.id + " deals");
      assert.deepEqual(now.logs.map(e => [e.id, e.msg, e.kind, e.tag]), was.logs.map(e => [e.id, e.msg, e.kind, e.tag]), f.id + ": the log reads as it was written");
      assert.deepEqual({ ...now.claink, earned: 0 }, { ...was.claink, earned: 0 }, f.id + " clAInk");
      assert.deepEqual(now.story, was.story && { ...was.story }, f.id + " story");
      assert.equal(now.endCause, was.endCause, f.id + " cause");
      // the old shared bonus becomes one dated effect worth the same, for as long as it had left
      const m = was.modifiers || {};
      assert.ok(Math.abs(eng.effects.convMod(now) - Math.max(-0.3, Math.min(0.3, m.conversion || 0))) < 1e-9, `${f.id}: odds ${eng.effects.convMod(now)} vs ${m.conversion}`);
      assert.equal(eng.effects.discountRate(now), m.discount || 0, f.id + " discount");
      if (m.expiresIn > 0 && (m.conversion || m.discount)) assert.equal(now.effects[0].until - now.week + 1, m.expiresIn, f.id + " weeks left");
      assert.deepEqual(now.pending, [], "a legacy save waits on nothing by itself"); assert.deepEqual(now.achievements.map(a => a.key), (was.achievements || []).filter(a => a && a.key === "whale").map(a => a.key));
    }
  }
  assert.ok(opened >= 37, opened + " opened"); assert.deepEqual(damaged, ["legacy-corrupt-json"]);
});

test("a run that goes through storage after every few moves plays exactly as one that never did", async () => {
  const eng = await E();
  for (const name of ["balanced", "claink-weekly", "risk", "conference"]) for (const seed of [301, 302, 303]) {
    const run = reload => {
      let g = start(eng, seed); const ctx = { rng: mulberry(fnv("save:" + seed)), mem: {} }; const trail = [];
      for (let k = 0; k < 300 && !isOver(eng, g); k++) {
        const legal = legalMoves(eng, g); let id = POLICIES[name](viewOf(eng, g, legal), ctx); if (!legal.includes(id)) id = "end";
        g = play(eng, g, id).g;
        if (reload && k % 2 === 1) { const r = S.decodeRun(S.encodeRun(g.s, "t")); assert.equal(r.status, "ok"); g = { s: r.state, dialog: null }; }
        trail.push(digest(S.decodeRun(S.encodeRun(g.s, "t")).state));
      }
      return trail;
    };
    const a = run(false), b = run(true);
    assert.equal(a.length, b.length, `${name} ${seed}`);
    for (let i = 0; i < a.length; i++) assert.equal(b[i], a[i], `${name} seed ${seed} move ${i}`);
  }
});
