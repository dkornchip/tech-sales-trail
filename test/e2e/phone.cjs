// The game on a phone: what a thumb, a small screen and no hover need.
//   node test/e2e/phone.cjs [path/to/index.html]      (default: dist/index.html)
//   1. a 360px screen: nothing wider than the screen, a top bar on one line, whole button names, 44px targets
//   2. a hint stays up after a tap, and a blocked button says why
//   3. the numbers follow you down the page; the page returns to the top when the week turns
//   4. the log is a log, the deals are labelled, the announcer's caption covers no control
//   5. sideways: a caption does not widen the page; an ending shows its whole scene and then its paperwork
//   6. the onboarding memo's button comes after the job's three lines
//   7. a stored run that is not a run goes to the recovery page; one that cannot be read says so
// Every screen here is a touch screen (no hover, a coarse pointer). Exits 1 if any check fails.
// (CommonJS on purpose: Playwright only resolves through require() here.)
"use strict";
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

const target = path.resolve(process.argv[2] || "dist/index.html");
const AUTOSAVE = "tst-autosave-v4-3", FLAG = "tst-onboarded-v2";
const FIXTURES = path.join(__dirname, "../saves/fixtures/generated");
const rows = [];
const check = (name, ok, detail) => { rows.push(!!ok); console.log("  " + (ok ? "ok  " : "FAIL") + "  " + name + (detail ? "  (" + detail + ")" : "")); return !!ok; };
const SMALL = { width: 360, height: 640 }, PHONE = { width: 390, height: 664 }, SIDEWAYS = { width: 750, height: 342 };

// o: { viewport, save (raw text for the autosave), first (a brand-new player: the first day is shown) }
async function open(browser, o) {
  const context = await browser.newContext({ viewport: o.viewport, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await context.addInitScript(([save, first, key, flag]) => {
    try {
      window.sessionStorage.setItem("tst-booted", "1");
      if (!window.sessionStorage.getItem("__seeded")) {
        if (!first) window.localStorage.setItem(flag, "1");
        if (save !== null) window.localStorage.setItem(key, save);
        window.sessionStorage.setItem("__seeded", "1");
      }
    } catch (e) {}
  }, [o.save === undefined ? null : o.save, !!o.first, AUTOSAVE, FLAG]);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(String(e).slice(0, 200)));
  await page.goto(pathToFileURL(target).href);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  return { context, page, errors };
}
const fixture = name => fs.readFileSync(path.join(FIXTURES, name + ".json"), "utf8").trim();
const tap = async (page, sel) => { const b = page.locator(sel).first(); await b.scrollIntoViewIfNeeded(); await page.waitForTimeout(120); await b.tap({ force: true }); await page.waitForTimeout(350); };
const box = (page, sel) => page.evaluate(s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; }, sel);
const text = (page, sel) => page.evaluate(s => { const e = document.querySelector(s); return e ? e.innerText.replace(/\s+/g, " ").trim() : null; }, sel);
const wide = page => page.evaluate(() => ({ page: document.documentElement.scrollWidth, screen: document.documentElement.clientWidth }));

