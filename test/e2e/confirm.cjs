// The four things the game asks about before doing them, pressed the way a player presses them.
//   node test/e2e/confirm.cjs [path/to/index.html]      (default: dist/index.html, the release build)
//   1. New run: asked while a quarter is in progress (Escape and "Keep playing" change nothing), not on an untouched run
//   2. Hail Mary: asked the first time in a run (button and H key), not after one has been thrown
//   3. Quad shot: asked only when the shot is certain to end the run
//   4. clAInk's offer: the X asks inside the ad; minimizing does not; "Keep" and Escape leave the offer alone
// A "no" must leave the run byte for byte as it was. Exits 1 if any check fails.
// (CommonJS on purpose: Playwright only resolves through require() here.)
"use strict";
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const { readRun } = require("./lib/store.cjs");

const target = path.resolve(process.argv[2] || "dist/index.html");
const LEGACY = "tst-autosave-v4-3", FLAG = "tst-onboarded-v2";       // a crafted run is handed over under the v2.0 key, which is still read
const FIXTURES = path.join(__dirname, "../saves/fixtures/generated");
const rows = [];
const check = (name, ok, detail) => { rows.push(!!ok); console.log("  " + (ok ? "ok  " : "FAIL") + "  " + name + (detail ? "  (" + detail + ")" : "")); return !!ok; };
const fixture = (name, over) => JSON.stringify(Object.assign(JSON.parse(fs.readFileSync(path.join(FIXTURES, name + ".json"), "utf8")), over || {}));

async function open(browser, save) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await context.addInitScript(([save, key, flag]) => {
    try {
      window.sessionStorage.setItem("tst-booted", "1");
      if (window.name !== "tst-seeded") { window.name = "tst-seeded"; window.localStorage.setItem(flag, "1"); if (save !== null) window.localStorage.setItem(key, save); }
    } catch (e) {}
  }, [save === undefined ? null : save, LEGACY, FLAG]);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(String(e).slice(0, 200)));
  page.on("console", m => { if (m.type() === "error") errors.push(m.text().slice(0, 200)); });
  await page.goto(pathToFileURL(target).href);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
  return { context, page, errors };
}
const run = page => page.evaluate(readRun);
// everything about the run except the clock on the save
const print = s => JSON.stringify(s);
const dialog = page => page.evaluate(() => { const d = [...document.querySelectorAll("dialog[open]")].pop(); return d ? { id: d.getAttribute("data-dialog"), text: (d.querySelector(".d-body") || d).innerText.replace(/\s+/g, " ").trim(), focus: document.activeElement && document.activeElement.getAttribute("data-ui") } : null; });
const click = async (page, sel) => { await page.locator(sel).first().click(); await page.waitForTimeout(300); };
const menu = async (page, item) => { await click(page, '[data-ui="settings"]'); await click(page, '[data-ui="' + item + '"]'); };

