// Small promises the game keeps when things go sideways.
//   node test/e2e/resilience.cjs [path/to/index.html]      (default: dist/index.html)
//   1. an End Week choice that was on screen when the page closed is still waiting when it opens again
//   2. two open deals never share an account name, even when the dice pick the same name every time
//   3. ids handed out after a reload never repeat one in the save
//   4. a save that parses but is not a save gets a plain page with a way out, not a blank one
// Exits 1 if any check fails. (CommonJS on purpose: Playwright only resolves through require() here.)
"use strict";
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

const target = path.resolve(process.argv[2] || "dist/index.html");
const AUTOSAVE = "tst-autosave-v4-3", PENDING = "tst-pending-v2", FLAG = "tst-onboarded-v2";
const rows = [];
const check = (name, ok, detail) => { rows.push(!!ok); console.log("  " + (ok ? "ok  " : "FAIL") + "  " + name + (detail ? "  (" + detail + ")" : "")); return !!ok; };

async function open(browser, storage, fixedTime) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  // a returning player in a tab that has already booted: straight to the desk
  await context.addInitScript(([kv, flag]) => {
    try {
      window.sessionStorage.setItem("tst-booted", "1");
      if (!window.sessionStorage.getItem("__seeded")) { window.localStorage.setItem(flag, "1"); for (const k of Object.keys(kv || {})) window.localStorage.setItem(k, kv[k]); window.sessionStorage.setItem("__seeded", "1"); }
    } catch (e) {}
  }, [storage || null, FLAG]);
  const page = await context.newPage();
  if (fixedTime) await page.clock.setFixedTime(fixedTime);
  const errors = [];
  page.on("pageerror", e => errors.push(String(e).slice(0, 200)));
  await page.goto(pathToFileURL(target).href);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  return { context, page, errors };
}
const save = page => page.evaluate(k => { try { return JSON.parse(window.localStorage.getItem(k)); } catch (e) { return null; } }, AUTOSAVE);
const dialog = page => page.evaluate(() => { const d = document.querySelector("dialog[open]"); return d ? d.getAttribute("data-dialog") : null; });
const dice = (page, v) => page.evaluate(x => { Math.random = () => x; }, v);

