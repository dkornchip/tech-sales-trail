#!/usr/bin/env node
// clAInk beside the game, measured: what a player sees of clAInk's window, the deal list and the log on desktop
// screens. A report for a person to read (and pictures to look at); the layout gate holds the rules themselves
// (test/e2e/layout.cjs: dock-whole, dock-fair, dock-question-seen).
//
//   node test/e2e/tools/claink-desktop.cjs <build.html> [--shots <dir>] [--jpeg] [--scale 2] [--sizes 1440x900,1280x720] [--only ad,cancel]
//
// It runs on any build, a release included (it presses nothing but clAInk's own buttons and reads the page), so an
// old release can be measured beside a new one:   git show <commit>:Tech_Sales_Trail_2.1.html > /tmp/old.html
//
//   1. clAInk's window, state by state, each opened fresh at each size with nothing scrolled by hand:
//        ad       the offer on an empty board           policy   after "Begin your transformation"
//        ask      the dismissal question open           work     the workspace after a run that earned a strike
//        idle     the workspace before a run            cancel   after pressing "Cancel seat"
//        revoked  after the third strike
//      "in sight / whole" is the window's visible height against the height of what is in it. "question" says
//      whether the question a press has just opened is inside the part of the window that shows.
//   2. the column clAInk shares with the deal list and the log, in six states from an empty board to 24 deals:
//      how many deals and log lines are wholly in sight, and what the window got.
// (CommonJS on purpose: Playwright only resolves through require() here.)
"use strict";
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const { FIXTURES } = require("../lib/fixtures.cjs");

const args = process.argv.slice(2);
const take = flag => { const i = args.indexOf(flag); if (i < 0) return null; const v = args[i + 1]; args.splice(i, 2); return v; };
const shots = take("--shots"), sizesArg = take("--sizes"), onlyArg = take("--only"), scale = Number(take("--scale") || 1);
const jpeg = args.includes("--jpeg"); if (jpeg) args.splice(args.indexOf("--jpeg"), 1);
if (!args[0]) { console.error("usage: node test/e2e/tools/claink-desktop.cjs <build.html> [--shots <dir>] [--jpeg] [--scale n] [--sizes WxH,..] [--only state,..]"); process.exit(2); }
const target = path.resolve(args[0]);
if (!fs.existsSync(target)) { console.error("claink-desktop: no such file: " + target); process.exit(2); }
// (at 1024 wide and under the page is stacked, not side by side: clAInk's window has no share of a column there)
const SIZES = (sizesArg ? sizesArg.split(",") : ["1920x1080", "1536x864", "1440x900", "1366x768", "1280x800", "1280x720"]).map(s => s.split("x").map(Number));
const only = onlyArg ? onlyArg.split(",") : null;

const kept = name => fs.readFileSync(path.join(__dirname, "../../saves/fixtures/generated", name + ".json"), "utf8");
const fixture = id => Object.values(FIXTURES.find(f => f.id === id).storage)[0];
// [id, what, the save the page opens on (a v2.0.1 save: every version reads those), the button to press]
const WINDOW = [
  ["ad", null, null], ["policy", null, ".claink-cta"], ["ask", null, ".claink-ad-close"],
  ["work", kept("ck-report-strike-hurt"), null], ["idle", kept("ck-active-0-strikes"), null], ["cancel", kept("ck-active-1-strike"), ".claink-cancel-link"], ["revoked", kept("ck-revoked-card"), null]
];
const COLUMN = [
  ["ad-empty-board", "the ad, an empty board", null], ["ad-ten-deals", "the ad, ten deals", fixture("ad-board")],
  ["workspace-idle-4-deals", "the workspace idle, 4 deals", kept("ck-active-0-strikes")], ["workspace-run-3-deals", "the workspace after a run, 3 deals", kept("ck-report-strike-hurt")],
  ["workspace-report-8-deals", "the workspace with a full report, 8 deals", fixture("ck-report")], ["workspace-24-deals", "the workspace, 24 deals", fixture("board-24")]
];

