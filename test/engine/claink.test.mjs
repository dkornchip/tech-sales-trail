// clAInk (src/game/claink.js): the seat, a run that works, a run that does not, the Council's strikes, the manager,
// the Friday invoice, cancelling, and who gets the blame when it takes the jacket.
import test from "node:test";
import assert from "node:assert/strict";
import { E, craft, move, END, script, unscript, withDice, fridayDice, lines, tags } from "./lib/kit.mjs";

const ck = op => ({ t: "ck", op });
const go = async (s, m, dice = [], rest = 0.99) => { const eng = await E(); return withDice(dice, rest, () => eng.run.step(s, m)); };
// End Week with dice for what comes after the Friday events (the invoice is the last thing a week does).
async function week(state, after = [], rest = 0.99) {
  const eng = await E(); const dice = await fridayDice(state, {}, after, rest); const d = script(dice, rest);
  try { const r = eng.run.step(state, END); return { s: r.state, over: r.over, tags: tags(state, r.state), lines: lines(state, r.state) }; } finally { unscript(); }
}
const active = (over = {}) => ({ status: "active", ...over });
// a deploy's first four rolls: does it work, does the manager notice, does the strike hurt, how
const RUN = { miracle: 0.1999, flop: 0.2, seen: 0.2499, unseen: 0.25, hurt: 0.3799, harmless: 0.38 };

test("the numbers are the brief's", async () => {
  const { CLAINK } = (await E()).claink;
  const { rng, flavor, INC, ...n } = CLAINK;
  assert.deepEqual(n, { INSTALL: 500, CANCEL: 250, REPO_AT: -1500, OFFER_LAST_WEEK: 3, MIRACLE_P: 0.20, MIRACLE: [12000, 22000], MIRACLE_NUDGE: 2, STRIKES: 3, TRUEUP_OVER: [200, 1800], TRUEUP_MIN: 0,
    REVOKE_MGR: 8, INCIDENT_P: 0.38, MGR_P: 0.25, MGR_HIT: 9, RETAINER: 249, PER_OUTCOME: [140, 280], IDLE: [150, 300], OVERAGE_P: 0.10, OVERAGE: [200, 600], OUTCOMES: [2, 5], TOKENS_PER_DOLLAR: 4000 });
  assert.deepEqual(INC, { slop: { w: 0.20, rep: 10, mgr: 6 }, discount: { w: 0.15, cut: 0.45, mgr: 10, rep: 4 }, leak: { w: 0.15, n: 2, rep: 12, mgr: 8 }, churn: { w: 0.50, frac: 0.22, lo: 1500, hi: 45000 } });
});

test("the seat: $500 while the offer stands and the cash allows; dismissing or ignoring it ends the offer for the run", async () => {
  const eng = await E();
  let s = await craft({ week: 1 }), r = await move(s, ck("buy"));
  assert.equal(r.state.claink.status, "active"); assert.equal(r.state.cash, 700); assert.equal(r.state.claink.billed, 500); assert.deepEqual(tags(s, r.state), ["ck.install"]); assert.equal(lines(s, r.state)[0].d.cost, 500);
  assert.equal((await move(r.state, ck("buy"))).refused, "illegal");
  assert.equal((await move(await craft({ week: 3 }), ck("buy"))).refused, null); assert.equal((await move(await craft({ week: 4 }), ck("buy"))).refused, "illegal");
  assert.equal((await move(await craft({ cash: -1000 }), ck("buy"))).refused, "illegal", "it may not take cash to -1500");
  assert.equal((await move(await craft({ cash: -999 }), ck("buy"))).state.cash, -1499);
  r = await move(s, ck("dismiss")); assert.equal(r.state.claink.status, "dismissed"); assert.deepEqual(tags(s, r.state), ["ck.dismiss"]);
  for (const op of ["buy", "dismiss", "deploy", "cancel", "hide"]) assert.equal((await move(r.state, ck(op))).refused, "illegal", op);
  // End Week of week 3 takes an unanswered offer away; week 2 does not
  assert.equal((await week(await craft({ week: 2 }))).s.claink.status, "ad");
  const w3 = await week(await craft({ week: 3 })); assert.equal(w3.s.claink.status, "expired"); assert.ok(w3.tags.includes("ck.expired"));
  assert.equal(eng.state.mergeSaved({ week: 5, deals: [], logs: [], claink: { status: "ad" } }).claink.status, "expired", "an old save past the deadline");
});

