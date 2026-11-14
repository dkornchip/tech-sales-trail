// The words against the rules: every number the copy quotes is the number the rules use, the variant engine keeps
// its promises (the plain line most of the time, never the same sentence twice running, the same run reads the
// same), and the ending card only awards what the run can prove.
import test from "node:test";
import assert from "node:assert/strict";
import { E, craft, move, act, script, unscript, withDice, lines, start, playRun } from "./lib/kit.mjs";

const plain = t => String(t).replace(/[⁠​]/g, "").replace(/ /g, " ").replace(/[−–]/g, "-");
// "+6 reputation, -18 product" -> { reputation: 6, product: -18 }
const deltas = text => Object.fromEntries([...plain(text).matchAll(/([+-]\d+) (manager|product|reputation|stress|energy)/g)].map(m => [m[2], Number(m[1])]));

test("the choices say what they do: reputation, product, odds, duration and the chance a deal walks", async () => {
  const eng = await E(), copy = await import("../../src/copy/events.js");
  assert.deepEqual(copy.WALK, eng.events.SECURITY_WALK, "the walk chances the dialog quotes are the ones the rules roll");
  const base = { week: 4, reputation: 50, product: 60 };
  for (const [event, option, src] of [["evt:security", "own", "securityOwn"], ["evt:security", "spin", "securitySpin"], ["evt:competitor", "hold", "competitorHold"], ["evt:competitor", "match", "competitorMatch"]]) {
    const s = await craft({ ...base, pending: [{ id: event }] });
    const r = withDice([], 0.99, () => eng.run.step(s, { t: "choose", event, option }));
    assert.equal(r.refused, null, event + " " + option);
    const said = copy.EVENT_COPY[event].options[option](), want = deltas(said.effect);
    for (const [k, v] of Object.entries(want)) assert.equal(r.state[k] - s[k], v, `${event} ${option}: ${k} ${v}`);
    for (const k of ["reputation", "product"]) if (!(k in want)) assert.equal(r.state[k], s[k], `${event} ${option}: ${k} is not mentioned and does not move`);
    const fx = eng.effects.EFFECT[src], pp = Math.round(fx.conv * 100);
    assert.ok(plain(said.effect).includes(`${pp > 0 ? "+" : "-"}${Math.abs(pp)} `), `${option}: the odds change is quoted (${pp})`);
    assert.ok(Math.abs(eng.effects.convMod(r.state) - fx.conv) < 1e-9, "and is what the rules applied");
    assert.ok(fx.weeks > 1 ? plain(said.effect).includes(`${fx.weeks} weeks`) : /this week/.test(said.effect), `${option}: the duration is quoted`);
    if (fx.disc) { assert.ok(said.label.includes(`${Math.round(fx.disc * 100)}%`)); assert.equal(eng.effects.discountRate(r.state), fx.disc); }
    if (event === "evt:security") assert.ok(said.effect.includes(`${Math.round(copy.WALK[option] * 100)}% chance to walk`));
  }
});

test("the action hints quote the rules: lunch with leadership, the Hail Mary, the conference, referrals", async () => {
  const eng = await E(), ui = await import("../../src/copy/ui.js"), R = eng.rules;
  // internal politics: the hint's four numbers are what one lunch does to a run with room on every meter
  const s = await craft({ manager: 50, product: 50, reputation: 50, stress: 30, energy: 90 });
  const r = withDice([], 0.99, () => eng.run.step(s, act("politics")));
  const want = deltas(ui.HINT.politics());
  assert.deepEqual(Object.keys(want).sort(), ["manager", "product", "reputation", "stress"]);
  for (const [k, v] of Object.entries(want)) assert.equal(r.state[k] - s[k], v, "politics " + k);
  // the Hail Mary: "Four times in five ... 55%"
  assert.equal(R.HAIL.blast, 0.2); assert.equal(R.HAIL.walk, 0.55);
  assert.match(ui.HINT.hail(2, R.HAIL.blast, R.HAIL.walk), /Four times in five, each remaining late deal then has a 55% chance to walk\./);
  assert.equal(ui.HINT.hail(0, R.HAIL.blast, R.HAIL.walk), "No late-stage deals to rescue.");
  // referrals: the whale chance
  assert.match(ui.HINT.network(0, R.REFERRAL.whale), /roughly a 3% chance of being a whale/);
  // conference: its real cost, and the real chance and size of the bonus
  const c = R.COST.conference, text = plain(ui.HINT.conference(c, R.CONFERENCE_STRESS, R.CONFERENCE_BUZZ, eng.effects.EFFECT.conference.conv));
  for (const bit of [`${c.slots} slots`, `${c.energy} energy`, `+${R.CONFERENCE_STRESS} stress`, `${Math.round(R.CONFERENCE_BUZZ * 100)}% chance of +${Math.round(eng.effects.EFFECT.conference.conv * 100)} pp`]) assert.ok(text.includes(bit), bit + " in: " + text);
});

