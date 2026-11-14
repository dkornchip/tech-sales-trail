#!/usr/bin/env node
// One command that says whether the build is still the game: npm run verify
//
//   node scripts/verify.mjs [--target <build.html>] [--only step,...] [--driver <name>] [--workers <n>] [--release] [--verbose]
//
// Two builds are verified. The RELEASE build (dist/index.html) is what ships: it carries no test hook, so it is
// checked by the steps that need none. The TEST build (dist-test/index.html) is the same source with the hooks
// compiled in (scripted dice, a pinned cosmetic stream, the engine handles the harness reads); every step that
// has to script the game runs on it.
//
// Runs these in order and stops at the first that fails:
//   build        scripts/build.mjs into dist/              (skipped with --target: that file is verified instead)
//   build-test   scripts/build.mjs --test into dist-test/  (skipped with --target)
//   lint-rng     Math.random only in the cosmetic stream; test hooks only behind the build flag (scripts/lint-rng.mjs)
//   lint-copy    the house style on every string           (scripts/lint-copy.mjs --strict)
//   lint-css     colours and sizes only from the tokens    (scripts/lint-css.mjs --strict)
//   copy-check   every log tag, dialog and line is wired   (test/copy/check.cjs)
//   copy-render  every log line renders, every wording     (test/copy/render.mjs)
//   fonts        the bundled fonts are what the packages give, and cover what the scenes draw (scripts/fonts.mjs --check)
//   notices      THIRD-PARTY-NOTICES.md is current         (scripts/notices.mjs --check)
//   engine       the rules, in Node: the dice, invariants after every move, golden seeded replays  (test/engine)
//   audio        what the sound engine decides: routing, batching, one voice at a time, captions, mute  (test/audio)
//   sim-smoke    the frozen balance baseline is intact and the simulation kit still measures  (test/sim/smoke.mjs)
//   scenes       every scene's picture, frame by frame, is v1.21's (test/parity/scenes.cjs --art). The captions
//                were rewritten for v2.1 (copydeck §11): their words are held by the copy lint and the deck fixture
//   fixtures     the save fixtures are what v1.21 writes   (test/saves/generate.cjs --check)
//   saves        every save fixture, both ways in: it loads, shows what the manifest says, and plays on  (test/saves/run.cjs --a self)
//   release      the shipped file has no test hook and replays move for move against src/game  (test/e2e/release.cjs)
//   offline      no network, bundled fonts                 (test/e2e/offline.cjs)
//   firstday     the onboarding memo and the tour          (test/e2e/firstday.cjs)
//   resilience   a held choice, names, ids, damaged saves  (test/e2e/resilience.cjs)
//   phone        a touch screen: hints, the strip, the log, captions, sideways endings  (test/e2e/phone.cjs)
//   keyboard     a whole run with the keyboard only        (test/e2e/keyboard.cjs)
//   layout       one screen, nothing covered or cut off    (test/e2e/layout.cjs)
//   released     with --release only: the committed release file (./Tech_Sales_Trail_<major.minor>.html) is exactly
//                what the source builds (scripts/build.mjs --check)
//
// What is NOT here any more, and why. Up to v2.0.1 the build was held, move for move and sound for sound, to the
// frozen v1.21 file (test/parity/run.cjs: the "parity" and "sound" steps). v2.1 changes rules on purpose, so that
// comparison ended at the last commit where it held ("checkpoint P", qa/2.1/evidence/01-checkpoint-P-verify.txt):
// there the seeded dice and the single dispatch were proven to change nothing. From then on the rules are held by
// the engine tests and golden replays, the sounds by the audio tests, and the bundle by the release step. The
// parity harness itself stays: the scenes, the save fixtures and the browser tests are built on it.
// and prints a one-screen summary with timings. Each step's full output is kept in test-results/verify/<step>.log;
// --verbose also streams it.
//
// --only runs just the named steps. "npm run test:layout", "test:saves" and "test:keyboard" are this script with
// --only, so that the lists below are the one place where a known failure would be written down.
//
// --driver names the harness driver for the build (default next: the v2.0 markup, test/parity/drivers/next.cjs).
// The frozen baseline has its own, v121.
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/* ============================================================================================================
 * KNOWN FAILURES. None: the redesign fixed every layout problem that used to be listed here (small type, clAInk's
 * window floating over the log and the deals, the badge row wrapping). If one ever has to be tolerated for a
 * while, list its id here with the reason; a listed id that no longer fails is itself an error, so the list
 * cannot go stale.
 * Ids are  check@fixture@viewport  (a pattern may stop early: "min-font" is that check everywhere).
 * ============================================================================================================ */
