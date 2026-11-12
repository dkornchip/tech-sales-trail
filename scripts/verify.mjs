#!/usr/bin/env node
// One command that says whether the build is still the game: npm run verify
//
//   node scripts/verify.mjs [--target <build.html>] [--only step,...] [--driver <name>] [--workers <n>] [--release] [--verbose]
//
// Runs these in order and stops at the first that fails:
//   build        scripts/build.mjs into dist/              (skipped with --target: that file is verified instead)
//   lint-rng     Math.random only where the rules roll     (scripts/lint-rng.mjs)
//   lint-copy    the house style on every string           (scripts/lint-copy.mjs --strict)
//   lint-css     colours and sizes only from the tokens    (scripts/lint-css.mjs --strict)
//   copy-check   every log tag, dialog and line is wired   (test/copy/check.cjs)
//   copy-render  every log line renders, every wording     (test/copy/render.mjs)
//   fonts        the bundled fonts are what the packages give, and cover what the scenes draw (scripts/fonts.mjs --check)
//   notices      THIRD-PARTY-NOTICES.md is current         (scripts/notices.mjs --check)
//   parity       the quick mechanics-parity run set        (test/parity/run.cjs)
//   scenes       every scene, frame by frame and caption by caption, is v1.21's (test/parity/scenes.cjs)
//   fixtures     the save fixtures are what v1.21 writes   (test/saves/generate.cjs --check)
//   saves        every save fixture, both ways in          (test/saves/run.cjs)
//   offline      no network, bundled fonts                 (test/e2e/offline.cjs)
//   firstday     the onboarding memo and the tour          (test/e2e/firstday.cjs)
//   resilience   a held choice, names, ids, damaged saves  (test/e2e/resilience.cjs)
//   phone        a touch screen: hints, the strip, the log, captions, sideways endings  (test/e2e/phone.cjs)
//   keyboard     a whole run with the keyboard only        (test/e2e/keyboard.cjs)
//   layout       one screen, nothing covered or cut off    (test/e2e/layout.cjs)
//   sound        with --release only: the same sounds fire as in v1.21, move by move (test/parity/run.cjs --sound)
//   released     with --release only: the committed ./index.html is exactly what the source builds (scripts/build.mjs --check)
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
const target = targetArg ? path.resolve(targetArg) : path.join(ROOT, "dist", "index.html");
const rel = p => path.relative(ROOT, p) || ".";
const drv = flag => [flag, driver || "next"];

const STEPS = {
  build: { what: "build to dist/", cmd: ["scripts/build.mjs"], skip: targetArg ? `--target ${rel(target)}` : null },
  "lint-rng": { what: "dice only in the rules", cmd: ["scripts/lint-rng.mjs"] },
  parity: { what: "mechanics parity, quick set", cmd: ["test/parity/run.cjs", "--b", target, "--workers", workers, ...drv("--b-driver")] },
  saves: { what: "save compatibility", cmd: ["test/saves/run.cjs", "--b", target, "--workers", workers, ...drv("--b-driver")] },
  offline: { what: "no network, bundled fonts", cmd: ["test/e2e/offline.cjs", target] },
  firstday: { what: "a new player's first day", cmd: ["test/e2e/firstday.cjs", target] },
  resilience: { what: "reloads, damaged saves, names, ids", cmd: ["test/e2e/resilience.cjs", target] },
  phone: { what: "a phone: touch, small screens, sideways", cmd: ["test/e2e/phone.cjs", target] },
  layout: { what: "layout on one screen", cmd: ["test/e2e/layout.cjs", target, "--workers", workers, "--min-font", String(LAYOUT_MIN_FONT), "--expect-fail", LAYOUT_KNOWN.join(","), ...drv("--driver")] },
  keyboard: { what: "keyboard only", cmd: ["test/e2e/keyboard.cjs", target, "--expect-fail", KEYBOARD_KNOWN.join(","), ...drv("--driver")] },
  // about the source, not the built file
  "lint-copy": { what: "house style", cmd: ["scripts/lint-copy.mjs", "--strict"] },
  "lint-css": { what: "stylesheet rules", cmd: ["scripts/lint-css.mjs", "--strict"] },
  "copy-check": { what: "copy is wired", cmd: ["test/copy/check.cjs"] },
  "copy-render": { what: "every line renders", cmd: ["test/copy/render.mjs"] },
  scenes: { what: "the scenes and their captions", cmd: ["test/parity/scenes.cjs", "--b", target] },
  fonts: { what: "bundled fonts", cmd: ["scripts/fonts.mjs", "--check"] },
  notices: { what: "licence notices", cmd: ["scripts/notices.mjs", "--check"] },
  fixtures: { what: "save fixtures are the baseline's", cmd: ["test/saves/generate.cjs", "--check"] },
  // with --release: which sounds fire, move by move, and that the committed ./index.html is exactly what the source builds
  sound: { what: "sound parity, both pinned passes", cmd: ["test/parity/run.cjs", "--b", target, "--workers", workers, "--sound", ...drv("--b-driver")] },
  released: { what: "./index.html is current", cmd: ["scripts/build.mjs", "--check"] }
};
const DEFAULT = ["build", "lint-rng", "lint-copy", "lint-css", "copy-check", "copy-render", "fonts", "notices", "parity", "scenes", "fixtures", "saves", "offline", "firstday", "resilience", "phone", "keyboard", "layout"];
const order = onlyArg ? onlyArg.split(",").map(s => s.trim()).filter(Boolean) : release ? DEFAULT.concat("sound", "released") : DEFAULT;
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
console.log(`verify: ${rel(target)}${driver ? "   driver " + driver : ""}   (${order.join(", ")})`);
let failed = null;
for(const name of order){
  const step = STEPS[name];
  if(step.skip){ results.push({ name, status: "skipped", ms: 0, note: step.skip }); console.log(`  --    ${name.padEnd(11)} skipped (${step.skip})`); continue; }
  if(failed){ results.push({ name, status: "not run", ms: 0, note: `stopped at ${failed.name}` }); continue; }
  if(name !== "build" && !fs.existsSync(target)){ console.error(`verify: ${rel(target)} does not exist`); process.exit(2); }
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
