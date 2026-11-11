// Offline check of the built single file: it must run with no network at all, on its own bundled fonts.
//   node test/e2e/offline.cjs [path/to/index.html]      (default: dist/index.html)
// The page is opened twice: served from a made-up http origin where only the document itself is answered, and
// straight from a file:// URL. Every other request is aborted and counted. In each pass it checks the fonts,
// clicks through the boot screen and plays one action. Exits 1 if any check fails.
// (CommonJS on purpose: Playwright only resolves through require() here.)
"use strict";
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

const target = path.resolve(process.argv[2] || "dist/index.html");
const ORIGIN = "http://tst-offline.test";
const SANS = "TST Sans", MONO = "TST Mono";
const AUTOSAVE = "tst-autosave-v4-3";

function reporter(pass){
  const rows = [];
  return {
    rows,
    check(name, ok, detail){ rows.push({ ok: !!ok, name }); console.log("  " + (ok ? "ok  " : "FAIL") + "  " + name + (detail ? "  (" + detail + ")" : "")); return !!ok; },
    note(text){ console.log("        " + text); },
    title(){ console.log("\n" + pass + ": " + target); }
  };
}

// Runs in the page. Widths are layout widths of a 100px probe, so they do not depend on zoom or transforms.
function measureFonts(){
  const probe = (family, text, host) => {
    const s = document.createElement("span");
    s.textContent = text;
    s.style.cssText = "position:absolute;left:-9999px;top:0;visibility:hidden;white-space:pre;font-size:100px;line-height:1;font-weight:400;font-style:normal;letter-spacing:normal;" + (family ? "font-family:" + family + ";" : "");
    (host || document.body).appendChild(s);
    const w = s.getBoundingClientRect().width;
    s.remove();
    return w;
  };
  const monoText = "MW.il1|_-=/\\()~*' 0123456789 ─│┌█░▌";
  const sansText = "Quota attainment: 104% of $1,234,567 − Will it close? “Maybe”…";
  const generics = ["monospace", "serif", "sans-serif", "system-ui", '"no such family"'];
  const out = { mono: { own: probe('"TST Mono"', monoText), generic: {} }, sans: { own: probe('"TST Sans"', sansText), generic: {} } };
  for(const g of generics){ out.mono.generic[g] = probe(g, monoText); out.sans.generic[g] = probe(g, sansText); }
  // the same strings where the page itself puts text: inside a scene screen, and in the body
  const pre = [...document.querySelectorAll(".cutbox.crt pre")].find(p => p.parentNode.clientWidth > 0); // the one on screen
  out.mono.inScene = pre ? probe("", monoText, pre) : null;
  out.sans.inBody = probe("", sansText, document.body);
  out.mono.chars = [...monoText].length;
  return out;
}

