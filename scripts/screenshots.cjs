#!/usr/bin/env node
// Takes the screenshots the README shows, from the built game, by playing it.
//   node scripts/screenshots.cjs [path/to/index.html] [--out dir]      (defaults: dist/index.html, test-results/screenshots)
// The run is played with a seeded Math.random, so the same build gives the same pictures:
//   main.png      mid-quarter, with clAInk's workspace reporting on a run
//   claink.png    the agent workspace on its own, after that run
//   ending.png    the President's Club ending, once the scene has played and the paperwork is out
//   first-day.png the onboarding memo a new player opens on
// They are written as PNG at twice the CSS size. The README uses WebP copies of them (screenshots/*.webp).
// (CommonJS on purpose: Playwright only resolves through require() here.)
"use strict";
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

const args = process.argv.slice(2);
const outAt = args.indexOf("--out");
const out = path.resolve(outAt >= 0 ? args[outAt + 1] : "test-results/screenshots");
const target = path.resolve(args.find((a, i) => !a.startsWith("--") && i !== outAt + 1) || "dist/index.html");
const AUTOSAVE = "tst-autosave-v4-3";

// Runs in the page before any of its scripts: a seeded Math.random, and (unless it is the first-day shot) a player
// who has been here before.
const seedPage = ([seed, returning]) => {
  let a = seed >>> 0;
  Math.random = () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  try { if (returning) window.localStorage.setItem("tst-onboarded-v2", "1"); } catch (e) {}
};

async function open(browser, { seed = 7, returning = true, width = 1440, height = 900 } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2 });
  await context.addInitScript(seedPage, [seed, returning]);
  const page = await context.newPage();
  await page.goto(pathToFileURL(target).href);
  await page.evaluate(() => document.fonts.ready);
  if (await page.evaluate(() => !!document.getElementById("boot"))) {
    await page.keyboard.press("Enter"); await page.waitForTimeout(300); await page.keyboard.press("Enter");
    await page.waitForFunction(() => !document.getElementById("boot"), null, { timeout: 6000 });
  }
  await page.waitForTimeout(700);
  return { context, page };
}
const state = page => page.evaluate(k => JSON.parse(window.localStorage.getItem(k)), AUTOSAVE);
const press = async (page, sel) => { const el = page.locator(sel).first(); if (await el.count() && await el.getAttribute("aria-disabled") !== "true" && await el.isEnabled()) { await el.click(); await page.waitForTimeout(120); return true; } return false; };
const answer = async page => { for (let i = 0; i < 3; i++) { const b = page.locator("dialog[open] .d-footer .btn").first(); if (!(await b.count())) return; await b.click(); await page.waitForTimeout(250); } };

// One sensible week: rest if tired, work the funnel from the back, then find more leads.
async function week(page) {
  for (let k = 0; k < 5; k++) {
    const s = await state(page);
    if (s.slots <= 0) break;
    const at = n => s.deals.filter(d => d.stage === n).length, late = s.deals.filter(d => d.stage >= 3).length;
    const pick = s.energy < 35 && !s.restedThisWeek ? "recharge" : late && s.energy >= 28 ? "close" : at(2) && s.energy >= 25 ? "propose" : at(1) >= 2 && s.energy >= 28 ? "demo"
      : at(0) >= 2 && s.energy >= 22 ? "discovery" : s.energy >= 30 ? "prospect" : s.energy >= 16 ? "network" : null;
    if (!pick || !(await press(page, `[data-act="${pick}"]`))) break;
    await answer(page);
  }
  await press(page, '[data-ui="end"]');
  await page.waitForTimeout(350);
  await answer(page);
}

(async () => {
  if (!fs.existsSync(target)) { console.error("screenshots: no such file: " + target + " (run npm run build first)"); process.exit(2); }
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  try {
    /* main + clAInk: a seat from week 1, five weeks of work, then a run. Not every seed makes a good picture
       (some get Matt fired, some leave the board empty), so seeds are tried in order until one does. */
    let context, page, seed = 11;
    const over = s => !!(s.fired || s.burnedOut || s.win || s.missed || s.repo);
    for (; seed < 60; seed++) {
      ({ context, page } = await open(browser, { seed }));
      await press(page, ".claink-cta"); await press(page, ".claink-confirm");
      let s = await state(page);
      for (let w = 0; w < 5 && !over(s); w++) { await week(page); s = await state(page); }
      if (!over(s)) {
        await press(page, '[data-act="discovery"]'); await press(page, '[data-act="demo"]');
        await press(page, ".claink-deploy");
        await page.waitForTimeout(5000);                  // the report plays out beat by beat
        await answer(page);
        s = await state(page);
      }
      const good = !over(s) && s.deals.length >= 6 && s.deals.length <= 12 && s.closedWon > 15000 && s.claink.status === "active" && s.claink.strikes === 1 && s.deals.some(d => d.stage >= 3);
      if (good) break;
      await context.close(); context = null;
    }
    if (!context) throw new Error("no seed between 11 and 59 gave a mid-quarter run worth a picture");
    console.log("main: seed " + seed);
    await page.hover('[data-act="close"]');
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(out, "main.png") });
    // the workspace on its own: let it take the height it wants for the picture
    await page.addStyleTag({ content: ".claink-console{max-height:none !important} .deals{display:none} .activity{display:none}" });
    await page.waitForTimeout(200);
    const ck = page.locator(".claink-console").first();
    if (await ck.count()) await ck.screenshot({ path: path.join(out, "claink.png") });
    const mid = await state(page);
    await context.close();

    /* ending: the same run, carried to quota in week 13 */
    const won = Object.assign({}, mid, { week: 13, closedWon: 171300, closedQuarter: 171300, manager: 72, stress: 31, slots: 5, cash: 6240, trip: "Whistler",
      story: Object.assign({ signed: 0, top: null, took: null, n: {} }, mid.story, { signed: Math.max(9, (mid.story && mid.story.signed) || 0), top: (mid.story && mid.story.top) || { account: "Quasar Laundry", value: 48200 } }) });
    ({ context, page } = await open(browser, { seed: 5 }));
    await page.evaluate(([k, v]) => window.localStorage.setItem(k, v), [AUTOSAVE, JSON.stringify(won)]);
    await page.reload(); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(600);
    await press(page, '[data-ui="end"]');
    await page.waitForSelector('dialog[open][data-dialog="end:club"]', { timeout: 5000 });
    await page.waitForSelector(".end-card.is-in", { timeout: 20000 });
    await page.waitForTimeout(900);
    await page.locator("dialog[open]").screenshot({ path: path.join(out, "ending.png") });
    await context.close();

    /* first day: what a new player opens on */
    ({ context, page } = await open(browser, { seed: 3, returning: false, width: 1280, height: 760 }));
    await page.waitForSelector('dialog[open][data-dialog="welcome"]', { timeout: 5000 });
    await page.waitForTimeout(3200);                      // the stamp lands
    await page.screenshot({ path: path.join(out, "first-day.png") });
    await context.close();
  } finally { await browser.close(); }
  for (const f of fs.readdirSync(out).filter(f => f.endsWith(".png"))) console.log(path.join(out, f) + "  " + Math.round(fs.statSync(path.join(out, f)).size / 1024) + " KB");
})().catch(e => { console.error(e); process.exit(1); });
