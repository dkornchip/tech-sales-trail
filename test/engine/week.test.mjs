// End Week (src/game/week.js) and the reviews (src/game/quarter.js): what Friday does, in what order, and how a quarter ends.
import test from "node:test";
import assert from "node:assert/strict";
import { E, craft, move, act, END, HAIL, script, unscript, fridayDice, lines, tags } from "./lib/kit.mjs";

// One End Week with chosen dice. Returns { s, over, tags, lines, used, base } (base: rolls before `after`).
async function week(state, picks = {}, after = [], rest = 0.99) {
  const eng = await E();
  const dice = await fridayDice(state, picks, after, rest);
  const d = script(dice, rest);
  try { const r = eng.run.step(state, END); return { s: r.state, over: r.over, tags: tags(state, r.state), lines: lines(state, r.state), used: d.used(), base: dice.length - after.length }; }
  finally { unscript(); }
}
const Q = 160000;
const at = pct => Math.round(Q * pct);

test("the numbers are the brief's", async () => {
  const eng = await E(), R = eng.rules, quarter = await import("../../src/game/quarter.js");
  assert.deepEqual(R.PAY, { salary: 1000, rent: 1600, commission: 0.12 }); assert.deepEqual(R.RENT_WEEKS, [1, 5, 9]);
  assert.deepEqual(R.CASH, { repoAt: -1500, warnAt: -1000 }); assert.deepEqual(R.FRIDAY, { energy: 15, relief: 4 }); assert.equal(R.FRIDAY_CLOSE, 0.15);
  assert.equal(R.PACE_GRACE, 0.03); assert.equal(R.REVIEWS_FROM, 5); assert.equal(R.FIRING_FROM, 6);
  assert.deepEqual(quarter.QBR, { club: 1, safe: 0.8, floor: 0.7, politics: 0.06, politicsBelow: 25 });
  assert.equal(eng.stress.CRASH_PER_SHOT, 13); assert.equal(eng.stress.STRESS_DANGER, 80); assert.equal(eng.stress.DANGER_RATE, 0.03);
  assert.equal(eng.constants.QUARTER_WEEKS, 13);
});

test("Friday pays the salary, charges rent in weeks 1, 5 and 9, and says when rent took the cash below zero", async () => {
  let r = await week(await craft({ week: 1 }));
  assert.equal(r.s.cash, 600); assert.deepEqual(r.tags.slice(0, 2), ["pay.rent", "pay.salary"]);
  assert.deepEqual(r.lines[0].d, { rent: 1600, short: false }); assert.deepEqual(r.lines[1].d, { salary: 1000 });
  r = await week(await craft({ week: 2 }));
  assert.equal(r.s.cash, 2200); assert.ok(!r.tags.includes("pay.rent"));
  for (const w of [5, 9]) { r = await week(await craft({ week: w, cash: 100, closedQuarter: Q, closedWon: Q })); assert.equal(r.s.cash, -500); assert.equal(r.lines.find(l => l.tag === "pay.rent").d.short, true); }
  for (const w of [3, 4, 6, 7, 8, 10, 11, 12]) assert.ok(!(await week(await craft({ week: w, closedQuarter: Q, closedWon: Q }))).tags.includes("pay.rent"), "week " + w);
});

test("rent that takes cash to -1500 ends the run there, with Collections as the last line; -1000 only warns, once", async () => {
  let r = await week(await craft({ week: 5, cash: -900 }));
  assert.ok(r.over && r.s.repo); assert.equal(r.s.endCause, "repo"); assert.equal(r.s.cash, -1500); assert.equal(r.tags[r.tags.length - 1], "end.repo");
  assert.equal(r.s.week, 5, "the week does not turn");
  r = await week(await craft({ week: 5, cash: -899, closedQuarter: Q, closedWon: Q }));
  assert.ok(!r.over); assert.equal(r.s.cash, -1499); assert.ok(r.tags.includes("pay.repoWarn")); assert.equal(r.s.repoWarned, true);
  const again = await week({ ...r.s, cash: -2499 + 1000 - 1 });      // week 6: +1000 -> -1500... stays warned, no second warning line
  assert.equal(again.tags.filter(t => t === "pay.repoWarn").length, 0);
});

