// Choices and the front door (src/game/run.js): a waiting choice is part of the run, blocks everything else, and is
// answered exactly once; the rules decide what is legal; step never changes the state it is given.
import test from "node:test";
import assert from "node:assert/strict";
import { E, craft, move, act, END, HAIL, withDice, endWeek, lines, tags, frozen, digest, start, legalMoves, play, isOver, mulberry, fnv } from "./lib/kit.mjs";

const choose = (event, option) => ({ t: "choose", event, option });
const ALL_ACTS = ["prospect", "cadence", "network", "discovery", "demo", "propose", "close", "conference", "crm", "recharge", "coffee", "politics"];
const OTHER_MOVES = [...ALL_ACTS.map(act), HAIL, END, ...["buy", "dismiss", "deploy", "cancel", "hide"].map(op => ({ t: "ck", op }))];
const reload = async s => (await E()).state.mergeSaved(JSON.parse(JSON.stringify(s)));

test("a waiting choice blocks every other move, and its options are the only legal moves", async () => {
  const eng = await E();
  const s = await craft({ week: 5, deals: [[3, 9000]], pending: [{ id: "evt:competitor" }] });
  assert.deepEqual(eng.run.legalMoves(s), [choose("evt:competitor", "match"), choose("evt:competitor", "hold")]);
  for (const m of [...OTHER_MOVES, choose("evt:security", "own"), choose("evt:competitor", "nope"), choose("ck:warning", "ack")]) {
    const r = await move(s, m);
    assert.equal(r.refused, "pending", JSON.stringify(m)); assert.equal(r.state, s, "the same state object comes back");
  }
});

test("an answer is applied once and takes its choice off the list; answering again is refused", async () => {
  const s = await craft({ week: 5, pending: [{ id: "evt:competitor" }] });
  const r = await move(s, choose("evt:competitor", "match"));
  assert.equal(r.refused, null); assert.deepEqual(r.state.pending, []); assert.deepEqual(tags(s, r.state), ["evt.competitor.match"]);
  const again = await move(r.state, choose("evt:competitor", "match"));
  assert.equal(again.refused, "illegal"); assert.equal(again.state, r.state);
  assert.equal(r.state.effects.length, 1, "applied once");
});

test("a Friday choice and a word from clAInk's manager waiting together: each is asked in turn, once, in either order", async () => {
  const eng = await E();
  for (const pending of [[{ id: "ck:lesson", params: { account: "Initech" } }, { id: "evt:competitor" }], [{ id: "evt:competitor" }, { id: "ck:lesson", params: { account: "Initech" } }]]) {
    const s0 = await craft({ week: 5, pending });
    const answers = pending.map(p => choose(p.id, p.id === "evt:competitor" ? "hold" : "ack"));
    // the second in line cannot be answered first
    assert.equal((await move(s0, answers[1])).refused, "pending");
    const s1 = (await move(s0, answers[0])).state;
    assert.deepEqual(s1.pending, [pending[1]], "the second is still waiting, with what it was about");
    const s2 = (await move(s1, answers[1])).state;
    assert.deepEqual(s2.pending, []);
    assert.equal(s2.logs.filter(e => e.tag === "evt.competitor.hold").length, 1, "the pricing choice was applied exactly once");
    assert.ok(eng.run.legalMoves(s2).some(m => m.t === "end"), "and play goes on");
    // the same with the run going through storage between every step: nothing lost, nothing repeated, same result
    const t1 = (await move(await reload(s0), answers[0])).state;
    assert.deepEqual((await reload(t1)).pending, [pending[1]]);
    const t2 = (await move(await reload(t1), answers[1])).state;
    assert.equal(digest(await reload(t2)), digest(await reload(s2)), "the reloaded run ends where the straight one did");
  }
});

test("the manager's warning holds End Week back until it is acknowledged; then End Week's own choice is asked too", async () => {
  const eng = await E();
  const s0 = await craft({ week: 2, claink: { status: "active" }, deals: [[2, 9000]] });
  // deploy: rMiracle 0.5 (no sale), rMgr 0.1 (he notices), rInc 0.9 (no damage), rKind
  const d = await withDice([0.5, 0.1, 0.9, 0.5], 0.5, () => eng.run.step(s0, { t: "ck", op: "deploy" }));
  assert.deepEqual(d.state.pending, [{ id: "ck:warning", params: { miracle: false } }]); assert.deepEqual(d.events, d.state.pending);
  const blocked = await move(d.state, END);
  assert.equal(blocked.refused, "pending"); assert.equal(blocked.state.week, 2);
  // through storage and back: still waiting
  const back = await reload(d.state);
  assert.deepEqual(back.pending, d.state.pending);
  const acked = (await move(back, choose("ck:warning", "ack"))).state;
  assert.deepEqual(acked.pending, []);
  const r = await endWeek(acked, { competitor: 0.01 }, [], 0.99);
  assert.equal(r.state.week, 3); assert.deepEqual(r.state.pending, [{ id: "evt:competitor" }]);
  assert.equal(r.state.logs.filter(e => e.tag === "ck.mgr.warning").length, 1);
});

test("a run that ends in the same End Week that raised a choice is waiting on nothing", async () => {
  const eng = await E();
  // week 7, nothing closed, three warnings, a manager who has had enough: the price cut comes up, then the review fires
  const s = await craft({ week: 7, perfWarnings: 3, manager: 10 });
  const dice = [0.99, ...Array(7).fill(0.99)]; dice[2] = 0.01;       // close no; marketing no; competitor yes
  const r = await withDice(dice.concat([0.0]), 0.0, () => eng.run.step(s, END));   // every later roll is 0: the review fires
  assert.ok(r.over && eng.log.isRunOver(r.state)); assert.equal(r.state.endCause, "review");
  assert.deepEqual(r.state.pending, []); assert.deepEqual(r.events, []);
  assert.deepEqual(eng.run.legalMoves(r.state), []);
  assert.equal(r.state.logs[0].tag, "end.fired.review", "the ending is the last line");
});

