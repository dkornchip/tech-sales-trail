// The screen-size matrix: every state a player meets, at every size the brief names, in the shipped file.
//   node test/e2e/matrix.cjs [path/to/index.html] [--shots <dir>] [--keep <WxH,..>] [--only <state,..>] [--jpeg]
//   (default: dist/index.html, the release build, opened from file:// with every network request refused)
//
// Sizes: 1440x900, 1024x768, 768x1024 (touch), 320x568, 375x667, 390x844 (phones), 667x375 (a phone on its side),
//        and 1440x900 at 200% zoom (720x450 CSS pixels).
// States: the main screen mid-quarter; clAInk's offer open and minimized; a Friday choice; a clAInk incident
//         (the strike card in the workspace); the handbook; and the six endings, each with its card.
//
// At every size, in every state:
//   no-hscroll      the page is not wider than the screen
//   reachable       End Week and the Hail Mary (or, with a dialog open, each of its buttons) can be brought on
//                   screen and are not under anything when they are: not clAInk's window, not a caption
//   dock            clAInk's own minimize / close / run buttons are on screen and on top
//   focus           with a dialog open, the keyboard focus is inside it
//   ending          the ending's card arrives with its verdict and its numbers, and New run is pressable
//   offline         no request left the file; no errors on the console
// With reduced motion (one desktop and one phone size): an ending shows its description instead of the animation,
// and the card is there at once.
// Screenshots: --shots <dir> saves one per state and size (every size, or only those named by --keep).
// Exits 1 if any check fails. (CommonJS on purpose: Playwright only resolves through require() here.)
"use strict";
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const { envelope, KEYS } = require("./lib/store.cjs");

const argv = process.argv.slice(2);
const take = flag => { const i = argv.indexOf(flag); if (i < 0) return null; return argv.splice(i, 2)[1]; };
const jpeg = argv.includes("--jpeg") && !!argv.splice(argv.indexOf("--jpeg"), 1);     // screenshots as .jpg (smaller, for the record kept in the repository)
const shotsDir = take("--shots"), keep = (take("--keep") || "").split(",").filter(Boolean), only = (take("--only") || "").split(",").filter(Boolean);
const target = path.resolve(argv[0] || "dist/index.html");
const FIXTURES = path.join(__dirname, "../saves/fixtures/generated");
const fixture = name => JSON.parse(fs.readFileSync(path.join(FIXTURES, name + ".json"), "utf8"));

const SIZES = [
  { id: "1440x900", w: 1440, h: 900 },
  { id: "1024x768", w: 1024, h: 768 },
  { id: "768x1024", w: 768, h: 1024, touch: true },
  { id: "320x568", w: 320, h: 568, touch: true, phone: true },
  { id: "375x667", w: 375, h: 667, touch: true, phone: true },
  { id: "390x844", w: 390, h: 844, touch: true, phone: true },
  { id: "667x375-landscape", w: 667, h: 375, touch: true, phone: true },
  { id: "1440x900-zoom200", w: 720, h: 450, scale: 2 }
];
// save: a run from before v2.1, handed over under the old key (still read). pending: a v2.1 run with a choice waiting.
const STATES = [
  { id: "main", save: "midrun-seeded" },
  { id: "ad-open", save: "fresh", ad: "open" },
  { id: "ad-minimized", save: "fresh", ad: "mini" },
  { id: "choice", save: "midrun-seeded", pending: [{ id: "evt:security" }], dialog: "evt:security" },
  { id: "incident", save: "ck-report-strike-hurt", dock: "report" },
  { id: "handbook", save: "midrun-seeded", open: "rules", dialog: "help" },
  { id: "end-club", save: "end-club", ending: "end:club" },
  { id: "end-missed", save: "end-missed", ending: "end:missed" },
  { id: "end-fired", save: "end-review", ending: "end:fired" },
  { id: "end-repo", save: "end-repo-rent", ending: "end:repo" },
  { id: "end-meltdown", save: "end-stress", ending: "end:meltdown" },
  { id: "end-ascension", save: "end-caffeine", ending: "end:ascension" }
];

const rows = [], failures = [];
const check = (id, ok, detail) => { rows.push(!!ok); if (!ok) { failures.push(id + (detail ? "  (" + detail + ")" : "")); console.log("  FAIL  " + id + (detail ? "  (" + detail + ")" : "")); } return !!ok; };

async function openState(browser, size, state, reduced) {
  const context = await browser.newContext({ viewport: { width: size.w, height: size.h }, deviceScaleFactor: size.scale || 1, hasTouch: !!size.touch, isMobile: !!size.phone, reducedMotion: reduced ? "reduce" : "no-preference" });
  const requests = [];
  await context.route("**/*", route => { const u = route.request().url(); if (/^(file|data|blob|about):/.test(u)) return route.continue(); requests.push(u); return route.abort(); });
  const run = fixture(state.save);
  const stored = state.pending ? { key: KEYS.autosave, text: envelope(Object.assign({}, run, { pending: state.pending, effects: [], said: {}, lastConference: 0 })) } : { key: KEYS.legacyAutosave, text: JSON.stringify(run) };
  await context.addInitScript(([key, text]) => {
    try {
      window.sessionStorage.setItem("tst-booted", "1");
      if (window.name !== "tst-seeded") { window.name = "tst-seeded"; window.localStorage.setItem("tst-onboarded-v2", "1"); window.localStorage.setItem(key, text); }
    } catch (e) {}
  }, [stored.key, stored.text]);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(String(e).slice(0, 160)));
  page.on("console", m => { if (m.type() === "error") errors.push(m.text().slice(0, 160)); });
  await page.goto(pathToFileURL(target).href);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(450);
  return { context, page, errors, requests };
}