test("the week turns: energy +15, stress -4, five slots, and every once-a-week flag is reset", async () => {
  const s = await craft({ week: 2, energy: 90, stress: 30, slots: 1, restedThisWeek: true, hygieneShield: true, stressWarned: true, used: { prospect: true, crm: true, recharge: true, close: true } });
  const r = await week(s);
  assert.equal(r.s.week, 3); assert.equal(r.s.energy, 100, "held at 100"); assert.equal(r.s.stress, 26); assert.equal(r.s.slots, 5);
  assert.deepEqual([r.s.restedThisWeek, r.s.hygieneShield, r.s.stressWarned, r.s.coffeesThisWeek], [false, false, false, 0]);
  assert.ok(Object.values(r.s.used).every(v => v === false));
  assert.equal(r.tags[r.tags.length - 1], "week.next"); assert.equal(r.lines[r.lines.length - 1].d.week, 3);
});

test("a week on quad shots crashes instead of recovering: +13 stress a shot", async () => {
  const r = await week(await craft({ week: 2, stress: 30, coffeesThisWeek: 2 }));
  assert.equal(r.s.stress, 56); const l = r.lines.find(x => x.tag === "coffee.crash");
  assert.deepEqual(l.d, { stress: 26, fx: { stress: 26 } }); assert.equal(r.s.coffeesThisWeek, 0);
  const end = await week(await craft({ week: 2, stress: 90, coffeesThisWeek: 1 }));
  assert.ok(end.over && end.s.burnedOut); assert.equal(end.s.endCause, "stress"); assert.equal(end.tags[end.tags.length - 1], "end.meltdown.stress");
});

test("from stress 80 the weekend can end the run: a roll under (stress - 75) x 3%", async () => {
  // 84 eases to 80: the chance is 15%
  let r = await week(await craft({ week: 2, stress: 84 }), {}, [0.1499]);
  assert.ok(r.over && r.s.burnedOut); assert.equal(r.s.endCause, "stress"); assert.equal(r.tags[r.tags.length - 1], "end.meltdown.weekend");
  r = await week(await craft({ week: 2, stress: 84 }), {}, [0.15]);
  assert.ok(!r.over);
  r = await week(await craft({ week: 2, stress: 83 }), {}, [0]);     // eases to 79: no roll at all
  assert.ok(!r.over); assert.equal(r.used, r.base, "no weekend roll below 80");
});

test("deals age a week; old early-stage deals and skeptical ones can go dark", async () => {
  const s = await craft({ week: 2, used: { discovery: true, demo: true, prospect: true }, deals: [[0, 1000, "skeptical", 7, "Old"], [2, 5000, "neutral", 7, "Late"], [1, 3000, "neutral", 0, "New"]] });
  let r = await week(s, {}, [0.25, 0.15]);                           // both rolls exactly at their chance: it stays
  assert.deepEqual(r.s.deals.map(d => [d.account, d.age]), [["Old", 8], ["Late", 8], ["New", 1]]); assert.equal(r.used, r.base + 2, "only the old skeptical lead rolled");
  r = await week(s, {}, [0.2499, 0.99]); assert.deepEqual(r.s.deals.map(d => d.account), ["Late", "New"]); assert.ok(r.tags.includes("deal.ghost"));
  r = await week(s, {}, [0.99, 0.1499]); assert.deepEqual(r.s.deals.map(d => d.account), ["Late", "New"]); assert.equal(r.s.pipeline, 8000);
  assert.equal(r.lines.find(l => l.tag === "deal.ghost").d.account, "Old");
});