// a returning player, past the boot screen, with `text` as the run on their desk
const opening = ([text]) => { try { window.sessionStorage.setItem("tst-booted", "1"); if (window.name !== "s") { window.name = "s"; window.localStorage.setItem("tst-onboarded-v2", "1"); if (text) window.localStorage.setItem("tst-autosave-v4-3", text); } } catch (e) {} };
async function open(browser, [w, h], text) {
  const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: scale });
  await context.addInitScript(opening, [text]);
  const page = await context.newPage();
  await page.goto(pathToFileURL(target).href);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForSelector("#root .main", { timeout: 8000 });
  await page.waitForTimeout(900);
  return { context, page };
}
const shoot = async (page, name) => { if (shots) await page.screenshot(Object.assign({ path: path.join(shots, name + (jpeg ? ".jpg" : ".png")) }, jpeg ? { type: "jpeg", quality: 82 } : {})); };
const measure = () => {
  const q = s => document.querySelector(s), box = e => (e ? Math.round(e.getBoundingClientRect().height) : 0);
  const whole = (list, sel) => { if (!list) return "-"; const L = list.getBoundingClientRect(), rows = [...list.querySelectorAll(sel)]; return rows.filter(r => { const b = r.getBoundingClientRect(); return b.top >= L.top - 1 && b.bottom <= L.bottom + 1; }).length + "/" + rows.length; };
  const col = q(".right"), dock = q(".claink-ad, .claink-console");
  if (!col || !dock) return null;
  const ask = dock.querySelector(".claink-cancel-box, .claink-ad-ask, .claink-policy"), d = dock.getBoundingClientRect(), a = ask && ask.getBoundingClientRect();
  return { col: col.clientHeight, deals: box(q(".deals")), dealRows: whole(q(".deals .scroll"), "li"), log: box(q(".activity")), logRows: whole(q(".activity .scroll"), "li.line"),
    seen: dock.clientHeight, all: dock.scrollHeight, share: Math.round(100 * d.height / col.clientHeight), fit: dock.getAttribute("data-fit") || (dock.classList.contains("claink-ad") ? "full" : ""),
    question: !ask ? "" : a.top >= d.top - 1 && a.bottom <= d.bottom + 1 ? "in sight" : `${Math.round(Math.max(a.bottom - d.bottom, d.top - a.top))}px out of sight` };
};

(async () => {
  if (shots) fs.mkdirSync(shots, { recursive: true });
  const browser = await chromium.launch();
  try {
    console.log(`clAInk on desktop screens: ${path.relative(process.cwd(), target)}`);
    console.log("\n1. clAInk's window, state by state");
    console.log("   state    screen      window   in sight / whole   share of column   question    layout");
    for (const [id, text, press] of WINDOW) {
      if (only && !only.includes(id)) continue;
      for (const size of SIZES) {
        const { context, page } = await open(browser, size, text);
        if (press) { const b = page.locator(press).first(); if (await b.count()) { await b.click(); await page.waitForTimeout(400); } }
        const m = await page.evaluate(measure);
        console.log(m ? `   ${id.padEnd(8)} ${size.join("x").padEnd(10)} ${String(m.seen).padStart(5)}px ${(m.seen >= m.all - 1 ? "all" : m.seen + "/" + m.all).padStart(13)}   ${String(m.share).padStart(12)}%     ${m.question.padEnd(11)} ${m.fit}` : `   ${id.padEnd(8)} ${size.join("x").padEnd(10)} clAInk's window is not on this screen`);
        await shoot(page, `${id}@${size.join("x")}`);
        await context.close();
      }
    }
    console.log("\n2. the column clAInk shares with the deal list and the log");
    for (const [id, what, text] of COLUMN) {
      if (only && !only.includes(id)) continue;
      console.log(`\n   ${what}`);
      console.log("   screen      column   deal list: box, deals in sight   log: box, lines in sight   clAInk: in sight / whole, share, layout");
      for (const size of SIZES) {
        const { context, page } = await open(browser, size, text);
        const m = await page.evaluate(measure);
        console.log(m ? `   ${size.join("x").padEnd(10)} ${String(m.col).padStart(5)}px   ${String(m.deals).padStart(13)}px ${m.dealRows.padStart(14)}   ${String(m.log).padStart(7)}px ${m.logRows.padStart(15)}   ${(m.seen >= m.all - 1 ? "all" : m.seen + "/" + m.all).padStart(13)} ${String(m.share).padStart(4)}%  ${m.fit}` : `   ${size.join("x").padEnd(10)} clAInk's window is not on this screen`);
        await shoot(page, `${id}@${size.join("x")}`);
        await context.close();
      }
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
