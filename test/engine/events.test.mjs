// What a Friday can bring (src/game/events.js): which events are rolled, which are applied, and what each one does.
import test from "node:test";
import assert from "node:assert/strict";
import { E, craft, move, script, unscript, withDice, endWeek, lines, tags } from "./lib/kit.mjs";

// randomEvents on its own, with scripted dice. picks: event id -> roll. Returns { s, used, tags }.
async function friday(state, picks = {}, after = [], rest = 0.99) {
  const eng = await E();
  const rolls = [];
  for (const ev of eng.events.FRIDAY_EVENTS) if (!ev.can || ev.can(state)) rolls.push(picks[ev.id] === undefined ? rest : picks[ev.id]);
  const d = script(rolls.concat(after), rest);
  try {
    const [s] = eng.rng.rolling(state, () => eng.events.randomEvents(state));
    return { s, used: d.used(), tags: tags(state, s), lines: lines(state, s), eligible: rolls.length };
  } finally { unscript(); }
}

test("the numbers are the brief's: thirteen events, their chances, two choices, the caps", async () => {
  const ev = (await E()).events;
  assert.deepEqual(ev.FRIDAY_EVENTS.map(e => [e.id, e.p, !!e.modal]), [["marketing", 0.22, false], ["competitor", 0.18, true], ["seFumble", 0.14, false], ["seSave", 0.12, false],
    ["security", 0.10, true], ["outage", 0.12, false], ["champion", 0.11, false], ["caseStudy", 0.10, false], ["meme", 0.10, false], ["freeze", 0.10, false], ["crud", 0.10, false],
    ["rebalance", 0.11, false], ["favors", 0.09, false]]);
  assert.equal(ev.FRIDAY_EVENT_CAP, 2); assert.equal(ev.FRIDAY_CHOICE_CAP, 1);
  assert.deepEqual(ev.SECURITY_WALK, { own: 0.30, spin: 0.15 });
});

test("only events that can happen are rolled, each exactly once", async () => {
  // no deals, manager 50, energy 95: seven events can happen
  const bare = await craft({ week: 4 });
  let r = await friday(bare);
  assert.equal(r.eligible, 7); assert.equal(r.used, 7); assert.deepEqual(r.tags, []);
  // everything eligible: deals at stage 1 and 2, tired, a manager who is... both <35 and >=75 cannot be, so 12
  const full = await craft({ week: 4, energy: 40, manager: 30, deals: [[1, 5000], [2, 9000]] });
  r = await friday(full);
  assert.equal(r.eligible, 12); assert.equal(r.used, 12);
  const liked = await craft({ week: 4, energy: 40, manager: 80, deals: [[1, 5000], [2, 9000]] });
  assert.equal((await friday(liked)).eligible, 12);
});

test("a roll equal to an event's chance does not bring it up; one just under does", async () => {
  const s = await craft({ week: 4 });
  assert.deepEqual((await friday(s, { freeze: 0.10 })).tags, []);
  assert.deepEqual((await friday(s, { freeze: 0.0999 })).tags, ["evt.freeze"]);
});

test("at most two events are applied, in order of how far inside its chance each roll landed, not list order", async () => {
  const s = await craft({ week: 4 });
  // ranks (roll / p): marketing .045, caseStudy .2, freeze .01 -> freeze, marketing; the case study is dropped
  const r = await friday(s, { marketing: 0.0099, caseStudy: 0.02, freeze: 0.001 });
  assert.deepEqual(r.tags, ["evt.freeze", "evt.marketing"]);
  assert.ok(!r.s.effects.some(e => e.src === "caseStudy"));
  // the last event in the list wins a slot over the first when its roll is deeper
  const liked = await craft({ week: 4, manager: 80 });
  const r2 = await friday(liked, { marketing: 0.21, favors: 0.001, meme: 0.05 });
  assert.deepEqual(r2.tags, ["evt.favors", "evt.meme"]);
});

test("at most one choice is asked on a Friday, and the other event slot is still used", async () => {
  const s = await craft({ week: 4 });
  const r = await friday(s, { competitor: 0.09, security: 0.01, freeze: 0.09 });   // ranks .5, .1, .9
  assert.deepEqual(r.s.pending, [{ id: "evt:security" }]);
  assert.deepEqual(r.tags, ["evt.freeze"]);
});

test("an event that can no longer happen when its turn comes takes no slot, and nothing is rolled again", async () => {
  // one deal at Demoed and a manager under 35: the rebalance takes it, so the champion has nobody to promote
  const s = await craft({ week: 4, manager: 30, deals: [[2, 20000]] });
  const r = await friday(s, { rebalance: 0.001, champion: 0.01, outage: 0.1 });    // ranks .009, .09, .83
  assert.deepEqual(r.tags, ["evt.rebalance", "evt.outage"]);
  assert.equal(r.used, r.eligible, "no extra roll was made for the order or for the event that was passed over");
  assert.equal(r.s.deals.length, 0);
});

