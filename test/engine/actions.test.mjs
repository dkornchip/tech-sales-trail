// The twelve actions (src/game/actions.js): what each costs, does, trains and reports, and when it is refused.
import test from "node:test";
import assert from "node:assert/strict";
import { E, craft, move, act, withDice, lines, tags, start } from "./lib/kit.mjs";

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
  for (const id of Object.keys(eng.run.ACTS)) {
    const s = await craft({ cash: 5000 });
    const r = await go(s, id, [], 0.5);
    assert.equal(r.refused, null, id); assert.equal(r.state.slots, 5 - COST[id].slots, id + " slots");
    if (id !== "recharge" && id !== "coffee") assert.equal(r.state.energy, 95 - COST[id].energy, id + " energy");
    if (COST[id].energy > 0) { const tired = await craft({ energy: COST[id].energy - 1 }); const x = await move(tired, act(id)); assert.equal(x.refused, "illegal", id + " without energy"); assert.equal(x.state, tired); }
    const exact = await craft({ energy: COST[id].energy, cash: 5000 }); assert.equal((await go(exact, id, [], 0.5)).refused, null, id + " with exactly enough energy");
    const busy = await craft({ slots: COST[id].slots - 1 }); assert.equal((await move(busy, act(id))).refused, "illegal", id + " without slots");
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
  assert.deepEqual(eng.selectors.crmPreview(s), { pruned: 2, gain: 7, nuke: 0.15 });
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
