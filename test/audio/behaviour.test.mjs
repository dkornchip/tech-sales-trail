// How the game sounds, as behaviour: which line makes which sound, what a batch of lines plays, and what the
// announcer does and never does (talk over itself, say one thing and caption another, speak when muted).
// This replaces the old move-for-move sound comparison with the frozen v1.21 file, which the rules' authorised
// changes ended: these checks describe the sound engine's own contract instead of another build's trace.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { ROOT, soundEngine, overlaps } from "./lib/fakes.mjs";

const load = rel => import(pathToFileURL(path.join(ROOT, rel)).href);
const { LOG } = await load("src/copy/log.js");
const { LINES, HR_LINES, captionOf } = await load("src/copy/pa.js");
const map = await load("src/engine/audio/tagmap.js");
const GOLDEN = path.join(ROOT, "test/audio/golden/routing.json");

const line = (tag, d) => ({ tag, d: d || {} });
const sounds = a => a.plays.map(p => p.name).filter(n => n !== "pa" && n !== "click");

test("routing: every log tag sounds the way the routing table on file says", () => {
  const now = {};
  for (const tag of Object.keys(LOG)) { const r = map.ruleFor(tag, {}); now[tag] = r ? [r.sfx, r.prio, r.say || null] : null; }
  now["close.signed >= 45000"] = "bigClose"; now["act.network whale"] = map.ruleFor("act.network", { size: "whale" }).sfx;
  for (const [id, key] of Object.entries(map.MODAL_SAY)) now["dialog " + id] = key;
  if (process.env.TST_GOLDEN === "update") { fs.mkdirSync(path.dirname(GOLDEN), { recursive: true }); fs.writeFileSync(GOLDEN, JSON.stringify(now, null, 1) + "\n"); return; }
  assert.deepEqual(now, JSON.parse(fs.readFileSync(GOLDEN, "utf8")), "the sound routing changed: if that was meant, TST_GOLDEN=update");
});

test("routing: every announcer line a tag or a dialog asks for exists, and is a list of plain spoken lines", () => {
  for (const [tag, r] of Object.entries(map.TAG_SOUND)) if (r[2]) assert.ok(Array.isArray(LINES[r[2]]) && LINES[r[2]].length, `${tag} asks for "${r[2]}"`);
  for (const key of Object.values(map.MODAL_SAY)) assert.ok(Array.isArray(LINES[key]), key);
  for (const key of ["week5", "week7", "week12", "week13", "filler", "bigClose", "boot", "newrun", "welcome", "club", "fired", "firedOrg", "firedReview", "burnout", "burnoutCaffeine", "missed", "repo", "repoClaink", "hydrate"]) assert.ok(Array.isArray(LINES[key]) && LINES[key].length, key);
  for (const [key, bank] of Object.entries(LINES)) for (const text of bank) {
    assert.ok(/^[\x20-\x7e]+$/.test(text), `${key}: a spoken line is plain ASCII (${text})`);
    assert.ok(!/\bAI\b|clAInk/.test(text), `${key}: speech engines spell out AI and clAInk (${text})`);
  }
});

test("a batch of lines: the week flip always sounds, the most important others join it, in the order they happened", async () => {
  const a = await soundEngine(); a.reset(); globalThis.__TST_FX = () => 0.9;
  a.T.onLogs([line("pay.rent"), line("pay.salary"), line("evt.outage"), line("deal.lost", { n: 1, value: 9000 }), line("evt.freeze"), line("week.fullFunnel"), line("week.next", { week: 3 })], { over: false });
  a.tick(3000);
  assert.deepEqual(sounds(a), ["rent", "lost", "week"], "two others (highest priority first, earlier on a tie) and the flip, in log order");
  assert.equal(a.speech.said.length, 1); assert.ok(LINES.outage.includes(a.speech.said[0].text), "one announcement: the highest-priority line that has one");
  a.reset();
  a.T.onLogs([line("act.prospect"), line("stress.warn", { stress: 71 })], {}); a.tick(3000);
  assert.deepEqual(sounds(a), ["dial", "heartbeat"]);
  a.reset();
  a.T.onLogs([line("act.hail.lean"), line("close.nobody", { src: "hail" }), line("deal.lost", { n: 2, value: 1 }), line("act.hail.torched"), line("stress.warn", { stress: 80 })], {}); a.tick(3000);
  assert.equal(sounds(a).length, 3, "without a week flip, at most three");
  a.reset();
  a.T.onLogs([line("deal.ghost"), line("deal.ghost"), line("deal.ghost")], {}); a.tick(3000);
  assert.deepEqual(sounds(a), ["ghost"], "one sound per distinct preset");
  a.reset();
  a.T.onLogs([line("end.fired.review")], { over: true }); a.tick(3000);
  assert.deepEqual(sounds(a), [], "an ending is scored by its cutscene, not the log");
});