test("the lead counts the hints promise are the counts the actions give", async () => {
  const eng = await E();
  const seen = { prospect: new Set(), cadence: new Set(), network: new Set(), conference: new Set() };
  for (let seed = 1; seed <= 400; seed++) for (const id of Object.keys(seen)) {
    const s = await craft({ energy: 100, cash: 5000, slots: 5 }, seed);
    const r = eng.run.step(s, act(id));
    assert.equal(r.refused, null, id);
    const line = lines(s, r.state).find(l => l.tag === "act." + id);
    seen[id].add(line.d.n);
  }
  const range = set => [Math.min(...set), Math.max(...set)];
  assert.deepEqual(range(seen.prospect), [1, 5], "prospect: usually 1-4, occasionally a fifth");
  assert.deepEqual(range(seen.cadence), [0, 3], "cadence: 0-3");
  assert.deepEqual(range(seen.network), [1, 2], "referrals: 1-2");
  assert.deepEqual(range(seen.conference), [3, 8], "conference: 3-8");
});

test("the handbook is written from the rules", async () => {
  const eng = await E(), help = await import("../../src/copy/help.js"), R = eng.rules, quarter = await import("../../src/game/quarter.js");
  const s = start(eng, 5).s, v = eng.selectors.handbookFacts(s);
  assert.equal(v.quota, 160000); assert.equal(v.weeks, 13); assert.equal(v.slots, 5); assert.equal(v.conferenceSlots, R.COST.conference.slots);
  assert.deepEqual(v.qbr, { club: quarter.QBR.club, safe: quarter.QBR.safe, floor: quarter.QBR.floor });
  assert.equal(v.reviewsFrom, R.REVIEWS_FROM); assert.equal(v.firingFrom, R.FIRING_FROM); assert.equal(v.relief, R.TUNING.relief > 0);
  assert.equal(v.salary, R.PAY.salary); assert.equal(v.commission, R.PAY.commission); assert.equal(v.rent, R.PAY.rent); assert.deepEqual(v.rentWeeks, R.RENT_WEEKS); assert.equal(v.repoAt, R.CASH.repoAt);
  assert.equal(v.hailBlast, R.HAIL.blast); assert.equal(v.hailWalk, R.HAIL.walk); assert.equal(v.fullFunnel, eng.effects.EFFECT.fullFunnel.conv); assert.equal(v.neglect, eng.effects.EFFECT.neglect.conv);
  assert.equal(v.miracle, eng.claink.CLAINK.MIRACLE_P); assert.equal(v.strikes, eng.claink.CLAINK.STRIKES); assert.equal(v.seat, eng.claink.CLAINK.INSTALL); assert.equal(v.cancelFee, eng.claink.CLAINK.CANCEL);
  const all = plain(help.HELP.flatMap(sec => sec.rows.map(row => (typeof row.body === "function" ? row.body(v) : row.body))).join(" "));
  for (const bit of ["Close $160,000 in 13 weeks", "Reviews start in week 5; dismissal risk starts in week 6", "Healthy pipeline can soften early reviews", "$1,000 salary on Friday; 12% commission", "rent $1,600 weeks 1, 5 and 9",
    "cash reaches -$1,500 or lower", "+6 pp signing odds next week", "gives -6 pp next week", "Four times in five each remaining late-stage deal has a 55% chance to walk", "Recover 15 on Friday", "At 80+ you risk a weekend meltdown",
    "Every shot adds 13 stress on Friday", "offered through week 3", "Pay $500 upfront", "A 20% chance of genuine revenue per run", "Third strike revokes the seat", "cash plus $200-$1,800", "Cancel early for $250", "Week 13 is frozen"])
    assert.ok(all.includes(bit), "the handbook says: " + bit);
  // a rule that is switched off is not described
  R.setTuning({ relief: 0 });
  try { assert.ok(!plain(help.HELP[0].rows[2].body(eng.selectors.handbookFacts(s))).includes("Healthy pipeline")); } finally { R.setTuning(); }
});