test("no choice is asked on the last Friday; other events still happen", async () => {
  const eng = await E();
  const s = await craft({ week: 13 });
  const r = await friday(s, { marketing: 0.01 });
  assert.equal(r.eligible, 5, "the two choices are not even rolled in week 13");
  assert.deepEqual(r.s.pending, []); assert.ok(r.tags.includes("evt.marketing"));
  assert.ok(eng.events.FRIDAY_EVENTS.filter(e => e.modal).every(e => !e.can(s) && e.can({ ...s, week: 12 })));
});

test("each event does what it says: effects, params and the real meter changes", async () => {
  const eng = await E();
  const one = async (state, id, after = []) => { const r = await friday(state, { [id]: 0 }, after); return { s: r.s, l: r.lines[r.lines.length - 1], all: r.lines }; };
  let s = await craft({ week: 4 }), r;
  // marketing: 2-6 warm leads (a roll of 0 is 2)
  r = await one(s, "marketing", [0]); assert.equal(r.l.tag, "evt.marketing"); assert.equal(r.l.d.n, 2); assert.equal(r.s.deals.length, 2);
  assert.equal(r.s.pipeline, r.s.deals.reduce((t, d) => t + d.value, 0));
  r = await friday(s, { marketing: 0 }, [0.999]); assert.equal(r.s.deals.length, 6);
  // SE fumble: -6 product, +4 stress, names the first deal at Qualified or Demoed
  s = await craft({ week: 4, deals: [[0, 1000], [2, 9000, "neutral", 0, "Globex"], [1, 5000]] });
  r = await one(s, "seFumble"); assert.equal(r.l.d.account, "Globex"); assert.deepEqual(r.l.d.fx, { product: -6, stress: 4 }); assert.equal(r.l.kind, "warn");
  r = await one({ ...s, product: 2 }, "seFumble"); assert.deepEqual(r.l.d.fx, { product: -2, stress: 4 }, "a meter near zero loses what it has");
  // SE save: +8 product, +3 reputation
  r = await one(s, "seSave"); assert.equal(r.l.d.account, "Globex"); assert.deepEqual(r.l.d.fx, { product: 8, reputation: 3 });
  // outage: -12 product, each deal at Demoed or later walks at 18%
  r = await friday(s, { outage: 0 }, [0.17]); assert.equal(r.s.product, 48); assert.equal(r.s.deals.length, 2); assert.deepEqual(r.tags, ["deal.lost", "evt.outage"]);
  r = await friday(s, { outage: 0 }, [0.18]); assert.equal(r.s.deals.length, 3);
  // champion: the deal goes up a stage and turns happy, +3 reputation, +3 manager; at Closing it cannot move
  r = await one(s, "champion"); assert.equal(r.l.d.moved, true); assert.deepEqual(r.l.d.fx, { manager: 3, reputation: 3 });
  assert.deepEqual([r.s.deals.find(d => d.account === "Globex").stage, r.s.deals.find(d => d.account === "Globex").mood], [3, "happy"]);
  r = await one(await craft({ week: 4, deals: [[4, 9000]] }), "champion"); assert.equal(r.l.d.moved, false); assert.equal(r.s.deals[0].stage, 4);
  // case study: +5 reputation and +8 points next week; freeze: -12 points next week
  s = await craft({ week: 4 });
  r = await one(s, "caseStudy"); assert.deepEqual(r.l.d.fx, { reputation: 5 }); assert.deepEqual(r.s.effects, [{ src: "caseStudy", conv: 0.08, disc: 0, from: 5, until: 5 }]);
  r = await one(s, "freeze"); assert.deepEqual(r.s.effects, [{ src: "freeze", conv: -0.12, disc: 0, from: 5, until: 5 }]); assert.equal(r.l.kind, "warn");
  // meme: 1-3 inbound leads, +4 reputation
  r = await one(s, "meme", [0]); assert.equal(r.l.d.n, 1); assert.equal(r.s.deals.length, 1); assert.deepEqual(r.l.d.fx, { reputation: 4 });
  // crud: only when tired; -10 energy, +6 stress; "from the conference" only after one this week or last
  assert.ok(!eng.events.FRIDAY_EVENTS.find(e => e.id === "crud").can({ ...s, energy: 55 }));
  r = await one({ ...s, energy: 54 }, "crud"); assert.deepEqual(r.l.d.fx, { energy: -10, stress: 6 }); assert.equal(r.l.d.conf, false);
  assert.equal((await one({ ...s, energy: 54, lastConference: 3 }, "crud")).l.d.conf, true);
  assert.equal((await one({ ...s, energy: 54, lastConference: 2 }, "crud")).l.d.conf, false);
  // rebalance: a manager under 35 takes the two largest deals
  s = await craft({ week: 4, manager: 34, deals: [[0, 1000], [2, 9000], [1, 5000]] });
  r = await one(s, "rebalance"); assert.deepEqual([r.l.d.n, r.l.d.value, r.l.kind], [2, 14000, "bad"]); assert.deepEqual(r.s.deals.map(d => d.value), [1000]); assert.equal(r.s.pipeline, 1000);
  assert.equal(r.s.story.tookLargest, true);
  assert.ok(!eng.events.FRIDAY_EVENTS.find(e => e.id === "rebalance").can({ ...s, manager: 35 }));
  // favors: a manager at 75 or more sends 1-3 warm intros, or (60%) shreds a PIP
  s = await craft({ week: 4, manager: 75 });
  r = await one(s, "favors", [0]); assert.equal(r.l.tag, "evt.favors"); assert.equal(r.l.d.n, 1);
  r = await one({ ...s, pip: true, pipLevel: 2 }, "favors", [0.59]); assert.equal(r.l.tag, "evt.pipShred"); assert.deepEqual([r.s.pip, r.s.pipLevel], [false, 0]);
  r = await one({ ...s, pip: true, pipLevel: 2 }, "favors", [0.6, 0]); assert.equal(r.l.tag, "evt.favors"); assert.equal(r.s.pip, true);
  assert.ok(!eng.events.FRIDAY_EVENTS.find(e => e.id === "favors").can({ ...s, manager: 74 }));
});

