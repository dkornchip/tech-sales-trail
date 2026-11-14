// What bends the signing odds, and for how long (src/game/effects.js): each effect on its own clock.
import test from "node:test";
import assert from "node:assert/strict";
import { E, craft, move, act, END, withDice, endWeek, lines } from "./lib/kit.mjs";

const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg || ""} ${a} vs ${b}`);
const answer = (s, event, option) => move(s, { t: "choose", event, option });

test("the numbers are the brief's: every source's size and length", async () => {
  const { EFFECT, MAX_SWING } = (await E()).effects;
  assert.deepEqual(EFFECT, {
    competitorMatch: { conv: 0.12, disc: 0.20, weeks: 1 }, competitorHold: { conv: -0.08, disc: 0, weeks: 1 },
    securityOwn: { conv: -0.15, disc: 0, weeks: 2 }, securitySpin: { conv: -0.08, disc: 0, weeks: 1 },
    caseStudy: { conv: 0.08, disc: 0, weeks: 1 }, freeze: { conv: -0.12, disc: 0, weeks: 1 }, conference: { conv: 0.08, disc: 0, weeks: 1 },
    fullFunnel: { conv: 0.06, disc: 0, weeks: 1 }, neglect: { conv: -0.06, disc: 0, weeks: 1 }
  });
  assert.equal(MAX_SWING, 0.30);
});

test("a Friday effect applies to the next playable week only, and still counts for that week's Friday close", async () => {
  const eng = await E(), { convMod } = eng.effects;
  const s0 = await craft({ week: 3, deals: [[3, 10000]] });
  const base = eng.rules.closeOdds(s0, s0.deals[0]);
  // the case study comes up on Friday of week 3
  const r1 = await endWeek(s0, { caseStudy: 0.01 });
  const s1 = r1.state;
  assert.equal(s1.week, 4);
  assert.deepEqual(s1.effects.find(e => e.src === "caseStudy"), { src: "caseStudy", conv: 0.08, disc: 0, from: 4, until: 4 });
  // (the one deal and nothing else worked: "neglect" is also set for week 4)
  near(convMod(s1), 0.08 - 0.06, "week 4");
  // week 4's own Friday close is rolled with it: a roll just under the bent odds signs, and would not have without it
  const d = s1.deals[0], odds = eng.rules.closeOdds(s1, d);
  near(odds - eng.rules.closeOdds({ ...s1, effects: [] }, d), 0.02, "the deal's odds are bent by the sum");
  const r2 = await endWeek(s1, { close: 0.01 }, [], 0.99);       // close happens; the deal's roll is the next die
  assert.ok(lines(s1, r2.state).some(l => l.tag === "close.nobody" || l.tag === "close.signed"), "the Friday close was attempted");
  const s2 = r2.state;
  assert.equal(s2.week, 5);
  assert.ok(!s2.effects.some(e => e.src === "caseStudy"), "gone once week 4's Friday close has been rolled");
  assert.ok(base > 0);
});

test("the Friday close of an effect's last week is rolled against the bent odds", async () => {
  const eng = await E();
  const s = await craft({ week: 4, deals: [[3, 10000]], effects: [{ src: "caseStudy", conv: 0.08, disc: 0, from: 4, until: 4 }] });
  const with8 = eng.rules.closeOdds(s, s.deals[0]), without = eng.rules.closeOdds({ ...s, effects: [] }, s.deals[0]);
  near(with8 - without, 0.08);
  const roll = without + 0.04;                                    // signs only because of the effect
  const dice = [0.01, roll];                                      // Friday close happens, then the deal's roll
  const r = await withDice(dice, 0.99, () => eng.run.step(s, END));
  assert.ok(lines(s, r.state).some(l => l.tag === "close.signed"), "signed on the last Friday of the effect");
});

test("a choice answered after the week turned applies to the new week; security disclosure lasts exactly two playable weeks", async () => {
  const eng = await E(), { convMod } = eng.effects;
  const s0 = await craft({ week: 2 });
  const r1 = await endWeek(s0, { security: 0.01 });
  assert.equal(r1.state.week, 3); assert.equal(r1.state.pending[0].id, "evt:security");
  const s1 = (await withDice([], 0.99, () => eng.run.step(r1.state, { t: "choose", event: "evt:security", option: "own" }))).state;
  assert.deepEqual(s1.effects.find(e => e.src === "securityOwn"), { src: "securityOwn", conv: -0.15, disc: 0, from: 3, until: 4 });
  near(convMod(s1), -0.15);
  const s2 = (await endWeek(s1)).state;                           // week 3 -> 4 (an empty funnel is not "neglect": no pipeline)
  assert.equal(s2.week, 4); near(convMod(s2), -0.15, "second week");
  const s3 = (await endWeek(s2)).state;
  assert.equal(s3.week, 5); near(convMod(s3), 0, "third week"); assert.equal(s3.effects.length, 0);
});

test("full-funnel, freeze, a matched price cut and a disclosed incident add up, are held to 30 points, and end on their own weeks", async () => {
  const eng = await E(), { convMod, discountRate, addEffect, effectChips } = eng.effects;
  let s = await craft({ week: 5 });
  s = addEffect(s, "fullFunnel", "next"); s = addEffect(s, "freeze", "next");
  s = { ...s, week: 6 };                                           // the week turns
  s = addEffect(s, "competitorMatch"); s = addEffect(s, "securityOwn");
  near(convMod(s), 0.06 - 0.12 + 0.12 - 0.15); near(discountRate(s), 0.20);
  assert.deepEqual(effectChips(s).map(c => [c.src, c.weeksLeft]).sort(), [["competitorMatch", 1], ["freeze", 1], ["fullFunnel", 1], ["securityOwn", 2]]);
  // penalties only: -0.15 - 0.12 - 0.08 - 0.06 is -0.41, held to -0.30; bonuses only are held to +0.30
  let t = ["securityOwn", "freeze", "securitySpin", "neglect"].reduce((x, src) => addEffect(x, src), await craft({ week: 6 }));
  near(convMod(t), -0.30, "held to 30 points");
  const up = { ...t, effects: [0.12, 0.08, 0.08, 0.06].map((conv, i) => ({ src: ["competitorMatch", "caseStudy", "conference", "fullFunnel"][i], conv, disc: 0, from: 6, until: 6 })) };
  near(convMod(up), 0.30, "held to 30 points upward");
  assert.ok(eng.rules.closeOdds(t, { stage: 3, mood: "neutral" }) >= eng.rules.ODDS_FLOOR);
  // Friday of week 6: everything but the disclosure ends; the discount ends with its own week
  const s7 = eng.effects.expireEffects(s); const w7 = { ...s7, week: 7 };
  assert.deepEqual(w7.effects.map(e => e.src), ["securityOwn"]);
  near(convMod(w7), -0.15); near(discountRate(w7), 0, "no discount in week 7");
  const w8 = { ...eng.effects.expireEffects(w7), week: 8 };
  assert.equal(w8.effects.length, 0); near(convMod(w8), 0);
});

test("the same source twice refreshes instead of stacking", async () => {
  const eng = await E(), { addEffect, convMod } = eng.effects;
  let s = await craft({ week: 4 });
  s = addEffect(addEffect(s, "conference"), "conference");
  assert.equal(s.effects.length, 1); near(convMod(s), 0.08, "two conferences in a week are +8, not +16");
  s = addEffect(s, "securityOwn");                                  // weeks 4-5
  s = { ...eng.effects.expireEffects(s), week: 5 };
  s = addEffect(s, "securityOwn");                                  // disclosed again in week 5: the clock restarts
  assert.deepEqual(s.effects.filter(e => e.src === "securityOwn"), [{ src: "securityOwn", conv: -0.15, disc: 0, from: 5, until: 6 }]);
  near(convMod(s), -0.15);
});

test("a conference's buzz is for the current week only, and the discount is not carried by anything else", async () => {
  const eng = await E();
  const s = await craft({ week: 4, cash: 5000 });
  // conference rolls: lead count, then per lead (big?, base, mood, name), then the buzz roll. All 0: 3 leads, buzz.
  const r = await withDice([], 0, () => eng.run.step(s, act("conference")));
  assert.deepEqual(r.state.effects, [{ src: "conference", conv: 0.08, disc: 0, from: 4, until: 4 }]);
  assert.equal(lines(s, r.state)[0].d.buzz, true);
  const none = await withDice([], 0.99, () => eng.run.step(s, act("conference")));
  assert.deepEqual(none.state.effects, []); assert.equal(lines(s, none.state)[0].d.buzz, undefined);
  // a matched price cut in week 4 and a full-funnel week: week 5 has the funnel bonus and no discount
  let t = eng.effects.addEffect(await craft({ week: 4 }), "competitorMatch");
  t = eng.effects.addEffect(eng.effects.expireEffects(t), "fullFunnel", "next");
  t = { ...t, week: 5 };
  near(eng.effects.discountRate(t), 0); near(eng.effects.convMod(t), 0.06);
});

test("a discount takes 20% off what is signed that week, and commission is paid on the net", async () => {
  const eng = await E();
  const s = eng.effects.addEffect(await craft({ week: 4, deals: [[3, 10000]], cash: 0 }), "competitorMatch");
  const r = await withDice([0], 0.99, () => eng.run.step(s, act("close")));
  const l = lines(s, r.state).find(x => x.tag === "close.signed");
  assert.equal(l.d.won, 8000); assert.equal(l.d.keep, 960); assert.equal(l.d.off, 2000);
  assert.equal(r.state.closedWon, 8000); assert.equal(r.state.cash, 960); assert.equal(r.state.discounts, 2000);
});

test("old saves: one shared number and timer becomes one effect that lasts as long as the timer had left", async () => {
  const eng = await E(), { legacyEffects, sanitizeEffects } = eng.effects;
  assert.deepEqual(legacyEffects({ conversion: 0.12, discount: 0.2, expiresIn: 2 }, 6), [{ src: "legacy", conv: 0.12, disc: 0.2, from: 6, until: 7 }]);
  assert.deepEqual(legacyEffects({ conversion: 0.06 }, 5), [{ src: "legacy", conv: 0.06, disc: 0, from: 5, until: 5 }], "no timer: this week only");
  assert.deepEqual(legacyEffects({ conversion: 0, discount: 0, expiresIn: 3 }, 5), []);
  assert.deepEqual(legacyEffects({ conversion: -0.9, expiresIn: 1 }, 2)[0].conv, -0.30, "held to the swing");
  for (const junk of [null, undefined, 3, "x", [], { conversion: NaN }]) assert.deepEqual(legacyEffects(junk, 4), []);
  const merged = eng.state.mergeSaved({ week: 6, deals: [], logs: [], modifiers: { conversion: 0.12, discount: 0.2, expiresIn: 2 } });
  assert.ok(!("modifiers" in merged)); assert.deepEqual(merged.effects, [{ src: "legacy", conv: 0.12, disc: 0.2, from: 6, until: 7 }]);
  // what a v2.1 save carries is checked on the way in
  const kept = sanitizeEffects([{ src: "freeze", conv: -0.12, disc: 0, from: 6, until: 6 }, { src: "nope", conv: 1, from: 6, until: 6 }, { src: "freeze", conv: -0.12, from: 4, until: 5 },
    { src: "caseStudy", conv: 9, disc: -2, from: 6, until: 7 }, null, 7, { src: "freeze", conv: "x", from: 6, until: 6 }, { src: "freeze", conv: 0.1, from: 7, until: 6 }], 6);
  assert.deepEqual(kept, [{ src: "freeze", conv: -0.12, disc: 0, from: 6, until: 6 }, { src: "caseStudy", conv: 0.30, disc: 0, from: 6, until: 7 }]);
  assert.deepEqual(sanitizeEffects("x", 1), []);
});
