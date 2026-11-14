// A new player's first day, and the proof that nobody else gets one.
//   node test/e2e/firstday.cjs [path/to/index.html]      (default: dist/index.html)
// A brand-new browser gets the onboarding memo as the opening and then a tour of three stops; the vendor's ad waits
// until both are over. A browser that has been through it once, or that holds a saved run, opens on the desk.
// The page is driven with real keys and clicks, the way a player would. Exits 1 if any check fails.
// (CommonJS on purpose: Playwright only resolves through require() here.)
"use strict";
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

const target = path.resolve(process.argv[2] || "dist/index.html");
const FLAG = "tst-onboarded-v2", AUTOSAVE = "tst-autosave-v4-3";
const rows = [];
const check = (name, ok, detail) => { rows.push(!!ok); console.log("  " + (ok ? "ok  " : "FAIL") + "  " + name + (detail ? "  (" + detail + ")" : "")); return !!ok; };

const look = page => page.evaluate(([flag]) => {
  const d = document.querySelector("dialog[open]"), c = document.querySelector(".coach"), a = document.activeElement;
  return {
    dialog: d ? d.getAttribute("data-dialog") : null,
    stop: c ? Number(c.getAttribute("data-tour-step")) : null,
    focus: a ? (a.getAttribute("data-ui") || a.getAttribute("data-act") || (a.hasAttribute("data-tour-next") ? "tour-next" : a.tagName)) : null,
    ad: !!document.querySelector(".claink-ad"),
    ring: !!document.querySelector(".coach-ring"),
    flag: window.localStorage.getItem(flag),
    week: (() => { try { return JSON.parse(window.localStorage.getItem("tst-autosave-v5")).state.week; } catch (e) { return null; } })(),
    logs: (() => { try { return JSON.parse(window.localStorage.getItem("tst-autosave-v5")).state.logs.length; } catch (e) { return null; } })()
  };
}, [FLAG]);

async function open(browser, { storage, session } = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  if (storage || session) await context.addInitScript(([kv, ss]) => {
    try { for (const k of Object.keys(kv || {})) if (window.localStorage.getItem(k) === null) window.localStorage.setItem(k, kv[k]); for (const k of Object.keys(ss || {})) window.sessionStorage.setItem(k, ss[k]); } catch (e) {}
  }, [storage || null, session || null]);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(String(e).slice(0, 200)));
  page.on("console", m => { if (m.type() === "error") errors.push(m.text().slice(0, 200)); });
  await page.goto(pathToFileURL(target).href);
  await page.evaluate(() => document.fonts.ready);
  return { context, page, errors };
}
// clock in and skip the boot sequence, if there is a boot screen
async function pastBoot(page) {
  if (!(await page.evaluate(() => !!document.getElementById("boot")))) return false;
  await page.keyboard.press("Enter"); await page.waitForTimeout(300); await page.keyboard.press("Enter");
  await page.waitForFunction(() => !document.getElementById("boot"), null, { timeout: 6000 }).catch(() => {});
  return true;
}