(async () => {
  if (!fs.existsSync(target)) { console.error("confirm: no such file: " + target); process.exit(2); }
  console.log("confirm: " + target);
  const browser = await chromium.launch();
  try {
    /* ---------- 1. New run ---------- */
    let { context, page, errors } = await open(browser);
    let a = await run(page);
    await menu(page, "newgame");
    let d = await dialog(page), b = await run(page);
    check("an untouched run is replaced without a question", d === null && b.runId !== a.runId && b.week === 1, d ? d.id : "run " + a.runId + " -> " + b.runId);
    await context.close();

    ({ context, page, errors } = await open(browser, fixture("midrun-seeded")));
    a = await run(page);
    await menu(page, "newgame");
    d = await dialog(page);
    check("a quarter in progress asks first, in the approved words", !!d && d.id === "confirm:newRun" && /Start over\? This quarter.s unsaved progress will be lost\./.test(d.text), JSON.stringify(d));
    check("the safe answer has the focus", !!d && d.focus === "confirm-no", d && d.focus);
    check("while it asks, the run is untouched", print(await run(page)) === print(a));
    await page.keyboard.press("Escape"); await page.waitForTimeout(300);
    check("Escape closes the question and changes nothing", (await dialog(page)) === null && print(await run(page)) === print(a));
    await menu(page, "newgame"); await click(page, '[data-ui="confirm-no"]');
    check("Keep playing closes it and changes nothing", (await dialog(page)) === null && print(await run(page)) === print(a));
    await menu(page, "newgame"); await click(page, '[data-ui="confirm-yes"]');
    b = await run(page);
    check("Start over starts a new quarter", (await dialog(page)) === null && b.runId !== a.runId && b.week === 1 && b.closedWon === 0, "week " + b.week);
    check("no errors (new run)", errors.length === 0, errors.join(" | "));
    await context.close();

    /* ---------- 2. Hail Mary ---------- */
    const late = Array.from({ length: 10 }, (_, i) => ({ id: "h" + i, account: "Late Deal " + (i + 1), value: 9000 + i * 500, stage: i % 2 ? 4 : 3, mood: "neutral", probNote: "", age: 1 }));
    const hailRun = fixture("midrun-seeded", { deals: late, pipeline: late.reduce((t, x) => t + x.value, 0), energy: 100, slots: 5, stress: 20 });
    ({ context, page, errors } = await open(browser, hailRun));
    a = await run(page);
    await click(page, '[data-ui="hail"]');
    d = await dialog(page);
    check("the first Hail Mary of a run asks first, in the approved words", !!d && d.id === "confirm:hail" && /This may save the week or destroy the pipeline\. Continue\?/.test(d.text), JSON.stringify(d));
    check("nothing has been thrown yet", print(await run(page)) === print(a));
    await click(page, '[data-ui="confirm-no"]');
    check("Not yet: no Hail Mary, no cost", (await dialog(page)) === null && print(await run(page)) === print(a));
    await page.keyboard.press("h"); await page.waitForTimeout(300);
    d = await dialog(page);
    check("the H key asks the same question", !!d && d.id === "confirm:hail");
    await page.keyboard.press("h"); await page.waitForTimeout(200);
    check("a key pressed behind the question does nothing", print(await run(page)) === print(a) && ((await dialog(page)) || {}).id === "confirm:hail");
    await click(page, '[data-ui="confirm-yes"]');
    b = await run(page);
    const hailTags = s => s.logs.filter(l => /^act\.hail\.(blast|lean)$/.test(l.tag || "")).length;
    check("Throw it: one Hail Mary is thrown", hailTags(b) === hailTags(a) + 1 && b.slots === a.slots - 1, "slots " + a.slots + " -> " + b.slots);
    const over = s => s.fired || s.burnedOut || s.win || s.missed || s.repo;
    const canAgain = await page.evaluate(() => { const h = document.querySelector('[data-ui="hail"]'); return !!h && h.getAttribute("aria-disabled") !== "true"; });
    if (!over(b) && canAgain) {
      await click(page, '[data-ui="hail"]');
      const c = await run(page);
      check("the second Hail Mary of the run is not asked about", ((await dialog(page)) || {}).id !== "confirm:hail" && hailTags(c) === hailTags(b) + 1, "thrown " + hailTags(c));
    } else check("the second Hail Mary of the run is not asked about", true, "not reachable in this run: the first one left nothing to throw at");
    check("no errors (Hail Mary)", errors.length === 0, errors.join(" | "));
    await context.close();

    /* ---------- 3. Quad shot ---------- */
    ({ context, page, errors } = await open(browser, fixture("midrun-seeded", { stress: 20, coffeesThisWeek: 0, slots: 5, cash: 3000 })));
    a = await run(page);
    await click(page, '[data-act="coffee"]');
    b = await run(page);
    check("an ordinary quad shot is not asked about", (await dialog(page)) === null && b.coffeesThisWeek === 1, "shots " + b.coffeesThisWeek);
    await context.close();

    ({ context, page, errors } = await open(browser, fixture("midrun-seeded", { stress: 97, coffeesThisWeek: 0, slots: 5, cash: 3000 })));
    a = await run(page);
    await page.hover('[data-act="coffee"]'); await page.waitForTimeout(250);
    const hint = await page.evaluate(() => { const h = document.querySelector(".hint"); return h ? h.innerText.replace(/\s+/g, " ") : ""; });
    check("the button already says the shot ends the run", /reaches 100 stress and ends the run/.test(hint), hint.slice(0, 120));
    await click(page, '[data-act="coffee"]');
    d = await dialog(page);
    check("a shot that is certain to end the run asks first", !!d && d.id === "confirm:coffee" && /This shot reaches 100 stress and ends the run\./.test(d.text), JSON.stringify(d));
    await click(page, '[data-ui="confirm-no"]');
    check("Put it down: no shot, no cost", (await dialog(page)) === null && print(await run(page)) === print(a));
    await click(page, '[data-act="coffee"]'); await click(page, '[data-ui="confirm-yes"]');
    await page.waitForTimeout(400);
    b = await run(page); d = await dialog(page);
    check("Drink it anyway: the run ends, as it said it would", !!b.burnedOut && !!d && /^end:/.test(d.id), d && d.id);
    check("no errors (quad shot)", errors.length === 0, errors.join(" | "));
    await context.close();

    /* ---------- 4. clAInk's offer ---------- */
    ({ context, page, errors } = await open(browser));
    await page.waitForSelector(".claink-ad", { timeout: 5000 }).catch(() => {});
    a = await run(page);
    check("the offer is on the desk", a.claink.status === "ad" && (await page.locator(".claink-ad").count()) === 1);
    await click(page, ".claink-ad-close");
    let ask = await page.evaluate(() => { const e = document.querySelector('[data-ui="confirm-dismiss"]'); return e ? { text: e.innerText.replace(/\s+/g, " ").trim(), focus: document.activeElement && document.activeElement.getAttribute("data-ui") } : null; });
    check("the X asks inside the ad, in the approved words", !!ask && /Dismiss the offer for this run\? Minimizing keeps it available\./.test(ask.text), JSON.stringify(ask));
    check("Keep has the focus, and no dialog covers the game", !!ask && ask.focus === "confirm-no" && (await dialog(page)) === null);
    check("the offer is still on", print(await run(page)) === print(a));
    await page.keyboard.press("Escape"); await page.waitForTimeout(250);
    const afterEsc = await page.evaluate(() => ({ ask: !!document.querySelector('[data-ui="confirm-dismiss"]'), ad: !!document.querySelector(".claink-ad"), focus: document.activeElement && document.activeElement.className }));
    check("Escape withdraws the question, keeps the ad open and returns the focus to the X", !afterEsc.ask && afterEsc.ad && /claink-ad-close/.test(afterEsc.focus || ""), JSON.stringify(afterEsc));
    await click(page, ".claink-ad-close"); await click(page, '[data-ui="confirm-no"]');
    check("Keep: the offer stays", !(await page.locator('[data-ui="confirm-dismiss"]').count()) && (await run(page)).claink.status === "ad");
    await click(page, ".claink-ad-min");
    check("minimizing asks nothing and keeps the offer", !(await page.locator('[data-ui="confirm-dismiss"]').count()) && (await run(page)).claink.status === "ad" && (await page.locator(".claink-ad.is-mini").count()) === 1);
    await click(page, ".claink-ad-close");
    const pill = await page.evaluate(() => { const e = document.querySelector('[data-ui="confirm-dismiss"]'); if (!e) return null; const r = e.getBoundingClientRect(), y = e.querySelector('[data-ui="confirm-yes"]').getBoundingClientRect(); return { inView: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight, yes: y.width > 20 && y.height > 20 }; });
    check("minimized, the X still asks, and the question fits on screen", !!pill && pill.inView && pill.yes, JSON.stringify(pill));
    await click(page, '[data-ui="confirm-yes"]');
    b = await run(page);
    check("Dismiss: the offer is gone for this run", b.claink.status === "dismissed" && (await page.locator(".claink-ad").count()) === 0, b.claink.status);
    check("and only that changed", b.week === a.week && b.cash === a.cash && b.slots === a.slots && b.energy === a.energy);
    check("no errors (offer)", errors.length === 0, errors.join(" | "));
    await context.close();
  } finally { await browser.close(); }
  const failed = rows.filter(r => !r).length;
  console.log(failed ? `\nCONFIRM FAILED: ${failed} of ${rows.length} checks` : `\nCONFIRM OK: all ${rows.length} checks passed`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