(async () => {
  if (!fs.existsSync(target)) { console.error("phone: no such file: " + target); process.exit(2); }
  console.log("phone: " + target);
  const browser = await chromium.launch();
  try {
    /* ---------- 1. a 360px screen ---------- */
    let { context, page, errors } = await open(browser, { viewport: SMALL, save: fixture("board-24-deals") });
    let w = await wide(page);
    check("at 360px nothing is wider than the screen", w.page <= w.screen, w.page + " vs " + w.screen);
    const bar = await page.evaluate(() => ["rules", "sound", "settings"].map(u => { const r = document.querySelector('[data-ui="' + u + '"]').getBoundingClientRect(); return { u, w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top), bottom: Math.round(r.bottom) }; }));
    check("the top bar's three controls are on one line, inside the bar, and a thumb's size", bar.every(b => b.h >= 44 && b.h <= 48 && b.w >= 44 && b.top >= 0 && b.bottom <= 48), JSON.stringify(bar));
    const cut = await page.evaluate(() => [...document.querySelectorAll(".action .title")].filter(t => t.scrollWidth > t.clientWidth + 1).map(t => t.textContent));
    check("no action's name is cut short", cut.length === 0, cut.join(", "));
    const small = await page.evaluate(() => [...document.querySelectorAll('.foot .btn, .menu-row, .topbar .linkbtn, .iconbtn')].filter(e => e.getBoundingClientRect().height < 44).map(e => e.className + " " + Math.round(e.getBoundingClientRect().height)));
    check("the buttons a thumb presses are at least 44px tall", small.length === 0, small.join(", "));
    const chips = await page.evaluate(() => ({ shown: document.querySelectorAll(".chips .chip").length, folded: !!document.querySelector(".chip.more") }));
    check("every status chip is shown; none is folded into a +N", chips.shown >= 5 && !chips.folded, JSON.stringify(chips));
    check("no errors", errors.length === 0, errors.join(" | "));
    await context.close();

    /* ---------- 2. hints by touch ---------- */
    ({ context, page, errors } = await open(browser, { viewport: PHONE }));
    await tap(page, '[data-ui="hail"]');                       // a new run has nothing to throw a Hail Mary at
    await page.waitForTimeout(500);
    const why = await text(page, ".hint");
    check("a tap on a blocked button leaves its reason in the hint bar", /Hail Mary/.test(why || "") && /proposal|closing/.test(why || ""), why);
    const dim = await page.evaluate(() => { const b = document.querySelector('[data-ui="hail"]'), e = document.querySelector('[data-ui="rules"]'); return { hail: getComputedStyle(b).color, text: getComputedStyle(document.querySelector(".quarter-head h2")).color }; });
    check("and a blocked button is drawn dimmer than the text", dim.hail !== dim.text, JSON.stringify(dim));
    const before = await page.evaluate(k => JSON.parse(window.localStorage.getItem(k) || "{}").energy, AUTOSAVE);
    await tap(page, '[data-act="conference"]'); await tap(page, '[data-act="prospect"]'); await tap(page, '[data-act="prospect"]');
    await tap(page, '[data-act="prospect"]');                  // by now there is not the energy for it
    await page.waitForTimeout(400);
    const broke = await text(page, ".hint");
    check("a tap on an action you cannot afford says what it needs", /Prospect blitz/.test(broke || "") && /energy/.test(broke || ""), broke);

    /* ---------- 3. the numbers follow you ---------- */
    const state = () => page.evaluate(k => { const s = JSON.parse(window.localStorage.getItem(k)); return { week: s.week, energy: Math.round(s.energy), stress: Math.round(s.stress), cash: Math.round(s.cash) }; }, AUTOSAVE);
    await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(300);
    check("at the top of the page the strip is away", !(await page.evaluate(() => !!document.querySelector(".strip.on"))));
    await page.evaluate(() => document.querySelector('[data-ui="end"]').scrollIntoView({ block: "center" })); await page.waitForTimeout(500);
    const strip = await page.evaluate(() => { const s = document.querySelector(".strip"); const r = s.getBoundingClientRect(); return { on: s.classList.contains("on"), top: Math.round(r.top), right: Math.round(r.right), text: s.innerText.replace(/\s+/g, " ").trim(), sw: s.scrollWidth, cw: s.clientWidth }; });
    const now = await state();
    check("scrolled down to End week, the strip is at the top of the screen", strip.on && strip.top === 0 && strip.sw <= strip.cw, JSON.stringify(strip));
    check("and carries the week, energy, stress and cash as they are", strip.text.indexOf("Week " + now.week) === 0 && strip.text.indexOf(" " + now.energy + " ") > 0 && strip.text.indexOf(" " + now.stress + " ") > 0, strip.text + " / " + JSON.stringify(now));
    await page.evaluate(() => { Math.random = () => 0.95; });   // a quiet Friday: no event dialog
    await tap(page, '[data-ui="end"]'); await page.waitForTimeout(1200);
    const turned = await page.evaluate(() => ({ y: Math.round(window.scrollY), week: document.querySelector(".quarter-head h2").innerText, strip: !!document.querySelector(".strip.on") }));
    check("when the week turns the page goes back to the top, where the new week is", turned.y <= 2 && turned.week === "Week " + (now.week + 1) && !turned.strip, JSON.stringify(turned));
    check("no errors", errors.length === 0, errors.join(" | "));
    await context.close();

    /* ---------- 4. the log, the deals, the caption ---------- */
    ({ context, page, errors } = await open(browser, { viewport: PHONE, save: fixture("midrun-seeded") }));
    const log = await box(page, ".activity .scroll");
    check("the activity log has room for more than a line (it used to be a 63px slot)", !!log && log.height >= 200, log ? Math.round(log.height) + "px" : "no log");
    const deals = await page.evaluate(() => { const rowsOf = [...document.querySelectorAll("li.deal")]; const vis = e => !!e && getComputedStyle(e).display !== "none" && e.getBoundingClientRect().width > 0; return { rows: rowsOf.length, named: rowsOf.filter(r => vis(r.querySelector(".stage-name"))).length, odds: rowsOf.filter(r => r.querySelector(".odds").textContent).map(r => r.querySelector(".odds").innerText.replace(/\s+/g, " ").trim()) }; });
    check("every deal names its stage, and odds say that they are odds", deals.rows > 0 && deals.named === deals.rows && deals.odds.length > 0 && deals.odds.every(o => /%\s*odds$/.test(o)), JSON.stringify(deals));
    await page.evaluate(() => window.TST_AUDIO.say("filler")); await page.waitForTimeout(500);
    const cap = await page.evaluate(() => { const c = document.querySelector(".pa-cap"); if (!c) return null; const r = c.getBoundingClientRect(); const at = u => { const b = document.querySelector('[data-ui="' + u + '"]').getBoundingClientRect(); const e = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return !!e && !!e.closest('[data-ui="' + u + '"]'); }; return { top: Math.round(r.top), bottom: Math.round(r.bottom), vh: window.innerHeight, free: ["rules", "sound", "settings"].every(at) }; });
    check("the announcer's caption is at the bottom of the screen and covers none of the top bar's buttons", !!cap && cap.top > cap.vh / 2 && cap.bottom <= cap.vh && cap.free, JSON.stringify(cap));
    check("no errors", errors.length === 0, errors.join(" | "));
    await context.close();

    /* ---------- 5. sideways ---------- */
    ({ context, page, errors } = await open(browser, { viewport: SIDEWAYS, save: fixture("midrun-seeded") }));
    await page.evaluate(() => window.TST_AUDIO.say("filler")); await page.waitForTimeout(500);
    w = await wide(page);
    check("sideways, a caption in the top bar does not make the page wider than the screen", w.page <= w.screen && !!(await text(page, ".pa-cap")), w.page + " vs " + w.screen);
    const side = await page.evaluate(() => [...document.querySelectorAll('.foot .btn, .topbar .linkbtn, .iconbtn')].filter(e => e.getBoundingClientRect().height < 44).map(e => e.className + " " + Math.round(e.getBoundingClientRect().height)));
    check("and its buttons are a thumb's size too", side.length === 0, side.join(", "));
    await context.close();
    ({ context, page, errors } = await open(browser, { viewport: SIDEWAYS, save: fixture("end-club") }));
    await page.waitForSelector('dialog[open][data-dialog="end:club"]', { timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const scene = await page.evaluate(() => { const d = document.querySelector("dialog[open]"); if (!d) return null; const R = e => { const r = e.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right) }; }; return { dialog: R(d), crt: R(d.querySelector(".cutbox")), buttons: [...d.querySelectorAll(".d-footer button")].map(R), vh: window.innerHeight, vw: window.innerWidth }; });
    check("sideways, an ending's whole scene is on the screen", !!scene && scene.crt.top >= scene.dialog.top && scene.crt.bottom <= scene.dialog.bottom && scene.dialog.bottom <= scene.vh, JSON.stringify(scene && { dialog: scene.dialog, crt: scene.crt }));
    check("with its buttons beside it, on the screen and clear of the scene", !!scene && scene.buttons.length >= 1 && scene.buttons.every(b => b.bottom <= scene.vh && b.right <= scene.vw && b.left >= scene.crt.right), JSON.stringify(scene && scene.buttons));
    await tap(page, 'dialog[open] .d-footer .btn.at-start');   // Skip to the end
    await page.waitForTimeout(1600);
    const card = await page.evaluate(() => { const d = document.querySelector("dialog[open]"), b = d.querySelector(".d-body").getBoundingClientRect(); const facts = [...d.querySelectorAll(".end-fact")].map(e => e.getBoundingClientRect()); return { facts: facts.length, seen: facts.filter(r => r.top >= b.top - 1 && r.bottom <= b.bottom + 1).length }; });
    check("and when the scene is over the paperwork is brought into view", card.facts >= 2 && card.seen === card.facts, JSON.stringify(card));
    check("no errors", errors.length === 0, errors.join(" | "));
    await context.close();

    /* ---------- 6. the memo ---------- */
    ({ context, page, errors } = await open(browser, { viewport: SMALL, first: true }));
    await page.waitForSelector('dialog[open][data-dialog="welcome"]', { timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(2200);
    await page.evaluate(() => { const d = document.querySelector("dialog[open]"); if (d) d.scrollTo(0, d.scrollHeight); }); await page.waitForTimeout(200);
    const memo = await page.evaluate(() => { const d = document.querySelector("dialog[open]"); if (!d) return null; const lines = [...d.querySelectorAll(".welcome-lines li")].map(e => e.getBoundingClientRect()), btn = d.querySelector(".d-footer .btn").getBoundingClientRect(), r = d.getBoundingClientRect(); return { lines: lines.length, above: lines.every(l => l.bottom <= btn.top + 1), seen: lines.every(l => l.top >= r.top && l.bottom <= r.bottom), button: btn.bottom <= r.bottom + 1 }; });
    check("the memo's button comes after the three lines that state the job, and all of them can be read", !!memo && memo.lines === 3 && memo.above && memo.seen && memo.button, JSON.stringify(memo));
    check("no errors", errors.length === 0, errors.join(" | "));
    await context.close();

    /* ---------- 7. a stored run that is not a run ---------- */
    ({ context, page, errors } = await open(browser, { viewport: PHONE, save: '{"week":"x"}' }));
    await page.waitForTimeout(300);
    const crash = await box(page, ".crash");
    check('a stored run whose week is not a number goes to the recovery page (it used to play as "Week NaN")', !!crash && !(await text(page, ".quarter-head h2")), JSON.stringify(crash && { left: Math.round(crash.left), right: Math.round(crash.right) }));
    check("whose card keeps a gutter on a phone", !!crash && crash.left >= 12 && crash.right <= PHONE.width - 12);
    if (crash) { await page.tap(".crash button"); await page.waitForTimeout(500); }
    check("and New run starts a quarter from it", (await text(page, ".quarter-head h2")) === "Week 1", await text(page, ".quarter-head h2"));
    await context.close();
    ({ context, page, errors } = await open(browser, { viewport: PHONE, save: "{not json" }));
    await page.waitForTimeout(400);
    const said = await page.evaluate(() => { const t = document.getElementById("tst-toast"); return t && t.classList.contains("show") ? t.textContent : null; });
    check("a stored run that cannot be read starts a new one and says so", (await text(page, ".quarter-head h2")) === "Week 1" && /damaged/.test(said || ""), said);
    check("no errors", errors.length === 0, errors.join(" | "));
    await context.close();
  } finally { await browser.close(); }
  const bad = rows.filter(ok => !ok).length;
  console.log(bad ? `\nPHONE FAILED: ${bad} of ${rows.length} checks` : `\nPHONE OK: all ${rows.length} checks passed`);
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
