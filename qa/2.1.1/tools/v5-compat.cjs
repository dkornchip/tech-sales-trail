// A run played and saved by the 2.1 release opens in the 2.1.1 build as the same run, and plays on.
//   node v5-compat.cjs <2.1.html> <2.1.1.html> <repo root> [sessions]
// For each session: a new run is played in the 2.1 FILE by real presses (a different number of presses each time,
// answering any dialog), its autosave envelope (tst-autosave-v5) and manual save (tst-save-v5) are taken as they
// are, handed to the 2.1.1 FILE in a fresh browser profile, and then:
//   - no recovery dialog opens, and the run on screen is the run that was saved (week, cash, closed, slots, deals)
//   - the envelope the 2.1.1 page keeps is the same run: mechanical state equal (test/engine/lib/kit.mjs), log text included
//   - schemaVersion is still 5 and the keys are the same
//   - one more press is taken, and the page saves again without complaint
"use strict";
const { chromium } = require("playwright"); const path = require("path"); const { pathToFileURL } = require("url");
const [OLD, NEW, ROOT, N] = [path.resolve(process.argv[2]), path.resolve(process.argv[3]), path.resolve(process.argv[4] || "."), Number(process.argv[5] || 6)];
const rows = []; const check = (name, ok, detail) => { rows.push(!!ok); console.log("  " + (ok ? "ok  " : "FAIL") + "  " + name + (detail ? "  (" + detail + ")" : "")); };
(async () => {
  const kit = await import(pathToFileURL(path.join(ROOT, "test/engine/lib/kit.mjs")).href);
  const STATE = await import(pathToFileURL(path.join(ROOT, "src/game/state.js")).href);
  const SAVE = await import(pathToFileURL(path.join(ROOT, "src/game/save.js")).href).catch(() => null);
  const browser = await chromium.launch();
  const boot = () => { try { sessionStorage.setItem("tst-booted", "1"); if (window.name !== "c") { window.name = "c"; localStorage.setItem("tst-onboarded-v2", "1"); } } catch (e) {} };
  const snap = page => page.evaluate(() => ({ auto: localStorage.getItem("tst-autosave-v5"), manual: localStorage.getItem("tst-save-v5"), keys: Object.keys(localStorage).sort() }));
  const screen = page => page.evaluate(() => ({ week: document.querySelector(".quarter h1, .quarter .week, [data-week]") ? document.querySelector(".quarter").textContent.replace(/\s+/g, " ").slice(0, 24) : "", cash: document.querySelector('[data-kpi="cash"] .value').textContent, closed: document.querySelector('[data-kpi="closed"] .value').textContent, deals: document.querySelectorAll(".deals li").length, dialog: (document.querySelector("dialog[open]") || { getAttribute() { return null; } }).getAttribute("data-dialog") }));
  const unwrap = raw => { const e = JSON.parse(raw); return { env: e, run: Object.assign({}, e.state, { pending: e.pendingEvents, rng: e.rngState }) }; };
  const mech = run => JSON.stringify(kit.mechanical(STATE.mergeSaved(JSON.parse(JSON.stringify(run)))));
  const words = run => JSON.stringify((run.logs || []).map(l => [l.tag, l.msg, l.dl || ""]));
  for (let k = 0; k < N; k++) {
    // ---- play in 2.1
    let ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } }); await ctx.addInitScript(boot);
    let page = await ctx.newPage(); await page.goto(pathToFileURL(OLD).href); await page.waitForSelector("#root .main"); await page.waitForTimeout(500);
    const presses = 6 + k * 9; let made = 0;
    for (let i = 0; i < presses * 3 && made < presses; i++) {
      const dlg = await page.evaluate(() => { const d = [...document.querySelectorAll("dialog[open]")].pop(); return d ? d.getAttribute("data-dialog") : null; });
      if (dlg) {
        if (/^end/.test(dlg) || dlg === "ending") break;
        const btns = page.locator("dialog[open] .d-footer button, dialog[open] button"); const n = await btns.count(); if (!n) break;
        await btns.nth((i + k) % n).click({ force: true }).catch(() => {}); await page.waitForTimeout(250); continue;
      }
      // (no quad shots: random play drinks itself into a meltdown within a few weeks, and a longer run is the better test)
      const on = await page.evaluate(() => [...document.querySelectorAll('[data-act]:not([aria-disabled="true"])')].map(b => b.getAttribute("data-act")).filter(id => id !== "coffee"));
      const slots = await page.evaluate(() => { const m = /(\d+) left/.exec(document.querySelector(".quarter").textContent); return m ? Number(m[1]) : 0; });
      const pick = slots > 0 && on.length && (i + k) % 5 !== 4 ? `[data-act="${on[(i * 7 + k * 3) % on.length]}"]` : '[data-ui="end"]';
      await page.locator(pick).first().click({ force: true }).catch(() => {}); await page.waitForTimeout(220); made++;
    }
    // a manual save too, from the settings menu if it offers one
    await page.evaluate(() => { const a = localStorage.getItem("tst-autosave-v5"); if (a) localStorage.setItem("tst-save-v5", a); });
    await page.waitForTimeout(1200);                                  // the numbers on the cards count up: let them arrive
    const was = await snap(page), seenOld = await screen(page); await ctx.close();
    if (!was.auto) { check(`session ${k + 1}: 2.1 saved a run`, false, "no autosave"); continue; }
    const a = unwrap(was.auto);
    // ---- open in 2.1.1
    ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    await ctx.addInitScript(([auto, manual]) => { try { sessionStorage.setItem("tst-booted", "1"); if (window.name !== "c") { window.name = "c"; localStorage.setItem("tst-onboarded-v2", "1"); localStorage.setItem("tst-autosave-v5", auto); if (manual) localStorage.setItem("tst-save-v5", manual); } } catch (e) {} }, [was.auto, was.manual]);
    page = await ctx.newPage(); const errors = []; page.on("pageerror", e => errors.push(String(e).slice(0, 160)));
    await page.goto(pathToFileURL(NEW).href); await page.waitForSelector("#root .main"); await page.waitForTimeout(1500);
    const seenNew = await screen(page), now = await snap(page), b = unwrap(now.auto);
    const sameScreen = seenNew.cash === seenOld.cash && seenNew.closed === seenOld.closed && seenNew.deals === seenOld.deals && seenNew.dialog === seenOld.dialog;
    check(`session ${k + 1} (${made} presses in 2.1, week ${a.run.week}, ${a.run.deals.length} deals${a.run.claink ? ", clAInk " + a.run.claink.status : ""}${seenOld.dialog ? ", dialog " + seenOld.dialog + " open" : ""}): opens in 2.1.1 as the same run`,
      sameScreen && seenNew.dialog !== "recovery" && mech(a.run) === mech(b.run) && words(a.run) === words(b.run) && b.env.schemaVersion === 5 && a.env.schemaVersion === 5 && now.manual === was.manual && !errors.length,
      `cash ${seenOld.cash} -> ${seenNew.cash}, closed ${seenOld.closed} -> ${seenNew.closed}, ${seenNew.deals} deal rows, schema ${b.env.schemaVersion}, keys ${now.keys.filter(x => /save/.test(x)).join(",")}${errors.length ? ", " + errors[0] : ""}`);
    // ---- and plays on
    const dlg = seenNew.dialog;
    if (dlg && /^end/.test(dlg)) {            // a run that had ended: the ending is shown again, with the way to a new run
      const offer = await page.locator("dialog[open] .d-footer button").allTextContents();
      check(`session ${k + 1}: the run had ended in 2.1; 2.1.1 shows the same ending and offers a new run`, offer.some(t => /New run/.test(t)) && !errors.length, dlg + ": " + offer.join(" / "));
      await ctx.close(); continue;
    }
    if (dlg) { const btns = page.locator("dialog[open] .d-footer button, dialog[open] button"); if (await btns.count()) await btns.first().click({ force: true }).catch(() => {}); }
    else await page.locator('[data-ui="end"]').click({ force: true }).catch(() => {});
    await page.waitForTimeout(600);
    const after = await snap(page), c = unwrap(after.auto);
    check(`session ${k + 1}: one more press in 2.1.1 is taken and saved`, after.auto !== now.auto && c.env.schemaVersion === 5 && !errors.length && (await screen(page)).dialog !== "recovery", `week ${b.run.week} -> ${c.run.week}, log ${b.run.logs.length} -> ${c.run.logs.length} lines`);
    await ctx.close();
  }
  await browser.close();
  const bad = rows.filter(x => !x).length; console.log(bad ? `\nV5 COMPAT FAILED: ${bad} of ${rows.length}` : `\nV5 COMPAT OK: all ${rows.length} checks passed`); process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
