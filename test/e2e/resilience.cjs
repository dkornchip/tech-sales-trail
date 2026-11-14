// Small promises the game keeps when things go sideways.
//   node test/e2e/resilience.cjs [path/to/index.html]      (default: dist-test/index.html, the test build:
//   the dice are scripted through its hook, which a release build does not have)
//   1. an End Week choice that was on screen when the page closed is still waiting when it opens again
//   2. two open deals never share an account name, even when the dice pick the same name every time
//   3. ids handed out after a reload never repeat one in the save
//   4. a save that parses but is not a save gets a plain page with a way out, not a blank one
//   5. an ending whose cutscene cannot play still opens, says what happened and shows the paperwork
//   6. a dialog's close event that arrives late does not dismiss a dialog that has been opened since
//   7. on a phone, where the log is a scroll away, what an action did is shown where you are
// Exits 1 if any check fails. (CommonJS on purpose: Playwright only resolves through require() here.)
"use strict";
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

const target = path.resolve(process.argv[2] || "dist-test/index.html");
const AUTOSAVE = "tst-autosave-v4-3", PENDING = "tst-pending-v2", FLAG = "tst-onboarded-v2";
const rows = [];
const check = (name, ok, detail) => { rows.push(!!ok); console.log("  " + (ok ? "ok  " : "FAIL") + "  " + name + (detail ? "  (" + detail + ")" : "")); return !!ok; };