test("running the agents: no energy, no slot, once a week, never in week 13", async () => {
  const s = await craft({ week: 4, slots: 0, energy: 0, claink: active() });
  const r = await go(s, ck("deploy"), [RUN.flop, RUN.unseen, RUN.harmless, 0.5, 0, 0, 0]);
  assert.equal(r.refused, null); assert.deepEqual([r.state.slots, r.state.energy, r.state.claink.deployed, r.state.claink.deploys], [0, 0, true, 1]);
  assert.equal((await move(r.state, ck("deploy"))).refused, "illegal", "once a week");
  assert.equal((await move(await craft({ week: 13, claink: active() }), ck("deploy"))).refused, "illegal", "week 13 is frozen");
  assert.equal((await move(await craft({ week: 12, claink: active() }), ck("deploy"))).refused, null);
  assert.equal((await move(await craft({ week: 4 }), ck("deploy"))).refused, "illegal", "no seat");
});

test("one run in five works: 12-22k of real revenue, 12% commission, up to two other deals nudged, fees still billed, no strike", async () => {
  const s = await craft({ week: 4, cash: 0, claink: active(), deals: [[2, 15000, "skeptical", 0, "Own"], [3, 30000, "neutral", 0, "TooBig"], [0, 1000, "skeptical", 0, "Lead"], [1, 2000, "neutral", 0, "Qual"]] });
  // target 12000 + floor(0.5 x 10001) = 17000: signs Own (15000) and upsells the 2000 left; nudge order rolls; one fee
  const r = await go(s, ck("deploy"), [RUN.miracle, RUN.unseen, 0.9, 0.9, 0.5, 0.9, 0.1, 0.2, 0]);
  const c = r.state.claink, t = tags(s, r.state);
  assert.deepEqual(t, ["ck.miracle", "ck.signed"]); const l = lines(s, r.state)[1];
  assert.deepEqual([l.d.n, l.d.won, l.d.keep, l.d.top.account], [1, 17000, 2040, "Own"]);
  assert.deepEqual([r.state.closedWon, r.state.closedQuarter, r.state.cash], [17000, 17000, 2040]);
  assert.deepEqual([c.miracles, c.delivered, c.earned, c.strikes, c.claims, c.due, c.fakes], [1, 17000, 2040, 0, 1, 249 + 140, 0]);
  assert.deepEqual(r.state.deals.map(d => [d.account, d.stage, d.mood]), [["TooBig", 3, "neutral"], ["Lead", 1, "neutral"], ["Qual", 2, "neutral"]], "the two with the lowest rolls move up a stage");
  assert.equal(r.state.pipeline, 33000); assert.equal(c.last.kind, "miracle"); assert.equal(c.last.revenue, 17000); assert.deepEqual(r.state.pending, []);
  assert.equal(r.state.story.signed, 1);
  // nothing of yours fits: the whole target is a customer nobody had met (lowest target: 12000)
  const bare = await craft({ week: 4, cash: 0, claink: active() });
  const n = await go(bare, ck("deploy"), [0, RUN.unseen, 0.9, 0.9, 0, 0.999999]);
  assert.deepEqual([n.state.closedWon, n.state.cash, n.state.claink.due, n.state.claink.earned], [12000, 1440, 249 + 280, 1440]);
  // a deal of yours plus a new customer when the remainder is 2500 or more: two signatures, two fees
  const two = await craft({ week: 4, cash: 0, claink: active(), deals: [[2, 12000, "neutral", 0, "Own"]] });
  const m = await go(two, ck("deploy"), [0, RUN.unseen, 0.9, 0.9, 0.999999, 0, 0]);    // target 22000
  assert.deepEqual([lines(two, m.state)[1].d.n, m.state.closedWon, m.state.claink.claims, m.state.claink.due, m.state.deals.length], [2, 22000, 2, 249 + 280, 0]);
});

test("the other four: outcomes are billed, nothing closes, and the Council files a strike", async () => {
  const s = await craft({ week: 4, claink: active(), deals: [[2, 9000]] });
  let r = await go(s, ck("deploy"), [RUN.flop, RUN.unseen, RUN.harmless, 0.5, 0, 0, 0.999999]);  // 2 outcomes: 140 + 280
  let c = r.state.claink;
  assert.deepEqual(tags(s, r.state), ["ck.run", "ck.strike"]); assert.deepEqual([c.strikes, c.fakes, c.claims, c.due, c.incidents, c.miracles], [1, 1, 2, 249 + 420, 0, 0]);
  assert.deepEqual([r.state.closedWon, r.state.cash, r.state.deals.length], [0, 1200, 1], "nothing closes and nothing is charged until Friday");
  assert.equal(c.strikeLog.length, 1); assert.equal(c.last.strike.hurt, false); assert.equal(lines(s, r.state)[1].kind, "warn"); assert.equal(lines(s, r.state)[0].d.n, 2);
  r = await go(s, ck("deploy"), [RUN.flop, RUN.unseen, RUN.harmless, 0.5, 0.999999, 0, 0, 0, 0, 0]);  // 5 outcomes at 140
  assert.deepEqual([r.state.claink.claims, r.state.claink.due], [5, 249 + 700]);
});

