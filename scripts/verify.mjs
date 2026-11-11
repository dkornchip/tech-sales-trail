#!/usr/bin/env node
// One command that says whether the build is still the game: npm run verify
//
//   node scripts/verify.mjs [--target <build.html>] [--only step,...] [--driver <name>] [--workers <n>] [--verbose]
//
// Runs these in order and stops at the first that fails:
//   build      scripts/build.mjs into dist/              (skipped with --target: that file is verified instead)
//   lint-rng   Math.random only where the rules roll     (scripts/lint-rng.mjs)
//   parity     the quick mechanics-parity run set        (test/parity/run.cjs)
//   saves      every save fixture, both ways in          (test/saves/run.cjs)
//   offline    no network, bundled fonts                 (test/e2e/offline.cjs)
//   layout     one screen, nothing covered or cut off    (test/e2e/layout.cjs)
// and prints a one-screen summary with timings. Each step's full output is kept in test-results/verify/<step>.log;
// --verbose also streams it.
//
// --only also takes the steps that are not part of the default run: keyboard (test/e2e/keyboard.cjs), lint-css,
// lint-copy. "npm run test:layout", "test:saves" and "test:keyboard" are this script with --only, so that the
// lists below are the one place where today's known failures are written down.
//
// --driver names the harness driver for the build (default v121: the original markup). A build with new markup
// brings its own driver, test/parity/drivers/<name>.cjs, and is verified with --driver <name>.
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/* ============================================================================================================
 * KNOWN FAILURES, TODAY. The build is the v1.21 interface, unchanged: these are what the redesign is for.
 * A listed id that fails is reported as known and does not fail the run. Anything else that fails does, and so
 * does a listed id that no longer fails: when something here gets fixed, delete its line.
 * Ids are  check@fixture@viewport  (a pattern may stop early: "min-font" is that check everywhere).
 * ============================================================================================================ */
const LAYOUT_MIN_FONT = 13;
const LAYOUT_KNOWN = [
  // type as small as 9px (clAInk's tier label), 10-11px for most labels: the scale starts at 13
  "min-font",
  // clAInk's window (the ad, the workspace) floats over the activity log
  "log-not-covered@fresh-ad",
  "log-not-covered@board-24",
  "log-not-covered@ck-report",
  // ...and with a full run report in it, over the deal list as well
  "deals-not-covered@ck-report",
  // every status badge at once wraps the badge row: the page then scrolls inside its container on a short screen...
  "page-no-scroll@board-24@1366x768",
  "page-no-scroll@board-24@1280x720",
  "page-no-scroll@board-24@1200x800",
  "page-no-scroll@ck-report@1280x720",
  // ...and End Week ends up below the fold
  "controls-in-viewport@board-24@1280x720",
  "controls-in-viewport@board-24@1200x800"
];
const KEYBOARD_KNOWN = [
  // the boot screen's button is removed while it has focus
  "focus-lost@boot",
  // a held Enter repeats the action, and ends several weeks in a row
  "held-key@enter-on-action",
  "held-key@enter-on-end-week"
];

/* ---------------------------------------------------------------- arguments */
const argv = process.argv.slice(2);
const take = flag => { const i = argv.indexOf(flag); if(i < 0) return null; if(i + 1 >= argv.length){ console.error(`${flag} needs a value`); process.exit(2); } return argv.splice(i, 2)[1]; };
const has = flag => { const i = argv.indexOf(flag); if(i < 0) return false; argv.splice(i, 1); return true; };
const targetArg = take("--target"), onlyArg = take("--only"), driver = take("--driver"), workers = take("--workers") || "2";
const verbose = has("--verbose");
if(argv.length){ console.error("usage: node scripts/verify.mjs [--target <build.html>] [--only step,...] [--driver <name>] [--workers <n>] [--verbose]"); process.exit(2); }
const target = targetArg ? path.resolve(targetArg) : path.join(ROOT, "dist", "index.html");
const rel = p => path.relative(ROOT, p) || ".";
const drv = flag => (driver ? [flag, driver] : []);

const STEPS = {
  build: { what: "build to dist/", cmd: ["scripts/build.mjs"], skip: targetArg ? `--target ${rel(target)}` : null },
  "lint-rng": { what: "dice only in the rules", cmd: ["scripts/lint-rng.mjs"] },
  parity: { what: "mechanics parity, quick set", cmd: ["test/parity/run.cjs", "--b", target, "--workers", workers, ...drv("--b-driver")] },
  saves: { what: "save compatibility", cmd: ["test/saves/run.cjs", "--b", target, "--workers", workers, ...drv("--b-driver")] },
  offline: { what: "no network, bundled fonts", cmd: ["test/e2e/offline.cjs", target] },
  layout: { what: "layout on one screen", cmd: ["test/e2e/layout.cjs", target, "--workers", workers, "--min-font", String(LAYOUT_MIN_FONT), "--expect-fail", LAYOUT_KNOWN.join(","), ...drv("--driver")] },
  // not in the default run
  keyboard: { what: "keyboard only", cmd: ["test/e2e/keyboard.cjs", target, "--expect-fail", KEYBOARD_KNOWN.join(","), ...drv("--driver")] },
  "lint-css": { what: "stylesheet rules (report)", cmd: ["scripts/lint-css.mjs"] },
  "lint-copy": { what: "house style (report)", cmd: ["scripts/lint-copy.mjs"] }
};
const DEFAULT = ["build", "lint-rng", "parity", "saves", "offline", "layout"];
const order = onlyArg ? onlyArg.split(",").map(s => s.trim()).filter(Boolean) : DEFAULT;
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
  if(step.skip){ results.push({ name, status: "skipped", ms: 0, note: step.skip }); console.log(`  --    ${name.padEnd(9)} skipped (${step.skip})`); continue; }
  if(failed){ results.push({ name, status: "not run", ms: 0, note: `stopped at ${failed.name}` }); continue; }
  if(name !== "build" && !fs.existsSync(target)){ console.error(`verify: ${rel(target)} does not exist`); process.exit(2); }
  if(verbose) console.log(`\n----- ${name}: node ${step.cmd.map(a => (a.includes(" ") || a.length > 60 ? JSON.stringify(a) : a)).join(" ")}`);
  const r = await run(name);
  const ok = r.code === 0;
  results.push({ name, status: ok ? "ok" : "FAILED", ms: r.ms, note: verdict(r.out), log: r.log });
  console.log(`  ${ok ? "ok    " : "FAILED"} ${name.padEnd(9)} ${secs(r.ms).padStart(8)}`);
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
