// The twelve actions (src/game/actions.js): what each costs, does, trains and reports, and when it is refused.
import test from "node:test";
import assert from "node:assert/strict";
import { E, craft, move, act, withDice, lines, tags, start, mulberry, fnv, mechanical } from "./lib/kit.mjs";

const go = async (s, id, dice = [], rest = 0.99) => { const eng = await E(); return withDice(dice, rest, () => eng.run.step(s, act(id))); };
const first = async (s, id, dice, rest) => { const r = await go(s, id, dice, rest); return { s: r.state, l: lines(s, r.state)[0], all: lines(s, r.state), r }; };

test("a new run starts where the brief says", async () => {
  const eng = await E(), s = start(eng, 1).s;
  assert.deepEqual([s.week, s.slots, s.maxSlots, s.cash, s.energy, s.stress, s.manager, s.reputation, s.product, s.quota], [1, 5, 5, 1200, 95, 28, 50, 40, 60, 160000]);
  assert.deepEqual(s.skills, { prospect: 45, discovery: 35, demo: 30, negotiate: 25 });
  assert.deepEqual([s.closedWon, s.closedQuarter, s.pipeline, s.deals.length, s.logs.length, s.perfWarnings, s.coffeesThisWeek], [0, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual([s.effects, s.pending, s.claink.status, s.endCause, s.lastConference], [[], [], "ad", null, 0]);
  assert.ok(!s.fired && !s.burnedOut && !s.win && !s.missed && !s.repo && !s.pip);
});

test("the numbers are the brief's: what every action costs", async () => {
  const { COST } = (await E()).rules;
  assert.deepEqual(COST, { prospect: { energy: 30, slots: 1 }, cadence: { energy: 18, slots: 1 }, network: { energy: 16, slots: 1 }, discovery: { energy: 22, slots: 1 }, demo: { energy: 28, slots: 1 },
    propose: { energy: 25, slots: 1 }, close: { energy: 28, slots: 1 }, conference: { energy: 40, slots: 2, cash: 800 }, crm: { energy: 15, slots: 1 }, recharge: { energy: 0, slots: 1 },
    coffee: { energy: 0, slots: 1, cash: 6 }, politics: { energy: 20, slots: 1 }, hail: { energy: 10, slots: 1 } });
});

test("every action takes its energy and slots, and is refused without them", async () => {
  const eng = await E(), { COST } = eng.rules;
  const BOARD = [[0, 1000], [1, 1000], [2, 1000], [3, 1000]];      // a deal at every stage: every action has something to act on
  for (const id of Object.keys(eng.run.ACTS)) {
    const s = await craft({ cash: 5000, deals: BOARD });
    const r = await go(s, id, [], 0.5);
    assert.equal(r.refused, null, id); assert.equal(r.state.slots, 5 - COST[id].slots, id + " slots");
    if (id !== "recharge" && id !== "coffee") assert.equal(r.state.energy, 95 - COST[id].energy, id + " energy");
    if (COST[id].energy > 0) { const tired = await craft({ energy: COST[id].energy - 1, deals: BOARD }); const x = await move(tired, act(id)); assert.equal(x.refused, "illegal", id + " without energy"); assert.equal(x.state, tired); }
    const exact = await craft({ energy: COST[id].energy, cash: 5000, deals: BOARD }); assert.equal((await go(exact, id, [], 0.5)).refused, null, id + " with exactly enough energy");
    const busy = await craft({ slots: COST[id].slots - 1, deals: BOARD }); assert.equal((await move(busy, act(id))).refused, "illegal", id + " without slots");
    assert.equal((await move(await craft({ fired: true, endCause: "review" }), act(id))).refused, "over");
  }
});

test("Prospect: 1-4 cold leads, a fifth on a skill roll; trains prospecting; +2 stress", async () => {
  // rolls: count, bonus, then per lead (size, mood, name), then meetings
  let x = await first(await craft({}), "prospect", [0, 0.19], 0);          // 1 + no bonus (0.19 is not under 45% x 0.4)
  assert.equal(x.s.deals.length, 1); assert.deepEqual(x.l.d, { n: 1, fx: { energy: -30, stress: 2 } });
  assert.deepEqual([x.s.deals[0].stage, x.s.deals[0].mood, x.s.deals[0].value, x.s.deals[0].age], [0, "skeptical", 4700, 0]);   // 5000 x (0.7 + 0.6 x 0.40)
  x = await first(await craft({}), "prospect", [0.999, 0.1799], 0.5); assert.equal(x.s.deals.length, 5); assert.equal(x.s.deals[0].mood, "neutral");
  assert.deepEqual([x.s.skills.prospect, x.s.stress, x.s.used.prospect], [46, 30, true]);
  assert.equal(x.s.pipeline, x.s.deals.reduce((t, d) => t + d.value, 0));
  assert.equal(new Set(x.s.deals.map(d => d.account)).size, 5, "no two open deals share a name, even when the dice pick the same one");
  assert.deepEqual((await first(await craft({ stress: 99 }), "prospect", [0, 0.99], 0)).l.d.fx, { energy: -30, stress: 1 });
});

test("Cadence: 0-3 warm leads; Referrals: 1-2 introductions, +4 reputation before sizing, and the tier table", async () => {
  let x = await first(await craft({}), "cadence", [0], 0); assert.equal(x.s.deals.length, 0); assert.deepEqual(x.l.d, { n: 0, fx: { energy: -18 } }); assert.equal(x.s.used.cadence, true);
  x = await first(await craft({}), "cadence", [0.999], 0); assert.equal(x.s.deals.length, 3); assert.equal(x.s.deals[0].mood, "curious"); assert.equal(x.s.story.n.cadences, 1);
  // referrals: count, then per referral (tier, size, name)
  const tier = async roll => first(await craft({}), "network", [0, roll, 0, 0], 0);
  x = await tier(0.6999); assert.equal(x.s.deals.length, 1); assert.equal(x.l.d.size, ""); assert.equal(x.s.deals[0].value, Math.round(2000 * (0.75 + 0.70 * 0.44)), "sized on reputation 44");
  assert.deepEqual(x.l.d.fx, { energy: -16, reputation: 4 }); assert.equal(x.s.deals[0].mood, "happy"); assert.equal(x.s.used.network, true);
  x = await tier(0.70); assert.equal(x.s.deals[0].value, Math.round(9000 * 1.058)); assert.equal(x.l.d.size, "");
  x = await tier(0.90); assert.equal(x.s.deals[0].value, Math.round(26000 * 1.058)); assert.equal(x.l.d.size, "big");
  x = await tier(0.9699); assert.equal(x.l.d.size, "big");
  x = await tier(0.97); assert.equal(x.s.deals[0].value, Math.round(85000 * 1.058)); assert.equal(x.l.d.size, "whale");
  x = await first(await craft({}), "network", [0.5], 0); assert.equal(x.s.deals.length, 2);
  assert.deepEqual((await first(await craft({ reputation: 99 }), "network", [0], 0)).l.d.fx, { energy: -16, reputation: 1 });
});

test("Discovery, Demos and Proposals: each waiting deal moves up on a roll under its chance; an empty funnel still costs and trains", async () => {
  const eng = await E(), R = eng.rules;
  let s = await craft({ deals: [[0, 1000, "skeptical"], [0, 2000, "curious"], [1, 3000]] });
  const q = R.qualifyOdds(s); assert.ok(Math.abs(q - (0.35 + 35 / 200)) < 1e-12);
  let x = await first(s, "discovery", [q - 1e-9, q]);
  assert.deepEqual(x.s.deals.map(d => [d.stage, d.mood]), [[1, "neutral"], [0, "curious"], [1, "neutral"]]); assert.deepEqual(x.l.d, { n: 1, of: 2, fx: { energy: -22 } });
  assert.equal(x.s.skills.discovery, 37); assert.equal(x.s.used.discovery, true);
  s = await craft({ deals: [[1, 1000, "neutral"], [1, 2000, "skeptical"], [2, 3000]] });
  const d = R.demoOdds(s); assert.ok(Math.abs(d - (0.30 + 30 / 220 + 60 / 350)) < 1e-12);
  x = await first(s, "demo", [d - 1e-9, d - 1e-9]);
  assert.deepEqual(x.s.deals.map(dl => [dl.stage, dl.mood]), [[2, "curious"], [2, "skeptical"], [2, "neutral"]]); assert.equal(x.s.skills.demo, 32); assert.equal(x.l.d.n, 2);
  s = await craft({ deals: [[2, 1000, "curious"], [2, 2000, "neutral"], [3, 3000]] });
  assert.equal(R.PROPOSE_ODDS, 0.38);
  x = await first(s, "propose", [0.3799, 0.38]);
  assert.deepEqual(x.s.deals.map(dl => [dl.stage, dl.mood]), [[3, "happy"], [2, "neutral"], [3, "neutral"]]); assert.deepEqual(x.l.d, { n: 1, of: 2, fx: { energy: -25 } });
  // nothing to work on: the slot and the energy are still spent, and the skill still grows
  const empty = await craft({});
  x = await first(empty, "discovery", []); assert.deepEqual(x.l.d, { n: 0, of: 0, fx: { energy: -22 } }); assert.deepEqual([x.s.slots, x.s.energy, x.s.skills.discovery], [4, 73, 37]);
  assert.deepEqual(eng.run.step(empty, act("discovery")).state.rng, empty.rng, "and no dice are rolled");
});

test("an empty stage: Discovery, Demos and Close deals still train; Proposals only marks the week, and is refused once that is done", async () => {
  const eng = await E(), R = eng.run, legal = st => R.legalMoves(st).filter(m => m.t === "act").map(m => m.id);
  // a board with leads and one deal at Proposal: nothing qualified, nothing demoed
  const s = await craft({ deals: [[0, 6000], [0, 7000], [3, 21000, "happy"]] });
  // Demo marathon has nobody to demo to: it costs what it costs, trains demos by 2, counts as this week's demo
  // motion, moves no deal and rolls nothing
  let x = await first(s, "demo", []);
  assert.deepEqual([x.s.slots, x.s.energy, x.s.skills.demo, x.s.used.demo], [4, 95 - 28, 32, true]); assert.deepEqual(x.l.d, { n: 0, of: 0, fx: { energy: -28 } });
  assert.deepEqual(x.s.deals, s.deals); assert.deepEqual(x.s.rng, s.rng);
  // Close deals with nothing at Proposal or Closing: negotiation +1, the late motion, no signing roll
  const early = await craft({ deals: [[0, 6000], [1, 7000]] });
  x = await first(early, "close", []);
  assert.deepEqual([x.s.slots, x.s.energy, x.s.skills.negotiate, x.s.used.close, x.s.closedWon], [4, 95 - 28, 26, true, 0]); assert.deepEqual(x.s.deals, early.deals); assert.deepEqual(x.s.rng, early.rng);
  assert.equal(x.all[0].tag, "close.none");
  // Proposals with no demoed deal moves nothing and trains nothing. The first such press of a week still does one
  // thing: it marks the week's proposal-or-close work as done (week.js counts that toward a full-funnel week). So
  // it stays a move, exactly as it was in v2.1.
  assert.equal(R.actBlock(s, "propose"), null); assert.ok(legal(s).includes("propose"));
  x = await first(s, "propose", []);
  assert.deepEqual([x.s.slots, x.s.energy, x.s.used.propose], [4, 95 - 25, true]); assert.deepEqual(x.l.d, { n: 0, of: 0, fx: { energy: -25 } });
  assert.deepEqual([x.s.deals, x.s.skills, x.s.rng], [s.deals, s.skills, s.rng]);
  // Once the mark is there, the same press would take a slot and 25 energy and change nothing else: it is not a
  // move. The page shows the card off for the same reason (ActionGrid.jsx reads actBlock).
  const marked = x.s;
  assert.deepEqual(R.actBlock(marked, "propose"), { why: "none" }); assert.ok(!legal(marked).includes("propose")); assert.equal(eng.selectors.proposeIdle(marked), true);
  const r = await move(marked, act("propose")); assert.equal(r.refused, "illegal"); assert.equal(r.state, marked, "the run is untouched");
  assert.equal(eng.run.ACTS.propose(marked), null, "and the rule itself does nothing");
  // Close deals leaves the same mark, so an empty Proposals after any Close deals this week is refused too
  const closed = (await first(s, "close", [0.99, 0.99])).s;
  assert.equal(closed.used.close, true); assert.deepEqual(R.actBlock(closed, "propose"), { why: "none" }); assert.equal((await move(closed, act("propose"))).refused, "illegal");
  // the three that train a skill are never refused for an empty stage, marked or not
  for (const st of [s, marked, closed, early, await craft({})]) for (const id of ["discovery", "demo", "close"]) assert.ok(legal(st).includes(id), id);
  // one demoed deal is enough, marked week or not, and what the press does then is what it always did
  const one = await craft({ deals: [[2, 9000, "curious"]], used: { propose: true, close: true } });
  assert.equal(R.actBlock(one, "propose"), null); assert.ok(legal(one).includes("propose"));
  x = await first(one, "propose", [0.3799]); assert.deepEqual(x.s.deals.map(d => [d.stage, d.mood]), [[3, "happy"]]);
  // the reasons come in the rule's order: slots, then energy, then nothing to gain
  assert.equal(R.actBlock({ ...marked, slots: 0 }, "propose").why, "slots"); assert.equal(R.actBlock({ ...marked, energy: 10 }, "propose").why, "energy");
  // a new week clears the mark: an empty Proposals is a move again
  const next = withDice([], 0.99, () => R.step(marked, { t: "end" })).state;
  assert.equal(next.used.propose, false); assert.equal(R.actBlock({ ...next, energy: 60 }, "propose"), null);
});

test("the stress an action is certain to add, and the press that would reach 100", async () => {
  const eng = await E(), S = eng.selectors, { STRESS_COST, CONFERENCE_STRESS } = eng.rules;
  assert.deepEqual(STRESS_COST, { prospect: 2, politics: 2, hail: 4 });
  // what the interface quotes is what the action adds
  for (const [id, add] of [["prospect", 2], ["politics", 2], ["conference", CONFERENCE_STRESS]]) {
    const s = await craft({ stress: 40, cash: 5000 }); assert.equal(S.stressCost(s, id), add, id); assert.equal((await go(s, id, [], 0.5)).state.stress, 40 + add, id);
  }
  assert.equal(S.stressCost(await craft({ coffeesThisWeek: 2 }), "coffee"), 12 + 3 * 2);
  for (const id of ["cadence", "network", "discovery", "demo", "propose", "close", "crm", "recharge"]) assert.equal(S.stressCost(await craft({}), id), 0, id);
  // the Hail Mary adds at least its figure, however it goes (blast and signed, blast and nothing, lean and signed, lean and nothing)
  const awaitCraft = { board: await craft({ stress: 40, deals: [[3, 20000, "happy"], [4, 30000, "happy"]] }) };
  for (const dice of [[0.1, 0, 0], [0.1, 0.99, 0.99, 0.99, 0.99], [0.9, 0, 0, 0.99, 0.99], [0.9, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99]]) {
    const r = withDice(dice, 0.99, () => eng.run.step({ ...awaitCraft.board }, { t: "hail" }));
    assert.ok(r.state.stress >= 40 + STRESS_COST.hail, `a Hail Mary added ${r.state.stress - 40}`);
  }
  // fatalPress: one point short is not fatal; at the line it is, and the press then ends the run on the spot
  for (const [id, add] of [["prospect", 2], ["politics", 2], ["conference", CONFERENCE_STRESS]]) {
    const safe = await craft({ stress: 99 - add, cash: 5000 }), dead = await craft({ stress: 100 - add, cash: 5000 });
    assert.equal(S.fatalPress(safe, id), null, id); assert.deepEqual(S.fatalPress(dead, id), { why: "stress", add, atLeast: false }, id);
    assert.ok(!(await go(safe, id, [], 0.5)).state.burnedOut, id); const end = (await go(dead, id, [], 0.5)).state; assert.equal(end.burnedOut, true, id); assert.equal(end.endCause, "stress", id);
  }
  assert.deepEqual(S.fatalPress(await craft({ stress: 96, deals: [[3, 20000]] }), "hail"), { why: "stress", add: 4, atLeast: true }); assert.equal(S.fatalPress(await craft({ stress: 95, deals: [[3, 20000]] }), "hail"), null);
  // cash: the conference's bill comes before the stress check that follows it; a quad shot's heart comes before its bill
  assert.equal(S.fatalPress(await craft({ cash: -700, stress: 99 }), "conference").why, "cash"); assert.equal(S.fatalPress(await craft({ cash: -1494, stress: 90 }), "coffee").why, "stress");
  assert.equal(S.fatalPress(await craft({ cash: -1494, stress: 20 }), "coffee").why, "cash"); assert.equal(S.fatalPress(await craft({ cash: 5000, stress: 20 }), "coffee"), null);
});

test("what the interface is told before a press that money would end: a purchase, and Friday's rent", async () => {
  const eng = await E(), S = eng.selectors, { CASH, COST, PAY } = eng.rules;
  // a conference at -$700: 800 more is exactly the line; one dollar richer and it is not
  assert.deepEqual(S.purchaseBust(await craft({ cash: -700 }), "conference"), { cash: -1500, repoAt: CASH.repoAt });
  assert.equal(S.purchaseBust(await craft({ cash: -699 }), "conference"), null);
  assert.deepEqual(S.purchaseBust(await craft({ cash: -1494 }), "coffee"), { cash: -1500, repoAt: -1500 }); assert.equal(S.purchaseBust(await craft({ cash: -1493 }), "coffee"), null);
  for (const id of Object.keys(COST)) if (!COST[id].cash) assert.equal(S.purchaseBust(await craft({ cash: -1499 }), id), null, id + " costs no cash");
  // and it is what happens: the conference at -$700 ends the run, at -$699 it does not
  assert.equal((await go(await craft({ cash: -700 }), "conference", [], 0.5)).state.repo, true); assert.ok(!(await go(await craft({ cash: -699 }), "conference", [], 0.5)).state.repo);
  // Friday: salary, then rent in a rent week, then Collections is asked
  let f = S.fridayPreview(await craft({ week: 5, cash: -900 })); assert.deepEqual([f.rent, f.cash, f.bust], [PAY.rent, -1500, true]);
  f = S.fridayPreview(await craft({ week: 5, cash: -899 })); assert.deepEqual([f.cash, f.bust], [-1499, false]);
  f = S.fridayPreview(await craft({ week: 6, cash: -1400 })); assert.deepEqual([f.rent, f.cash, f.bust], [0, -400, false]);
  // and it is what happens when no Friday signing comes first (the first roll of End Week is that chance)
  const END = { t: "end" }, short = await craft({ week: 5, cash: -900 }), just = await craft({ week: 5, cash: -899 });
  assert.equal(withDice([0.99], 0.99, () => eng.run.step(short, END)).state.repo, true);
  assert.ok(!withDice([0.99], 0.99, () => eng.run.step(just, END)).state.repo);
  // Friday's coffee crash: 13 a shot, and nothing on a Friday lowers stress in a week with shots. At 74 with two
  // shots it reaches 100, which ends the run whatever the dice say; one point lower it is a roll
  const ui = await import("../../src/copy/ui.js"), plain = t => t.replace(/\u2060/g, "");
  f = S.fridayPreview(await craft({ week: 6, stress: 74, coffeesThisWeek: 2 })); assert.deepEqual([f.stress, f.melt], [26, true]);
  assert.equal(plain(ui.HINT.endWeek(f)), "Friday: salary +$1,000. The coffee crash adds 26 stress. That reaches 100 and ends the run.");
  f = S.fridayPreview(await craft({ week: 6, stress: 73, coffeesThisWeek: 2 })); assert.equal(f.melt, false); assert.match(ui.HINT.endWeek(f), /stress \+26\. Friday events/);
  assert.equal(S.fridayPreview(await craft({ week: 6, stress: 99 })).melt, false, "no shots: Friday eases stress");
  assert.equal(S.fridayPreview(await craft({ week: 6, stress: 87, coffeesThisWeek: 1 })).melt, true);
  const wired = await craft({ week: 6, stress: 74, coffeesThisWeek: 2 });
  for (const rest of [0, 0.5, 0.999999]) {
    const done = withDice([], rest, () => eng.run.step(wired, END)).state;
    assert.ok(done.burnedOut && eng.log.isRunOver(done), "74 stress and two shots ends on Friday with every roll at " + rest);
  }
  // (Collections comes first on a Friday: when both are certain the hint names that one)
  assert.match(ui.HINT.endWeek(S.fridayPreview(await craft({ week: 5, cash: -900, stress: 90, coffeesThisWeek: 2 }))), /Collections ends the run/);
});

test("Recharge: 35 energy and 12 relief, up to half as much again on the luck roll; coffee eats the relief; once a week", async () => {
  const eng = await E();
  let s = await craft({ energy: 10, stress: 60 });
  let x = await first(s, "recharge", [0]); assert.deepEqual([x.s.energy, x.s.stress], [45, 48]); assert.equal(x.l.tag, "act.recharge"); assert.deepEqual(x.l.d.fx, { energy: 35, stress: -12 }); assert.equal(x.l.d.nap, 0);
  x = await first(s, "recharge", [0.999999, 0]);                    // the luckiest nap, and a trip
  assert.deepEqual([x.s.energy, x.s.stress], [10 + 52, 60 - 18]); assert.equal(x.l.d.nap, 50); assert.equal(x.all[1].tag, "act.recharge.trip"); assert.equal(x.s.trip, x.all[1].d.trip);
  const range = eng.selectors.rechargeRange(s);
  assert.deepEqual(range, { energy: [35, 52], relief: [12, 18] }, "the preview is exactly the reachable range");
  x = await first(s, "recharge", [0.8]); assert.equal(x.s.trip, null, "a luck of 0.40 is not over 0.40"); assert.equal(x.all.length, 1);
  x = await first(s, "recharge", [0.8001, 0]); assert.ok(x.s.trip);
  // two shots this week: relief 12 - 4; six shots: none, and the line says so
  x = await first({ ...s, coffeesThisWeek: 2 }, "recharge", [0]); assert.equal(x.s.stress, 52);
  x = await first({ ...s, coffeesThisWeek: 6 }, "recharge", [0]); assert.equal(x.l.tag, "act.recharge.flat"); assert.equal(x.s.stress, 60);
  assert.deepEqual(eng.selectors.rechargeRange({ ...s, coffeesThisWeek: 6 }).relief, [0, 0]);
  // capped by the meters, and reported as such
  x = await first(await craft({ energy: 90, stress: 5 }), "recharge", [0]); assert.deepEqual(x.l.d.fx, { energy: 10, stress: -5 });
  assert.equal(x.s.restedThisWeek, true); assert.equal((await move(x.s, act("recharge"))).refused, "illegal"); assert.equal(x.s.slots, 4);
});

test("Quad shot: less energy and more stress each time, a heart roll from the third, and what the preview says is what happens", async () => {
  const eng = await E(), St = eng.stress;
  assert.deepEqual([0, 1, 2, 3, 4, 5, 9].map(St.coffeeEnergy), [18, 16, 15, 14, 12, 12, 12]); assert.deepEqual([0, 1, 2, 3].map(St.coffeeStress), [12, 15, 18, 21]);
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7].map(n => +St.coffeeRisk(n).toFixed(2)), [0, 0, 0.20, 0.45, 0.75, 0.85, 0.95, 0.95]);
  let s = await craft({ energy: 20, stress: 20, cash: 100 });
  for (let n = 0; n < 3; n++) {
    const shot = eng.selectors.nextShot(s);
    const x = await first(s, "coffee", [0.99]);
    assert.deepEqual(x.l.d.fx, { energy: shot.energy, stress: shot.stress, cash: -6 }, "shot " + (n + 1)); assert.equal(x.l.d.shot, n + 1); assert.equal(shot.n, n + 1);
    s = x.s;
  }
  assert.deepEqual([s.coffeesThisWeek, s.cash, s.slots, s.story.n.shots], [3, 82, 2, 3]);
  // only a shot with a heart risk rolls: on the run's own dice, the first two leave them where they were
  const own = await craft({ stress: 20 }), r1 = eng.run.step(own, act("coffee")), r2 = eng.run.step(r1.state, act("coffee")), r3 = eng.run.step(r2.state, act("coffee"));
  assert.deepEqual(r2.state.rng, own.rng); assert.notDeepEqual(r3.state.rng, own.rng);
  // the third shot's heart roll: under 20% is liftoff
  const two = await craft({ coffeesThisWeek: 2, stress: 20 });
  let x = await first(two, "coffee", [0.1999]); assert.ok(x.s.burnedOut); assert.equal(x.s.endCause, "caffeine"); assert.equal(x.l.tag, "end.ascension"); assert.equal(x.l.d.shot, 3); assert.equal(x.l.kind, "bad");
  // the shot that ended the run is a shot: the ending card counts it (the story does not: it is logged as the ending)
  assert.equal(eng.selectors.runFacts(x.s).shots, (two.story ? two.story.n.shots || 0 : 0) + 1, "the card's count includes the fatal shot");
  assert.equal(eng.selectors.runFacts(two).shots, two.story ? two.story.n.shots || 0 : null, "and adds nothing to a run a quad shot did not end");
  // ...nor to a run that ended any other way after shots were drunk: by stress, by Friday's crash, by Collections
  const drank = { v: 2, signed: 0, top: null, took: null, tookLargest: false, reversed: false, n: { shots: 2 } };
  const byStress = (await first(await craft({ stress: 98, story: drank }), "prospect", [])).s;
  assert.ok(byStress.burnedOut && byStress.endCause === "stress"); assert.equal(eng.selectors.runFacts(byStress).shots, 2);
  const byCrash = withDice([0.99], 0.99, () => eng.run.step(withDice([], 0.99, () => eng.run.step(withDice([], 0.99, () => eng.run.step({ ...two, stress: 70, story: drank, coffeesThisWeek: 0 }, act("coffee"))).state, act("coffee"))).state, { t: "end" })).state;
  assert.ok(byCrash.burnedOut && byCrash.endCause === "stress", "two shots from 70 crash to 100 on Friday"); assert.equal(eng.selectors.runFacts(byCrash).shots, 4);
  const byRepo = (await first(await craft({ cash: -700, story: drank }), "conference", [], 0.5)).s;
  assert.ok(byRepo.repo && byRepo.endCause !== "caffeine"); assert.equal(eng.selectors.runFacts(byRepo).shots, 2);
  assert.ok(!(await first(two, "coffee", [0.20])).s.burnedOut);
  // a shot that takes stress to 100 ends the run whatever the roll, and the preview says it is certain
  const hot = await craft({ stress: 88 });
  assert.deepEqual([eng.selectors.nextShot(hot).lethal, eng.selectors.nextShot(hot).risk], [true, 1]);
  x = await first(hot, "coffee", [0.99]); assert.ok(x.s.burnedOut); assert.equal(x.s.endCause, "caffeine");
  assert.equal(eng.selectors.nextShot(await craft({ stress: 87 })).lethal, false);
  // a shot that cannot be afforded past -1500 still happens; Collections then has the last line
  x = await first(await craft({ cash: -1494 }), "coffee", []); assert.ok(x.s.repo); assert.deepEqual(x.all.map(l => l.tag), ["coffee.shot", "end.repo"]);
});