test("a strike with real damage: each incident, and what it falls back to when there is nothing to hit", async () => {
  const deals = [[1, 50000, "happy", 0, "BigEarly"], [3, 8000, "curious", 0, "Late"], [2, 20000, "neutral", 0, "Mid"]];
  const hit = async (rKind, over = {}) => { const s = await craft({ week: 4, claink: active(), deals, ...over }); const r = await go(s, ck("deploy"), [RUN.flop, RUN.unseen, RUN.hurt, rKind, 0, 0, 0]); return { s, r, st: r.state, c: r.state.claink }; };
  // slop (under 0.20): the most advanced deal flees, -10 reputation, -6 manager
  let x = await hit(0.1999);
  assert.deepEqual(x.st.deals.map(d => d.account), ["BigEarly", "Mid"]); assert.deepEqual([x.st.reputation, x.st.manager], [30, 44]); assert.equal(x.c.incidents, 1); assert.equal(x.c.last.strike.hurt, true);
  assert.deepEqual(tags(x.s, x.st), ["ck.run", "ck.strike.hurt"]); assert.equal(lines(x.s, x.st)[1].kind, "bad"); assert.equal(x.st.pipeline, 70000);
  // discount (0.20 to under 0.35): the most advanced deal at Demoed or later loses 45% and turns skeptical; -10 manager, -4 reputation
  x = await hit(0.20);
  assert.deepEqual(x.st.deals.find(d => d.account === "Late"), { ...x.s.deals[1], value: 4400, mood: "skeptical", probNote: x.st.deals.find(d => d.account === "Late").probNote });
  assert.deepEqual([x.st.manager, x.st.reputation, x.st.deals.length, x.st.pipeline], [40, 36, 3, 74400]);
  // leak (0.35 to under 0.50): the two most advanced deals are gone; -12 reputation, -8 manager
  x = await hit(0.35); assert.deepEqual(x.st.deals.map(d => d.account), ["BigEarly"]); assert.deepEqual([x.st.reputation, x.st.manager], [28, 42]);
  // churn (0.50 and up): 22% of what is closed comes back, between 1,500 and 45,000 and never more than there is, with its commission
  x = await hit(0.50, { closedQuarter: 50000, closedWon: 50000, cash: 5000 });
  assert.deepEqual([x.st.closedQuarter, x.st.closedWon, x.st.cash, x.st.deals.length], [39000, 39000, 5000 - 1320, 3]);
  x = await hit(0.9, { closedQuarter: 1000, closedWon: 1000, cash: 5000 }); assert.deepEqual([x.st.closedQuarter, x.st.cash], [0, 5000 - 120]);
  x = await hit(0.9, { closedQuarter: 300000, closedWon: 300000, cash: 50000 }); assert.deepEqual([x.st.closedQuarter, x.st.cash], [255000, 50000 - 5400]);
  // nothing closed: churn becomes slop. No deals: leak and discount become churn, or slop when nothing is closed either
  x = await hit(0.9); assert.deepEqual(x.st.deals.map(d => d.account), ["BigEarly", "Mid"]); assert.equal(x.st.reputation, 30);
  x = await hit(0.35, { deals: [], closedQuarter: 10000, closedWon: 10000 }); assert.equal(x.st.closedQuarter, 10000 - 2200);
  x = await hit(0.35, { deals: [] }); assert.deepEqual([x.st.reputation, x.st.manager, x.st.closedWon], [30, 44, 0]);
  // a meter with less to lose than the rule says: the card reports what was really lost
  x = await hit(0.1, { reputation: 3, manager: 2 });
  assert.deepEqual([x.st.reputation, x.st.manager], [0, 0]);
  assert.ok(/\b3\b/.test(x.c.last.strike.fx) && /\b2\b/.test(x.c.last.strike.fx) && !/\b10\b/.test(x.c.last.strike.fx) && !/\b6\b/.test(x.c.last.strike.fx), x.c.last.strike.fx);
});