// Brings a control on screen and says whether it is whole, inside the viewport and on top there.
const pressable = (page, sel, within) => page.evaluate(([sel, within]) => {
  const root = within ? document.querySelector(within) : document;
  const el = root && root.querySelector(sel);
  if (!el) return { found: false };
  el.scrollIntoView({ block: "center", inline: "nearest" });
  const r = el.getBoundingClientRect();
  const inside = r.left >= -0.5 && r.top >= -0.5 && r.right <= window.innerWidth + 0.5 && r.bottom <= window.innerHeight + 0.5 && r.width > 8 && r.height > 8;
  const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  const top = !!at && (at === el || el.contains(at));
  return { found: true, inside, top, under: top || !at ? null : (at.className && String(at.className).slice(0, 40)) || at.tagName, box: [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)] };
}, [sel, within || null]);
const fine = r => r.found && r.inside && r.top;

async function inspect(browser, size, state, reduced) {
  const tag = `${state.id}@${size.id}${reduced ? "@reduced" : ""}`;
  const { context, page, errors, requests } = await openState(browser, size, state, reduced);
  // The picture of this state, with the thing the state is about on screen (sel), taken once.
  let shot = false;
  const shoot = async sel => {
    if (shot || !shotsDir || reduced || (keep.length && !keep.includes(size.id))) return;
    shot = true;
    fs.mkdirSync(shotsDir, { recursive: true });
    await page.evaluate(sel => { const el = sel && document.querySelector(sel); if (el) el.scrollIntoView({ block: "center", inline: "nearest" }); else window.scrollTo(0, 0); }, sel || null);
    await page.waitForTimeout(200);
    await page.screenshot(jpeg ? { path: path.join(shotsDir, `${state.id}@${size.id}.jpg`), type: "jpeg", quality: 82 } : { path: path.join(shotsDir, `${state.id}@${size.id}.png`) });
  };
  try {
    if (state.open === "rules") { await page.locator('[data-ui="rules"]').first().click(); await page.waitForTimeout(350); }
    if (state.ad) {
      await page.waitForSelector(".claink-ad", { timeout: 4000 }).catch(() => {});
      const mini = await page.evaluate(() => { const a = document.querySelector(".claink-ad"); return a ? a.classList.contains("is-mini") : null; });
      check(`dock@${tag}: the offer is there`, mini !== null);
      if (mini !== null && (state.ad === "mini") !== mini) { await page.locator(".claink-ad-min").first().click(); await page.waitForTimeout(350); }
    }
    if (state.ending) {
      await page.waitForSelector(`dialog[open][data-dialog="${state.ending}"]`, { timeout: 5000 }).catch(() => {});
      if (!reduced) { const skip = page.locator("dialog[open] .d-footer .at-start").first(); if (await skip.count()) { await skip.click(); } }
      await page.waitForTimeout(reduced ? 300 : 1100);
    }
    const w = await page.evaluate(() => ({ page: document.documentElement.scrollWidth, screen: document.documentElement.clientWidth }));
    check(`no-hscroll@${tag}`, w.page <= w.screen + 1, w.page + " vs " + w.screen);
    const dlg = await page.evaluate(() => { const d = [...document.querySelectorAll("dialog[open]")].pop(); return d ? { id: d.getAttribute("data-dialog"), focusInside: d.contains(document.activeElement), buttons: d.querySelectorAll(".d-footer .btn").length } : null; });
    if (state.dialog || state.ending) {
      const want = state.dialog || state.ending;
      check(`dialog@${tag}: ${want} is open`, !!dlg && dlg.id === want, dlg ? dlg.id : "none");
      if (dlg) {
        check(`focus@${tag}: inside the dialog`, dlg.focusInside);
        for (let i = 0; i < dlg.buttons; i++) {
          const r = await page.evaluate(i => {
            const d = [...document.querySelectorAll("dialog[open]")].pop(), el = d.querySelectorAll(".d-footer .btn")[i];
            el.scrollIntoView({ block: "nearest", inline: "nearest" });
            const r = el.getBoundingClientRect(), at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
            return { inside: r.left >= -0.5 && r.top >= -0.5 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5, top: !!at && (at === el || el.contains(at)), label: el.innerText.replace(/\s+/g, " ").slice(0, 30) };
          }, i);
          check(`reachable@${tag}: dialog button "${r.label}"`, r.inside && r.top, JSON.stringify(r));
        }
      }
    } else {
      check(`dialog@${tag}: none is open`, dlg === null, dlg ? dlg.id : "");
      for (const [name, sel] of [["End Week", '[data-ui="end"]'], ["Hail Mary", '[data-ui="hail"]'], ["the first action", '[data-act="prospect"]'], ["the last action", '[data-act="politics"]']]) {
        const r = await pressable(page, sel);
        check(`reachable@${tag}: ${name}`, fine(r), JSON.stringify(r));
      }
    }
    if (state.ad) for (const [name, sel] of [["minimize", ".claink-ad-min"], ["dismiss", ".claink-ad-close"]].concat(state.ad === "open" ? [["the offer's button", ".claink-cta"]] : [])) {
      const r = await pressable(page, sel, ".claink-ad");
      check(`dock@${tag}: ${name}`, fine(r), JSON.stringify(r));
    }
    if (state.ad) await shoot(".claink-ad");
    if (state.dock === "report") {
      const has = await page.evaluate(() => ({ console: !!document.querySelector(".claink-console"), mini: !!document.querySelector(".claink-console.is-mini") }));
      check(`dock@${tag}: the workspace is there`, has.console);
      if (has.mini) { await page.locator(".claink-min").first().click(); await page.waitForTimeout(400); }
      const card = await page.evaluate(() => { const c = document.querySelector(".claink-strike"); if (!c) return null; c.scrollIntoView({ block: "nearest" }); const r = c.getBoundingClientRect(); return { w: Math.round(r.width), fx: !!c.querySelector(".fx"), text: c.innerText.replace(/\s+/g, " ").slice(0, 80), over: c.scrollWidth > c.clientWidth + 1 }; });
      check(`dock@${tag}: the strike card is shown, with what it cost, and is not cut off`, !!card && card.w > 120 && !card.over, JSON.stringify(card));
      await shoot(".claink-strike");
      const r = await pressable(page, ".claink-min", ".claink-console");
      check(`dock@${tag}: the workspace can be minimized`, fine(r), JSON.stringify(r));
      // minimized, it leaves End Week alone
      await page.locator(".claink-min").first().click(); await page.waitForTimeout(350);
      const e = await pressable(page, '[data-ui="end"]');
      check(`dock@${tag}: minimized, End Week is clear of it`, fine(e), JSON.stringify(e));
    }
    if (state.ending) {
      const card = await page.evaluate(() => {
        const d = [...document.querySelectorAll("dialog[open]")].pop(); if (!d) return null;
        const c = d.querySelector(".end-card"), v = d.querySelector('[data-ui="verdict"]');
        return { in: !!c && c.classList.contains("is-in"), verdict: v ? v.innerText.replace(/\s+/g, " ").trim().length : 0, facts: d.querySelectorAll(".end-fact").length, note: !!d.querySelector(".scene-note"), scene: !!d.querySelector("pre") };
      });
      check(`ending@${tag}: the card is in, with a verdict and the numbers`, !!card && card.in && card.verdict > 30 && card.facts >= 2, JSON.stringify(card));
      if (reduced) check(`ending@${tag}: reduced motion shows the scene's description`, !!card && card.note, JSON.stringify(card));
      const n = await pressable(page, '[data-ui="newrun"]', "dialog[open]");
      check(`ending@${tag}: New run is pressable`, fine(n), JSON.stringify(n));
    }
    check(`offline@${tag}: no request left the file`, requests.length === 0, requests.slice(0, 3).join(" "));
    check(`offline@${tag}: no errors`, errors.length === 0, errors.slice(0, 2).join(" | "));
    await shoot(null);
  } finally { await context.close(); }
}