test("CRM cleanup: prunes dead leads, pleases the manager, shields this week's review, and he may close a live deal out", async () => {
  const eng = await E(), R = eng.rules;
  const deals = [[0, 1000, "skeptical", 0, "DeadMood"], [1, 2000, "neutral", 5, "DeadAge"], [1, 3000, "neutral", 4, "LiveSmall"], [2, 9000, "happy", 9, "LiveWarm"], [2, 12000, "neutral", 0, "LiveBig"], [3, 5000, "skeptical", 9, "Late"]];
  const s = await craft({ manager: 50, deals });
  assert.deepEqual(s.deals.filter(R.isDeadLead).map(d => d.account), ["DeadMood", "DeadAge"]);
  let x = await first(s, "crm", [0.1499]);                           // 15% at a manager of 40 or more
  assert.deepEqual(x.l.d, { pruned: 2, mgr: 7, fx: { energy: -15, manager: 7 } }); assert.equal(x.s.hygieneShield, true); assert.equal(x.s.used.crm, true);
  assert.equal(x.all[1].tag, "act.crm.nuked"); assert.deepEqual([x.all[1].d.account, x.all[1].d.value], ["LiveWarm", 9000], "the warmest, then the largest, of the Qualified and Demoed deals");
  assert.deepEqual(x.s.deals.map(d => d.account), ["LiveSmall", "LiveBig", "Late"]); assert.equal(x.s.pipeline, 20000);
  x = await first(s, "crm", [0.15]); assert.equal(x.all.length, 1); assert.equal(x.s.deals.length, 4);
  x = await first({ ...s, manager: 39 }, "crm", [0.2499]); assert.equal(x.all.length, 2, "25% under 40"); assert.ok(!(await first({ ...s, manager: 39 }, "crm", [0.25])).all[1]);
  assert.deepEqual([R.crmGain(0), R.crmGain(4), R.crmGain(5), R.crmGain(50)], [5, 9, 10, 10]);
  assert.deepEqual(eng.selectors.crmPreview(s), { pruned: 2, value: 3000, gain: 7, nuke: 0.15 });
  // the hint says what is going, in dollars: "dead" is skeptical or five weeks old, whatever the deal is worth
  const ui = await import("../../src/copy/ui.js"), big = await craft({ manager: 50, deals: [[1, 150000, "happy", 5, "OldWhale"], [1, 30000, "skeptical", 0, "Doubter"], [2, 14000, "skeptical", 0, "Demoed"], [0, 6000, "neutral", 0, "Fresh"]] });
  const pv = eng.selectors.crmPreview(big);
  assert.deepEqual([pv.pruned, pv.value], [2, 180000]);
  assert.ok(ui.HINT.crm(pv.pruned, pv.gain, pv.nuke, pv.value).replace(/\u2060/g, "").startsWith("Removes 2 dead leads ($180,000): +7 manager."));
  const after = (await first(big, "crm", [0.99])).s;
  assert.equal(big.deals.reduce((t, d) => t + d.value, 0) - after.deals.reduce((t, d) => t + d.value, 0), pv.value, "and that is what the press removes");
  assert.equal(ui.HINT.crm(0, 5, 0, 0), "Removes 0 dead leads: +5 manager. Once per week.");
  // nothing dead, nothing at risk: no roll, a different line, and still once a week
  const clean = await craft({ manager: 98 });
  x = await first(clean, "crm", []); assert.equal(x.l.tag, "act.crm.clean"); assert.deepEqual(x.l.d, { mgr: 5, fx: { energy: -15, manager: 2 } }); assert.deepEqual(eng.run.step(clean, act("crm")).state.rng, clean.rng);
  assert.equal((await move(x.s, act("crm"))).refused, "illegal");
});

