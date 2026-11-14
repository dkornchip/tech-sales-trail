// The release build: what ships carries no test hook, and plays exactly the rules in src/game.
//   node test/e2e/release.cjs [path/to/index.html] [--sessions n] [--moves n]      (default: dist/index.html)
//
//   1. the file names no hook, and the page exposes none: no __TST_* global, no TST_CLAINK, and only the members of
//      TST_AUDIO and TST_SCENES the interface itself uses
//   2. hooks set from outside do nothing: with window.__TST_SEED and window.__TST_RNG planted before the game's
//      first script, two new runs still get dice of their own
//   3. replay: whole sessions are played in the page by pressing what a player could press. After every press the
//      run the page saved is compared, field by field, with the same move made in Node on the source (src/game,
//      through its front door) starting from the run the page saved at the start, dice included. So the bundle is
//      the source, a saved run carries everything needed to continue it, and nothing outside the run decides a roll.
//      At every press the moves the page offers are also the moves the rules allow.
// Exits 1 if any check fails. (CommonJS on purpose: Playwright only resolves through require() here.)
"use strict";
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const { loadBuild } = require("../parity/lib/serve.cjs");
const { Side } = require("../parity/lib/side.cjs");
const { loadDriver } = require("../parity/drivers/interface.cjs");
const { parseFx } = require("../parity/lib/plan.cjs");

const ROOT = path.resolve(__dirname, "..", "..");
const args = process.argv.slice(2);
const opt = (flag, dflt) => { const i = args.indexOf(flag); if (i < 0) return dflt; const v = Number(args[i + 1]); args.splice(i, 2); return v; };
const SESSIONS = opt("--sessions", 6), MOVES = opt("--moves", 150);
// Who plays each session: the simulation's bots (test/sim/lib/policies.mjs), which get through a quarter, and one
// player who presses anything.
const PLAYERS = ["chaos", "balanced", "claink-weekly", "risk", "referral", "claink", "conference", "caller"];
const target = path.resolve(args[0] || "dist/index.html");
const rows = [];
const check = (name, ok, detail) => { rows.push(!!ok); console.log("  " + (ok ? "ok  " : "FAIL") + "  " + name + (detail ? "  (" + detail + ")" : "")); return !!ok; };

const AUDIO_MEMBERS = ["ambient", "cancelSay", "hush", "onCaption", "onChange", "onLogs", "onModal", "play", "say", "setCaptions", "setOn", "setStress", "setVoice", "setVolume", "settings", "stopAmbient", "unlock"];
const SCENE_MEMBERS = ["COLS", "ROWS", "play", "reduced", "summaryFor"];
const AUTOSAVE = "tst-autosave-v4-3";

// What a press in the page is, as a move of the rules (test/sim/lib/harness.mjs). null: the press only changes what
// is on screen (opens the policy, folds the workspace), and the run must be exactly as it was.
const ENGINE = { "ck:accept": "ck:buy", "ck:dismiss": "ck:dismiss", "ck:run": "ck:deploy", "ck:cancel-confirm": "ck:cancel", "ck:hide": "ck:hide" };
const SCREEN_ONLY = ["ck:cta", "ck:notnow", "ck:ad-min", "ck:ad-expand", "ck:cancel", "ck:keep", "ck:minimize", "ck:expand"];
const NOT_PLAYED = ["ui:rules", "save", "load", "newgame"];            // the handbook and the settings menu: other tests
// The presses that lead to a move of the rules, nearest first (the policy before Accept, the confirmation before the fee).
const WAY = { "ck:buy": ["ck:accept", "ck:cta", "ck:ad-expand"], "ck:deploy": ["ck:run", "ck:expand"], "ck:cancel": ["ck:cancel-confirm", "ck:cancel", "ck:expand"], "ck:dismiss": ["ck:dismiss", "ck:ad-expand"], "ck:hide": ["ck:hide", "ck:expand"] };
const mulberry = seed => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

async function plain(browser, init) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await context.addInitScript(() => { try { window.localStorage.setItem("tst-onboarded-v2", "1"); window.sessionStorage.setItem("tst-booted", "1"); } catch (e) {} });
  if (init) await context.addInitScript(init);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(String(e).slice(0, 200)));
  await page.goto(pathToFileURL(target).href);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForSelector("#root .main", { timeout: 5000 });
  await page.waitForTimeout(300);
  return { context, page, errors };
}