test("a full-funnel week earns +6 points next week; a neglected one with pipeline costs 6; neither applies this week", async () => {
  const eng = await E();
  const base = { week: 3, deals: [[2, 5000]] };
  let r = await week(await craft({ ...base, used: { network: true, discovery: true, propose: true } }));
  assert.ok(r.tags.includes("week.fullFunnel")); assert.deepEqual(r.s.effects, [{ src: "fullFunnel", conv: 0.06, disc: 0, from: 4, until: 4 }]);
  r = await week(await craft({ ...base, used: { cadence: true, prospect: true, close: true, propose: true } }));   // two groups: neither
  assert.deepEqual(r.s.effects, []); assert.ok(!r.tags.includes("week.fullFunnel") && !r.tags.includes("week.neglected"));
  r = await week(await craft({ ...base, used: { demo: true } }));    // one group, with pipeline
  assert.ok(r.tags.includes("week.neglected")); assert.deepEqual(r.s.effects, [{ src: "neglect", conv: -0.06, disc: 0, from: 4, until: 4 }]);
  r = await week(await craft({ week: 3 }));                          // nothing worked, but nothing to neglect
  assert.deepEqual(r.s.effects, []);
  // CRM, recharge, coffee and politics are not funnel work
  r = await week(await craft({ ...base, used: { crm: true, recharge: true, prospect: true, discovery: true } }));
  assert.deepEqual(r.s.effects, []);
  assert.equal(eng.effects.EFFECT.fullFunnel.conv, 0.06);
});

test("six or more raw leads with no discovery go stale at 20% each; five or more qualified with no demo cool at 18% each", async () => {
  const leads = Array.from({ length: 6 }, () => [0, 1000]);
  let r = await week(await craft({ week: 3, deals: leads }), {}, [0.1999, 0.2, 0.99, 0.99, 0.99, 0.99]);
  assert.equal(r.s.deals.length, 5); assert.equal(r.lines.find(l => l.tag === "week.stale").d.n, 1); assert.equal(r.s.pipeline, 5000);
  r = await week(await craft({ week: 3, deals: leads, used: { discovery: true } }), {}, [0, 0, 0, 0, 0, 0]);
  assert.equal(r.s.deals.length, 6, "discovery this week protects them");
  assert.equal((await week(await craft({ week: 3, deals: leads.slice(1) }), {}, [0, 0, 0, 0, 0])).s.deals.length, 5, "five leads are not a backlog");
  const qualified = Array.from({ length: 5 }, () => [1, 2000, "curious"]);
  r = await week(await craft({ week: 3, deals: qualified }), {}, [0.1799, 0.18, 0.99, 0.99, 0.99]);
  assert.deepEqual(r.s.deals.map(d => [d.stage, d.mood]).filter(x => x[0] === 0), [[0, "skeptical"]]); assert.equal(r.lines.find(l => l.tag === "week.backlog").d.n, 1);
  assert.equal((await week(await craft({ week: 3, deals: qualified, used: { demo: true } }), {}, [0, 0, 0, 0, 0])).s.deals.filter(d => d.stage === 1).length, 5);
});

test("the manager's opinion follows the number, and an email-only week costs 3 more", async () => {
  let r = await week(await craft({ week: 2, manager: 50 }));
  assert.equal(r.s.manager, 48, "nothing closed: (0 - 0.5) x 4");
  r = await week(await craft({ week: 2, manager: 50, closedQuarter: Q, closedWon: Q })); assert.equal(r.s.manager, 52);
  r = await week(await craft({ week: 2, manager: 50, closedQuarter: Q / 2, closedWon: Q / 2, used: { cadence: true } }));
  assert.equal(r.s.manager, 47); assert.deepEqual(r.lines.find(l => l.tag === "mgr.emails").d.fx, { manager: -3 });
  r = await week(await craft({ week: 2, manager: 50, closedQuarter: Q / 2, closedWon: Q / 2, used: { cadence: true, prospect: true } }));
  assert.equal(r.s.manager, 50); assert.ok(!r.tags.includes("mgr.emails"));
});

test("End Week makes a close attempt of its own only when its first roll is under 15%", async () => {
  const s = await craft({ week: 2, deals: [[3, 10000]] });
  let r = await week(s, { close: 0.1499 }); assert.ok(r.tags[0].startsWith("close."), r.tags[0]); assert.equal(r.lines[0].d.src, "friday");
  r = await week(s, { close: 0.15 }); assert.ok(!r.tags.some(t => t.startsWith("close.")));
});

