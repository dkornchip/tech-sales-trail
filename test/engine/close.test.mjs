// Signing deals (src/game/deals.js, rules.js closeOdds) and the Hail Mary (actions.js).
import test from "node:test";
import assert from "node:assert/strict";
import { E, craft, move, act, HAIL, withDice, lines, tags } from "./lib/kit.mjs";

const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg || ""} ${a} vs ${b}`);
const go = async (s, m, dice, rest = 0.99) => { const eng = await E(); return withDice(dice, rest, () => eng.run.step(s, m)); };

test("the signing odds: every term, the floor and the cap", async () => {
  const eng = await E(), odds = eng.rules.closeOdds;
  const s = await craft({}), d = { stage: 3, mood: "neutral" };
  // a new run: 0.05 + 0.26 x 0.25 + 0.10 x 0.35 + 0.07 x 0.50 + 0.08 x 0.40 + 0.08 x 0.60 - 0.20 x 0.28
  near(odds(s, d), 0.209);
  const plus = (over, delta, msg) => near(odds({ ...s, ...over }, d) - odds(s, d), delta, msg);
  plus({ skills: { ...s.skills, negotiate: 35 } }, 0.026, "negotiate"); plus({ skills: { ...s.skills, discovery: 45 } }, 0.010, "discovery");
  plus({ manager: 60 }, 0.007, "manager"); plus({ reputation: 50 }, 0.008, "reputation"); plus({ product: 70 }, 0.008, "product"); plus({ stress: 38 }, -0.020, "stress");
  plus({ pip: true, pipLevel: 1 }, -0.05, "PIP"); plus({ pip: true, pipLevel: 2 }, -0.10, "PIP level 2");
  plus({ effects: [{ src: "caseStudy", conv: 0.08, disc: 0, from: 1, until: 1 }] }, 0.08, "an effect in force"); plus({ effects: [{ src: "caseStudy", conv: 0.08, disc: 0, from: 2, until: 2 }] }, 0, "one that has not started");
  near(odds(s, { stage: 4, mood: "neutral" }) - odds(s, d), 0.05, "Closing"); near(odds(s, { stage: 3, mood: "happy" }) - odds(s, d), 0.08); near(odds(s, { stage: 3, mood: "skeptical" }) - odds(s, d), -0.06);
  near(odds(s, { stage: 3, mood: "curious" }), odds(s, d));
  assert.equal(odds({ ...s, stress: 100, manager: 0, reputation: 0, product: 0, skills: { ...s.skills, negotiate: 0, discovery: 0 }, pip: true, pipLevel: 2 }, d), 0.03);
  assert.equal(odds({ ...s, stress: 0, manager: 100, reputation: 100, product: 100, skills: { ...s.skills, negotiate: 100, discovery: 100 }, effects: [{ src: "caseStudy", conv: 0.3, disc: 0, from: 1, until: 1 }] }, { stage: 4, mood: "happy" }), 0.88);
  assert.deepEqual([eng.rules.ODDS_FLOOR, eng.rules.ODDS_CAP], [0.03, 0.88]);
});

test("the odds shown for the Close button are the odds it rolls against (it trains negotiation first)", async () => {
  const eng = await E();
  const s = await craft({ deals: [[3, 10000]] });
  const shown = eng.selectors.closeChance(s, s.deals[0], { trained: true });
  near(shown - eng.rules.closeOdds(s, s.deals[0]), 0.0026);
  assert.ok((await go(s, act("close"), [shown - 1e-6])).state.closedWon === 10000, "a roll just under the shown odds signs");
  assert.ok((await go(s, act("close"), [shown, 0.99])).state.closedWon === 0, "a roll equal to them does not");
});

test("a signature: closed revenue, 12% commission on the batch, the deal leaves the pipeline", async () => {
  const s = await craft({ cash: 0, deals: [[3, 10001], [4, 20002, "happy"], [2, 7000]] });
  const r = await go(s, act("close"), [0, 0]);
  const l = lines(s, r.state).find(x => x.tag === "close.signed");
  assert.deepEqual([l.d.src, l.d.n, l.d.won, l.d.keep], ["close", 2, 30003, 3600]); assert.deepEqual(l.d.top, { account: s.deals[1].account, value: 20002 }); assert.equal(l.d.off, undefined);
  assert.deepEqual(l.d.fx, { energy: -28 });
  assert.equal(r.state.closedWon, 30003); assert.equal(r.state.closedQuarter, 30003); assert.equal(r.state.cash, 3600);
  assert.deepEqual(r.state.deals.map(d => d.value), [7000]); assert.equal(r.state.pipeline, 7000);
  assert.equal(r.state.story.signed, 2); assert.equal(r.state.story.top.value, 20002);
  assert.equal(r.state.skills.negotiate, 26); assert.equal(r.state.used.close, true); assert.equal(r.state.slots, 4); assert.equal(r.state.energy, 67);
});

test("a failed attempt: the deal walks at 14% (Proposal) or 22% (Closing), else stays, cooler after a very bad roll", async () => {
  const one = async (stage, mood, dice) => { const s = await craft({ deals: [[stage, 9000, mood]] }); const r = await go(s, act("close"), dice); return { s, r, t: tags(s, r.state), d: r.state.deals[0] }; };
  let x = await one(3, "curious", [0.95, 0.1399]); assert.equal(x.r.state.deals.length, 0); assert.deepEqual(x.t, ["close.nobody", "close.lost"]);
  assert.deepEqual(lines(x.s, x.r.state)[1].d, { n: 1, value: 9000 }); assert.equal(x.r.state.pipeline, 0); assert.equal(x.r.state.story.n.lost, 1);
  x = await one(3, "curious", [0.95, 0.14]); assert.equal(x.d.mood, "neutral", "a roll over 0.9 cools the deal one step"); assert.ok(x.d.probNote.length > 0); assert.deepEqual(x.t, ["close.nobody"]);
  x = await one(3, "curious", [0.9, 0.14]); assert.equal(x.d.mood, "curious", "0.9 exactly does not");
  x = await one(3, "skeptical", [0.95, 0.5]); assert.equal(x.d.mood, "skeptical", "it cannot cool below skeptical");
  x = await one(4, "neutral", [0.95, 0.2199]); assert.equal(x.r.state.deals.length, 0);
  x = await one(4, "neutral", [0.95, 0.22]); assert.equal(x.r.state.deals.length, 1);
  assert.equal(lines(x.s, x.r.state)[0].kind, "warn");
});

test("nothing to sign: the action still costs, and says so", async () => {
  const s = await craft({ deals: [[2, 5000]] });
  const r = await go(s, act("close"), []);
  const l = lines(s, r.state); assert.deepEqual(l.map(x => x.tag), ["close.none"]); assert.deepEqual(l[0].d, { src: "close", fx: { energy: -28 } }); assert.equal(l[0].kind, "muted");
  assert.equal(r.state.slots, 4); assert.equal(r.state.skills.negotiate, 26);
});

test("Whale hunter: 65,000 or more signed in one push, in total, and not a dollar less", async () => {
  const push = async total => { const s = await craft({ deals: [[3, 30000], [3, total - 30000]] }); return (await go(s, act("close"), [0, 0])).state; };
  let s = await push(65000); assert.deepEqual(s.achievements.map(a => a.key), ["whale"]); assert.ok(s.logs.some(e => e.tag === "ach.unlocked"));
  s = await push(64999); assert.deepEqual(s.achievements, []);
  assert.equal((await import("../../src/game/deals.js")).WHALE_PUSH, 65000);
});

test("Collections: the jacket goes at -1500 exactly, Finance warns once at -1000", async () => {
  const { checkRepo } = await import("../../src/game/deals.js");
  const s = await craft({});
  assert.equal(checkRepo({ ...s, cash: -1499 }).repo, false); const r = checkRepo({ ...s, cash: -1500 });
  assert.ok(r.repo); assert.equal(r.endCause, "repo"); assert.equal(r.logs[0].tag, "end.repo"); assert.equal(r.logs[0].kind, "bad");
  const w = checkRepo({ ...s, cash: -1000 }); assert.ok(w.repoWarned && !w.repo); assert.equal(w.logs[0].tag, "pay.repoWarn");
  assert.equal(checkRepo({ ...s, cash: -999 }).repoWarned, false); assert.equal(checkRepo(w).logs.length, w.logs.length, "warned once");
  assert.equal(checkRepo({ ...s, cash: -5000, fired: true }).repo, false, "an ending already landed keeps its place");
});

test("the Hail Mary: its cost, and when it cannot be thrown", async () => {
  const eng = await E();
  assert.deepEqual(eng.rules.COST.hail, { energy: 10, slots: 1 }); assert.deepEqual(eng.rules.HAIL, { blast: 0.2, walk: 0.55 });
  assert.equal((await move(await craft({ deals: [[2, 5000]] }), HAIL)).refused, "illegal");
  assert.equal((await move(await craft({ deals: [[3, 5000]], energy: 9 }), HAIL)).refused, "illegal");
  assert.equal((await move(await craft({ deals: [[3, 5000]], slots: 0 }), HAIL)).refused, "illegal");
  assert.deepEqual(eng.run.hailBlock(await craft({ deals: [[2, 5000]] })), { why: "none" }); assert.equal(eng.run.hailBlock(await craft({ deals: [[3, 5000]] })), null);
});

test("the Hail Mary, all four ways", async () => {
  const base = { manager: 50, reputation: 40, stress: 30, deals: [[3, 10000], [4, 20000]] };
  // blast (first roll under 0.2) and a signature: +8 manager, +4 stress, nobody walks
  let s = await craft(base), r = await go(s, HAIL, [0.1999, 0, 0.95, 0.99]);
  assert.deepEqual(tags(s, r.state), ["act.hail.blast", "close.signed", "act.hail.chaosWon"]);
  assert.deepEqual([r.state.manager, r.state.stress, r.state.reputation, r.state.energy, r.state.slots], [58, 34, 40, 85, 4]);
  assert.deepEqual(lines(s, r.state)[0].d.fx, { energy: -10 }); assert.deepEqual(lines(s, r.state)[2].d.fx, { manager: 8, stress: 4 }); assert.equal(r.state.deals.length, 1);
  assert.equal(r.state.story.n.hails, 1);
  // blast and nothing signed: -4 manager, +6 stress
  r = await go(s, HAIL, [0, 0.95, 0.99, 0.95, 0.99]);
  assert.deepEqual(tags(s, r.state), ["act.hail.blast", "close.nobody", "act.hail.chaosLost"]); assert.deepEqual([r.state.manager, r.state.stress], [46, 36]); assert.equal(r.state.deals.length, 2);
  // lean (0.2 or more) and nothing signed: each late deal left walks at 55%; -8 manager, -4 reputation, +8 stress
  r = await go(s, HAIL, [0.2, 0.95, 0.99, 0.95, 0.99, 0.5499, 0.55]);
  assert.deepEqual(tags(s, r.state), ["act.hail.lean", "close.nobody", "deal.lost", "act.hail.torched"]);
  assert.deepEqual([r.state.manager, r.state.reputation, r.state.stress], [42, 36, 38]); assert.deepEqual(r.state.deals.map(d => d.value), [20000]);
  let last = lines(s, r.state).pop(); assert.equal(last.d.walked, 1); assert.deepEqual(last.d.fx, { manager: -8, reputation: -4, stress: 8 }); assert.equal(last.kind, "bad");
  // lean and a signature: net -6 manager, -3 reputation, +8 stress; the other deal may still walk
  r = await go(s, HAIL, [0.99, 0, 0.95, 0.99, 0.55]);
  assert.deepEqual(tags(s, r.state), ["act.hail.lean", "close.signed", "act.hail.cooked"]);
  assert.deepEqual([r.state.manager, r.state.reputation, r.state.stress, r.state.closedWon], [44, 37, 38, 10000]);
  last = lines(s, r.state).pop(); assert.equal(last.d.walked, 0); assert.deepEqual(last.d.fx, { manager: -6, reputation: -3, stress: 8 });
  r = await go(s, HAIL, [0.99, 0, 0.95, 0.99, 0.1]);
  assert.equal(lines(s, r.state).pop().d.walked, 1); assert.equal(r.state.deals.length, 0);
});

test("the Hail Mary reports what really changed, and checks burnout and Collections after itself", async () => {
  // a manager at 3 can only lose 3
  let s = await craft({ manager: 3, reputation: 2, stress: 30, deals: [[3, 10000]] });
  let r = await go(s, HAIL, [0.99, 0.95, 0.99, 0.99]);
  assert.deepEqual(lines(s, r.state).pop().d.fx, { manager: -3, reputation: -2, stress: 8 });
  // stress 93 + 8: meltdown, and the ending is the last line
  s = await craft({ stress: 93, deals: [[3, 10000]] });
  r = await go(s, HAIL, [0.99, 0.95, 0.99, 0.99]);
  assert.ok(r.state.burnedOut); assert.equal(r.state.endCause, "stress"); assert.equal(r.state.logs[0].tag, "end.meltdown.stress");
});