test("Politics: +8 manager, +3 product, -4 reputation, +2 stress, and the line reports what really moved", async () => {
  let x = await first(await craft({}), "politics", []);
  assert.deepEqual([x.s.manager, x.s.product, x.s.reputation, x.s.stress], [58, 63, 36, 30]); assert.deepEqual(x.l.d.fx, { energy: -20, manager: 8, product: 3, reputation: -4, stress: 2 });
  assert.equal(x.s.story.n.lunches, 1);
  x = await first(await craft({ manager: 97, product: 99, reputation: 1 }), "politics", []);
  assert.deepEqual(x.l.d.fx, { energy: -20, manager: 3, product: 1, reputation: -1, stress: 2 });
});

test("Conference: two slots, 40 energy, $800, 3-8 warm leads, +5 stress, and sometimes this week's signing odds", async () => {
  let s = await craft({ cash: 1200 });
  // rolls: count, then per lead (large?, size, mood, name), then the buzz
  let x = await first(s, "conference", [0], 0.99);
  assert.equal(x.s.deals.length, 3); assert.deepEqual(x.l.d, { n: 3, fx: { energy: -40, stress: 5, cash: -800 } }); assert.deepEqual([x.s.slots, x.s.cash, x.s.lastConference, x.s.story.n.conferences], [3, 400, 1, 1]);
  assert.deepEqual(x.s.effects, []);
  x = await first(s, "conference", [0.999], 0.39); assert.equal(x.s.deals.length, 8); assert.ok(x.s.deals.every(d => d.value >= 22000 * 0.94), "a roll under 40% makes a lead a large one");
  x = await first(s, "conference", [0, 0.4, 0, 0, 0, 0.4, 0, 0, 0, 0.4, 0, 0, 0, 0.2999]); assert.deepEqual(x.s.effects.map(e => e.src), ["conference"]); assert.equal(x.l.d.buzz, true);
  assert.ok(x.s.deals.every(d => d.value < 22000));
  x = await first(s, "conference", [0, 0.4, 0, 0, 0, 0.4, 0, 0, 0, 0.4, 0, 0, 0, 0.30]); assert.deepEqual(x.s.effects, []);
  assert.equal((await move(await craft({ slots: 1 }), act("conference"))).refused, "illegal");
  // it can be bought on credit; if that reaches -1500, Collections has the last line
  x = await first(await craft({ cash: -700 }), "conference", [0]); assert.ok(x.s.repo); assert.deepEqual(x.all.map(l => l.tag).slice(-2), ["act.conference", "end.repo"]);
});