test("a batch of lines: the weeks that matter are announced; a quiet week is filler only when the cosmetic roll says so", async () => {
  const a = await soundEngine();
  for (const [week, key] of [[5, "week5"], [7, "week7"], [12, "week12"], [13, "week13"]]) {
    a.reset(); globalThis.__TST_FX = () => 0.9;
    a.T.onLogs([line("pay.salary"), line("week.next", { week })], {}); a.tick(4000);
    assert.equal(a.speech.said.length, 1, "week " + week); assert.ok(LINES[key].includes(a.speech.said[0].text), `week ${week} says ${key}`);
  }
  a.reset(); globalThis.__TST_FX = () => 0.9;
  a.T.onLogs([line("week.next", { week: 3 })], {}); a.tick(4000);
  assert.equal(a.speech.said.length, 0, "no filler above the roll");
  a.reset(); globalThis.__TST_FX = () => 0.1;
  a.T.onLogs([line("week.next", { week: 3 })], {}); a.tick(4000);
  assert.equal(a.speech.said.length, 1); assert.ok(LINES.filler.includes(a.speech.said[0].text));
  globalThis.__TST_FX = () => 0.9;
});

test("a batch of lines: a big close is announced, a small one is not; a clAInk run voices itself", async () => {
  const a = await soundEngine(); a.reset();
  a.T.onLogs([line("close.signed", { src: "close", n: 2, won: 52000, keep: 6240 })], {}); a.tick(4000);
  assert.deepEqual(sounds(a), ["cash"]); assert.ok(LINES.bigClose.includes(a.speech.said[0].text));
  a.reset();
  a.T.onLogs([line("close.signed", { src: "close", n: 1, won: 12000, keep: 1440 })], {}); a.tick(4000);
  assert.deepEqual(sounds(a), ["cash"]); assert.equal(a.speech.said.length, 0);
  a.reset();
  a.T.onLogs([line("ck.run", { n: 3, tokens: 1 }), line("ck.strike", { n: 1, of: 3, who: "Finance", line: "x" }), line("pay.repoWarn"), line("ck.mgr.warning", { miracle: false, hit: 9 })], {}); a.tick(4000);
  assert.deepEqual(sounds(a), [], "the workspace plays a run beat by beat; the log director leaves the whole batch alone");
  assert.equal(a.speech.said.length, 0);
});

test("the announcer: what is spoken is what is captioned, a moment after the chime", async () => {
  const a = await soundEngine(); a.reset();
  assert.equal(a.T.say("hygiene"), true);
  assert.equal(a.captions.length, 1); assert.equal(a.speech.said.length, 0, "the chime leads the voice");
  assert.deepEqual(a.plays.map(p => p.name), ["pa"]);
  a.tick(721);
  assert.equal(a.speech.said.length, 1);
  const said = a.speech.said[0], cap = a.captions[0];
  assert.ok(LINES.hygiene.includes(said.text)); assert.equal(cap.text, captionOf(said.text)); assert.equal(cap.key, "hygiene"); assert.equal(cap.who, "pa");
  assert.equal(said.voice, "Google UK English Male");
});

test("the announcer: HR reads a termination, in the other voice, and the cause picks the line bank", async () => {
  const a = await soundEngine();
  for (const [key, meta, bank, who, voice] of [["fired", { cause: "qbr" }, "fired", "hr", "Microsoft Aria"], ["fired", { cause: "org" }, "firedOrg", "hr", "Microsoft Aria"], ["fired", { cause: "review" }, "firedReview", "hr", "Microsoft Aria"],
    ["burnout", { cause: "caffeine" }, "burnoutCaffeine", "pa", "Google UK English Male"], ["burnout", { cause: "stress" }, "burnout", "pa", "Google UK English Male"], ["repo", { cause: "claink" }, "repoClaink", "pa", "Google UK English Male"], ["repo", { cause: "repo" }, "repo", "pa", "Google UK English Male"]]) {
    a.reset(); a.T.say(key, { meta, force: true }); a.tick(800);
    assert.equal(a.speech.said.length, 1, key); assert.ok(LINES[bank].includes(a.speech.said[0].text), `${key} / ${meta.cause} reads from ${bank}`);
    assert.equal(a.captions[0].who, who); assert.equal(a.speech.said[0].voice, voice);
  }
  assert.deepEqual(LINES.fired, HR_LINES);
});

test("the announcer never talks over itself: a line inside the cooldown, or while one is being spoken, is dropped", async () => {
  const a = await soundEngine(); a.reset();
  assert.equal(a.T.say("hygiene", { cooldown: 6000 }), true);
  assert.equal(a.T.say("cash", { cooldown: 6000 }), false, "inside the cooldown");
  a.tick(6100);
  a.T.say("fired", { force: true }); a.tick(800);                     // a long HR line is now being spoken
  const speaking = a.speech.said[a.speech.said.length - 1];
  assert.ok(speaking.until > a.now(), "still speaking");
  assert.equal(a.T.say("cash", { cooldown: 1 }), false, "busy: dropped, not queued");
  a.tick(30000);
  assert.equal(overlaps(a.speech.said).length, 0);
  assert.equal(a.captions.length, a.speech.said.length, "a dropped line leaves no caption either");
});