test("the third strike revokes the seat: the true-up takes all the cash and 200-1,800 more, the best deal goes, the manager hears", async () => {
  const two = { status: "active", strikes: 2, strikeLog: [{ n: 1, who: "Finance", line: "x" }, { n: 2, who: "Legal", line: "y" }] };
  const s = await craft({ week: 6, cash: 3000, manager: 50, claink: two, deals: [[3, 9000, "neutral", 0, "Best"], [1, 50000, "neutral", 0, "Early"]] });
  let r = await go(s, ck("deploy"), [RUN.flop, RUN.unseen, RUN.hurt, 0.1, 0, 0, 0, 0]);                 // 2 outcomes at 140; true-up over by 200
  let c = r.state.claink;
  assert.deepEqual([c.status, c.strikes, c.due, c.lastInvoice, c.billed], ["revoked", 3, 0, 3200, 3200]); assert.equal(r.state.cash, -200); assert.equal(r.state.manager, 42);
  assert.deepEqual(r.state.deals.map(d => d.account), ["Early"]); assert.deepEqual(tags(s, r.state), ["ck.run", "ck.farewell", "ck.revoked"]);
  assert.equal(lines(s, r.state)[1].d.mgr, 8); assert.equal(lines(s, r.state)[2].d.cost, 3200); assert.equal(c.incidents, 0, "the third strike is the revocation, not an incident");
  assert.equal(c.strikeLog.length, 3); assert.equal(c.last.kind, "revoked"); assert.ok(!r.state.repo);
  for (const op of ["deploy", "cancel", "buy"]) assert.equal((await move(r.state, ck(op))).refused, "illegal", op);
  // the largest true-up from positive cash lands at -1800: Collections, and clAInk is why
  r = await go(s, ck("deploy"), [RUN.flop, RUN.unseen, RUN.hurt, 0.1, 0, 0, 0, 0.999999]);
  assert.equal(r.state.cash, -1800); assert.ok(r.state.repo); assert.equal(r.state.endCause, "claink"); assert.equal(r.state.logs[0].tag, "end.repo"); assert.deepEqual(r.state.pending, []);
  // with no cash to take, it still takes what the week's run cost
  const brokeS = await craft({ week: 6, cash: -900, claink: two });
  r = await go(brokeS, ck("deploy"), [RUN.flop, RUN.unseen, RUN.hurt, 0.1, 0, 0, 0, 0]);
  assert.equal(r.state.claink.lastInvoice, 249 + 280); assert.equal(r.state.cash, -900 - 529); assert.ok(!r.state.repo);
  assert.deepEqual(tags(brokeS, r.state), ["ck.run", "ck.revoked", "pay.repoWarn"], "no deal, no farewell (and Finance has noticed the balance)");
  // the revoked seat is never billed again
  const after = await week(await craft({ week: 7, claink: { ...c } }));
  assert.ok(!after.tags.some(t => t.startsWith("ck.invoice"))); assert.equal(after.s.claink.billed, c.billed);
});