(async () => {
  if (!fs.existsSync(target)) { console.error("release: no such file: " + target); process.exit(2); }
  console.log("release: " + target);
  const html = fs.readFileSync(target, "utf8");
  const H = await import(pathToFileURL(path.join(ROOT, "test/sim/lib/harness.mjs")).href);
  const K = await import(pathToFileURL(path.join(ROOT, "test/engine/lib/kit.mjs")).href);
  const E = await K.E();
  const { POLICIES } = await import(pathToFileURL(path.join(ROOT, "test/sim/lib/policies.mjs")).href);
  const asSaved = s => K.normal(E.state.mergeSaved(JSON.parse(JSON.stringify(s))));
  const firstDiff = (a, b, at) => {
    if (a === b) return null;
    if (a && b && typeof a === "object" && typeof b === "object") {
      for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) { const d = firstDiff(a[k], b[k], at ? at + "." + k : k); if (d) return d; }
      return null;
    }
    return (at || "(root)") + ": page " + String(JSON.stringify(a)).slice(0, 90) + " | source " + String(JSON.stringify(b)).slice(0, 90);
  };

  const browser = await chromium.launch();
  try {
    /* ---------- 1. no hook in the file or on the page ---------- */
    const named = html.match(/__TST_[A-Z]\w*|TST_CLAINK|TST_DEV/g) || [];
    check("the file names no test hook", named.length === 0, [...new Set(named)].join(", "));
    let { context, page, errors } = await plain(browser);
    const surface = await page.evaluate(() => ({
      globals: Object.getOwnPropertyNames(window).filter(k => /^_*TST_/.test(k)).sort(),
      audio: window.TST_AUDIO ? Object.getOwnPropertyNames(window.TST_AUDIO).sort() : null,
      scenes: window.TST_SCENES ? Object.getOwnPropertyNames(window.TST_SCENES).sort() : null
    }));
    check("the page's only globals of the game's are the sound engine, the scenes and the toast", JSON.stringify(surface.globals) === JSON.stringify(["TST_AUDIO", "TST_SCENES", "TST_TOAST"]), surface.globals.join(", "));
    check("the sound engine shows what the interface uses and nothing of its insides", JSON.stringify(surface.audio) === JSON.stringify(AUDIO_MEMBERS), "extra: " + (surface.audio || []).filter(k => !AUDIO_MEMBERS.includes(k)).join(", ") + "; missing: " + AUDIO_MEMBERS.filter(k => !(surface.audio || []).includes(k)).join(", "));
    check("the scenes show what the interface uses", JSON.stringify(surface.scenes) === JSON.stringify(SCENE_MEMBERS), (surface.scenes || []).join(", "));
    check("no errors", errors.length === 0, errors.join(" | "));
    await context.close();

    /* ---------- 2. hooks planted from outside do nothing ---------- */
    const plant = () => { window.__TST_SEED = 7; window.__TST_RNG = () => 0; window.__TST_FX = () => 0; };
    const seeds = [];
    for (let i = 0; i < 2; i++) {
      ({ context, page, errors } = await plain(browser, plant));
      await page.click('[data-act="prospect"]'); await page.waitForTimeout(250);
      const s = await page.evaluate(k => JSON.parse(window.localStorage.getItem(k)), AUTOSAVE);
      seeds.push(s && s.rng ? s.rng.seed : null);
      // a scripted roll leaves the run's own stream where it was (src/game/rng.js); a release rolls its own, so it moved
      if (i === 0) check("a planted roll is not rolled: prospecting rolled the run's own dice", !!s && !!s.rng && s.rng.core !== E.rng.newRng(s.rng.seed).core && s.deals.length >= 1, s && s.rng ? `seed ${s.rng.seed}, ${s.deals.length} deals` : "no save");
      await context.close();
    }
    check("a planted seed is not the run's seed, and two runs do not share one", seeds[0] !== null && seeds[1] !== null && seeds[0] !== 7 && seeds[1] !== 7 && seeds[0] !== seeds[1], seeds.join(", "));

    /* ---------- 3. the bundle replays against the source, from the run it saved ---------- */
    const build = loadBuild({ kind: "file", file: target });
    const driver = loadDriver("next");
    let presses = 0, compared = 0, endings = [], offers = 0;
    for (let n = 0; n < SESSIONS; n++) {
      const side = new Side({ label: "B", build, driver, seed: 1000 + n, fx: parseFx("seeded"), flavor: 0.5, motion: n % 2 ? "reduce" : "full", roundMs: 2000, maxRounds: 8,
        initScripts: ["window.__drv.pinFlavor = function(){}; window.__drv.soundInstall = function(){};"] });   // a release has no flavor handle to pin and no sound trace to hook
      const pick = mulberry(0xC0FFEE + n), who = PLAYERS[n % PLAYERS.length], ctx = { rng: mulberry(0xB07 + n), mem: {} };
      let fail = null, steps = 0, ended = null;
      try {
        let snap = await side.open(browser);
        const read = () => side.page.evaluate(() => window.__drv.readState());
        let g = { s: E.state.mergeSaved(await read()), dialog: null };
        for (; steps < MOVES && !fail; steps++) {
          const legal = snap.legal.filter(m => !NOT_PLAYED.includes(m));
          if (legal.includes("newrun")) {
            // an ending: the rules agree the run is over; then a new run, which is replayed from the run the page saves for it
            const end = H.endingOf(E, g.s);
            if (!end) { fail = `press ${steps}: the page shows ${snap.dialog && snap.dialog.id}, the rules say the run goes on`; break; }
            endings.push(end.id + "/" + end.cause); ended = (ended ? ended + ", " : "") + (snap.dialog && snap.dialog.id);
            snap = await side.step("newrun"); presses++;
            if (snap.actError) { fail = `press ${steps} (newrun): ${snap.actError}`; break; }
            g = { s: E.state.mergeSaved(await read()), dialog: null }; ctx.mem = {};
            if (E.log.isRunOver(g.s) || g.s.week !== 1) { fail = `press ${steps}: New run did not start a new run`; break; }
            continue;
          }
          // what the page offers is what the rules allow
          const rules = H.legalMoves(E, g);
          const offered = legal.filter(m => !SCREEN_ONLY.includes(m)).map(m => (/^dlg:\d+$/.test(m) ? rules[Number(m.slice(4))] || m : ENGINE[m] || m)).sort();
          // the page shows clAInk's install and cancel in two presses (the policy, the confirmation); the second
          // press is the move, so the rules' move is on offer once the first has been made
          const twoStep = { "ck:buy": legal.includes("ck:cta") || legal.includes("ck:ad-expand"), "ck:cancel": legal.includes("ck:cancel") || legal.includes("ck:expand"), "ck:deploy": legal.includes("ck:expand"), "ck:dismiss": false, "ck:hide": false };
          const allowed = rules.filter(m => !(twoStep[m] && !offered.includes(m))).sort();
          offers++;
          if (JSON.stringify(offered) !== JSON.stringify(allowed)) { fail = `press ${steps}: the page offers [${offered.join(" ")}], the rules allow [${allowed.join(" ")}]`; break; }
          if (snap.dialog && g.dialog && snap.dialog.id !== g.dialog.id) { fail = `press ${steps}: the page shows ${snap.dialog.id}, the rules are waiting on ${g.dialog.id}`; break; }
          const game = legal.filter(m => !SCREEN_ONLY.includes(m)), poke = legal.filter(m => SCREEN_ONLY.includes(m));
          let ui;
          if (who === "chaos") {
            // presses anything: mostly the game, sometimes clAInk's window, and ends the week now and then
            const pool = poke.length && pick() < 0.2 ? poke : game.includes("end") && pick() < 0.22 ? ["end"] : game;
            ui = pool[Math.floor(pick() * pool.length)];
          } else if (poke.length && pick() < 0.04) ui = poke[Math.floor(pick() * poke.length)];      // a bot that fiddles with the window too
          else {
            const want = POLICIES[who](H.viewOf(E, g, rules), ctx);
            ui = /^dlg:/.test(want) ? "dlg:" + rules.indexOf(want) : WAY[want] ? WAY[want].find(m => legal.includes(m)) : want;
            if (!ui || !legal.includes(ui)) ui = game.includes("end") ? "end" : game[0];
          }
          const id = /^dlg:\d+$/.test(ui) ? rules[Number(ui.slice(4))] : SCREEN_ONLY.includes(ui) ? null : ENGINE[ui] || ui;
          snap = await side.step(ui);
          presses++;
          if (snap.actError) { fail = `press ${steps} (${ui}): ${snap.actError}`; break; }
          if (id) g = H.play(E, g, id).g;
          const d = firstDiff(asSaved(await read()), asSaved(g.s), "");
          compared++;
          if (d) { fail = `press ${steps} (${ui}${id && id !== ui ? " = " + id : ""}): ${d}`; break; }
          const trouble = side.drainTrouble();
          if (trouble.length) { fail = `press ${steps} (${ui}): ${trouble.join(" ; ")}`; break; }
        }
      } catch (e) { fail = String(e && e.stack || e).slice(0, 400); }
      await side.close();
      check(`session ${n + 1} (${who}): ${steps} presses, the page and the source agree after every one${ended ? ", through to " + ended : ""}`, !fail, fail);
    }
    check("the sessions were worth playing", presses >= SESSIONS * MOVES * 0.9 && endings.length >= 1, `${presses} presses, ${compared} saved runs compared, ${offers} offers compared, endings: ${endings.join(", ") || "none"}`);
  } finally { await browser.close(); }
  const bad = rows.filter(ok => !ok).length;
  console.log(bad ? `\nRELEASE FAILED: ${bad} of ${rows.length} checks` : `\nRELEASE OK: all ${rows.length} checks passed`);
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