function auditFamilies(){
  const first = el => getComputedStyle(el).fontFamily.split(",")[0].trim().replace(/^["']|["']$/g, "");
  const bad = {};
  let seen = 0;
  for(const el of document.body.querySelectorAll("*")){
    if(el.tagName === "SCRIPT" || el.tagName === "STYLE") continue;
    const ownText = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
    if(!ownText && !/^(INPUT|BUTTON|TEXTAREA|SELECT)$/.test(el.tagName)) continue;
    seen++;
    const f = first(el);
    if(f !== "TST Sans" && f !== "TST Mono"){
      const key = el.tagName.toLowerCase() + (typeof el.className === "string" && el.className.trim() ? "." + el.className.trim().split(/\s+/).join(".") : "") + " uses " + f;
      bad[key] = (bad[key] || 0) + 1;
    }
  }
  return { seen, bad };
}

function sceneFit(){
  const pre = [...document.querySelectorAll(".cutbox.crt pre")].find(p => p.parentNode.clientWidth > 0); // the one on screen
  if(!pre) return null;
  const box = pre.parentNode, cs = getComputedStyle(pre), bs = getComputedStyle(box);
  const fontSize = parseFloat(cs.fontSize);
  const probe = family => { const s = document.createElement("span"); s.textContent = "M".repeat(100); s.style.cssText = "position:absolute;visibility:hidden;white-space:pre;font-size:100px;line-height:1;font-family:" + family; document.body.appendChild(s); const w = s.offsetWidth / 10000; s.remove(); return w; };
  return {
    cached: pre._ratio || 0, own: probe('"TST Mono"'), generic: probe("monospace"),
    fontSize, lineHeight: parseFloat(cs.lineHeight) / fontSize,
    preWidth: pre.getBoundingClientRect().width, inner: box.clientWidth - parseFloat(bs.paddingLeft) - parseFloat(bs.paddingRight),
    rows: pre.getBoundingClientRect().height / parseFloat(cs.lineHeight),
    cols: (window.TST_SCENES || {}).COLS, gridRows: (window.TST_SCENES || {}).ROWS
  };
}

async function pass(browser, name, open){
  const r = reporter(name);
  r.title();
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  const requests = [], blocked = [], consoleErrors = [], pageErrors = [];
  let documentUrl = "";
  page.on("request", req => { const u = req.url(); if(!/^(data|blob|about):/.test(u)) requests.push(u); });
  page.on("console", m => { if(m.type() === "error") consoleErrors.push(m.text()); });
  page.on("pageerror", e => pageErrors.push(String(e && e.message || e)));
  await context.route("**/*", route => {
    const u = route.request().url();
    if(u === documentUrl) return open.fulfil ? route.fulfill({ status: 200, contentType: "text/html", body: fs.readFileSync(target) }) : route.continue();
    blocked.push(u);
    return route.abort();
  });
  documentUrl = open.url;

  try{
    await page.goto(documentUrl, { waitUntil: "load" });
    const doc = await page.evaluate(() => ({ mode: document.compatMode, charset: document.characterSet, title: document.title,
      icon: (document.querySelector('link[rel="icon"]') || {}).href || "", description: (document.querySelector('meta[name="description"]') || {}).content || "",
      theme: (document.querySelector('meta[name="theme-color"]') || {}).content || "", protocol: location.protocol }));
    r.check("the document opens in standards mode as UTF-8", doc.mode === "CSS1Compat" && doc.charset === "UTF-8" && !!doc.title, doc.protocol + " " + doc.mode + " " + doc.charset);
    r.check("the head carries a description and a theme colour", !!doc.description && !!doc.theme);
    const iconOk = /^data:image\/svg\+xml[;,]/.test(doc.icon) && await page.evaluate(src => new Promise(done => { const i = new Image(); i.onload = () => done(i.naturalWidth > 0); i.onerror = () => done(false); i.src = src; }), doc.icon);
    r.check("the favicon is an inline SVG that decodes", iconOk);

    /* ---------- fonts ---------- */
    await page.evaluate(() => document.fonts.ready);
    const natural = await page.evaluate(() => [...document.fonts].map(f => ({ family: f.family.replace(/["']/g, ""), weight: f.weight, status: f.status })));
    const families = [...new Set(natural.map(f => f.family))].sort();
    r.check("the page declares only the two bundled families", families.join("|") === [MONO, SANS].join("|"), natural.map(f => f.family + " " + f.weight + ": " + f.status).join(", "));
    const loadedByPage = (family, weight) => natural.some(f => f.family === family && f.status === "loaded" && (!weight || f.weight === weight));
    r.check('"TST Sans" was loaded by the page itself', loadedByPage(SANS));
    r.check('"TST Mono" 400 was loaded by the page itself (the boot screen draws in it)', loadedByPage(MONO, "400"));
    const forced = await page.evaluate(async () => {
      const out = {};
      for(const font of ['400 16px "TST Sans"', '800 16px "TST Sans"', '400 16px "TST Mono"', '700 16px "TST Mono"']){
        try{ const faces = await document.fonts.load(font); out[font] = faces.length && faces.every(f => f.status === "loaded") ? "loaded" : "not loaded (" + faces.length + " faces)"; }
        catch(e){ out[font] = "error: " + e.message; }
      }
      return out;
    });
    r.check("document.fonts loads every bundled face", Object.values(forced).every(v => v === "loaded"), Object.entries(forced).map(([k, v]) => k + " " + v).join("; "));

    const m = await page.evaluate(measureFonts);
    const differs = (own, generic) => Object.entries(generic).filter(([, w]) => Math.abs(w - own) < 0.5).map(([g]) => g);
    const monoSame = differs(m.mono.own, m.mono.generic), sansSame = differs(m.sans.own, m.sans.generic);
    r.check('"TST Mono" has its own advance, unlike every generic fallback', monoSame.length === 0,
      "TST Mono " + (m.mono.own / m.mono.chars).toFixed(3) + "px a character at 100px; monospace " + (m.mono.generic.monospace / m.mono.chars).toFixed(3) + (monoSame.length ? "; same as " + monoSame.join(", ") : ""));
    r.check('"TST Sans" has its own advance, unlike every generic fallback', sansSame.length === 0,
      "TST Sans " + m.sans.own.toFixed(1) + "px; sans-serif " + m.sans.generic["sans-serif"].toFixed(1) + "px" + (sansSame.length ? "; same as " + sansSame.join(", ") : ""));
    r.check("text in a scene screen is set in TST Mono", m.mono.inScene !== null && Math.abs(m.mono.inScene - m.mono.own) < 0.5, m.mono.inScene === null ? "no scene screen on the page" : m.mono.inScene.toFixed(1) + " vs " + m.mono.own.toFixed(1));
    r.check("body text is set in TST Sans", Math.abs(m.sans.inBody - m.sans.own) < 0.5, m.sans.inBody.toFixed(1) + " vs " + m.sans.own.toFixed(1));

    /* ---------- boot screen ---------- */
    const boot = page.locator("#boot");
    const hasBoot = await boot.count() === 1 && await boot.isVisible();
    r.check("the boot screen is up", hasBoot);
    if(hasBoot){
      // the scene engine sizes its type from a glyph ratio; that ratio has to be the bundled face's, not the fallback's
      await page.waitForFunction(() => { const p = document.querySelector("#boot .cutbox.crt pre"); return p && p._ratio; }, null, { timeout: 5000 }).catch(() => {});
      const fit = await page.evaluate(sceneFit);
      r.check("the scene engine measured its glyph ratio against TST Mono", !!fit && Math.abs(fit.cached - fit.own) < 0.0005 && Math.abs(fit.own - fit.generic) > 0.0005,
        fit ? "cached " + fit.cached + ", TST Mono " + fit.own + ", generic monospace " + fit.generic : "no scene");
      r.check("the scene grid keeps the line-height the engine assumes (1.14) and fits its screen", !!fit && Math.abs(fit.lineHeight - 1.14) < 0.006 && fit.preWidth <= fit.inner + 0.5 && Math.abs(fit.rows - fit.gridRows) < 0.05,
        fit ? "line-height " + fit.lineHeight.toFixed(4) + ", " + fit.cols + " columns " + fit.preWidth.toFixed(1) + "px in " + fit.inner + "px, " + fit.rows.toFixed(2) + " rows at " + fit.fontSize + "px" : "");
      const bootAudit = await page.evaluate(auditFamilies);
      r.check("every piece of text on the boot screen uses a bundled family", Object.keys(bootAudit.bad).length === 0, bootAudit.seen + " elements" + (Object.keys(bootAudit.bad).length ? "; " + Object.keys(bootAudit.bad).join("; ") : ""));

      const btn = page.locator("#boot .boot-btn");
      await btn.click();                                                    // clock in: the boot sequence starts
      const started = await page.waitForFunction(() => document.querySelector("#boot.on"), null, { timeout: 3000 }).then(() => true, () => false);
      if(await boot.count()) await btn.click({ timeout: 3000 }).catch(() => {}); // skip the rest of it
      const gone = await page.waitForFunction(() => !document.getElementById("boot"), null, { timeout: 6000 }).then(() => true, () => false);
      const live = await page.evaluate(() => { const c = document.getElementById("root"); return !!c && !c.inert && !!c.querySelector("[data-act]") && !document.documentElement.classList.contains("tst-booting"); });
      r.check("the boot screen can be clicked through", started && gone && live, "started " + started + ", removed " + gone + ", game live " + live);
    }

    /* ---------- one action ---------- */
    await page.waitForSelector("#root [data-act]", { timeout: 5000 }).catch(() => {});
    const readSave = () => page.evaluate(k => { try{ return localStorage.getItem(k); }catch(e){ return null; } }, AUTOSAVE);
    const before = await readSave();
    const action = page.locator('#root [data-act]:not([aria-disabled="true"])').first();
    let played = false, detail = "no enabled action found";
    if(await action.count()){
      const label = (await action.locator(".title").innerText().catch(() => "")).trim();
      await action.click();
      await page.waitForFunction(({ k, prev }) => { try{ return localStorage.getItem(k) !== prev; }catch(e){ return false; } }, { k: AUTOSAVE, prev: before }, { timeout: 5000 }).catch(() => {});
      const after = await readSave();
      const a = before ? JSON.parse(before) : null, b = after ? JSON.parse(after) : null;
      played = !!b && after !== before && (!a || b.energy < a.energy || (b.logs || []).length > (a.logs || []).length);
      detail = JSON.stringify(label) + (a && b ? ": energy " + a.energy + " -> " + b.energy + ", log " + (a.logs || []).length + " -> " + (b.logs || []).length + " lines" : "");
    }
    r.check("one action can be played", played, detail);
    const mainAudit = await page.evaluate(auditFamilies);
    r.check("every piece of text on the main screen uses a bundled family", Object.keys(mainAudit.bad).length === 0, mainAudit.seen + " elements" + (Object.keys(mainAudit.bad).length ? "; " + Object.keys(mainAudit.bad).join("; ") : ""));

    await page.waitForTimeout(400);
    const faces = await page.evaluate(() => [...document.fonts].map(f => f.family.replace(/["']/g, "") + " " + f.weight + ": " + f.status));
    r.check("no font face failed", faces.length > 0 && faces.every(f => /: loaded$/.test(f)), faces.join(", "));
  }catch(e){
    r.check("the pass ran to the end", false, String(e && e.message || e).split("\n")[0]);
  }

  const others = requests.filter(u => u !== documentUrl);
  r.check("zero requests other than the document", requests.filter(u => u === documentUrl).length === 1 && others.length === 0 && blocked.length === 0,
    requests.length + " request" + (requests.length === 1 ? "" : "s") + (others.length || blocked.length ? "; extra: " + [...new Set([...others, ...blocked])].slice(0, 5).join(", ") : ""));
  r.check("zero console errors", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));
  r.check("zero page errors", pageErrors.length === 0, pageErrors.slice(0, 3).join(" | "));
  await context.close();
  return r.rows;
}

(async () => {
  if(!fs.existsSync(target)){ console.error("offline: " + target + " does not exist. Build it first (npm run build)."); process.exit(1); }
  const browser = await chromium.launch();
  let rows = [];
  try{
    rows = rows.concat(await pass(browser, "served, network blocked", { url: ORIGIN + "/", fulfil: true }));
    rows = rows.concat(await pass(browser, "file:// URL, network blocked", { url: pathToFileURL(target).href, fulfil: false }));
  }finally{
    await browser.close();
  }
  const failed = rows.filter(x => !x.ok);
  console.log("\n" + (failed.length ? "FAILED " + failed.length + " of " + rows.length + " checks" : "all " + rows.length + " checks passed") + "  (" + path.relative(process.cwd(), target) + ", " + (fs.statSync(target).size / 1024).toFixed(0) + " KB)");
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