test("the manager: a warning the first time, then he takes a deal, or circles back when there is none", async () => {
  const s = await craft({ week: 4, manager: 50, claink: active(), deals: [[2, 9000, "neutral", 0, "Mid"], [0, 60000, "neutral", 0, "Whale"], [3, 5000, "neutral", 0, "Late"]] });
  let r = await go(s, ck("deploy"), [RUN.flop, RUN.seen, RUN.harmless, 0.5, 0, 0, 0]);
  assert.deepEqual(r.state.pending, [{ id: "ck:warning", params: { miracle: false } }]); assert.equal(r.state.manager, 41); assert.equal(r.state.claink.mgr.noticed, true);
  assert.equal(r.state.deals.length, 3); assert.deepEqual(lines(s, r.state).pop().d, { miracle: false, hit: 9 });
  assert.deepEqual((await go(s, ck("deploy"), [RUN.flop, RUN.unseen, RUN.harmless, 0.5, 0, 0, 0])).state.pending, [], "a roll of 0.25 goes unnoticed");
  const lucky = await go(s, ck("deploy"), [RUN.miracle, RUN.seen, 0.9, 0.9, 0, 0.9, 0.9, 0.9, 0]);
  assert.deepEqual(lucky.state.pending, [{ id: "ck:warning", params: { miracle: true } }]);
  // already warned: he takes the most advanced deal at Demoed or later. It was not the largest on the board.
  const warned = { ...s, claink: { ...s.claink, mgr: { noticed: true, yoinks: 0 } } };
  r = await go(warned, ck("deploy"), [RUN.flop, RUN.seen, RUN.harmless, 0.5, 0, 0, 0]);
  assert.deepEqual(r.state.pending, [{ id: "ck:lesson", params: { account: "Late" } }]); assert.deepEqual(r.state.deals.map(d => d.account), ["Mid", "Whale"]);
  let l = lines(warned, r.state).pop(); assert.deepEqual([l.tag, l.d.account, l.d.hit, l.d.largest, l.kind], ["ck.mgr.yoink", "Late", 9, false, "bad"]);
  assert.deepEqual([r.state.claink.mgr.yoinks, r.state.story.took, r.state.story.tookLargest, r.state.pipeline], [1, "Late", false, 69000]);
  // nothing at Demoed or later: he takes the largest, and the run remembers that it was
  const early = { ...warned, deals: warned.deals.filter(d => d.stage < 2) };
  r = await go(early, ck("deploy"), [RUN.flop, RUN.seen, RUN.harmless, 0.5, 0, 0, 0]);
  l = lines(early, r.state).pop(); assert.deepEqual([l.d.account, l.d.largest], ["Whale", true]); assert.equal(r.state.story.tookLargest, true);
  // no deals at all: he circles back; nothing to acknowledge
  const none = { ...warned, deals: [], pipeline: 0, manager: 4 };
  r = await go(none, ck("deploy"), [RUN.flop, RUN.seen, RUN.harmless, 0.5, 0, 0, 0]);
  l = lines(none, r.state).pop(); assert.equal(l.tag, "ck.mgr.circle"); assert.deepEqual(r.state.pending, []); assert.equal(l.d.hit, 4, "a manager at 4 can only drop 4"); assert.equal(r.state.manager, 0);
});

test("the Friday invoice: a week's run, an idle week, the weekend overage, and nothing in week 13", async () => {
  // a week with a run: what is due is charged, and the week's flags are cleared
  let s = await craft({ week: 4, cash: 5000, closedQuarter: 160000, closedWon: 160000, claink: active({ deployed: true, due: 669, claims: 2, weekTokens: 1000 }) });
  let r = await week(s, [0.10]);                                    // overage roll: 0.10 is not under 10%
  let l = r.lines.find(x => x.tag === "ck.invoice"); assert.deepEqual([l.d.total, l.d.claims, l.d.looped], [669, 2, false]);
  assert.deepEqual([r.s.cash, r.s.claink.billed, r.s.claink.due, r.s.claink.deployed, r.s.claink.claims, r.s.claink.lastInvoice], [5000 + 1000 - 669, 669, 0, false, 0, 669]);
  r = await week(s, [0.0999, 0.999999]);                               // ...and one agent that looped all weekend: +600
  l = r.lines.find(x => x.tag === "ck.invoice"); assert.deepEqual([l.d.total, l.d.looped], [1269, true]);
  // an idle week still bills 150-300
  s = await craft({ week: 4, cash: 5000, closedQuarter: 160000, closedWon: 160000, claink: active() });
  r = await week(s, [0, 0.99]); l = r.lines.find(x => x.tag === "ck.invoice.idle"); assert.equal(l.d.total, 150); assert.equal(r.s.cash, 5850);
  r = await week(s, [0.999999, 0, 0]); assert.equal(r.lines.find(x => x.tag === "ck.invoice.idle").d.total, 300 + 200);
  // week 12 is invoiced; week 13 is not (the review ends the run first), and the seat cannot run there
  r = await week({ ...s, week: 12 }, [0, 0.99]); assert.ok(r.tags.includes("ck.invoice.idle")); assert.equal(r.s.week, 13);
  r = await week({ ...s, week: 13, claink: { ...s.claink, deployed: true, due: 669 } }, [0, 0]);
  assert.ok(r.over && r.s.win); assert.ok(!r.tags.some(t => t.startsWith("ck.invoice"))); assert.equal(r.s.claink.billed, 0); assert.equal(r.s.cash, 6000);
  // a run that ended on Friday for another reason is not billed either
  r = await week(await craft({ week: 7, perfWarnings: 3, manager: 5, claink: active({ deployed: true, due: 669 }) }), [0, 0, 0]);
  assert.ok(r.s.fired); assert.equal(r.s.claink.billed, 0);
  // an invoice that takes cash to -1500 ends the run, and clAInk is why
  r = await week(await craft({ week: 2, cash: -1831, closedQuarter: 160000, closedWon: 160000, repoWarned: true, claink: active({ deployed: true, due: 669 }) }), [0.99]);
  assert.equal(r.s.cash, -1500); assert.ok(r.s.repo); assert.equal(r.s.endCause, "claink"); assert.equal(r.tags[r.tags.length - 1], "end.repo");
});