(async () => {
  if (!fs.existsSync(target)) { console.error("resilience: no such file: " + target); process.exit(2); }
  console.log("resilience: " + target);
  const browser = await chromium.launch();
  try {
    /* ---------- 1. a choice survives a reload ---------- */
    let { context, page, errors } = await open(browser);
    await dice(page, 0.1);                       // at 0.1 the week's first two events fire: inbound leads, then the price cut
    await page.click('[data-ui="end"]');
    await page.waitForSelector('dialog[open]', { timeout: 3000 }).catch(() => {});
    check("an End Week choice opens", await dialog(page) === "evt:competitor", "dialog " + await dialog(page));
    const held = await page.evaluate(k => window.localStorage.getItem(k), PENDING);
    const before = await save(page);
    check("it is kept beside the autosave, with its run and week", !!held && JSON.parse(held).runId === before.runId && JSON.parse(held).week === before.week, held);
    await page.reload(); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(500);
    check("after a reload the same choice is waiting", await dialog(page) === "evt:competitor", "dialog " + await dialog(page));
    const same = await save(page);
    check("and the run is where it was", same.week === before.week && same.cash === before.cash && same.deals.length === before.deals.length);
    await page.click('dialog[open] .d-footer .btn >> nth=0');
    await page.waitForTimeout(300);
    const after = await save(page);
    check("answering it applies the answer", await dialog(page) === null && after.modifiers.discount === 0.2, "discount " + (after.modifiers && after.modifiers.discount));
    check("and nothing is left waiting", await page.evaluate(k => window.localStorage.getItem(k), PENDING) === null);
    await page.reload(); await page.waitForTimeout(500);
    check("another reload brings back no dialog", await dialog(page) === null);
    check("no errors", errors.length === 0, errors.join(" | "));
    await context.close();

    // a held choice from another week, or another run, is not honoured
    const mid = fs.readFileSync(path.join(__dirname, "../saves/fixtures/generated/midrun-seeded.json"), "utf8").trim();
    const midRun = JSON.parse(mid);
    ({ context, page, errors } = await open(browser, { [AUTOSAVE]: mid, [PENDING]: JSON.stringify({ runId: midRun.runId, week: midRun.week + 1, id: "evt:security" }) }));
    check("a choice held for a different week is dropped", await dialog(page) === null && await page.evaluate(k => window.localStorage.getItem(k), PENDING) === null);
    await context.close();
    ({ context, page, errors } = await open(browser, { [AUTOSAVE]: mid, [PENDING]: JSON.stringify({ runId: midRun.runId, week: midRun.week, id: "ck:warning" }) }));
    check("only End Week choices are held, whatever the key says", await dialog(page) === null);
    await context.close();

    /* ---------- 2. no two deals share a name ---------- */
    ({ context, page, errors } = await open(browser));
    await dice(page, 0.5);                       // every name draw now lands on the same name
    for (const a of ["prospect", "network", "cadence"]) { await page.click(`[data-act="${a}"]`); await page.waitForTimeout(120); }
    let s = await save(page);
    const names = s.deals.map(d => d.account);
    check("with the dice stuck, several deals were still created", names.length >= 4, names.length + " deals");
    check("and no two of them share an account name", new Set(names).size === names.length, names.join(", "));
    check("no errors", errors.length === 0, errors.join(" | "));
    await context.close();

    /* ---------- 3. ids after a reload ---------- */
    ({ context, page, errors } = await open(browser, null, new Date("2026-03-02T09:00:00Z")));   // a stopped clock: ids differ only by their counter
    await page.click('[data-act="prospect"]'); await page.waitForTimeout(150);
    await page.reload(); await page.waitForTimeout(400);
    await page.click('[data-act="network"]'); await page.waitForTimeout(150);
    s = await save(page);
    const ids = s.deals.map(d => d.id).concat(s.logs.map(l => l.id));
    check("ids handed out after a reload do not repeat ids in the save", new Set(ids).size === ids.length && ids.length >= 4, ids.length + " ids, " + new Set(ids).size + " distinct");
    await context.close();

    /* ---------- 4. a save that is not a save ---------- */
    const broken = JSON.stringify({ week: 3, deals: "nope", logs: 7, skills: null });
    ({ context, page, errors } = await open(browser, { [AUTOSAVE]: broken }));
    await page.waitForTimeout(300);
    const crash = await page.evaluate(() => { const c = document.querySelector(".crash"); return c ? { text: c.textContent, button: !!c.querySelector('[data-ui="crash-new"]') } : null; });
    check("a damaged save gets a page that says so, not a blank one", !!crash && crash.button && /could not be opened/.test(crash.text), crash ? crash.text.slice(0, 80) : "no .crash element");
    if (crash) {
      await page.click('[data-ui="crash-new"]');
      await page.waitForSelector('[data-act="prospect"]', { timeout: 5000 }).catch(() => {});
      const ok = await page.evaluate(([k]) => ({ desk: !!document.querySelector('[data-act="prospect"]'), aside: window.localStorage.getItem(k + "-set-aside") }), [AUTOSAVE]);
      s = await save(page);
      check("New run starts a fresh quarter", ok.desk && s && s.week === 1 && Array.isArray(s.deals), "week " + (s && s.week));
      check("and the damaged save is set aside, not destroyed", ok.aside === broken);
    }
    await context.close();
  } finally { await browser.close(); }
  const bad = rows.filter(ok => !ok).length;
  console.log(bad ? `\nRESILIENCE FAILED: ${bad} of ${rows.length} checks` : `\nRESILIENCE OK: all ${rows.length} checks passed`);
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