test("no review before week 5, none when on pace or within 3 points, and week 5 never fires", async () => {
  const risk = t => t.filter(x => x.startsWith("risk.") || x.startsWith("end."));
  let r = await week(await craft({ week: 4 }), {}, [0, 0, 0]);
  assert.deepEqual(risk(r.tags), []); assert.equal(r.used, r.base, "no review roll in week 4");
  r = await week(await craft({ week: 6, closedQuarter: at(6 / 13 - 0.03) + 1, closedWon: at(6 / 13) }), {}, [0, 0, 0]);
  assert.deepEqual(risk(r.tags), [], "3 points behind is still on pace"); assert.equal(r.used, r.base);
  r = await week(await craft({ week: 6, closedQuarter: at(6 / 13 - 0.031), closedWon: at(6 / 13) }), {}, [0.99, 0.99]);
  assert.equal(r.used, r.base + 2, "past the grace: the warning roll and the fire roll");
  // week 5, far behind, every roll a zero: a warning, and no firing roll at all
  r = await week(await craft({ week: 5, manager: 5 }), {}, [0, 0, 0]);
  assert.deepEqual(risk(r.tags), ["risk.audit"]); assert.ok(!r.over); assert.equal(r.used, r.base + 1); assert.equal(r.s.perfWarnings, 1);
});

test("the warning ladder: 70%, 60%, 50%, with +4, +5, +6 stress, and a clean CRM holds it still", async () => {
  const step = async (perfWarnings, roll, extra = {}) => week(await craft({ week: 5, stress: 30, perfWarnings, ...extra }), {}, [roll]);
  let r = await step(0, 0.6999); assert.equal(r.s.perfWarnings, 1); assert.deepEqual(r.lines.find(l => l.tag === "risk.audit").d.fx, { stress: 4 });
  assert.equal((await step(0, 0.7)).s.perfWarnings, 0);
  r = await step(1, 0.5999); assert.equal(r.s.perfWarnings, 2); assert.deepEqual(r.lines.find(l => l.tag === "risk.hygiene").d.fx, { stress: 5 });
  assert.equal((await step(1, 0.6)).s.perfWarnings, 1);
  r = await step(2, 0.4999); assert.equal(r.s.perfWarnings, 3); assert.deepEqual(r.lines.find(l => l.tag === "risk.hr").d.fx, { stress: 6 });
  assert.equal((await step(2, 0.5)).s.perfWarnings, 2);
  r = await step(1, 0, { hygieneShield: true }); assert.equal(r.s.perfWarnings, 1, "shielded: no escalation"); assert.equal(r.used, r.base, "and no roll for one");
});