(async () => {
  if (!fs.existsSync(target)) { console.error("matrix: no such file: " + target); process.exit(2); }
  console.log("matrix: " + target + "  (" + SIZES.length + " sizes x " + STATES.length + " states, file://, network refused)");
  const browser = await chromium.launch();
  const t0 = Date.now();
  try {
    const states = STATES.filter(s => !only.length || only.includes(s.id));
    for (const size of SIZES) {
      const before = rows.length, bad = failures.length;
      for (const state of states) await inspect(browser, size, state, false);
      console.log(`  ${failures.length === bad ? "ok  " : "FAIL"}  ${size.id.padEnd(20)} ${rows.length - before} checks`);
    }
    // reduced motion: the endings, at one desktop and one phone size
    const before = rows.length, bad = failures.length;
    for (const size of [SIZES[0], SIZES[5]]) for (const state of states.filter(s => s.ending)) await inspect(browser, size, state, true);
    console.log(`  ${failures.length === bad ? "ok  " : "FAIL"}  ${"reduced motion".padEnd(20)} ${rows.length - before} checks`);
  } finally { await browser.close(); }
  const failed = rows.filter(r => !r).length;
  console.log(failed ? `\nMATRIX FAILED: ${failed} of ${rows.length} checks, ${((Date.now() - t0) / 1000).toFixed(1)} s` : `\nMATRIX OK: all ${rows.length} checks passed at ${SIZES.length} sizes, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
