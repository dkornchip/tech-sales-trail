// The game on a phone: what a thumb, a small screen and no hover need.
//   node test/e2e/phone.cjs [path/to/index.html]      (default: dist-test/index.html, the test build:
//   the dice are scripted through its hook, which a release build does not have)
//   1. a 360px screen: nothing wider than the screen, a top bar on one line, whole button names, 44px targets
//   2. a hint stays up after a tap, and a blocked button says why
//   3. the numbers follow you down the page; the page returns to the top when the week turns
//   4. the log is a log, the deals are labelled, the announcer's caption covers no control
//   5. sideways: a caption does not widen the page; an ending shows its whole scene and then its paperwork
//   6. the onboarding memo's button comes after the job's three lines
//   7. a stored run that cannot be opened is not played: a dialog says so, fits the phone, and leaves it where it was
//   8. a 320px screen: the wordmark makes way for the top bar's buttons; a tall dialog opens at its first line
//   9. turned on its side: the chips are measured again, and settle (they used to be redrawn on every frame)
// Every screen here is a touch screen (no hover, a coarse pointer). Exits 1 if any check fails.
// (CommonJS on purpose: Playwright only resolves through require() here.)
"use strict";
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

const target = path.resolve(process.argv[2] || "dist-test/index.html");
const AUTOSAVE = "tst-autosave-v4-3", FLAG = "tst-onboarded-v2";      // a crafted run is handed over under the v2.0 key, which is still read
const { readRun } = require("./lib/store.cjs");
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
      if (window.name !== "tst-seeded" && !window.sessionStorage.getItem("__seeded")) {   // once per tab (the tab's name survives a reload)
        window.name = "tst-seeded";
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
  if (!/__TST_RNG/.test(fs.readFileSync(target, "utf8"))) { console.error("phone: " + target + " has no dice hook (it is a release build). Build the test build first: npm run build:test"); process.exit(2); }
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
    const before = (await page.evaluate(readRun)).energy;
    await tap(page, '[data-act="conference"]'); await tap(page, '[data-act="prospect"]'); await tap(page, '[data-act="prospect"]');
    await tap(page, '[data-act="prospect"]');                  // by now there is not the energy for it
    await page.waitForTimeout(400);
    const broke = await text(page, ".hint");
    check("a tap on an action you cannot afford says what it needs", /Prospect blitz/.test(broke || "") && /energy/.test(broke || ""), broke);
    // with the action at the foot of the screen the hint bar is below the fold: the reason must still be on the screen
    await page.evaluate(() => document.querySelector('[data-act="prospect"]').scrollIntoView({ block: "end" })); await page.waitForTimeout(300);
    await page.locator('[data-act="prospect"]').tap({ force: true }); await page.waitForTimeout(450);
    const where = await page.evaluate(() => { const seen = e => { if (!e) return false; const r = e.getBoundingClientRect(); return r.top >= 0 && r.bottom <= window.innerHeight && r.height > 0; }; const h = document.querySelector(".hint"), p = document.querySelector(".peek"); return { hint: seen(h), notice: seen(p), text: p ? p.innerText.replace(/\s+/g, " ").trim() : "" }; });
    check("and when the hint bar is off the screen, the reason is shown in a notice that is on it", !where.hint && where.notice && /Prospect blitz/.test(where.text) && /energy/.test(where.text), JSON.stringify(where));

    /* ---------- 3. the numbers follow you ---------- */
    const state = async () => { const s = await page.evaluate(readRun); return { week: s.week, energy: Math.round(s.energy), stress: Math.round(s.stress), cash: Math.round(s.cash) }; };
    await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(300);
    check("at the top of the page the strip is away", !(await page.evaluate(() => !!document.querySelector(".strip.on"))));
    await page.evaluate(() => document.querySelector('[data-ui="end"]').scrollIntoView({ block: "center" })); await page.waitForTimeout(500);
    const strip = await page.evaluate(() => { const s = document.querySelector(".strip"); const r = s.getBoundingClientRect(); return { on: s.classList.contains("on"), top: Math.round(r.top), right: Math.round(r.right), text: s.innerText.replace(/\s+/g, " ").trim(), sw: s.scrollWidth, cw: s.clientWidth }; });
    const now = await state();
    check("scrolled down to End week, the strip is at the top of the screen", strip.on && strip.top === 0 && strip.sw <= strip.cw, JSON.stringify(strip));
    const cash = (now.cash < 0 ? "−$" : "$") + Math.abs(now.cash).toLocaleString("en-US");
    check("and carries the week, energy, stress and cash as they are", strip.text.indexOf("Week " + now.week) === 0 && strip.text.indexOf(" " + now.energy + " ") > 0 && strip.text.indexOf(" " + now.stress + " ") > 0 && strip.text.endsWith(" " + cash), strip.text + " / " + JSON.stringify(now));
    await page.evaluate(() => { window.__TST_RNG = () => 0.95; });   // a quiet Friday: no event dialog
    // End week at the top of the screen, so the log's first lines are on it when the button is pressed
    await page.evaluate(() => document.querySelector('[data-ui="end"]').scrollIntoView({ block: "start" })); await page.waitForTimeout(300);
    await page.locator('[data-ui="end"]').tap(); await page.waitForTimeout(1200);
    const turned = await page.evaluate(() => ({ y: Math.round(window.scrollY), week: document.querySelector(".quarter-head h2").innerText, strip: !!document.querySelector(".strip.on") }));
    check("when the week turns the page goes back to the top, where the new week is", turned.y <= 2 && turned.week === "Week " + (now.week + 1) && !turned.strip, JSON.stringify(turned));
    const friday = await text(page, ".peek");
    check("and what Friday did is shown, wherever End week was on the screen when it was pressed", !!friday && friday.length > 3, friday);
    // a week that ends in a choice: nothing is shown under the dialog, and the week's lines are shown once it is made
    await page.evaluate(() => { window.__TST_RNG = () => 0.1; });
    await page.waitForTimeout(5200);                           // the last notice has gone
    await tap(page, '[data-ui="end"]'); await page.waitForTimeout(900);
    const under = await page.evaluate(() => ({ dialog: (document.querySelector("dialog[open]") || { getAttribute() { return null; } }).getAttribute("data-dialog"), notice: !!document.querySelector(".peek") }));
    check("while an event's choice is open no notice sits dimmed under it", /^evt:/.test(under.dialog || "") && !under.notice, JSON.stringify(under));
    for (let i = 0; i < 3 && await page.evaluate(() => !!document.querySelector("dialog[open]")); i++) { await page.tap("dialog[open] .d-footer .btn"); await page.waitForTimeout(700); }
    const after = await page.evaluate(() => { const p = document.querySelector(".peek"); return p ? { lines: p.querySelectorAll(".line").length, more: !!p.querySelector(".peek-more") } : null; });
    check("and once it is made, the week's lines are shown with the choice's", !!after && (after.lines >= 2 || after.more), JSON.stringify(after));
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
    await page.evaluate(() => document.querySelector('[data-ui="end"]').scrollIntoView({ block: "center" })); await page.waitForTimeout(500);
    check("sideways too, the numbers follow you down the page", await page.evaluate(() => { const s = document.querySelector(".strip"); return s.classList.contains("on") && Math.round(s.getBoundingClientRect().top) === 0; }));
    await context.close();
    for (const small of [{ width: 640, height: 360 }, { width: 568, height: 320 }]) {
      ({ context, page, errors } = await open(browser, { viewport: small, save: fixture("end-club") }));
      await page.waitForSelector('dialog[open][data-dialog="end:club"]', { timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(1200);
      const sm = await page.evaluate(() => { const d = document.querySelector("dialog[open]"); if (!d) return null; const c = d.querySelector(".cutbox").getBoundingClientRect(), r = d.getBoundingClientRect(), f = d.querySelector(".d-footer").getBoundingClientRect(); return { crt: [Math.round(c.top), Math.round(c.bottom), Math.round(c.right)], dialog: [Math.round(r.top), Math.round(r.bottom)], footerLeft: Math.round(f.left), vh: window.innerHeight }; });
      check("a small phone on its side (" + small.width + "x" + small.height + ") shows an ending's whole scene too", !!sm && sm.crt[0] >= sm.dialog[0] && sm.crt[1] <= sm.dialog[1] && sm.dialog[1] <= sm.vh && sm.footerLeft >= sm.crt[2], JSON.stringify(sm));
      await context.close();
    }
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
    for (const [what, raw] of [["whose week is not a number", '{"week":"x"}'], ["that cannot be read", "{not json"]]) {
      ({ context, page, errors } = await open(browser, { viewport: PHONE, save: raw }));
      await page.waitForTimeout(300);
      const dlg = await box(page, 'dialog[open][data-dialog="recovery"]');
      const words = await text(page, 'dialog[open][data-dialog="recovery"]');
      check(`a stored run ${what} is not played: a dialog says it could not be opened`, !!dlg && /could not be opened/.test(words || ""), (words || "").slice(0, 80));
      check("the dialog fits a phone, with a gutter", !!dlg && dlg.left >= 8 && dlg.right <= PHONE.width - 8 && dlg.bottom <= PHONE.height, JSON.stringify(dlg && { left: Math.round(dlg.left), right: Math.round(dlg.right), bottom: Math.round(dlg.bottom) }));
      if (dlg) { await page.tap('dialog[open] [data-ui="recover-new"]'); await page.waitForTimeout(500); }
      check("and Start a new run starts a quarter", (await text(page, ".quarter-head h2")) === "Week 1" && !(await box(page, "dialog[open]")), await text(page, ".quarter-head h2"));
      check("the stored run is still where it was", await page.evaluate(([k, v]) => window.localStorage.getItem(k) === v, [AUTOSAVE, raw]));
      if (what !== "that cannot be read") await context.close();
    }
    check("no errors", errors.length === 0, errors.join(" | "));
    await context.close();

    /* ---------- 8. a 320px screen ---------- */
    ({ context, page, errors } = await open(browser, { viewport: { width: 320, height: 568 }, first: true }));
    await page.waitForSelector('dialog[open][data-dialog="welcome"]', { timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(600);
    const tall = await page.evaluate(() => { const d = document.querySelector("dialog[open]"); return d ? { top: Math.round(d.scrollTop), content: d.scrollHeight, seen: d.clientHeight } : null; });
    check("a dialog taller than the screen opens at its first line, not scrolled to its button", !!tall && tall.content > tall.seen && tall.top === 0, JSON.stringify(tall));
    await context.close();
    ({ context, page, errors } = await open(browser, { viewport: { width: 320, height: 568 } }));
    const names = await page.evaluate(() => { const ink = document.createRange(); const n = document.querySelector(".brand-name") || document.querySelector(".brand"); ink.selectNodeContents(n); const box = n.getBoundingClientRect(); return { brandRight: Math.round(Math.min(ink.getBoundingClientRect().right, box.right)), rulesLeft: Math.round(document.querySelector('[data-ui="rules"]').getBoundingClientRect().left), page: document.documentElement.scrollWidth, screen: document.documentElement.clientWidth }; });
    check("at 320px the wordmark does not run under the top bar's buttons, and nothing is wider than the screen", names.brandRight <= names.rulesLeft && names.page <= names.screen, JSON.stringify(names));
    check("no errors", errors.length === 0, errors.join(" | "));
    await context.close();

    /* ---------- 9. turned on its side ---------- */
    ({ context, page, errors } = await open(browser, { viewport: { width: 390, height: 844 }, save: fixture("board-24-deals") }));
    const upright = await page.evaluate(() => ({ chips: document.querySelectorAll(".chips .chip").length, more: !!document.querySelector(".chip.more") }));
    await page.setViewportSize({ width: 844, height: 390 }); await page.waitForTimeout(500);
    const turnedSide = await page.evaluate(() => { const box = document.querySelector(".chips").getBoundingClientRect(); const chips = [...document.querySelectorAll(".chips .chip")]; return { chips: chips.length, outside: chips.filter(c => { const r = c.getBoundingClientRect(); return r.bottom > box.bottom + 1 || r.right > box.right + 1; }).length, more: !!document.querySelector(".chip.more") }; });
    check("turned on its side, the chips are measured again: none is cut off, and the rest are under a +N", upright.chips >= 5 && !upright.more && turnedSide.outside === 0 && turnedSide.more && turnedSide.chips < upright.chips, JSON.stringify({ upright, turnedSide }));
    const churn = await page.evaluate(() => new Promise(done => { let n = 0; const mo = new MutationObserver(list => { n += list.length; }); mo.observe(document.querySelector(".foot"), { childList: true, subtree: true, attributes: true, characterData: true }); setTimeout(() => { mo.disconnect(); done(n); }, 600); }));
    check("and then they are left alone (they used to be redrawn on every frame)", churn === 0, churn + " changes in 600 ms");
    const kept = await page.evaluate(() => new Promise(done => { const m = document.querySelector(".chip.more"); m.focus(); setTimeout(() => done(document.activeElement === m && m.isConnected), 400); }));
    check("so the +N chip can keep the focus", kept);
    check("no errors", errors.length === 0, errors.join(" | "));
    await context.close();
  } finally { await browser.close(); }
  const bad = rows.filter(ok => !ok).length;
  console.log(bad ? `\nPHONE FAILED: ${bad} of ${rows.length} checks` : `\nPHONE OK: all ${rows.length} checks passed`);
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