test("the announcer: a forced line cuts the one before it off first; hush drops a line that was queued", async () => {
  const a = await soundEngine(); a.reset();
  a.T.say("fired", { force: true }); a.tick(800);
  a.T.say("club", { force: true }); a.tick(800);
  assert.equal(a.speech.said.length, 2); assert.ok(a.speech.said[0].cut !== null, "the first was cut");
  assert.equal(overlaps(a.speech.said).length, 0);
  a.reset();
  a.T.say("hygiene"); a.T.hush(); a.tick(5000);
  assert.equal(a.speech.said.length, 0, "a queued line does not speak after hush (New run, Load)");
});

test("sound off or announcer off: nothing is spoken, and the caption is the announcement, line by line in turn", async () => {
  const a = await soundEngine();
  for (const off of ["sound", "voice"]) {
    a.reset(); if (off === "sound") a.T.setOn(false); else a.T.setVoice(false);
    const seen = [];
    for (let i = 0; i < LINES.filler.length + 1; i++) { a.T.say("filler", { cooldown: 1 }); a.tick(50); seen.push(a.captions[a.captions.length - 1].text); }
    assert.equal(a.speech.said.length, 0, off + " off: silent");
    // (the turn carries on from wherever earlier lines left it: what matters is that it walks the bank in order)
    const bank = LINES.filler.map(captionOf), at = bank.indexOf(seen[0]);
    assert.ok(at >= 0);
    assert.deepEqual(seen, seen.map((_, i) => bank[(at + i) % bank.length]), "taken in turn, not drawn, and round again");
  }
  a.reset(); a.T.setOn(false);
  a.T.onLogs([line("act.prospect"), line("week.next", { week: 5 })], {}); a.tick(3000);
  assert.deepEqual(a.plays, [], "muted: no sound effect plays");
  assert.equal(a.captions.length, 1); assert.equal(a.captions[0].key, "week5");
});

test("captions off: lines are spoken and not captioned; with sound off as well, nothing happens at all", async () => {
  const a = await soundEngine(); a.reset(); a.T.setCaptions(false);
  assert.equal(a.T.say("hygiene"), true); a.tick(800);
  assert.equal(a.speech.said.length, 1); assert.equal(a.captions.length, 0);
  a.reset(); a.T.setCaptions(false); a.T.setOn(false);
  assert.equal(a.T.say("hygiene"), false); a.tick(800);
  assert.equal(a.speech.said.length, 0); assert.equal(a.captions.length, 0);
});

test("a dialog opening plays its cue and its line", async () => {
  const a = await soundEngine();
  for (const [id, key] of Object.entries(map.MODAL_SAY)) {
    a.reset(); a.T.onModal(id); a.tick(900);
    assert.ok(a.plays.some(p => p.name === "modal"), id);
    assert.ok(LINES[key].includes(a.speech.said[0].text), `${id} says ${key}`);
  }
});

test("a whole quarter of real log lines: never two lines at once, every spoken line captioned as spoken, sound on every move", async () => {
  const a = await soundEngine();
  const { loadEngine, playRun, mulberry } = await load("test/sim/lib/harness.mjs");
  const { POLICIES } = await load("test/sim/lib/policies.mjs");
  const eng = await loadEngine(ROOT, "working tree");
  let batches = 0, spoken = 0;
  for (const [name, seed] of [["balanced", 3], ["claink", 9], ["risk", 5], ["conference", 6], ["novice", 7]]) {
    a.reset(); const pace = mulberry(seed);
    playRun(eng, seed, POLICIES[name], { salt: name, onStep(g, id, r) {
      if (r.logs.length) { a.T.onLogs(r.logs, { over: eng.log.isRunOver(r.g.s) }); batches++; }
      const d = r.g.dialog || (r.g.s.pending && r.g.s.pending[0]); if (d && id.indexOf("dlg:") !== 0) a.T.onModal(d.id);
      a.tick(200 + Math.floor(pace() * 5000));           // a player's pace: sometimes faster than a line is long
    } });
    a.tick(20000);
    assert.equal(overlaps(a.speech.said).length, 0, `${name}: two lines at once`);
    assert.ok(a.speech.said.every(s => !s.overlapped), `${name}: a line was started while another was being spoken`);
    for (const s of a.speech.said) assert.ok(a.captions.some(c => c.text === captionOf(s.text) && c.at <= s.at), `${name}: "${s.text}" was spoken without its caption`);
    assert.equal(a.captions.length, a.speech.said.length, `${name}: as many captions as spoken lines`);
    spoken += a.speech.said.length;
    assert.ok(a.plays.length > 20, `${name}: the run made sound`);
  }
  assert.ok(batches > 200 && spoken > 10, `${batches} batches, ${spoken} lines`);
});