test("from week 6 a review can fire: the chance, its floor and ceiling, the CRM's 6 points, and the cause", async () => {
  // week 6, nothing closed: 6/13 behind. severity = min(0.9, 6/13 x 1.8); chance = 0.03 + severity x 0.45 + 0.06 a warning
  // + 0.04 / 0.08 / 0.10 for a manager under 50 / 35 / 20 + 0.05 for pipeline under 40% of quota
  const sev = Math.min(0.9, (6 / 13) * 1.8);
  const fire = async (over, roll, more = []) => week(await craft({ week: 6, ...over }), {}, [roll, ...more]);
  // three warnings (no ladder roll), manager 60 (58 after the week's drift), no pipeline
  const c1 = 0.03 + sev * 0.45 + 3 * 0.06 + 0.05;
  let r = await fire({ perfWarnings: 3, manager: 60 }, c1 - 0.0001);
  assert.ok(r.over && r.s.fired); assert.equal(r.s.endCause, "review"); assert.equal(r.tags[r.tags.length - 1], "end.fired.review"); assert.equal(r.lines[r.lines.length - 1].kind, "bad");
  r = await fire({ perfWarnings: 3, manager: 60 }, c1, [0.3999]);
  assert.ok(!r.over); assert.ok(r.tags.includes("risk.recurring"));
  assert.ok(!(await fire({ perfWarnings: 3, manager: 60 }, c1, [0.4])).tags.includes("risk.recurring"));
  // a healthy pipeline (40% of quota) takes the 5 points off
  r = await fire({ perfWarnings: 3, manager: 60, deals: [[0, at(0.4), "neutral"]], used: { discovery: true, prospect: true, demo: true } }, c1 - 0.05);
  assert.ok(!r.over, "with pipeline at 40% of quota the same roll survives");
  // the ceiling: a manager at 10 would make it 0.85; it is held to 0.70
  assert.ok((await fire({ perfWarnings: 3, manager: 10 }, 0.6999)).over); assert.ok(!(await fire({ perfWarnings: 3, manager: 10 }, 0.70, [0.99])).over);
  // a clean CRM this week: 6 points off
  assert.ok(!(await fire({ perfWarnings: 3, manager: 60, hygieneShield: true }, c1 - 0.06, [0.99])).over);
  assert.ok((await fire({ perfWarnings: 3, manager: 60, hygieneShield: true }, c1 - 0.0601)).over);
  // no warning on file and none this week: the chance is scaled by 0.6, and a firing is an "org update"
  const c0 = (0.03 + sev * 0.45 + 0.05) * 0.6;
  r = await week(await craft({ week: 6, manager: 60 }), {}, [0.99, c0 - 0.0001]);
  assert.ok(r.over); assert.equal(r.s.endCause, "org"); assert.equal(r.tags[r.tags.length - 1], "end.fired.org");
  assert.ok(!(await week(await craft({ week: 6, manager: 60 }), {}, [0.99, c0])).over);
  // the floor: barely behind, liked, pipeline healthy, shielded: never safer than 2%
  const mild = { week: 6, manager: 90, hygieneShield: true, closedQuarter: at(6 / 13 - 0.04), closedWon: at(6 / 13), deals: [[0, at(0.5)]], used: { discovery: true, prospect: true, demo: true } };
  assert.ok((await week(await craft(mild), {}, [0.0199])).over); assert.ok(!(await week(await craft(mild), {}, [0.02])).over);
});

test("the QBR: one resolution at each boundary", async () => {
  const qbr = async (closed, over = {}, after = []) => week(await craft({ week: 13, closedQuarter: closed, closedWon: closed, ...over }), {}, after);
  const ends = r => r.tags.filter(t => t.startsWith("qbr.") || t.startsWith("end."));
  // under 70%: fired, no roll, no reprieve announced first
  let r = await qbr(at(0.7) - 1, {}, [0.99]);
  assert.deepEqual(ends(r), ["qbr.final", "end.fired.under70"]); assert.equal(r.s.endCause, "qbr"); assert.ok(r.s.fired && r.over);
  assert.equal(r.used, r.base, "no roll decides it"); assert.equal(r.lines.find(l => l.tag === "qbr.final").d.pct, 69, "69.99% is shown as 69, not 70");
  assert.equal(r.lines[r.lines.length - 1].kind, "bad");
  assert.deepEqual(ends(await qbr(0)), ["qbr.final", "end.fired.under70"]);
  // 70% exactly: the review decides. No PIP, manager over 35, no pipeline: 0.25 + 0.10
  r = await qbr(at(0.7), {}, [0.3499]); assert.deepEqual(ends(r), ["qbr.final", "end.fired.qbr"]); assert.equal(r.s.endCause, "qbr");
  r = await qbr(at(0.7), {}, [0.35]); assert.deepEqual(ends(r), ["qbr.final", "qbr.dodged", "end.missed"]); assert.ok(r.s.missed && r.s.pip); assert.equal(r.s.endCause, "missed");
  assert.equal(r.lines.find(l => l.tag === "qbr.final").d.pct, 70);
  // ...+0.20 on a PIP, +0.20 with a manager under 35: 0.75
  r = await qbr(at(0.7), { pip: true, pipLevel: 1, manager: 30 }, [0.7499]); assert.ok(r.s.fired);
  r = await qbr(at(0.7), { pip: true, pipLevel: 1, manager: 30 }, [0.75, 0.99]); assert.deepEqual(ends(r).slice(0, 2), ["qbr.final", "qbr.dodgedUp"]); assert.equal(r.s.pipLevel, 2);
  // 79.99% is still the review's call; 80% is safe without a roll
  assert.ok((await qbr(at(0.8) - 1, {}, [0])).s.fired);
  r = await qbr(at(0.8), {}, [0]); assert.deepEqual(ends(r), ["qbr.final", "qbr.survive", "end.missed"]); assert.equal(r.used, r.base);
  r = await qbr(at(0.8), { manager: 30 }, [0.99]); assert.deepEqual(ends(r).slice(0, 2), ["qbr.final", "qbr.pip"]); assert.ok(r.s.pip && r.s.missed);
  r = await qbr(at(0.8), { manager: 80 }, [0.99]); assert.deepEqual(ends(r), ["qbr.final", "qbr.macro", "end.missed"]);
  // 99.99% is not Club; 100% is
  r = await qbr(Q - 1); assert.ok(r.s.missed && !r.s.win); assert.equal(r.lines.find(l => l.tag === "qbr.final").d.pct, 99);
  r = await qbr(Q); assert.deepEqual(ends(r), ["qbr.final", "qbr.hit", "end.club"]); assert.ok(r.s.win); assert.equal(r.s.endCause, "club");
  assert.deepEqual(r.lines.filter(l => l.tag.startsWith("qbr.") || l.tag.startsWith("end.")).map(l => l.kind), ["info", "info", "info"], "Club is not logged as a warning");
  // the quarter's total is kept on the finished run
  assert.equal(r.s.closedQuarter, Q); assert.equal(r.s.closedWon, Q); assert.equal(r.s.week, 13);
});