test("an action that pushes stress to 100 ends the run on the spot, and one that crosses 70 says so once", async () => {
  let x = await first(await craft({ stress: 98 }), "prospect", [0, 0.99], 0);
  assert.ok(x.s.burnedOut); assert.equal(x.s.endCause, "stress"); assert.equal(x.s.logs[0].tag, "end.meltdown.stress");
  x = await first(await craft({ stress: 68 }), "prospect", [0, 0.99], 0);
  assert.deepEqual(x.all.map(l => l.tag), ["act.prospect", "stress.warn"]); assert.equal(x.all[1].d.stress, 70); assert.equal(x.s.stressWarned, true);
  const again = await first(x.s, "politics", []); assert.deepEqual(again.all.map(l => l.tag), ["act.politics"]);
});

test("End week's preview: what it calls certain ends the run with every roll; with a late deal on the board it says what may still save it", async () => {
  const eng = await E(), S = eng.selectors, ui = await import("../../src/copy/ui.js"), plain = t => t.replace(/\u2060/g, "");
  // Friday played with 300 different sets of rolls (each a seeded stream), from the same state
  const fridays = (s, n = 300) => Array.from({ length: n }, (_, k) => { const r = mulberry(fnv("friday:" + k)); return withDice([], () => r(), () => eng.run.step(s, { t: "end" })).state; });
  const ends = list => list.filter(x => eng.log.isRunOver(x)).length;
  const seat = (over = {}) => ({ status: "active", deployed: false, due: 0, ...over });
  const cases = [
    // [what, state, what the preview must say, outcome]
    ["rent: salary and rent leave -$1,500", { week: 5, cash: -900 }, { bust: true, mayClose: false }, "all"],
    ["clAInk's invoice after a run: -$1,569", { week: 5, cash: -300, claink: seat({ deployed: true, due: 669 }) }, { bust: false, billBust: true, billCash: -1569, mayClose: false }, "all"],
    ["an idle seat's least charge lands on the line", { week: 9, cash: -750, claink: seat() }, { billBust: true, billCash: -1500 }, "all"],
    ["one dollar richer, the idle seat is not certain", { week: 9, cash: -749, claink: seat() }, { bust: false, billBust: false }, null],
    ["the coffee crash reaches 100", { week: 6, cash: 2000, stress: 74, coffeesThisWeek: 2 }, { melt: true }, "all"],
    ["the crash and a Closing deal: the deal cannot lower stress", { week: 6, cash: 2000, stress: 74, coffeesThisWeek: 2, deals: [[4, 30000, "happy"]] }, { melt: true, mayClose: true }, "all"],
    ["rent with three happy late deals: a Friday signing may pay first", { week: 5, cash: -900, deals: [[4, 30000, "happy"], [3, 22000, "happy"], [3, 18000, "curious"]] }, { bust: true, mayClose: true }, "some"],
    ["the invoice with a late deal", { week: 5, cash: -300, claink: seat({ deployed: true, due: 669 }), deals: [[4, 30000, "happy"], [3, 22000, "happy"]] }, { billBust: true, mayClose: true }, "some"]
  ];
  for (const [what, over, want, outcome] of cases) {
    const s = await craft(over), f = S.fridayPreview(s);
    for (const k of Object.keys(want)) assert.equal(f[k], want[k], `${what}: ${k}`);
    const hint = plain(ui.HINT.endWeek(f));
    if (f.bust || f.billBust) assert.match(hint, /Collections ends the run at −\$1,500(, unless a deal signs on Friday first)?\.$/, what);
    assert.equal(/unless a deal signs on Friday first/.test(hint), (f.bust || (f.billBust && !f.melt)) && f.mayClose, `${what}: the caveat`);
    if (!outcome) continue;
    const n = ends(fridays(s));
    if (outcome === "all") assert.equal(n, 300, `${what}: the run ends on Friday with every roll`);
    else assert.ok(n > 150 && n < 300, `${what}: usually ends, but not always (${n} of 300)`);
  }
  // the cash card names what would trigger Collections
  assert.equal(ui.KPI.billBust(), "Friday’s clAInk invoice would trigger Collections");
});