test("variants: the plain line most of the time, never the same sentence twice running, and a run reads the same twice", async () => {
  const { render, bandOf } = await import("../../src/copy/engine.js"), { LOG } = await import("../../src/copy/log.js");
  assert.deepEqual([1, 3, 4, 6, 7, 9, 10, 12, 13].map(bandOf), [0, 0, 1, 1, 2, 2, 3, 3, 4]);
  // act.prospect: one plain line and two alternatives, the plain one listed three times
  const p = { n: 2, fx: { energy: -30 } }, counts = {};
  let last = null, repeats = 0;
  for (let k = 0; k < 3000; k++) {
    const r = render(LOG["act.prospect"], p, { week: 2, band: 0, n: k }, "seed-1|act.prospect|" + k, last);
    const text = typeof r === "string" ? r : r.text;
    counts[text] = (counts[text] || 0) + 1; if (text === last) repeats++; last = text;
  }
  const texts = Object.keys(counts);
  assert.equal(texts.length, 3, "three wordings"); assert.equal(repeats, 0, "never the same sentence twice running");
  const base = counts["Cold calls: 2 new leads."] / 3000;
  // listed 3 of 5 times; avoiding an immediate repeat takes some of that back
  assert.ok(base > 0.40 && base < 0.66, "the plain line is the usual one: " + base.toFixed(3));
  // without a previous line to avoid, the plain line is chosen 60% of the time
  let plainCount = 0;
  for (let k = 0; k < 5000; k++) { const r = render(LOG["act.prospect"], p, { week: 2, band: 0, n: k }, "seed-2|act.prospect|" + k, null); if ((r.text || r) === "Cold calls: 2 new leads.") plainCount++; }
  assert.ok(Math.abs(plainCount / 5000 - 0.6) < 0.03, "60% plain: " + (plainCount / 5000).toFixed(3));
  // the same inputs give the same sentence (a reloaded run reads as it did)
  for (let k = 0; k < 50; k++) assert.deepEqual(render(LOG["close.nobody"], { src: "close" }, { week: 8, band: 2, n: k }, "s|close.nobody|" + k, null), render(LOG["close.nobody"], { src: "close" }, { week: 8, band: 2, n: k }, "s|close.nobody|" + k, null));
  // week bands: a "no signatures" line in weeks 1-3 is not the one for weeks 10-12
  const early = new Set(), late = new Set();
  for (let k = 0; k < 200; k++) {
    early.add((render(LOG["close.nobody"], { src: "close" }, { week: 2, band: 0, n: k }, "b|" + k, null).text));
    late.add((render(LOG["close.nobody"], { src: "close" }, { week: 11, band: 3, n: k }, "b|" + k, null).text));
  }
  assert.ok([...early].some(t => /building relationships|aligned in principle/.test(t)), [...early].join(" | "));
  assert.ok([...late].some(t => /requesting visibility|negotiation point/.test(t)), [...late].join(" | "));
  assert.ok(![...late].some(t => /building relationships/.test(t)), "the honeymoon line is not said in the siege");
});