const LAYOUT_MIN_FONT = 13;
const LAYOUT_KNOWN = [];
const KEYBOARD_KNOWN = [];

/* ---------------------------------------------------------------- arguments */
const argv = process.argv.slice(2);
const take = flag => { const i = argv.indexOf(flag); if(i < 0) return null; if(i + 1 >= argv.length){ console.error(`${flag} needs a value`); process.exit(2); } return argv.splice(i, 2)[1]; };
const has = flag => { const i = argv.indexOf(flag); if(i < 0) return false; argv.splice(i, 1); return true; };
const targetArg = take("--target"), onlyArg = take("--only"), driver = take("--driver"), workers = take("--workers") || "2";
const verbose = has("--verbose"), release = has("--release");
if(argv.length){ console.error("usage: node scripts/verify.mjs [--target <build.html>] [--only step,...] [--driver <name>] [--workers <n>] [--release] [--verbose]"); process.exit(2); }
// target: the build the scripted steps drive (the test build). shipped: the build the hook-free steps check.
const target = targetArg ? path.resolve(targetArg) : path.join(ROOT, "dist-test", "index.html");
const shipped = targetArg ? path.resolve(targetArg) : path.join(ROOT, "dist", "index.html");
const rel = p => path.relative(ROOT, p) || ".";
const drv = flag => [flag, driver || "next"];

const STEPS = {
  build: { what: "release build to dist/", cmd: ["scripts/build.mjs"], skip: targetArg ? `--target ${rel(target)}` : null },
  "build-test": { what: "test build to dist-test/", cmd: ["scripts/build.mjs", "--test"], skip: targetArg ? `--target ${rel(target)}` : null },
  "lint-rng": { what: "dice only in the rules", cmd: ["scripts/lint-rng.mjs"] },
  engine: { what: "the rules, in Node", cmd: ["scripts/unit.mjs", "engine", "test/engine"] },
  audio: { what: "what the sound engine decides", cmd: ["scripts/unit.mjs", "audio", "test/audio"] },
  "sim-smoke": { what: "the simulation kit and its baseline", cmd: ["test/sim/smoke.mjs"] },
  saves: { what: "save compatibility", cmd: ["test/saves/run.cjs", "--a", "self", "--b", target, "--workers", workers, ...drv("--b-driver")], needs: target },
  release: { what: "no hooks; the bundle is the source", cmd: ["test/e2e/release.cjs", shipped], needs: shipped },
  offline: { what: "no network, bundled fonts", cmd: ["test/e2e/offline.cjs", shipped], needs: shipped },
  firstday: { what: "a new player's first day", cmd: ["test/e2e/firstday.cjs", shipped], needs: shipped },
  resilience: { what: "reloads, damaged saves, names, ids", cmd: ["test/e2e/resilience.cjs", target], needs: target },
  phone: { what: "a phone: touch, small screens, sideways", cmd: ["test/e2e/phone.cjs", target], needs: target },
  layout: { what: "layout on one screen", cmd: ["test/e2e/layout.cjs", target, "--workers", workers, "--min-font", String(LAYOUT_MIN_FONT), "--expect-fail", LAYOUT_KNOWN.join(","), ...drv("--driver")], needs: target },
  keyboard: { what: "keyboard only", cmd: ["test/e2e/keyboard.cjs", target, "--expect-fail", KEYBOARD_KNOWN.join(","), ...drv("--driver")], needs: target },
  // about the source, not the built file
  "lint-copy": { what: "house style", cmd: ["scripts/lint-copy.mjs", "--strict"] },
  "lint-css": { what: "stylesheet rules", cmd: ["scripts/lint-css.mjs", "--strict"] },
  "copy-check": { what: "copy is wired", cmd: ["test/copy/check.cjs"] },
  "copy-render": { what: "every line renders", cmd: ["test/copy/render.mjs"] },
  scenes: { what: "the scenes, frame by frame (pictures; v2.1 rewrote the captions)", cmd: ["test/parity/scenes.cjs", "--art", "--b", target], needs: target },
  fonts: { what: "bundled fonts", cmd: ["scripts/fonts.mjs", "--check"] },
  notices: { what: "licence notices", cmd: ["scripts/notices.mjs", "--check"] },
  fixtures: { what: "save fixtures are the baseline's", cmd: ["test/saves/generate.cjs", "--check"] },
  // with --release: the committed release file is exactly what the source builds
  released: { what: "the release file is current", cmd: ["scripts/build.mjs", "--check"] }
};
const DEFAULT = ["build", "build-test", "lint-rng", "lint-copy", "lint-css", "copy-check", "copy-render", "fonts", "notices", "engine", "audio", "sim-smoke", "scenes", "fixtures", "saves", "release", "offline", "firstday", "resilience", "phone", "keyboard", "layout"];
const order = onlyArg ? onlyArg.split(",").map(s => s.trim()).filter(Boolean) : release ? DEFAULT.concat("released") : DEFAULT;
for(const s of order) if(!STEPS[s]){ console.error(`verify: unknown step ${s}. steps: ${Object.keys(STEPS).join(", ")}`); process.exit(2); }