test("hitting quota with a manager under 25 can still end in a politics firing: 6%", async () => {
  const qbr = async roll => week(await craft({ week: 13, closedQuarter: 160000, closedWon: 160000, manager: 20 }), {}, [roll]);
  let r = await qbr(0.0599); assert.ok(r.s.fired && !r.s.win); assert.equal(r.s.endCause, "politics"); assert.equal(r.tags[r.tags.length - 1], "end.fired.politics");
  r = await qbr(0.06); assert.ok(r.s.win);
  // a manager at 25 or more: no roll
  const liked = await week(await craft({ week: 13, closedQuarter: 160000, closedWon: 160000, manager: 23 }), {}, [0]);   // 23 + 2 drift = 25
  assert.ok(liked.s.win); assert.equal(liked.used, liked.base);
});

test("week 13 has no behind-pace review, and a finished run takes no further move", async () => {
  const eng = await E();
  const r = await week(await craft({ week: 13, perfWarnings: 0 }));
  assert.ok(!r.tags.some(t => t.startsWith("risk.")));
  const done = r.s;
  assert.deepEqual(eng.run.legalMoves(done), []); assert.deepEqual(done.pending, []);
  for (const m of [END, HAIL, act("prospect"), { t: "ck", op: "buy" }]) { const x = await move(done, m); assert.equal(x.refused, "over"); assert.equal(x.state, done); }
  assert.ok(done.logs[0].tag.startsWith("end."), "the ending is the last line");
});

test("why a run ended: the run's own word, then the ending's tag, then old wording", async () => {
  const { causeOf, legacyCause } = (await E()).log && await import("../../src/game/legacy.js");
  assert.equal(causeOf("fired", { endCause: "politics", logs: [{ tag: "end.fired.org", kind: "bad", msg: "x" }] }), "politics");
  assert.equal(causeOf("fired", { logs: [{ tag: "week.next", msg: "" }, { tag: "end.fired.org", kind: "bad", msg: "anything" }] }), "org");
  assert.equal(causeOf("fired", { logs: [{ tag: "end.fired.under70", kind: "bad", msg: "x" }] }), "qbr");
  assert.equal(causeOf("burnout", { logs: [{ tag: "end.ascension", kind: "bad", msg: "x" }] }), "caffeine");
  assert.equal(causeOf("fired", { logs: [{ kind: "bad", msg: "🪓 Surprise org update" }] }), "org", "a save from before tags is read by its wording");
  assert.equal(causeOf("fired", { logs: [{ kind: "bad", msg: "📉 Mid-quarter review" }] }), "review");
  assert.equal(causeOf("fired", { logs: [] }), "qbr"); assert.equal(causeOf("burnout", {}), "stress"); assert.equal(causeOf("repo", {}), "repo");
  assert.equal(legacyCause("club", []), "club");
});