test("two runs from the same seed write the same log, word for word; rewording never moves a roll", async () => {
  const eng = await E(), { POLICIES } = await import("../sim/lib/policies.mjs");
  for (const [name, seed] of [["balanced", 41], ["claink", 9], ["risk", 43]]) {
    const a = playRun(eng, seed, POLICIES[name], { salt: name, keepState: true }), b = playRun(eng, seed, POLICIES[name], { salt: name, keepState: true });
    assert.ok(a.state.logs.length > 20, name + ": a log to compare");
    assert.deepEqual(a.state.logs.map(l => l.msg), b.state.logs.map(l => l.msg), name);
    assert.ok(a.state.logs.every(l => typeof l.msg === "string" && !/undefined|NaN|\[object/.test(l.msg + (l.dl || ""))), name + ": every line rendered");
  }
});

test("log lines stay inside the deck's budget: 100 characters, 150 for the lines the module names", async () => {
  const eng = await E(), { POLICIES } = await import("../sim/lib/policies.mjs"), { lint } = await import("../../src/copy/log.js");
  const roomy = Object.keys((lint.limits && lint.limits["len-log"]) || {}).map(k => k.replace(/^LOG\./, ""));
  let checked = 0, longest = 0;
  for (const name of ["balanced", "claink-weekly", "risk", "conference", "novice", "referral"]) for (let seed = 60; seed < 75; seed++) {
    const r = playRun(eng, seed, POLICIES[name], { salt: name, keepState: true });
    for (const l of r.state.logs) {
      if (!l.tag) continue;
      const max = roomy.some(k => l.tag === k || l.tag.startsWith(k + ".")) ? 150 : 100;
      checked++; longest = Math.max(longest, l.msg.length);
      assert.ok(l.msg.length <= max, `${l.tag}: ${l.msg.length} characters (limit ${max}): ${l.msg}`);
    }
  }
  assert.ok(checked > 1500, checked + " lines checked, longest " + longest);
});

test("distinctions: only what the run can prove, at most three, and nothing for what an old save cannot vouch for", async () => {
  const eng = await E(), S = eng.selectors, Q = 160000;
  const of = (s, ending) => S.distinctionsOf(s, ending);
  assert.deepEqual(of(await craft({}), "fired"), [], "an ordinary run earns none");
  assert.deepEqual(of(await craft({ repo: true, closedWon: Q }), "repo"), ["americanDream"]);
  assert.deepEqual(of(await craft({ repo: true, closedWon: Q - 1 }), "repo"), [], "a point short of quota is not the dream");
  assert.deepEqual(of(await craft({ burnedOut: true }), "ascension"), ["rightStuff"]); assert.deepEqual(of(await craft({ burnedOut: true }), "meltdown"), []);
  assert.deepEqual(of(await craft({ manager: 100, closedWon: Q - 1 }), "missed"), ["optics"]);
  assert.deepEqual(of(await craft({ manager: 100, closedWon: Q }), "club"), [], "adored and at quota: no optics");
  assert.deepEqual(of(await craft({ manager: 99, closedWon: 0 }), "fired"), []);
  const story = n => ({ v: 2, signed: 0, top: null, took: null, tookLargest: false, reversed: false, n });
  assert.deepEqual(of(await craft({ story: story({ conferences: 3 }) }), "missed"), ["patriot"]);
  assert.deepEqual(of(await craft({ story: story({ conferences: 2 }) }), "missed"), []);
  assert.deepEqual(of(await craft({ story: { ...story({}), tookLargest: true } }), "fired"), ["leader"]);
  // a story begun before v2.1 cannot vouch for conferences or for what the manager took
  assert.deepEqual(of(await craft({ story: { signed: 2, top: null, took: "Acme", n: { conferences: 9 } } }), "fired"), []);
  assert.deepEqual(of(await craft({ story: null }), "fired"), []);
  // digital transformation: a seat was bought, both totals are known, and the bills exceed the commission it earned
  const ck = over => ({ status: "active", billed: 2000, earned: 1500, strikes: 1, ...over });
  assert.deepEqual(of(await craft({ claink: ck() }), "fired"), ["digital"]);
  assert.deepEqual(of(await craft({ claink: ck({ earned: 2000 }) }), "fired"), [], "paid for itself: not awarded");
  assert.deepEqual(of(await craft({ claink: ck({ earned: null }) }), "fired"), [], "an old save's earnings are unknown: not awarded");
  assert.deepEqual(of(await craft({ claink: ck({ status: "dismissed" }) }), "fired"), [], "no seat, no project");
  assert.deepEqual(of(await craft({ claink: ck({ status: "revoked" }) }), "repo"), ["digital"]);
  // the whale: the achievement the run already holds
  assert.deepEqual(of(await craft({ achievements: [{ key: "whale", label: "Whale hunter" }] }), "club"), ["whale"]);
  // never more than three, in the card's order: the ending's own, then risks, then the rest
  const lots = await craft({ repo: true, closedWon: Q, manager: 100, achievements: [{ key: "whale", label: "x" }], claink: ck(), story: { ...story({ conferences: 5 }), tookLargest: true } });
  assert.deepEqual(of(lots, "repo"), ["americanDream", "whale", "digital"]); assert.equal(S.DISTINCTION_MAX, 3);
  // every key the rules can award has words on the card
  const { DISTINCTIONS, VERDICT, ENDINGS } = await import("../../src/copy/endings.js");
  for (const k of ["americanDream", "rightStuff", "whale", "digital", "leader", "optics", "patriot"]) assert.ok(DISTINCTIONS.some(d => d.key === k && d.title && d.sub), k);
  for (const e of ["club", "missed", "fired", "repo", "meltdown", "ascension"]) { assert.ok(VERDICT[e], e + " has a verdict"); assert.ok(ENDINGS[e].body({ closed: 1, cash: -1600, cause: "repo" })); }
  assert.match(DISTINCTIONS.find(d => d.key === "whale").sub((await import("../../src/game/deals.js")).WHALE_PUSH), /\$65,000 in a single qualifying close push/);
});

test("the story notices a reversal, the conferences attended and whether the manager took the largest deal", async () => {
  const story = await import("../../src/game/story.js");
  let st = story.newStory();
  assert.equal(st.v, 2); assert.equal(st.reversed, false);
  st = story.tally(st, "act.conference", { n: 4 }); st = story.tally(st, "act.conference", { n: 3 });
  assert.equal(st.n.conferences, 2);
  assert.equal(story.tally(st, "ck.strike.hurt", { incident: "slop" }).reversed, false, "only a churned customer reverses revenue");
  assert.equal(story.tally(st, "ck.strike.hurt", { incident: "churn" }).reversed, true);
  assert.equal(story.tally(st, "ck.mgr.yoink", { account: "Acme", largest: true }).tookLargest, true);
  assert.equal(story.tally(st, "ck.mgr.yoink", { account: "Acme", largest: false }).tookLargest, false);
  // through a save: kept for a v2 story, absent for an older one
  const back = story.sanitizeStory({ ...st, reversed: true, tookLargest: true });
  assert.equal(back.reversed, true); assert.equal(back.tookLargest, true);
  const old = story.sanitizeStory({ signed: 3, top: null, took: null, n: { shots: 2 } });
  assert.ok(!("reversed" in old) && !("tookLargest" in old) && !("v" in old));
});

test("the churn incident says so to the story, with the damage the rules really did", async () => {
  const eng = await E();
  // seeds are tried until one run closes nothing, does real damage and the damage is a churned customer
  let found = false;
  for (let seed = 1; seed <= 200 && !found; seed++) {
    const g = await craft({ week: 4, closedWon: 40000, closedQuarter: 40000, cash: 6000, claink: { status: "active" } }, seed);
    const r = eng.run.step(g, { t: "ck", op: "deploy" });
    const hurt = lines(g, r.state).find(l => l.tag === "ck.strike.hurt");
    if (hurt && hurt.d.incident === "churn") {
      found = true;
      assert.equal(r.state.story.reversed, true);
      assert.ok(r.state.closedWon < g.closedWon, "revenue really came back");
      const fx = plain(r.state.claink.last.strike.fx);
      assert.ok(fx.includes("$" + (g.closedWon - r.state.closedWon).toLocaleString("en-US")), "the card quotes the amount that came back: " + fx);
    }
  }
  assert.ok(found, "a churn incident occurred within 200 seeds");
});