/* ---------------------------------------------------------------- run */
const logDir = path.join(ROOT, "test-results", "verify");
fs.mkdirSync(logDir, { recursive: true });
const secs = ms => (ms / 1000).toFixed(1) + " s";
// The line of a step's output that says how it went: the last one that reads like a verdict, else the last one.
const verdict = text => {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  const hit = [...lines].reverse().find(l => /\b(OK|FAILED|PASS|FAIL|REPORT|passed|up to date)\b|\b(KB|MB) raw\b/.test(l));
  return (hit || lines[lines.length - 1] || "").replace(/\s+/g, " ");
};

function run(name){
  const step = STEPS[name], log = path.join(logDir, name + ".log");
  return new Promise(resolve => {
    const t0 = Date.now();
    const child = spawn(process.execPath, step.cmd, { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    const on = chunk => { out += chunk; if(verbose) process.stdout.write(chunk); };
    child.stdout.on("data", on); child.stderr.on("data", on);
    child.on("error", e => { out += String(e); });
    child.on("close", code => { fs.writeFileSync(log, out); resolve({ name, code, ms: Date.now() - t0, out, log }); });
  });
}

const results = [];
const t0 = Date.now();
console.log(`verify: ${rel(shipped)}${shipped === target ? "" : " (release) and " + rel(target) + " (test hooks)"}${driver ? "   driver " + driver : ""}   (${order.join(", ")})`);
let failed = null;
for(const name of order){
  const step = STEPS[name];
  if(step.skip){ results.push({ name, status: "skipped", ms: 0, note: step.skip }); console.log(`  --    ${name.padEnd(11)} skipped (${step.skip})`); continue; }
  if(failed){ results.push({ name, status: "not run", ms: 0, note: `stopped at ${failed.name}` }); continue; }
  if(step.needs && !fs.existsSync(step.needs)){ console.error(`verify: ${name} needs ${rel(step.needs)}, which does not exist (run the ${step.needs === shipped && shipped !== target ? "build" : "build-test"} step first)`); process.exit(2); }
  if(verbose) console.log(`\n----- ${name}: node ${step.cmd.map(a => (a.includes(" ") || a.length > 60 ? JSON.stringify(a) : a)).join(" ")}`);
  const r = await run(name);
  const ok = r.code === 0;
  results.push({ name, status: ok ? "ok" : "FAILED", ms: r.ms, note: verdict(r.out), log: r.log });
  console.log(`  ${ok ? "ok    " : "FAILED"} ${name.padEnd(11)} ${secs(r.ms).padStart(8)}`);
  if(!ok) failed = r;
}

if(failed && !verbose){
  const tail = failed.out.trimEnd().split("\n").slice(-45);
  console.log(`\n----- ${failed.name}: the end of its output (all of it: ${rel(failed.log)})`);
  console.log(tail.join("\n"));
  console.log("-----");
}
const w = Math.max(...results.map(r => r.name.length));
console.log("\n  step".padEnd(w + 5) + "result    time      ");
for(const r of results) console.log(`  ${r.name.padEnd(w + 2)}${r.status.padEnd(10)}${(r.ms ? secs(r.ms) : "").padStart(8)}  ${r.note.slice(0, 150)}`);
console.log(`\n${failed ? `VERIFY FAILED at ${failed.name}` : "VERIFY OK"}: ${results.filter(r => r.status === "ok").length}/${order.length} steps passed, ${secs(Date.now() - t0)}` +
  (order.includes("layout") ? `   (layout: ${LAYOUT_KNOWN.length} known-failure patterns, listed in scripts/verify.mjs)` : ""));
process.exit(failed ? 1 : 0);
