#!/usr/bin/env node
// One picture of the game in one state: open a build on a run, press a few things, save a screenshot.
// For looking at the game (QA pictures, before-and-after pairs, a visual review). It checks nothing.
//
//   node test/e2e/tools/shot.cjs --out <file.png|.jpg> [options]
//
//   --build <file.html>     the build to open (default dist/index.html). Any build works, a release included.
//   --save <file.json>      a saved run to open on: a bare v2.0.1-style save (test/saves/fixtures/generated/*.json)
//                           or a v2.1 envelope. Every version reads the first; it is handed over as the autosave.
//   --state '<json>'        instead of --save: fields over a default mid-quarter run (test/parity/lib/scenarios.cjs,
//                           save()), e.g. '{"week":6,"cash":900,"energy":20,"deals":[[3,21000,"happy"],[0,6000]]}'.
//                           A deal is [stage 0-4, value, mood, age]; "claink":{"status":"active"} gives a seat.
//   --first                 a new player: the boot screen is skipped, the onboarding memo is not.
//   --size <WxH>            the window (default 1440x900).   --scale <n>  device pixels per CSS pixel (default 1).
//   --touch                 a touch screen (phones, tablets).   --reduced   prefers-reduced-motion.
//   --do <step> ...         steps, in order, after the page is up:
//                             click:<selector>   hover:<selector>   focus:<selector>   key:<Key>   wait:<ms>
//                             scroll:<selector>  (into view)
//   --clip <selector>       only that element.   --full   the whole page, however tall.
//   --eval '<expression>'   also print the value of a JavaScript expression evaluated in the page (as JSON).
//
// Selectors the game offers: [data-act="prospect|cadence|network|discovery|demo|propose|close|conference|crm|recharge|
// coffee|politics"], [data-ui="end|hail|rules|settings"], dialog[open], .claink-ad, .claink-console, .deals, .activity.
// (CommonJS on purpose: Playwright only resolves through require() here.)
"use strict";
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

const argv = process.argv.slice(2);
const flag = name => { const i = argv.indexOf(name); if (i < 0) return false; argv.splice(i, 1); return true; };
const take = name => { const i = argv.indexOf(name); if (i < 0) return null; return argv.splice(i, 2)[1]; };
const many = name => { const i = argv.indexOf(name); if (i < 0) return []; let j = i + 1; while (j < argv.length && !argv[j].startsWith("--")) j++; return argv.splice(i, j - i).slice(1); };
const steps = many("--do");
const out = take("--out"), build = path.resolve(take("--build") || "dist/index.html"), saveFile = take("--save"), stateJson = take("--state");
const [w, h] = (take("--size") || "1440x900").split("x").map(Number), scale = Number(take("--scale") || 1);
const clip = take("--clip"), expr = take("--eval");
const first = flag("--first"), touch = flag("--touch"), reduced = flag("--reduced"), full = flag("--full");
if (!out && !expr) { console.error("usage: node test/e2e/tools/shot.cjs --out <file.png|.jpg> [--build f.html] [--save f.json | --state '<json>' | --first] [--size WxH] [--do click:<sel> ...] (see the header of this file)"); process.exit(2); }
if (!fs.existsSync(build)) { console.error("shot: no such build: " + build); process.exit(2); }

let run = null;
if (saveFile) run = fs.readFileSync(path.resolve(saveFile), "utf8");
else if (stateJson) {
  const { save, D, CK } = require("../../parity/lib/scenarios.cjs");
  const over = JSON.parse(stateJson);
  if (Array.isArray(over.deals)) over.deals = over.deals.map(d => (Array.isArray(d) ? D(d[0], d[1], d[2], d[3]) : d));
  if (over.claink) over.claink = CK(over.claink);
  run = JSON.stringify(save(over));
}
// before the game's first script: past the boot screen; a returning player unless --first; the run as the autosave.
// (An envelope goes under the v2.1 key, a bare run under the key every version reads.)
const opening = ([text, isFirst]) => {
  try {
    window.sessionStorage.setItem("tst-booted", "1");
    if (window.name === "shot") return;
    window.name = "shot";
    if (!isFirst) window.localStorage.setItem("tst-onboarded-v2", "1");
    if (text) window.localStorage.setItem(/"schemaVersion"/.test(text) ? "tst-autosave-v5" : "tst-autosave-v4-3", text);
  } catch (e) {}
};

(async () => {
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: scale, hasTouch: touch, isMobile: touch && w < 700, reducedMotion: reduced ? "reduce" : "no-preference" });
    await context.addInitScript(opening, [run, first]);
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", e => errors.push(String(e).slice(0, 200)));
    await page.goto(pathToFileURL(build).href);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForSelector("#root .main", { timeout: 8000 });
    await page.waitForTimeout(900);
    for (const st of steps) {
      const at = st.indexOf(":"), op = st.slice(0, at), arg = st.slice(at + 1);
      if (op === "click") await page.locator(arg).first().click();
      else if (op === "hover") await page.locator(arg).first().hover();
      else if (op === "focus") await page.locator(arg).first().focus();
      else if (op === "scroll") await page.locator(arg).first().scrollIntoViewIfNeeded();
      else if (op === "key") await page.keyboard.press(arg);
      else if (op === "wait") await page.waitForTimeout(Number(arg));
      else throw new Error("shot: unknown step " + st);
      if (op !== "wait") await page.waitForTimeout(350);
    }
    if (expr) console.log(JSON.stringify(await page.evaluate(expr)));
    if (out) {
      fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
      const opts = Object.assign({ path: path.resolve(out) }, /\.jpe?g$/i.test(out) ? { type: "jpeg", quality: 85 } : {});
      if (clip) await page.locator(clip).first().screenshot(opts);
      else await page.screenshot(Object.assign(opts, { fullPage: full }));
      console.log(out);
    }
    if (errors.length) console.error("page errors: " + errors.join(" | "));
  } finally { await browser.close(); }
})().catch(e => { console.error(String(e && e.message || e)); process.exit(1); });
