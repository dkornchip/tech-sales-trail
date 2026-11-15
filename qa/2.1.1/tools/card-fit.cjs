// The week's card at a list of window sizes: the hint bar, the action rows, and where End week ends against the card.
//   node qa/2.1.1/tools/card-fit.cjs <build.html> <repo root> [WxH,WxH,...]
const { chromium } = require("playwright"); const path = require("path"); const { pathToFileURL } = require("url");
const { save, D } = require(path.resolve(process.argv[3] || ".", "test/parity/lib/scenarios.cjs"));
const build = path.resolve(process.argv[2]);
const run = JSON.stringify(save({ week: 6, cash: 900, energy: 80, closedQuarter: 30000, closedWon: 30000, deals: [D(3, 42000, "happy"), D(2, 14000, "curious"), D(0, 6000)] }));
const sizes = (process.argv[4] || "1366x620,1366x641,1366x657,1366x680,1366x700,1366x720,1366x746,1366x768,1280x620,1280x720,1440x900,1536x864,1920x1080").split(",").map(s => s.split("x").map(Number));
(async () => {
  const b = await chromium.launch();
  for (const [w, h] of sizes) {
    const c = await b.newContext({ viewport: { width: w, height: h } });
    await c.addInitScript(([t]) => { try { sessionStorage.setItem("tst-booted", "1"); if (window.name !== "m") { window.name = "m"; localStorage.setItem("tst-onboarded-v2", "1"); localStorage.setItem("tst-autosave-v4-3", t); } } catch (e) {} }, [run]);
    const p = await c.newPage(); await p.goto(pathToFileURL(build).href); await p.evaluate(() => document.fonts.ready); await p.waitForSelector("#root .main"); await p.waitForTimeout(500);
    const m = async () => p.evaluate(() => { const q = s => document.querySelector(s).getBoundingClientRect(), r = v => Math.round(v * 10) / 10; const h = q(".hint"), t = document.querySelector(".hint span").getBoundingClientRect(), L = q(".left"), e = q('[data-ui="end"]'), a = q(".action");
      return { bar: r(h.height), text: r(t.height), pad: r(t.top - h.top), row: r(a.height), endInside: r(L.bottom - e.bottom), endTop: r(e.top), scroll: document.documentElement.scrollHeight - innerHeight }; });
    const idle = await m(); await p.locator('[data-ui="hail"]').hover(); await p.waitForTimeout(200); const two = await m();
    console.log(`${w}x${h}`.padEnd(10), "idle bar", String(idle.bar).padStart(5), "| two-line: bar", String(two.bar).padStart(5), "text", two.text, "space above", String(two.pad).padStart(4), "| row", String(two.row).padStart(5), "| End week inside card by", String(two.endInside).padStart(5), "| End week moved", Math.round((two.endTop - idle.endTop) * 10) / 10, "| page scroll", two.scroll);
    await c.close();
  }
  await b.close();
})();
