// A new player's first minute in short laptop windows: does the onboarding memo fit, and does the tour leave the page
// where it was (the page does not scroll in this layout)?
//   node qa/2.1.1/tools/first-day-short.cjs <build.html> [WxH,WxH,...]
const { chromium } = require("playwright"); const path = require("path"); const { pathToFileURL } = require("url");
const build = path.resolve(process.argv[2]);
(async () => {
  const b = await chromium.launch();
  for (const [w, h] of (process.argv[3] || "1366x768,1366x657,1366x625,1280x620,1280x720").split(",").map(s => s.split("x").map(Number))) {
    const c = await b.newContext({ viewport: { width: w, height: h } });
    await c.addInitScript(() => { try { sessionStorage.setItem("tst-booted", "1"); } catch (e) {} });
    const p = await c.newPage(); await p.goto(pathToFileURL(build).href); await p.evaluate(() => document.fonts.ready);
    await p.waitForSelector('dialog[open][data-dialog="welcome"]', { timeout: 8000 }); await p.waitForTimeout(2600);
    const memo = await p.evaluate(() => { const d = document.querySelector("dialog[open]"), f = d.querySelector(".d-footer"), r = d.getBoundingClientRect(), fr = f.getBoundingClientRect(); const lines = [...d.querySelectorAll(".d-body p, .d-body li, .welcome-lines p, .chapter")]; const under = [...d.querySelectorAll("p")].filter(e => { const x = e.getBoundingClientRect(); return x.height > 0 && x.bottom > fr.top + 1 && x.top < fr.bottom; }).map(e => e.textContent.slice(0, 40)); return { dialog: Math.round(r.height), top: Math.round(r.top), bottom: Math.round(r.bottom), scrolls: d.scrollHeight - d.clientHeight, footerPinned: getComputedStyle(f).position, coveredByFooter: under }; });
    await p.locator('dialog[open] .d-footer .btn').first().click(); await p.waitForTimeout(700);
    const stops = [];
    for (let i = 0; i < 3; i++) { stops.push(await p.evaluate(() => ({ body: document.body.scrollTop, html: document.documentElement.scrollTop, win: window.scrollY, topbar: Math.round(document.querySelector(".topbar").getBoundingClientRect().top), ring: (() => { const r = document.querySelector(".coach-ring"); if (!r) return null; const x = r.getBoundingClientRect(); return [Math.round(x.top), Math.round(x.bottom)]; })() }))); const next = p.locator("[data-tour-next]"); if (await next.count()) { await next.click(); await p.waitForTimeout(500); } }
    const after = await p.evaluate(() => ({ body: document.body.scrollTop, html: document.documentElement.scrollTop, topbar: Math.round(document.querySelector(".topbar").getBoundingClientRect().top), end: Math.round(document.querySelector('[data-ui="end"]').getBoundingClientRect().bottom), vh: innerHeight }));
    console.log(`${w}x${h}`, "memo", JSON.stringify(memo), "| tour stops", JSON.stringify(stops.map(s => [s.body, s.html, s.topbar, s.ring])), "| after", JSON.stringify(after));
    await c.close();
  }
  await b.close();
})();