async function open(browser, storage, fixedTime, init, phone) {
  const context = await browser.newContext(phone ? { viewport: { width: 390, height: 664 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1280, height: 720 } });
  if (init) await context.addInitScript(init);
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
// the rules roll window.__TST_RNG in a test build (src/game/rng.js); Math.random is left for the cosmetic stream
const dice = (page, v) => page.evaluate(x => { window.__TST_RNG = () => x; Math.random = () => x; }, v);

(async () => {
  if (!fs.existsSync(target)) { console.error("resilience: no such file: " + target); process.exit(2); }
  if (!/__TST_RNG/.test(fs.readFileSync(target, "utf8"))) { console.error("resilience: " + target + " has no dice hook (it is a release build). Build the test build first: npm run build:test"); process.exit(2); }
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

    // the manual save damaged as well: New run must not bring the same page straight back, and Load must not trap you
    ({ context, page, errors } = await open(browser, { [AUTOSAVE]: broken, "tst-save-v4-3": broken }));
    await page.waitForTimeout(300);
    await page.click('[data-ui="crash-new"]').catch(() => {});
    await page.waitForSelector('[data-act="prospect"]', { timeout: 5000 }).catch(() => {});
    check("with both saves damaged, New run still reaches the desk", await page.evaluate(() => !!document.querySelector('[data-act="prospect"]') && !document.querySelector(".crash")));
    // (since v2.0.1 a saved run that parses but is not a run is refused when it is loaded, the way one that does
    // not parse always was: the player is told, and is at a desk, never on a blank page or the recovery page)
    await page.click('[data-ui="settings"]'); await page.click('[data-ui="load"]'); await page.waitForTimeout(400);
    const afterLoad = await page.evaluate(() => { const t = document.getElementById("tst-toast"); return { crash: !!document.querySelector(".crash"), desk: !!document.querySelector('[data-act="prospect"]'), week: (document.querySelector(".quarter-head h2") || {}).textContent, said: t && t.classList.contains("show") ? t.textContent : "" }; });
    check("loading the damaged manual save says so and leaves you at a desk", afterLoad.desk && !afterLoad.crash && /damaged/.test(afterLoad.said) && afterLoad.week === "Week 1", JSON.stringify(afterLoad));
    await context.close();

    /* ---------- 5. an ending without its cutscene ---------- */
    // The scene engine is kept from registering itself. The ending must not depend on it: the screen says what
    // happened in a sentence, the paperwork is out at once, and New run works.
    const won = fs.readFileSync(path.join(__dirname, "../saves/fixtures/generated/end-club.json"), "utf8").trim();
    ({ context, page, errors } = await open(browser, { [AUTOSAVE]: won }, null, () => { Object.defineProperty(window, "TST_SCENES", { get() { return undefined; }, set() {}, configurable: true }); }));
    await page.waitForSelector('dialog[open][data-dialog="end:club"]', { timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(400);
    const still = await page.evaluate(() => { const d = document.querySelector('dialog[open]'); const p = d && d.querySelector(".scene-still p"); return { dialog: d ? d.getAttribute("data-dialog") : null, said: p ? p.textContent : "", card: !!(d && d.querySelector(".end-card.is-in")), run: !!(d && d.querySelector('[data-ui="newrun"]')), pre: !!(d && d.querySelector("pre")) }; });
    check("without the scene engine the ending still opens", still.dialog === "end:club", "dialog " + still.dialog);
    check("the screen says what happened, in a sentence", /jet/.test(still.said) && still.said.length > 30 && !still.pre, still.said);
    check("and the paperwork is out at once", still.card && still.run, JSON.stringify(still));
    await page.click('dialog[open] [data-ui="newrun"]'); await page.waitForTimeout(400);
    check("New run starts a new quarter from it", await dialog(page) === null && (await save(page)).week === 1);
    check("no errors", errors.length === 0, errors.join(" | "));
    await context.close();

    /* ---------- 6. a close event that arrives late ---------- */
    // dialog.close() only queues its close event. If the dialog is open again when the event lands (a scripted
    // press can get in between; a busy machine makes the gap wide), the event is stale. v1.21 took it for the
    // player dismissing the dialog and closed the rules that had just been opened.
    ({ context, page, errors } = await open(browser));
    await page.click('[data-ui="rules"]');
    await page.waitForSelector('dialog[open][data-dialog="help"]', { timeout: 3000 }).catch(() => {});
    await page.evaluate(() => document.querySelector('dialog[open]').dispatchEvent(new Event("close")));
    await page.waitForTimeout(300);
    check("a stale close event does not dismiss the rules", await dialog(page) === "help", "dialog " + await dialog(page));
    await page.keyboard.press("Escape"); await page.waitForTimeout(300);
    check("Escape still closes them", await dialog(page) === null, "dialog " + await dialog(page));
    await page.click('[data-ui="rules"]'); await page.waitForTimeout(200);
    await page.click('dialog[open] .d-footer .btn'); await page.click('[data-ui="rules"]'); await page.waitForTimeout(300);
    check("closed with its button and reopened at once, they are open", await dialog(page) === "help", "dialog " + await dialog(page));
    check("no errors", errors.length === 0, errors.join(" | "));
    await context.close();

    /* ---------- 7. what an action did, where you are ---------- */
    // On a phone the page is one column and the log is far below the buttons. The lines an action writes are shown
    // for a moment at the bottom of the screen; taps go through the notice, and it goes away by itself. Where the
    // log is on screen (the desktop layout) there is no notice.
    const notice = pg => pg.evaluate(() => {
      const p = document.querySelector(".peek"); if (!p) return null;
      const r = p.getBoundingClientRect(), log = document.querySelector(".activity").getBoundingClientRect();
      return { text: p.innerText.replace(/\s+/g, " ").trim(), inView: r.top >= 0 && r.bottom <= window.innerHeight, logInView: log.top < window.innerHeight && log.bottom > 0,
        passes: getComputedStyle(p).pointerEvents === "none", hidden: p.getAttribute("aria-hidden") === "true" };
    });
    ({ context, page, errors } = await open(browser, null, null, null, true));
    await dice(page, 0.5);
    await page.tap('[data-act="prospect"]'); await page.waitForTimeout(300);
    let n1 = await notice(page);
    const newest = await page.evaluate(() => { const l = document.querySelector(".activity .line"); return l ? l.innerText.replace(/\s+/g, " ").trim() : ""; });
    check("on a phone the log is off the screen when an action is pressed", !!n1 && !n1.logInView, JSON.stringify(n1));
    check("so the line it wrote is shown at the bottom of the screen", !!n1 && n1.inView && n1.text.length > 0 && n1.text === newest, n1 ? n1.text + " / log: " + newest : "no notice");
    check("the notice lets taps through and is hidden from screen readers (they hear the log)", !!n1 && n1.passes && n1.hidden);
    await page.waitForTimeout(5200);
    check("it goes away by itself", await notice(page) === null);
    check("no errors", errors.length === 0, errors.join(" | "));
    await context.close();
    ({ context, page, errors } = await open(browser));
    await dice(page, 0.5);
    await page.click('[data-act="prospect"]'); await page.waitForTimeout(300);
    n1 = await notice(page);
    check("on a desktop, where the log is on screen, there is no notice", n1 === null, JSON.stringify(n1));
    // every roll of the rules is made inside a move (src/game/run.js): the page counts the ones that are not
    await page.click('[data-ui="end"]'); await page.waitForTimeout(600);
    const strays = await page.evaluate(() => (typeof window.__TST_STRAYS === "function" ? window.__TST_STRAYS() : -1));
    check("no roll was made outside a move", strays === 0, strays + " stray rolls");
    await context.close();
  } finally { await browser.close(); }
  const bad = rows.filter(ok => !ok).length;
  console.log(bad ? `\nRESILIENCE FAILED: ${bad} of ${rows.length} checks` : `\nRESILIENCE OK: all ${rows.length} checks passed`);
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