test("Proposals with nothing demoed: in the three states where the press is on offer and buys nothing, the hint says so; elsewhere it counts", async () => {
  const eng = await E(), S = eng.selectors, ui = await import("../../src/copy/ui.js");
  const LEADS = [[0, 6000], [0, 7000], [1, 8000]];
  const states = [
    ["full", { week: 6, slots: 3, used: { prospect: true, discovery: true, demo: true }, deals: LEADS }],
    ["last", { week: 13, slots: 3, used: { prospect: true }, deals: LEADS }],
    ["alone", { week: 6, slots: 1, deals: LEADS }],
    [null, { week: 6, slots: 3, used: { prospect: true, discovery: true }, deals: LEADS }],
    [null, { week: 6, slots: 1, used: { prospect: true }, deals: LEADS }],
    // two slots and nothing worked yet: the press alone leaves the week neglected, but with one more category on the
    // last slot it is not (a Prospect blitz here, made on the same rolls with and without the press)
    [null, { week: 6, slots: 2, deals: LEADS }, "prospect"]
  ];
  // the Friday after the press and the Friday without it, with the same rolls, compared on everything Friday decides.
  // (Week 13's Friday ends the run at the QBR. A bonus or a penalty it sets is dated week 14, which never comes, and is
  // left out: so is its log line.)
  const keep = m => { const { energy, slots, used, logs, said, effects, ...rest } = m; return JSON.stringify({ ...rest, effects: (effects || []).filter(e => e.from <= 13) }); };
  for (const [why, over, then] of states) {
    const s = await craft(over);
    assert.equal(S.proposeNothing(s), why, JSON.stringify(over.used || {}) + " week " + over.week);
    assert.ok(!S.proposeIdle(s) && !eng.run.actBlock(s, "propose"), "on offer");
    const pressed = eng.run.step(s, act("propose")).state;
    let alike = 0;
    for (let k = 0; k < 40; k++) {
      const r1 = mulberry(fnv("p:" + k)), r2 = mulberry(fnv("p:" + k));
      const week = st => eng.run.step(then ? eng.run.step(st, act(then)).state : st, { t: "end" }).state;
      const a = withDice([], () => r1(), () => week(s)), b = withDice([], () => r2(), () => week(pressed));
      if (keep(mechanical(a)) === keep(mechanical(b))) alike++;
      if (why === "last") assert.ok(eng.log.isRunOver(a) && eng.log.isRunOver(b), "week 13's Friday ends the run");
    }
    if (why) assert.equal(alike, 40, `${why}: the press changes nothing Friday decides`);
    else assert.ok(alike < 40, "the mark may still matter here, and does");
    const text = ui.HINT.propose(0, 0.38, why);
    assert.ok(text.startsWith("No eligible deals. You would still spend a slot and energy"));
    assert.equal(/for nothing/.test(text), !!why); assert.equal(/count toward a full-funnel week/.test(text), !why);
  }
});
