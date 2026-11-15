// Every hint (twelve actions, Hail Mary, End week, nothing pointed at) in eight states at four narrow desktop sizes:
// how many lines each takes, and any that does not fit the hint bar.
//   node qa/2.1.1/tools/hint-lines.cjs <build.html> <repo root>
const { chromium } = require("playwright"); const path = require("path"); const { pathToFileURL } = require("url");
const { save, D, CK } = require(path.resolve(process.argv[3] || ".", "test/parity/lib/scenarios.cjs"));
const build = path.resolve(process.argv[2]);
const STATES = {
  midrun: { week: 6, cash: 900, energy: 80, closedQuarter: 30000, closedWon: 30000, deals: [D(3, 42000, "happy"), D(2, 14000, "curious"), D(0, 6000), D(1, 9000)] },
  empty: { week: 2, cash: 3000 },
  tired: { week: 7, cash: 200, energy: 12, stress: 66, deals: [D(3, 42000, "happy"), D(2, 14000)] },
  stressed: { week: 8, cash: -700, energy: 60, stress: 98, coffeesThisWeek: 3, deals: [D(4, 42000, "happy")] },
  rentweek: { week: 9, cash: 150, energy: 50, stress: 40, deals: [D(0, 6000)] },
  noslots: { week: 5, cash: 2000, slots: 0, deals: [D(0, 6000), D(2, 9000)] },
  bust: { week: 9, cash: -950, energy: 70, stress: 97, deals: [D(4, 42000, "happy"), D(3, 126000, "happy")] },
  shots: { week: 4, cash: 300, energy: 30, stress: 60, coffeesThisWeek: 2, restedThisWeek: true, used: { crm: true, close: true }, deals: [D(0, 6000)] }
};
(async () => {
  const b = await chromium.launch(); let worst = 0, n = 0, over = [], lines = {};
  for (const [w, h] of [[1025, 768], [1100, 700], [1280, 720], [1366, 657]]) for (const [name, st] of Object.entries(STATES)) {
    const c = await b.newContext({ viewport: { width: w, height: h } });
    await c.addInitScript(([t]) => { try { sessionStorage.setItem("tst-booted", "1"); if (window.name !== "m") { window.name = "m"; localStorage.setItem("tst-onboarded-v2", "1"); localStorage.setItem("tst-autosave-v4-3", t); } } catch (e) {} }, [JSON.stringify(save(st))]);
    const p = await c.newPage(); await p.goto(pathToFileURL(build).href); await p.evaluate(() => document.fonts.ready); await p.waitForSelector("#root .main"); await p.waitForTimeout(400);
    const sels = await p.evaluate(() => [...document.querySelectorAll("[data-act]")].map(e => `[data-act="${e.getAttribute("data-act")}"]`).concat(['[data-ui="hail"]', '[data-ui="end"]']));
    for (const sel of [null, ...sels]) {
      if (sel) { await p.locator(sel).hover({ force: true }); await p.waitForTimeout(60); } else { await p.mouse.move(5, 5); await p.waitForTimeout(60); }
      const m = await p.evaluate(() => { const hb = document.querySelector(".hint"), sp = hb.querySelector("span"), r = hb.getBoundingClientRect(), t = sp.getBoundingClientRect(); return { bar: r.height, text: t.height, lh: parseFloat(getComputedStyle(sp).lineHeight) || 18.2, words: sp.textContent }; });
      const k = Math.round(m.text / m.lh); lines[k] = (lines[k] || 0) + 1; n++;
      if (m.text > m.bar - 2) over.push(`${w}x${h} ${name} ${sel || "idle"}: ${k} lines, text ${m.text.toFixed(1)} in a ${m.bar.toFixed(1)}px bar: "${m.words.slice(0, 150)}"`);
      worst = Math.max(worst, k);
    }
    await c.close();
  }
  await b.close();
  console.log(`${n} hints; lines:`, JSON.stringify(lines), "| most lines:", worst); for (const o of over) console.log("  TIGHT " + o);
})();