(async () => {
  if (!fs.existsSync(target)) { console.error("firstday: no such file: " + target); process.exit(2); }
  console.log("first day: " + target);
  const browser = await chromium.launch();
  try {
    /* ---------- a brand-new browser ---------- */
    let { context, page, errors } = await open(browser);
    let s = await look(page);
    check("nothing opens over the boot screen", s.dialog === null && s.stop === null, JSON.stringify(s));
    // listen to what the game asks its sound engine for: the memo's cues moved here from the rules with the memo
    await page.evaluate(() => {
      const A = window.TST_AUDIO, heard = window.__heard = [];
      const play = A.play, say = A.say;
      A.play = function (name) { heard.push("play:" + name); return play.apply(this, arguments); };
      A.say = function (key) { heard.push("say:" + key); return say.apply(this, arguments); };
    });
    await pastBoot(page);
    await page.waitForSelector('dialog[open][data-dialog="welcome"]', { timeout: 4000 }).catch(() => {});
    s = await look(page);
    check("after the boot screen the onboarding memo opens", s.dialog === "welcome", "dialog " + s.dialog);
    check("its button has the focus", s.focus === "welcome-ok", "focus on " + s.focus);
    check("the vendor's ad is not up yet", s.ad === false);
    check("Escape does not dismiss the opening", (await page.keyboard.press("Escape"), await page.waitForTimeout(150), (await look(page)).dialog) === "welcome");
    const memo = await page.evaluate(() => { const m = document.querySelector('dialog[open] .memo'); const l = document.querySelectorAll('dialog[open] .welcome-lines li'); return { memo: !!m && m.textContent.length > 200, lines: l.length, quota: /\$160,000/.test(document.querySelector('dialog[open]').textContent) }; });
    check("it holds the memo and the job in three lines, quota included", memo.memo && memo.lines === 3 && memo.quota, JSON.stringify(memo));
    // the gag takes 1.65 s to reach the stamp; the welcome line waits out the boot screen's own announcement
    await page.waitForFunction(() => { const h = window.__heard || []; return h.includes("play:stamp") && !!document.querySelector('dialog[open] .d-cap'); }, null, { timeout: 8000 }).catch(() => {});
    const cues = await page.evaluate(() => ({ heard: window.__heard.filter(x => /welcome|sadHorn|stamp/.test(x)), caption: (document.querySelector('dialog[open] .d-cap') || { textContent: "" }).textContent }));
    check("the memo's cues fire here now: the welcome announcement, the sad horn, the stamp", cues.heard.includes("say:welcome") && cues.heard.includes("play:sadHorn") && cues.heard.includes("play:stamp"), cues.heard.join(" "));
    check("and the announcement is captioned under the dialog's title", /Welcome to Shitcorp/.test(cues.caption), cues.caption);
    await page.keyboard.press("Enter");
    await page.waitForSelector(".coach", { timeout: 3000 }).catch(() => {});
    s = await look(page);
    check("Start week 1 closes the memo and the tour begins at its first stop", s.dialog === null && s.stop === 0 && s.ring, JSON.stringify(s));
    check("the first day is recorded as done from that moment", s.flag === "1", "flag " + s.flag);
    check("the tour's Next button has the focus", s.focus === "tour-next", "focus on " + s.focus);
    const inView = () => page.evaluate(() => { const c = document.querySelector(".coach").getBoundingClientRect(); return c.left >= 0 && c.top >= 0 && c.right <= innerWidth && c.bottom <= innerHeight && c.width > 200; });
    check("stop 1 is on screen", await inView());
    await page.keyboard.press("Enter"); await page.waitForTimeout(250);
    s = await look(page);
    check("Next moves to stop 2", s.stop === 1 && (await inView()), "stop " + s.stop);
    await page.keyboard.press("Enter"); await page.waitForTimeout(250);
    s = await look(page);
    check("and to stop 3", s.stop === 2 && (await inView()), "stop " + s.stop);
    check("the game did not move while the tour ran", s.week === 1 && s.logs === 0, "week " + s.week + ", log lines " + s.logs);
    await page.keyboard.press("Enter"); await page.waitForTimeout(400);
    s = await look(page);
    check("Got it ends the tour", s.stop === null && !s.ring, JSON.stringify(s));
    check("the focus lands on the first action", s.focus === "prospect", "focus on " + s.focus);
    check("now the vendor's ad arrives", s.ad === true);
    await page.reload(); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(900);
    s = await look(page);
    check("a reload does not repeat the first day", s.dialog === null && s.stop === null, JSON.stringify(s));
    check("no errors in the console", errors.length === 0, errors.join(" | "));
    await context.close();

    /* ---------- the tour steps aside for someone who just starts playing; Escape skips it ---------- */
    ({ context, page, errors } = await open(browser));
    await pastBoot(page);
    await page.waitForSelector('dialog[open][data-dialog="welcome"]', { timeout: 4000 }).catch(() => {});
    await page.click('[data-ui="welcome-ok"]');
    await page.waitForSelector(".coach", { timeout: 3000 }).catch(() => {});
    await page.click('[data-act="network"]');
    await page.waitForTimeout(300);
    s = await look(page);
    check("pressing a game button during the tour ends the tour, and the press counts", s.stop === null && s.logs > 0, "stop " + s.stop + ", log lines " + s.logs);
    await context.close();

    ({ context, page, errors } = await open(browser));
    await pastBoot(page);
    await page.waitForSelector('dialog[open][data-dialog="welcome"]', { timeout: 4000 }).catch(() => {});
    await page.keyboard.press("Enter");
    await page.waitForSelector(".coach", { timeout: 3000 }).catch(() => {});
    await page.keyboard.press("Escape"); await page.waitForTimeout(250);
    s = await look(page);
    check("Escape skips the tour", s.stop === null && s.focus === "prospect", JSON.stringify(s));
    // the memo can be read again from the rules, and this time Escape closes it and no tour follows
    await page.click('[data-ui="rules"]'); await page.waitForSelector('dialog[open][data-dialog="help"]', { timeout: 3000 }).catch(() => {});
    await page.click('[data-ui="memo-again"]'); await page.waitForSelector('dialog[open][data-dialog="welcome"]', { timeout: 3000 }).catch(() => {});
    s = await look(page);
    check("the rules can reopen the memo", s.dialog === "welcome", "dialog " + s.dialog);
    await page.keyboard.press("Escape"); await page.waitForTimeout(300);
    s = await look(page);
    check("reopened, Escape closes it and no tour follows", s.dialog === null && s.stop === null && s.ad === true, JSON.stringify(s));
    await context.close();

    /* ---------- a browser with a saved run ---------- */
    const mid = fs.readFileSync(path.join(__dirname, "../saves/fixtures/generated/midrun-seeded.json"), "utf8").trim();
    ({ context, page, errors } = await open(browser, { storage: { [AUTOSAVE]: mid } }));
    await pastBoot(page); await page.waitForTimeout(900);
    s = await look(page);
    check("a browser with a saved run gets no first day", s.dialog === null && s.stop === null, JSON.stringify(s));
    check("no errors in the console", errors.length === 0, errors.join(" | "));
    await context.close();
  } finally { await browser.close(); }
  const bad = rows.filter(ok => !ok).length;
  console.log(bad ? `\nFIRST DAY FAILED: ${bad} of ${rows.length} checks` : `\nFIRST DAY OK: all ${rows.length} checks passed`);
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