test("the pricing choice: match is +12 points and 20% off this week; hold is -8 points and +4 reputation", async () => {
  const s = await craft({ week: 6, pending: [{ id: "evt:competitor" }] });
  let r = await move(s, { t: "choose", event: "evt:competitor", option: "match" });
  assert.deepEqual(r.state.effects, [{ src: "competitorMatch", conv: 0.12, disc: 0.20, from: 6, until: 6 }]); assert.deepEqual(tags(s, r.state), ["evt.competitor.match"]);
  r = await move(s, { t: "choose", event: "evt:competitor", option: "hold" });
  assert.deepEqual(r.state.effects, [{ src: "competitorHold", conv: -0.08, disc: 0, from: 6, until: 6 }]);
  assert.equal(r.state.reputation, 44); assert.deepEqual(lines(s, r.state)[0].d.fx, { reputation: 4 });
  assert.deepEqual(lines({ ...s, reputation: 99 }, (await move({ ...s, reputation: 99 }, { t: "choose", event: "evt:competitor", option: "hold" })).state)[0].d.fx, { reputation: 1 });
});

test("the incident choice: disclose and spin, with their walk chances", async () => {
  const eng = await E();
  const s = await craft({ week: 6, pending: [{ id: "evt:security" }], deals: [[1, 4000], [2, 9000], [3, 20000]] });
  const go = (option, dice) => withDice(dice, 0.99, () => eng.run.step(s, { t: "choose", event: "evt:security", option }));
  let r = await go("own", [0.29, 0.30]);                            // the Demoed deal walks, the Proposal stays
  assert.deepEqual(r.state.effects, [{ src: "securityOwn", conv: -0.15, disc: 0, from: 6, until: 7 }]);
  assert.deepEqual([r.state.reputation, r.state.product], [46, 42]); assert.deepEqual(r.state.deals.map(d => d.value), [4000, 20000]);
  assert.deepEqual(tags(s, r.state), ["deal.lost", "evt.security.own"]); assert.deepEqual(lines(s, r.state)[1].d.fx, { reputation: 6, product: -18 });
  r = await go("spin", [0.15, 0.149]);
  assert.deepEqual(r.state.effects, [{ src: "securitySpin", conv: -0.08, disc: 0, from: 6, until: 6 }]);
  assert.deepEqual([r.state.reputation, r.state.product], [32, 48]); assert.deepEqual(r.state.deals.map(d => d.value), [4000, 9000]);
  assert.equal(r.state.pipeline, 13000);
});

test("through End Week: a Friday choice is on the run when the week has turned, and End Week reports it", async () => {
  const s = await craft({ week: 4 });
  const r = await endWeek(s, { competitor: 0.01 });
  assert.equal(r.state.week, 5); assert.deepEqual(r.state.pending, [{ id: "evt:competitor" }]); assert.deepEqual(r.events, [{ id: "evt:competitor" }]);
});
