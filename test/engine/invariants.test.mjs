// What must hold after every move, whatever was pressed: random legal play and the policy bots, over many seeds.
import test from "node:test";
import assert from "node:assert/strict";
import { E, start, legalMoves, play, viewOf, isOver, dialogOf, mulberry, fnv } from "./lib/kit.mjs";
import { POLICIES } from "../sim/lib/policies.mjs";

const between = (x, lo, hi) => Number.isFinite(x) && x >= lo && x <= hi;
const MOODS = ["skeptical", "neutral", "curious", "happy"];
const CK_STATUS = ["ad", "dismissed", "expired", "active", "cancelled", "revoked"];

// Every way a state can be wrong, as text. An empty list is a sound state.
export function violations(eng, s) {
  const out = [], f = (ok, msg) => { if (!ok) out.push(msg); };
  const over = eng.log.isRunOver(s);
  f(Number.isInteger(s.week) && s.week >= 1 && s.week <= 13, `week ${s.week}`);
  f(Number.isInteger(s.slots) && s.slots >= 0 && s.slots <= s.maxSlots && s.maxSlots === 5, `slots ${s.slots}/${s.maxSlots}`);
  for (const k of ["energy", "stress", "manager", "reputation", "product"]) f(between(s[k], 0, 100), `${k} ${s[k]}`);
  for (const k of ["prospect", "discovery", "demo", "negotiate"]) f(between(s.skills[k], 0, 100), `skill ${k} ${s.skills[k]}`);
  f(Number.isFinite(s.cash), `cash ${s.cash}`);
  f(Number.isFinite(s.closedWon) && s.closedWon >= 0, `closedWon ${s.closedWon}`);
  f(Number.isFinite(s.discounts) && s.discounts >= 0, `discounts ${s.discounts}`);
  f(s.quota === 160000, `quota ${s.quota}`);
  // deals
  const ids = new Set(), names = new Set();
  let sum = 0;
  for (const d of s.deals) {
    f(typeof d.id === "string" && !ids.has(d.id), `deal id ${d.id} repeats`); ids.add(d.id);
    f(Number.isInteger(d.stage) && d.stage >= 0 && d.stage <= 4, `deal stage ${d.stage}`);
    f(Number.isInteger(d.value) && d.value > 0, `deal value ${d.value}`);
    f(MOODS.includes(d.mood), `deal mood ${d.mood}`);
    f(Number.isInteger(d.age) && d.age >= 0, `deal age ${d.age}`);
    f(typeof d.account === "string" && d.account.length > 0, "deal account");
    if (s.deals.length <= 50) { f(!names.has(d.account), `two open deals are called ${d.account}`); names.add(d.account); }
    sum += d.value;
  }
  f(s.pipeline === sum, `pipeline ${s.pipeline} is not the sum of the open deals ${sum}`);
  // the log
  f(s.logs.length <= 220, `log holds ${s.logs.length} lines`);
  const logIds = new Set();
  for (const e of s.logs) {
    f(typeof e.id === "string" && !logIds.has(e.id), `log id ${e.id} repeats`); logIds.add(e.id);
    f(typeof e.tag === "string" && e.tag.length > 0, "log line without a tag");
    f(typeof e.msg === "string", `log ${e.tag} has no text`);
    f(e.msg !== "" || e.tag === "week.next", `log ${e.tag} is empty`);
    f(!/undefined|NaN|\[object|\$\{/.test(e.msg + (e.dl || "")), `log ${e.tag} did not render: ${e.msg} ${e.dl || ""}`);
    f(["info", "warn", "bad", "muted"].includes(e.kind), `log kind ${e.kind}`);
  }
  // endings: one at most, with its cause; a live run is solvent and standing
  const flags = ["fired", "burnedOut", "win", "missed", "repo"].filter(k => s[k]);
  f(flags.length <= 1, `two endings at once: ${flags.join(", ")}`);
  if (over) f(typeof s.endCause === "string" && s.endCause.length > 0, "an ending without a cause");
  else {
    f(s.endCause === null, `a live run with end cause ${s.endCause}`);
    f(s.cash > -1500, `a live run at ${s.cash} cash (Collections comes at -1500)`);
    f(s.stress < 100, `a live run at stress ${s.stress}`);
  }
  // clAInk
  const c = s.claink;
  f(c && CK_STATUS.includes(c.status), `claink status ${c && c.status}`);
  if (c) {
    f(Number.isInteger(c.strikes) && c.strikes >= 0 && c.strikes <= 3, `strikes ${c.strikes}`);
    f(c.status !== "active" || c.strikes < 3, "an active seat on three strikes");
    f(c.status !== "revoked" || c.strikes === 3, "a revoked seat without three strikes");
    for (const k of ["due", "billed", "claims", "deploys", "miracles", "fakes", "tokens", "delivered", "claimed"]) f(Number.isFinite(c[k]) && c[k] >= 0, `claink.${k} ${c[k]}`);
    f(c.status === "active" || c.due === 0, `a seat that is ${c.status} still owes ${c.due}`);
    f(c.strikeLog.length === c.strikes || c.status === "ad" || c.status === "dismissed" || c.status === "expired", `strike log ${c.strikeLog.length} for ${c.strikes} strikes`);
  }
  // what is bending the odds: dated effects from known sources, none already spent, and never the old shared number
  f(!("modifiers" in s), "the run still carries the old shared modifiers");
  f(Array.isArray(s.effects), "effects is not a list");
  const sources = new Set();
  for (const e of s.effects || []) {
    f(typeof e.src === "string" && (e.src === "legacy" || eng.effects.EFFECT[e.src]), `effect from an unknown source ${e.src}`);
    f(!sources.has(e.src), `two effects from ${e.src}`); sources.add(e.src);
    f(Number.isInteger(e.from) && Number.isInteger(e.until) && e.from <= e.until, `effect ${e.src} runs ${e.from}..${e.until}`);
    f(over || e.until >= s.week, `effect ${e.src} ended in week ${e.until} and is still carried in week ${s.week}`);
    f(Number.isFinite(e.conv) && Math.abs(e.conv) <= 0.30 && Number.isFinite(e.disc) && e.disc >= 0 && e.disc < 1, `effect ${e.src} is ${e.conv} / ${e.disc}`);
  }
  f(Math.abs(eng.effects.convMod(s)) <= 0.30 + 1e-12, `the odds are bent by ${eng.effects.convMod(s)}`);
  // choices: a list of known ones; a finished run waits on nothing; while one waits, its options are the only moves
  f(Array.isArray(s.pending), "pending is not a list");
  for (const p of s.pending || []) f(p && typeof p.id === "string" && Object.prototype.hasOwnProperty.call(eng.events.EVENTS, p.id), `an unknown choice is waiting: ${p && p.id}`);
  f(!over || (s.pending || []).length === 0, "a finished run is still waiting on a choice");
  const moves = eng.run.legalMoves(s);
  f(over ? moves.length === 0 : moves.length > 0, `${moves.length} legal moves on a ${over ? "finished" : "live"} run`);
  if (!over && (s.pending || []).length) f(moves.every(m => m.t === "choose" && m.event === s.pending[0].id), "something other than the waiting choice is legal");
  // the dice
  const r = s.rng;
  f(r && [r.seed, r.core, r.fl].every(x => Number.isInteger(x) && x >= 0 && x <= 0xFFFFFFFF), "the run has no sound dice");
  return out;
}

// Presses anything that is legal. Ends the week a little more often than chance, so runs go the distance.
const chaos = (v, ctx) => { const pool = v.legal.concat(v.legal.includes("end") ? ["end", "end"] : []); return pool[Math.floor(ctx.rng() * pool.length)]; };

test("after every move of random legal play, the state is sound", async () => {
  const eng = await E();
  let steps = 0, runs = 0; const endings = {};
  for (let seed = 1; seed <= 300; seed++) {
    let g = start(eng, seed); const ctx = { rng: mulberry(fnv("chaos:" + seed)), mem: {} };
    assert.deepEqual(violations(eng, g.s), [], `a new run, seed ${seed}`);
    for (let k = 0; k < 500 && !isOver(eng, g); k++) {
      const legal = legalMoves(eng, g);
      assert.ok(legal.length > 0, `seed ${seed} move ${k}: a live run with nothing to press`);
      const id = chaos(viewOf(eng, g, legal), ctx);
      const r = play(eng, g, id); g = r.g; steps++;
      assert.ok(r.changed, `seed ${seed} move ${k}: ${id} was offered as legal and did nothing`);
      const bad = violations(eng, g.s);
      assert.deepEqual(bad, [], `seed ${seed} move ${k} (${id})`);
    }
    assert.ok(isOver(eng, g), `seed ${seed}: the run ended`);
    assert.equal(dialogOf(eng, g), null, "no dialog is left waiting on a finished run");
    runs++; endings[g.s.endCause] = (endings[g.s.endCause] || 0) + 1;
  }
  assert.ok(steps > 5000 && runs === 300, `${runs} runs, ${steps} moves`);
  assert.ok(Object.keys(endings).length >= 5, "random play reached several different endings: " + JSON.stringify(endings));
});

test("the policy bots only press legal moves, finish every run, and leave sound states", async () => {
  const eng = await E();
  for (const name of Object.keys(POLICIES)) {
    for (let seed = 500; seed < 512; seed++) {
      let g = start(eng, seed); const ctx = { rng: mulberry(fnv("bot:" + name + ":" + seed)), mem: {} };
      for (let k = 0; k < 400 && !isOver(eng, g); k++) {
        const legal = legalMoves(eng, g), id = POLICIES[name](viewOf(eng, g, legal), ctx);
        assert.ok(legal.includes(id), `${name} seed ${seed} move ${k}: pressed ${id}, legal: ${legal.join(" ")}`);
        g = play(eng, g, id).g;
        assert.deepEqual(violations(eng, g.s), [], `${name} seed ${seed} move ${k} (${id})`);
      }
      assert.ok(isOver(eng, g), `${name} seed ${seed}: the run ended within 400 moves`);
    }
  }
});