test("cancelling: $250 and whatever is already due, only when it can be paid; the books add up", async () => {
  const eng = await E();
  let s = await craft({ week: 1, cash: 3000, closedQuarter: 160000, closedWon: 160000 });
  s = (await move(s, ck("buy"))).state;                                                   // 500
  s = (await go(s, ck("deploy"), [RUN.flop, RUN.unseen, RUN.harmless, 0.5, 0, 0, 0])).state;   // due 249 + 280
  s = (await week(s, [0.99])).s;                                                          // invoice 529
  s = (await week(s, [0, 0.99])).s;                                                       // idle week: 150
  s = (await go(s, ck("deploy"), [RUN.flop, RUN.unseen, RUN.harmless, 0.5, 0, 0, 0])).state;   // due 529 again
  assert.equal(eng.claink.clainkCancelCost(s), 250 + 529);
  const before = s; const r = await move(s, ck("cancel")); s = r.state;
  assert.deepEqual([s.claink.status, s.claink.due, s.claink.lastInvoice], ["cancelled", 0, 779]); assert.equal(lines(before, s)[0].d.cost, 779);
  const charges = s.logs.filter(e => ["ck.install", "ck.invoice", "ck.invoice.idle", "ck.cancel", "ck.revoked"].includes(e.tag)).reduce((t, e) => t + (e.d.cost || e.d.total), 0);
  assert.equal(charges, 500 + 529 + 150 + 779); assert.equal(s.claink.billed, charges, "billed is exactly the sum of what was charged");
  // rent weeks 1 and salary x2: cash is what the ledger says
  assert.equal(s.cash, 3000 + 2000 - 1600 - charges);
  // no more invoices, and the card can be put away once
  const later = await week(s, [0, 0]); assert.ok(!later.tags.some(t => t.startsWith("ck.invoice")));
  const hidden = await move(s, ck("hide")); assert.equal(hidden.state.claink.hidden, true); assert.equal((await move(hidden.state, ck("hide"))).refused, "illegal");
  // it cannot be cancelled into Collections
  const poor = await craft({ week: 4, cash: -500, claink: active({ due: 760 }) });
  assert.equal(eng.claink.clainkCanCancel(poor), false); assert.equal((await move(poor, ck("cancel"))).refused, "illegal");
  assert.equal((await move({ ...poor, cash: -489 }, ck("cancel"))).state.cash, -1499);
  assert.equal((await move(await craft({ week: 4, claink: active() }), ck("hide"))).refused, "illegal", "only a finished seat's card can be put away");
});

test("old saves: what the seat was is read exactly, and what was never recorded stays unknown", async () => {
  const { sanitizeClaink } = (await E()).claink;
  assert.equal(sanitizeClaink({ status: "rugged", strikes: 3 }, 6).status, "revoked");
  assert.equal(sanitizeClaink({ status: "constructor" }, 2).status, "ad"); assert.equal(sanitizeClaink({ status: "weird" }, 6).status, "expired");
  assert.equal(sanitizeClaink("active", 2).status, "ad"); assert.equal(sanitizeClaink([], 9).status, "expired");
  const proto = sanitizeClaink({ active: true, usedThisWeek: true, runs: 2, totalBilled: 900, outcomesThisWeek: 3 }, 5);
  assert.deepEqual([proto.status, proto.deployed, proto.deploys, proto.billed, proto.claims], ["active", true, 2, 900, 3]);
  assert.equal(sanitizeClaink({ status: "active", miracles: 1, delivered: 15000 }, 5).earned, null, "a sale from before commission was tracked: unknown, not zero");
  assert.equal(sanitizeClaink({ status: "active", miracles: 0 }, 5).earned, 0); assert.equal(sanitizeClaink({ status: "active", miracles: 2, earned: 3000 }, 5).earned, 3000);
  const junk = sanitizeClaink({ status: "active", strikes: 99, due: -5, billed: "x", strikeLog: "no", last: { kind: "strike", lines: [1, "ok", null], strike: { n: 9, who: 5, hurt: 1 } } }, 5);
  assert.deepEqual([junk.strikes, junk.due, junk.billed, junk.last.lines, junk.last.strike.n], [2, 0, 0, ["ok"], 3]);
});
