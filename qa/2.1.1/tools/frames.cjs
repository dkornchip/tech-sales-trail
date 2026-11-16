// Frames around one press, on a test build with the dice forced (run from the repository root):
//   node qa/2.1.1/tools/frames.cjs <test build> <out dir> <name> '<state json>' <selector> <roll>
const { chromium } = require("playwright"); const { pathToFileURL } = require("url"); const path = require("path"); const fs = require("fs");
const { save, D, CK } = require(path.resolve("test/parity/lib/scenarios.cjs"));
const [build, out, name, stateJson, sel, roll] = process.argv.slice(2);
(async () => {
  const over = JSON.parse(stateJson); if (over.deals) over.deals = over.deals.map(d => D(d[0], d[1], d[2], d[3])); if (over.claink) over.claink = CK(over.claink);
  const run = JSON.stringify(save(over));
  const b = await chromium.launch(); const c = await b.newContext({ viewport: { width: 1366, height: 768 } });
  await c.addInitScript(([text, r]) => { try { sessionStorage.setItem("tst-booted", "1"); if (window.name !== "f") { window.name = "f"; localStorage.setItem("tst-onboarded-v2", "1"); localStorage.setItem("tst-autosave-v4-3", text); } } catch (e) {} if (r !== null) window.__TST_RNG = () => r; }, [run, roll === undefined ? null : Number(roll)]);
  const p = await c.newPage(); await p.goto(pathToFileURL(path.resolve(build)).href); await p.evaluate(() => document.fonts.ready); await p.waitForSelector("#root .main"); await p.waitForTimeout(800);
  fs.mkdirSync(out, { recursive: true });
  await p.screenshot({ path: path.join(out, `${name}-0before.png`) });
  await p.locator(sel).first().click();
  const t0 = Date.now();
  for (const ms of [120, 350, 700, 1200, 2000]) { await p.waitForTimeout(Math.max(0, ms - (Date.now() - t0))); await p.screenshot({ path: path.join(out, `${name}-${ms}ms.png`) }); }
  console.log(name, JSON.stringify(await p.evaluate(() => ({ dialog: (document.querySelector("dialog[open]") || { getAttribute: () => null }).getAttribute("data-dialog"), log: [...document.querySelectorAll(".activity .line")].slice(0, 3).map(l => l.innerText.replace(/\n/g, " | ")), closed: document.querySelector("[data-kpi=closed] .value").innerText }))));
  await b.close();
})();