test("what a save was waiting on is checked on the way in", async () => {
  const eng = await E(), { sanitizePending, mergeSaved } = eng.state;
  const long = "x".repeat(200);
  assert.deepEqual(sanitizePending([{ id: "evt:competitor", params: { html: "<b>", account: long, miracle: "yes" } }, { id: "nope" }, null, { id: "constructor" }, { id: "ck:warning", params: { miracle: true } },
    { id: "ck:lesson" }, { id: "evt:security" }, { id: "evt:competitor" }], false),
  [{ id: "evt:competitor", params: { account: long.slice(0, 60) } }, { id: "ck:warning", params: { miracle: true } }, { id: "ck:lesson" }, { id: "evt:security" }],
  "known choices only, in order, four at most, with nothing in them but a short account name and a yes or no");
  assert.deepEqual(sanitizePending([{ id: "evt:competitor" }], true), [], "a finished run waits on nothing");
  assert.deepEqual(sanitizePending("x", false), []);
  const over = mergeSaved({ week: 9, fired: true, endCause: "review", deals: [], logs: [], pending: [{ id: "evt:competitor" }] });
  assert.deepEqual(over.pending, []);
  assert.deepEqual(mergeSaved({ week: 9, deals: [], logs: [] }).pending, [], "a save from before v2.1 has none");
});

test("moves that are not legal are refused, change nothing, roll nothing and write nothing", async () => {
  const eng = await E();
  const s = frozen(await craft({ week: 3, slots: 5, energy: 95, restedThisWeek: true, used: { crm: true }, deals: [[1, 5000]] }));
  for (const m of [HAIL, act("recharge"), act("crm"), act("__proto__"), act("constructor"), { t: "ck", op: "constructor" }, { t: "ck", op: "deploy" }, { t: "ck", op: "cancel" }, { t: "ck", op: "hide" },
    choose("evt:competitor", "match"), null, undefined, {}, 7, "end", { t: "nope" }]) {
    const r = eng.run.step(s, m);
    assert.equal(r.refused, "illegal", JSON.stringify(m)); assert.equal(r.state, s); assert.deepEqual(r.events, []);
  }
  const broke = frozen(await craft({ energy: 5, slots: 0 }));
  for (const id of ALL_ACTS) assert.equal(eng.run.step(broke, act(id)).refused, "illegal", id);
  assert.equal(eng.run.step(broke, END).refused, null, "End Week is always there on a live run");
  const done = frozen(await craft({ fired: true, endCause: "review", pending: [] }));
  for (const m of OTHER_MOVES) { const r = eng.run.step(done, m); assert.equal(r.refused, "over"); assert.equal(r.state, done); }
});

test("step never changes the state it is given, and the same state and move give the same result", async () => {
  const eng = await E();
  let steps = 0; const kinds = new Set();
  for (let seed = 40; seed < 52; seed++) {
    let g = start(eng, seed); const rng = mulberry(fnv("pure:" + seed));
    for (let k = 0; k < 400 && !isOver(eng, g); k++) {
      frozen(g.s);                                                   // a write to it now throws
      const legal = eng.run.legalMoves(g.s);
      assert.ok(legal.length > 0);
      // every legal move is accepted by the same rules that listed it
      for (const m of legal) assert.equal(eng.run.refusal(g.s, m), null, JSON.stringify(m));
      const pool = legal.concat(legal.filter(m => m.t === "end"), legal.filter(m => m.t === "ck"), legal.filter(m => m.t === "ck"));
      const m = pool[Math.floor(rng() * pool.length)];
      const a = eng.run.step(g.s, m), b = eng.run.step(g.s, m);
      assert.equal(a.refused, null); assert.notEqual(a.state, g.s, "a legal move changes the run: " + JSON.stringify(m));
      assert.equal(digest(a.state), digest(b.state), "same state, same move, same result"); assert.deepEqual(a.state.rng, b.state.rng);
      kinds.add(m.t === "ck" ? "ck:" + m.op : m.t);
      g = { s: a.state, dialog: null }; steps++;
    }
    assert.ok(isOver(eng, g), "seed " + seed);
  }
  assert.ok(steps > 200, steps + " moves");
  for (const k of ["act", "end", "choose", "ck:buy", "ck:deploy"]) assert.ok(kinds.has(k), "random play made a " + k + " move: " + [...kinds].join(" "));
});

test("what the rules offer and what they accept are the same list", async () => {
  const eng = await E();
  for (let seed = 60; seed < 66; seed++) {
    let g = start(eng, seed); const rng = mulberry(seed);
    for (let k = 0; k < 200 && !isOver(eng, g); k++) {
      const legal = eng.run.legalMoves(g.s), key = m => JSON.stringify(m), offered = new Set(legal.map(key));
      for (const m of OTHER_MOVES) {
        const r = eng.run.refusal(g.s, m);
        assert.equal(r === null, offered.has(key(m)), `seed ${seed} move ${k}: ${key(m)} offered ${offered.has(key(m))} refusal ${r}`);
      }
      const ids = legalMoves(eng, g); g = play(eng, g, ids[Math.floor(rng() * ids.length)]).g;
    }
  }
});
