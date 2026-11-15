// What an action card says is what the press does.
//   node test/e2e/actions.cjs [path/to/index.html]      (default: dist/index.html, the release build)
//
// Crafted boards are opened in the page, the cards are read, the rules (src/game, in Node) are asked about the same
// run, and then the card is pressed and the run the page saves is compared with the run before.
//   1. every card on every board: the energy on its cost line is the rules' cost, and the card is off exactly when
//      the rules would refuse the move
//   2. the four actions that work a stage of the pipeline (Discovery, Demo marathon, Proposals, Close deals):
//        a count N     the stage holds N deals, and the press works on exactly those N
//        skill only    no deal moves, joins or leaves; the action's skill goes up; one slot and its energy are spent
//        no deals      (Proposals, which trains nothing) no deal moves and no skill goes up; the press only marks
//                      the week's proposal-or-close work as done; pressed again, the card is off
//        off           the hint bar gives the rules' reason, and the press changes nothing at all
//      Discovery, Demo marathon and Close deals are never off for having nothing to work on
//   3. the line under the grid when nothing is pointed at: what is on the board, and what it takes when that is
//      out of reach; never work that cannot be done. A number key on an action that is off goes to its card,
//      which says why
//   4. a press that is certain to end the run is marked, says so and asks first; "no" changes nothing, "yes" ends
//      the run as the rules say; one point or one dollar short of certain, none of that:
//        money    the conference or a quad shot that would take cash to Collections
//        stress   Prospect blitz, Internal politics, the conference or the Hail Mary that would reach 100 stress
//      and a Friday whose rent would take cash to Collections says so on the cash card and on End week; one
//      whose coffee crash is certain to reach 100 stress says so on the stress card and on End week
//   5. the Hail Mary says what it costs (its energy, as the cards do; a throw takes a slot like any action)
//      and CRM cleanup says what its "dead leads" are worth, which is what the press removes
//   6. the hint under the pointer is about the run as it is: after a press, with the pointer still on the card, the
//      bar says what the card would do now, not what it did (v2.1 kept the words from before the press)
//   7. what a press changed is shown: the change chip on a stat card can be seen, with reduced motion too (v2.1
//      drew it at opacity 0 for a player who asked for less motion), and the quota meter is marked from 100%
//   9. clAInk: a run the player presses is followed to its result (the strike card, the week's estimate and
//      "Cancel seat" are in sight in the workspace at laptop sizes; v2.1 left them below its fold), the workspace is
//      back at its top when the week turns, End week names Friday's invoice, and the two-strike warning says a deal
//      walks when there is one
//   8. the hint bar holds every hint: in the narrowest window of the one-screen layout (1025 wide) and at a common
//      laptop size, no hint in any of six states is taller than the bar, and the bar is the same height whatever
//      it says, so nothing under it moves
// The release build rolls its own dice, so nothing here depends on a roll. Exits 1 if any check fails.
// (CommonJS on purpose: Playwright only resolves through require() here.)
"use strict";
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const { readRun } = require("./lib/store.cjs");
const { save, D, CK } = require("../parity/lib/scenarios.cjs");

const ROOT = path.resolve(__dirname, "..", "..");
const target = path.resolve(process.argv[2] || "dist/index.html");
const LEGACY = "tst-autosave-v4-3", FLAG = "tst-onboarded-v2";       // a crafted run is handed over under the v2.0 key, which is still read
const rows = [];
const check = (name, ok, detail) => { rows.push(!!ok); console.log("  " + (ok ? "ok  " : "FAIL") + "  " + name + (detail ? "  (" + detail + ")" : "")); return !!ok; };

async function open(browser, run, opts) {
  const context = await browser.newContext(Object.assign({ viewport: { width: 1280, height: 800 } }, opts || {}));
  await context.addInitScript(([text, key, flag]) => {
    try {
      window.sessionStorage.setItem("tst-booted", "1");
      if (window.name !== "tst-seeded") { window.name = "tst-seeded"; window.localStorage.setItem(flag, "1"); window.localStorage.setItem(key, text); }
    } catch (e) {}
  }, [JSON.stringify(run), LEGACY, FLAG]);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(String(e).slice(0, 200)));
  page.on("console", m => { if (m.type() === "error") errors.push(m.text().slice(0, 200)); });
  await page.goto(pathToFileURL(target).href);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForSelector("#root .main", { timeout: 8000 });
  await page.waitForTimeout(400);
  return { context, page, errors };
}
// every card as the page shows it
const cards = page => page.evaluate(() => Object.fromEntries([...document.querySelectorAll("[data-act]")].map(b => {
  const count = b.querySelector(".count");
  return [b.getAttribute("data-act"), { off: b.getAttribute("aria-disabled") === "true", cost: b.querySelector(".cost").textContent.replace(/ /g, " ").replace(/\s+/g, " ").trim(),
    count: count ? Number((count.querySelector("[aria-hidden]") || count).textContent) : null, label: count ? count.getAttribute("title") : null, risk: !!b.querySelector(".cost .risk") }];
})));
const hintOf = page => page.evaluate(() => { const h = document.querySelector(".hint").cloneNode(true); const k = h.querySelector("kbd"); if (k) k.remove(); return h.textContent.replace(/[⁠ ]/g, m => (m === " " ? " " : "")).replace(/\s+/g, " ").trim(); });
const plain = t => String(t).replace(/⁠/g, "").replace(/ /g, " ");
const dialogOf = page => page.evaluate(() => { const d = [...document.querySelectorAll("dialog[open]")].pop(); return d ? d.getAttribute("data-dialog") : null; });
// (force: a card that is off is still there to be clicked, and a player will click it; Playwright would wait for it to come on)
const press = async (page, sel) => { await page.locator(sel).first().click({ force: true }); await page.waitForTimeout(350); };
const stored = async page => JSON.stringify(await page.evaluate(readRun));

(async () => {
  if (!fs.existsSync(target)) { console.error("actions: no such file: " + target); process.exit(2); }
  console.log("actions: " + target);
  const load = rel => import(pathToFileURL(path.join(ROOT, "src", rel)).href);
  const [R, S, RULES, STATE, COPY] = await Promise.all(["game/run.js", "game/selectors.js", "game/rules.js", "game/state.js", "copy/ui.js"].map(load));
  const rules = run => STATE.mergeSaved(JSON.parse(JSON.stringify(run)));          // the run as the rules read it
  const STAGE = { discovery: s => S.stageCount(s, 0), demo: s => S.stageCount(s, 1), propose: s => S.stageCount(s, 2), close: s => S.lateDeals(s).length };
  const SKILL = { discovery: ["discovery", 2], demo: ["demo", 2], close: ["negotiate", 1] };
  const browser = await chromium.launch();
  try {
    /* ---------- 1 and 2. the cards, board by board ---------- */
    const BOARDS = [
      ["an empty board", {}],
      ["three leads", { deals: [D(0, 6000), D(0, 7000), D(0, 5000)] }],
      ["a deal at every stage", { deals: [D(0, 6000), D(1, 7000), D(2, 9000, "curious"), D(3, 21000, "happy"), D(4, 26000, "happy")] }],
      ["two demoed deals", { deals: [D(2, 9000, "curious"), D(2, 12000)] }],
      ["two late deals", { deals: [D(3, 21000, "happy"), D(4, 26000)] }],
      ["demoed deals, too tired to propose", { energy: 20, deals: [D(2, 9000), D(2, 12000)] }],
      ["leads only, after a Close deals this week", { used: { close: true }, slots: 4, deals: [D(0, 6000), D(0, 7000)] }],
      ["no slots left", { slots: 0, deals: [D(0, 6000), D(2, 9000)] }]
    ];
    for (const [what, over] of BOARDS) {
      const crafted = save(Object.assign({ week: 3, cash: 3000 }, over));
      let { context, page, errors } = await open(browser, crafted);
      const s = rules(await page.evaluate(readRun)), seen = await cards(page), bad = [];
      for (const id of Object.keys(R.ACTS)) {
        const c = seen[id], block = R.actBlock(s, id);
        if (!c) { bad.push(id + ": no card"); continue; }
        if (c.off !== !!block) bad.push(`${id}: the card is ${c.off ? "off" : "on"}, the rules ${block ? "refuse it (" + block.why + ")" : "allow it"}`);
        const m = /(\d+) energy/.exec(c.cost);
        if (RULES.COST[id].energy > 0 && !(block && block.why !== "energy" && block.why !== "slots") && (!m || Number(m[1]) !== RULES.COST[id].energy)) bad.push(`${id}: the card says "${c.cost}", the rules charge ${RULES.COST[id].energy} energy`);
        if (STAGE[id]) {
          const n = STAGE[id](s), none = block && block.why === "none";
          if (n > 0 && (c.count !== n || c.label !== COPY.CARD.eligible(n))) bad.push(`${id}: ${n} deals to work on, the card shows ${c.count} ("${c.label}")`);
          if (n === 0 && c.count !== null) bad.push(`${id}: nothing to work on, the card shows a count of ${c.count}`);
          const tag = id === "propose" ? COPY.CARD.none : COPY.CARD.skillOnly;
          if (n === 0 && !none && !c.cost.endsWith(tag)) bad.push(`${id}: nothing to work on, and the card does not say "${tag}": "${c.cost}"`);
          if (n > 0 && (c.cost.includes(COPY.CARD.skillOnly) || c.cost.includes(COPY.CARD.none))) bad.push(`${id}: ${n} deals to work on, and the card says "${c.cost}"`);
          if (none && c.cost !== COPY.ACTION.propose.none) bad.push(`propose: off for having nothing to gain, and the card says "${c.cost}"`);
          if (none && !(id === "propose" && n === 0 && S.proposeIdle(s))) bad.push(`${id}: refused for having nothing to work on`);
        }
      }
      check(`${what}: every card is off exactly when the rules refuse the move, costs what the rules charge, and counts what the stage holds`, !bad.length && !errors.length, bad.concat(errors).join(" ; ")
        || ["discovery", "demo", "propose", "close"].map(id => `${id}: ${seen[id].off ? "off, " : ""}${seen[id].count !== null ? seen[id].count : seen[id].cost}`).join(" | "));
      await context.close();

      // press each of the four, each on a page of its own
      for (const id of Object.keys(STAGE)) {
        ({ context, page, errors } = await open(browser, crafted));
        const before = rules(await page.evaluate(readRun)), text = await stored(page), n = STAGE[id](before), block = R.actBlock(before, id);
        await page.locator(`[data-act="${id}"]`).hover(); await page.waitForTimeout(150);
        const hint = await hintOf(page);
        await press(page, `[data-act="${id}"]`);
        const after = rules(await page.evaluate(readRun)), line = after.logs.find(e => e.tag === "act." + id), cost = RULES.COST[id];
        const dealsSame = JSON.stringify(after.deals) === JSON.stringify(before.deals), spent = after.slots === before.slots - 1 && Math.round(after.energy) === Math.round(before.energy - cost.energy);
        let ok, detail;
        if (block) {
          const reason = block.why === "once" ? COPY.HINT.blocked.once() : COPY.HINT.blocked[block.why](block);
          ok = (await stored(page)) === text && hint === plain(COPY.ACTION[id].title + ". " + reason);
          detail = `off (${block.why}): "${hint}"; the press ${(await stored(page)) === text ? "changed nothing" : "CHANGED THE RUN"}`;
        } else if (n === 0 && id === "propose") {
          // nothing moves and nothing is learned: the press only marks the week; then the card is off, and stays put
          ok = dealsSame && spent && JSON.stringify(after.skills) === JSON.stringify(before.skills) && after.used.propose === true && JSON.stringify(after.rng) === JSON.stringify(before.rng) && /only count toward a full-funnel week/.test(hint);
          const again = await stored(page), offNow = (await cards(page)).propose;
          await press(page, '[data-act="propose"]');
          const hint2 = await hintOf(page), still = (await stored(page)) === again;
          ok = ok && offNow.off && offNow.cost === COPY.ACTION.propose.none && still && hint2 === plain(COPY.ACTION.propose.title + ". " + COPY.HINT.blocked.none());
          detail = `no deals: deals ${dealsSame ? "untouched" : "CHANGED"}, no skill, the week marked: "${hint}"; then off ("${offNow.cost}") and a second press ${still ? "changed nothing" : "CHANGED THE RUN"}: "${hint2}"`;
        } else if (n === 0) {
          const [skill, up] = SKILL[id];
          ok = dealsSame && spent && after.skills[skill] === before.skills[skill] + up && after.closedWon === before.closedWon && /You would still spend a slot and energy\. Trains (discovery|demos|negotiation)\.$/.test(hint) && JSON.stringify(after.rng) === JSON.stringify(before.rng);
          detail = `skill only: ${skill} ${before.skills[skill]} -> ${after.skills[skill]}, deals ${dealsSame ? "untouched" : "CHANGED"}, ${spent ? "one slot and " + cost.energy + " energy" : "COST WRONG"}, no roll: "${hint}"`;
        } else if (id === "close") {
          // each of the N late deals was put to a roll: it signed or walked (gone), or it stayed with this attempt's note on it
          const late = before.deals.filter(d => d.stage >= 3), rolled = late.filter(d => { const now = after.deals.find(x => x.id === d.id); return !now || (now.probNote && now.probNote !== d.probNote); });
          const others = before.deals.filter(d => d.stage < 3).every(d => JSON.stringify(after.deals.find(x => x.id === d.id)) === JSON.stringify(d));
          ok = rolled.length === n && others && spent && after.skills.negotiate === before.skills.negotiate + 1;
          detail = `${n} on the card, ${rolled.length} deals put to a signing roll, earlier deals ${others ? "untouched" : "CHANGED"}`;
        } else {
          ok = !!line && line.d.of === n && line.d.n <= n && spent && after.deals.length === before.deals.length;
          detail = `${n} on the card, the action worked on ${line ? line.d.of : "?"} and moved ${line ? line.d.n : "?"} up`;
        }
        check(`${what}: ${COPY.ACTION[id].title} does what its card says`, ok && !errors.length, detail + (errors.length ? " ; " + errors.join(" ; ") : ""));
        await context.close();
      }
    }

    /* ---------- 3. the line under the grid ---------- */
    const idle = async (what, over, expected) => {
      const { context, page, errors } = await open(browser, save(Object.assign({ week: 3, cash: 3000 }, over)));
      await page.mouse.move(5, 5); await page.waitForTimeout(150);
      const got = await hintOf(page);
      check(`with nothing pointed at, ${what}`, got === plain(expected) && !errors.length, `"${got}"` + (got === plain(expected) ? "" : ` expected "${plain(expected)}"`));
      await context.close();
    };
    const H = COPY.HINT;
    await idle("a deal ready to sign and the energy to try: the line says so", { deals: [D(3, 21000, "happy"), D(0, 6000)] }, H.idle.close(1));
    await idle("a deal ready to sign but too little energy: the line says what closing takes", { energy: 20, deals: [D(3, 21000, "happy"), D(0, 6000)] }, H.idle.close(1) + " " + H.blocked.energy({ need: RULES.COST.close.energy, have: 20 }));
    await idle("qualified deals but too little energy for a demo: the same", { energy: 24, deals: [D(1, 7000), D(1, 8000)] }, H.idle.demo(2) + " " + H.blocked.energy({ need: RULES.COST.demo.energy, have: 24 }));
    await idle("too little energy for any action: the line says that, not what is on the board", { energy: 12, deals: [D(3, 21000, "happy")] }, H.idle.tired());
    await idle("no leads and the energy to find some: the line says so", {}, H.idle.start());
    await idle("no slots left: the line says so", { slots: 0, deals: [D(3, 21000, "happy")] }, H.idle.noSlots());
    await idle("no leads and too little energy even for referrals: the line says what that takes", { energy: 15 }, H.idle.start() + " " + H.blocked.energy({ need: RULES.COST.network.energy, have: 15 }));
    {
      // the number key of an action that is off: the press goes to the card, and the card says why
      const { context, page, errors } = await open(browser, save({ week: 3, cash: 3000, energy: 20, deals: [D(3, 21000, "happy")] }));
      const text = await stored(page);
      await page.keyboard.press("7");                                             // Close deals: 28 energy
      await page.waitForTimeout(250);
      const focused = await page.evaluate(() => document.activeElement && document.activeElement.getAttribute("data-act")), got = await hintOf(page);
      check("a number key on an action that is off changes nothing, and its card takes the focus and says why", focused === "close" && got === plain(COPY.ACTION.close.title + ". " + H.blocked.energy({ need: RULES.COST.close.energy, have: 20 })) && (await stored(page)) === text && !errors.length, `focus on ${focused}: "${got}"`);
      await context.close();
    }

    /* ---------- 4. a press that is certain to end the run ---------- */
    const REPO = RULES.CASH.repoAt, PRICE = RULES.COST.conference.cash;
    const fatal = async (what, over, sel, id, kind, title, ends) => {
      // at the line: marked, said, asked; "no" changes nothing; "yes" ends the run
      let { context, page, errors } = await open(browser, save(Object.assign({ week: 3, cash: 3000 }, over.at)));
      const s = rules(await page.evaluate(readRun)), f = S.fatalPress(s, id), seen = id === "hail" ? null : (await cards(page))[id];
      await page.locator(sel).hover(); await page.waitForTimeout(150);
      const hint = await hintOf(page), want = plain(title + ". " + H.ends(f || {}));
      check(`${what}: the rules call it fatal, ${seen ? "its card is marked, " : ""}and the hint says so and nothing else`, !!f && f.why === kind && (!seen || (seen.risk && !seen.off)) && hint === want, `"${hint}"`);
      const text = await stored(page);
      await press(page, sel);
      const d = await dialogOf(page), named = await page.evaluate(() => { const t = document.querySelector("dialog[open] .d-title"); return t ? t.textContent : null; });
      await press(page, '[data-ui="confirm-no"]');
      check(`${what}: it asks first, under the action's name, and "no" changes nothing`, d === "confirm:" + kind && named === title && (await dialogOf(page)) === null && (await stored(page)) === text, `${d || "no dialog"}, titled ${named}`);
      await press(page, sel);
      await press(page, '[data-ui="confirm-yes"]');
      await page.waitForTimeout(700);
      const after = rules(await page.evaluate(readRun));
      check(`${what}: "yes" does it, and the run ends as the rules say`, ends(after) && !errors.length, `repo ${!!after.repo}, burned out ${!!after.burnedOut}, cause ${after.endCause}, cash ${after.cash}, stress ${Math.round(after.stress)}` + (errors.length ? " ; " + errors.join(" ; ") : ""));
      await context.close();
      // one short of the line: an ordinary press
      ({ context, page, errors } = await open(browser, save(Object.assign({ week: 3, cash: 3000 }, over.short))));
      const s2 = rules(await page.evaluate(readRun)), seen2 = id === "hail" ? null : (await cards(page))[id];
      const hailAsks = id === "hail";                       // the first Hail Mary of a run asks its own question, as ever
      await press(page, sel);
      const d2 = await dialogOf(page);
      check(`${what}, one short of the line: no mark, and no question about the run ending`, S.fatalPress(s2, id) === null && (!seen2 || !seen2.risk || id === "coffee") && d2 === (hailAsks ? "confirm:hail" : null) && !errors.length, d2 || "no dialog");
      await context.close();
    };
    const repo = a => a.repo === true && a.endCause === "repo", melt = a => a.burnedOut === true && a.endCause === "stress";
    await fatal("a conference that would take cash to Collections", { at: { cash: REPO + PRICE }, short: { cash: REPO + PRICE + 1 } }, '[data-act="conference"]', "conference", "cash", COPY.ACTION.conference.title, a => repo(a) && a.cash === REPO);
    await fatal("a quad shot that would take cash to Collections", { at: { cash: REPO + RULES.COST.coffee.cash }, short: { cash: REPO + RULES.COST.coffee.cash + 1 } }, '[data-act="coffee"]', "coffee", "cash", COPY.ACTION.coffee.title, repo);
    await fatal("Prospect blitz at 98 stress", { at: { stress: 100 - RULES.STRESS_COST.prospect }, short: { stress: 99 - RULES.STRESS_COST.prospect } }, '[data-act="prospect"]', "prospect", "stress", COPY.ACTION.prospect.title, melt);
    await fatal("Internal politics at 98 stress", { at: { stress: 100 - RULES.STRESS_COST.politics }, short: { stress: 99 - RULES.STRESS_COST.politics } }, '[data-act="politics"]', "politics", "stress", COPY.ACTION.politics.title, melt);
    await fatal("a conference at 95 stress", { at: { stress: 100 - RULES.CONFERENCE_STRESS }, short: { stress: 99 - RULES.CONFERENCE_STRESS } }, '[data-act="conference"]', "conference", "stress", COPY.ACTION.conference.title, melt);
    const LATE = [D(3, 21000, "happy")];
    await fatal("the Hail Mary at 96 stress", { at: { stress: 100 - RULES.STRESS_COST.hail, deals: LATE }, short: { stress: 99 - RULES.STRESS_COST.hail, deals: LATE } }, '[data-ui="hail"]', "hail", "stress", COPY.UI.hail, melt);
    let context, page, errors, hint;
    // Friday's rent
    const rentWeek = RULES.RENT_WEEKS.find(w => w > 1), short = REPO - RULES.PAY.salary + RULES.PAY.rent;        // salary and rent would leave exactly the line
    for (const [cash, bust] of [[short, true], [short + 1, false]]) {
      ({ context, page, errors } = await open(browser, save({ week: rentWeek, cash })));
      const s = rules(await page.evaluate(readRun)), f = S.fridayPreview(s);
      const sub = plain(await page.evaluate(() => document.querySelector('[data-kpi="cash"] .sub').textContent));
      await page.locator('[data-ui="end"]').hover(); await page.waitForTimeout(150);
      hint = await hintOf(page);
      const wantSub = plain(bust ? COPY.KPI.rentBust() : COPY.KPI.collections(REPO)), wantHint = plain(COPY.UI.endWeek + ". " + H.endWeek(f));
      check(bust ? "a Friday whose rent would take cash to Collections says so on the cash card and on End week" : "one dollar richer, the cash card and End week say what they always said",
        f.bust === bust && sub === wantSub && hint === wantHint && /Collections ends the run/.test(hint) === bust && !errors.length, `cash card: "${sub}"; End week: "${hint}"`);
      await context.close();
    }

    // Friday's coffee crash: 13 a shot, and nothing on a Friday lowers stress in such a week. When it is certain to
    // reach 100 the stress card and End week say so; one point lower, the card still gives the crash's size
    for (const [stress, melt] of [[74, true], [73, false]]) {
      ({ context, page, errors } = await open(browser, save({ week: 6, cash: 3000, stress, coffeesThisWeek: 2 })));
      const s = rules(await page.evaluate(readRun)), f = S.fridayPreview(s);
      const sub = plain(await page.evaluate(() => { const e = document.querySelector('[data-kpi="stress"] .sub'); return e.textContent + "|" + e.className; }));
      await page.locator('[data-ui="end"]').hover(); await page.waitForTimeout(150);
      hint = await hintOf(page);
      check(melt ? "a Friday whose coffee crash is certain to reach 100 stress says so on the stress card and on End week" : "one point lower, the stress card still gives the crash and End week says what it always said",
        f.melt === melt && sub === `${COPY.KPI.stressCrash(26)}|sub ${melt ? "bad" : "warn"}` && hint === plain(COPY.UI.endWeek + ". " + H.endWeek(f)) && /reaches 100 and ends the run/.test(hint) === melt && !errors.length, `stress card: "${sub}"; End week: "${hint}"`);
      await context.close();
    }

    /* ---------- 5. the Hail Mary says what it costs ---------- */
    ({ context, page, errors } = await open(browser, save({ week: 3, cash: 3000, deals: LATE })));
    await page.locator('[data-ui="hail"]').hover(); await page.waitForTimeout(150);
    hint = await hintOf(page);
    const c = RULES.COST.hail, before = rules(await page.evaluate(readRun));
    await press(page, '[data-ui="hail"]'); await press(page, '[data-ui="confirm-yes"]'); await page.waitForTimeout(500);
    const thrown = rules(await page.evaluate(readRun));
    check("the Hail Mary's hint gives its cost, and that is what the throw takes", hint === plain(COPY.UI.hail + ". " + H.hail(1, RULES.HAIL.blast, RULES.HAIL.walk, c)) && hint.includes(` ${c.energy} energy.`) && thrown.slots === before.slots - c.slots && Math.round(thrown.energy) === Math.round(before.energy - c.energy) && !errors.length, `"${hint}"; slots ${before.slots} -> ${thrown.slots}, energy ${Math.round(before.energy)} -> ${Math.round(thrown.energy)}`);
    await context.close();

    // CRM cleanup: a "dead lead" is a lead or qualified deal that is skeptical or five weeks old, whatever its size
    ({ context, page, errors } = await open(browser, save({ week: 6, cash: 3000, deals: [D(1, 150000, "happy", 5), D(1, 30000, "skeptical"), D(2, 14000, "skeptical"), D(0, 6000)] })));
    const crmBefore = rules(await page.evaluate(readRun)), pv = S.crmPreview(crmBefore);
    await page.locator('[data-act="crm"]').hover(); await page.waitForTimeout(150);
    hint = await hintOf(page);
    await press(page, '[data-act="crm"]');
    const crmAfter = rules(await page.evaluate(readRun)), sum = run => run.deals.reduce((t, d) => t + d.value, 0);
    const nuked = crmAfter.logs.find(e => e.tag === "act.crm.nuked"), gone = sum(crmBefore) - sum(crmAfter) - (nuked ? nuked.d.value : 0);
    check("CRM cleanup's hint says what the dead leads are worth, and that is what the press removes", pv.pruned === 2 && pv.value === 180000 && hint === plain(COPY.ACTION.crm.title + ". " + H.crm(pv.pruned, pv.gain, pv.nuke, pv.value)) && hint.includes("2 dead leads ($180,000)") && gone === pv.value && !errors.length, `"${hint}"; removed $${gone}${nuked ? " (and the manager closed out a live deal worth $" + nuked.d.value + ")" : ""}`);
    await context.close();

    /* ---------- 6. the hint under the pointer is about the run as it is ---------- */
    // (sure: the press is certain to change what the card would do. Close deals rolls: when the deal neither signs
    // nor walks, the same words are still the true ones.)
    const over = async (what, crafted, sel, want, sure = true) => {
      ({ context, page, errors } = await open(browser, crafted));
      await page.locator(sel).hover(); await page.waitForTimeout(150);
      const was = await hintOf(page), wantWas = plain(want(rules(await page.evaluate(readRun))));
      await page.locator(sel).click({ force: true }); await page.waitForTimeout(600);       // the pointer stays where it is
      const now = await hintOf(page), wantNow = plain(want(rules(await page.evaluate(readRun))));
      check(what, was === wantWas && now === wantNow && (now !== was || !sure) && !(await dialogOf(page)) && !errors.length, `before: "${was}"; after: "${now}"`);
      await context.close();
    };
    const T = COPY.ACTION;
    await over("Recharge, pressed with the pointer on it: the bar now says this week's recharge is used", save({ week: 3, cash: 3000, energy: 40 }), '[data-act="recharge"]',
      s => T.recharge.title + ". " + (R.actBlock(s, "recharge") ? H.blocked.rested() : H.recharge(S.rechargeRange(s))));
    await over("Proposals with no demoed deal, pressed: the bar now says there is nothing to gain", save({ week: 3, cash: 3000, deals: [D(0, 6000)] }), '[data-act="propose"]',
      s => T.propose.title + ". " + (R.actBlock(s, "propose") ? H.blocked.none() : H.propose(S.stageCount(s, 2), S.PROPOSE_CHANCE)));
    await over("Close deals on the only late deal, pressed: the bar counts the late deals there are now, and says whether the week's work is counted", save({ week: 3, cash: 3000, deals: [D(4, 21000, "happy")] }), '[data-act="close"]',
      s => T.close.title + ". " + H.close(S.lateDeals(s).length), false);

    /* ---------- 7. what a press changed is shown ---------- */
    for (const reduced of [false, true]) {
      ({ context, page, errors } = await open(browser, save({ week: 3, cash: 3000, energy: 40 }), { reducedMotion: reduced ? "reduce" : "no-preference" }));
      await page.locator('[data-act="recharge"]').click(); await page.waitForTimeout(450);
      const chip = await page.evaluate(() => { const d = document.querySelector('[data-kpi="energy"] .delta'); return d ? { text: d.textContent, opacity: Number(getComputedStyle(d).opacity) } : null; });
      await page.waitForTimeout(1900);
      const left = await page.evaluate(() => !!document.querySelector('[data-kpi="energy"] .delta'));
      check(`${reduced ? "with reduced motion" : "with full motion"}: the energy card shows what Recharge gave, and then lets it go`, !!chip && /^\+\d+$/.test(chip.text) && chip.opacity > 0.95 && !left && !errors.length, JSON.stringify(chip) + (left ? ", still there after 2.3 s" : ""));
      await context.close();
    }
    // the chips under a log line: each is whole on one row, and the row's text is the stored text
    ({ context, page, errors } = await open(browser, save({ week: 3, cash: 3000 }), { viewport: { width: 1280, height: 720 } }));
    await page.locator('[data-act="politics"]').click(); await page.waitForTimeout(400);
    const row = await page.evaluate(() => { const d = document.querySelector('.activity .line[data-tag="act.politics"] .deltas'); return d ? { text: d.textContent, chips: [...d.querySelectorAll(".d")].map(c => ({ t: c.textContent, rows: new Set([...c.getClientRects()].map(r => Math.round(r.top))).size })) } : null; });
    const kept = rules(await page.evaluate(readRun)).logs.find(e => e.tag === "act.politics");
    check("the chips under a log line are each whole on one row, and say what the run stored", !!row && !!kept && row.text === kept.dl && row.chips.length >= 2 && row.chips.every(c => c.rows === 1) && !errors.length, row ? `"${row.text}" in ${row.chips.length} chips` : "no chips");
    await context.close();
    const QUOTA = STATE.newGame ? rules(save({})).quota : 0;
    for (const [what, closed, want] of [["at quota", QUOTA, true], ["one dollar short of quota", QUOTA - 1, false]]) {
      ({ context, page, errors } = await open(browser, save({ week: 9, cash: 3000, closedQuarter: closed, closedWon: closed })));
      const meter = await page.evaluate(() => { const m = document.querySelector('[data-kpi="closed"] .meter'); return m ? { good: m.classList.contains("good"), width: m.querySelector("i").style.width, label: document.querySelector('[data-kpi="closed"] .value small').textContent } : null; });
      check(`${what}: the quota meter is ${want ? "marked" : "not marked"}, and the label reads ${want ? "100%" : "99%, not 100%"}`, QUOTA > 0 && !!meter && meter.good === want && meter.label === (want ? "100%" : "99%") && !errors.length, JSON.stringify(meter) + ` at $${closed} of $${QUOTA}`);
      await context.close();
    }

    /* ---------- 8. the hint bar holds every hint ---------- */
    const STATES = [
      ["mid-run", { week: 6, cash: 900, energy: 80, deals: [D(3, 42000, "happy"), D(2, 14000, "curious"), D(0, 6000), D(1, 9000)] }],
      ["an empty board", { week: 2, cash: 3000 }],
      ["tired", { week: 7, cash: 200, energy: 12, stress: 66, deals: [D(3, 42000, "happy"), D(2, 14000)] }],
      ["one press from a meltdown, one Friday from Collections", { week: 9, cash: -950, energy: 70, stress: 97, deals: [D(4, 42000, "happy"), D(3, 126000, "happy")] }],
      ["shots taken, recharge and CRM used", { week: 4, cash: 300, energy: 30, stress: 60, coffeesThisWeek: 2, restedThisWeek: true, used: { crm: true, close: true }, deals: [D(0, 6000)] }],
      ["no slots left", { week: 5, cash: 2000, slots: 0, deals: [D(0, 6000), D(2, 9000)] }]
    ];
    for (const [w, h] of [[1025, 768], [1366, 657]]) {
      const tall = [], bars = new Set(); let seen = 0;
      for (const [what, over] of STATES) {
        ({ context, page, errors } = await open(browser, save(over), { viewport: { width: w, height: h } }));
        const targets = await page.evaluate(() => [...document.querySelectorAll("[data-act]")].map(e => `[data-act="${e.getAttribute("data-act")}"]`).concat(['[data-ui="hail"]', '[data-ui="end"]']));
        for (const sel of [null, ...targets]) {
          if (sel) await page.locator(sel).hover({ force: true }); else await page.mouse.move(4, 4);
          await page.waitForTimeout(50);
          const m = await page.evaluate(() => { const bar = document.querySelector(".hint"), text = bar.querySelector("span"); return { bar: bar.getBoundingClientRect().height, text: text.getBoundingClientRect().height, words: text.textContent }; });
          seen++; bars.add(Math.round(m.bar * 10) / 10);
          if (m.text > m.bar - 1.5) tall.push(`${what}, ${sel || "nothing pointed at"}: ${m.text.toFixed(1)}px of text in a ${m.bar.toFixed(1)}px bar ("${m.words.slice(0, 60)}…")`);
        }
        if (errors.length) tall.push(what + ": " + errors[0]);
        await context.close();
      }
      check(`${w}x${h}: none of ${seen} hints is taller than the bar, and the bar is one height whatever it says`, !tall.length && bars.size === 1, tall.length ? tall.slice(0, 3).join(" ; ") : `bar ${[...bars].join("/")}px`);
    }

    /* ---------- 9. clAInk ---------- */
    const fixture = name => JSON.parse(fs.readFileSync(path.join(ROOT, "test/saves/fixtures/generated", name + ".json"), "utf8"));
    const inSight = () => {
      const el = document.querySelector(".claink-console"); if (!el) return null;
      const r = el.getBoundingClientRect(), bar = el.querySelector(".claink-titlebar").getBoundingClientRect();
      const whole = q => { const e = el.querySelector(q); if (!e) return null; const b = e.getBoundingClientRect(); return b.top >= bar.bottom - 1 && b.bottom <= r.bottom + 1; };
      const head = q => { const e = el.querySelector(q); if (!e) return null; const b = e.getBoundingClientRect(); return b.top >= bar.bottom - 1 && b.top + 18 <= r.bottom + 1; };
      return { result: whole(".claink-strike, .claink-clear"), resultTop: head(".claink-strike, .claink-clear"), usage: whole(".claink-usage"), cancel: whole(".claink-cancel-link"), top: Math.round(el.scrollTop), scrolls: el.scrollHeight > el.clientHeight + 1 };
    };
    const answer = async () => { for (let i = 0; i < 6; i++) { const d = await dialogOf(page); if (!d || /^end/.test(d)) return d; await page.locator("dialog[open] .d-footer button, dialog[open] button").first().click({ force: true }); await page.waitForTimeout(450); } return dialogOf(page); };
    const endHint = async () => { await page.mouse.move(4, 4); await page.locator('[data-ui="end"]').hover(); await page.waitForTimeout(150); return hintOf(page); };
    for (const [w, h] of [[1280, 720], [1366, 768]]) {
      ({ context, page, errors } = await open(browser, fixture("ck-active-0-strikes"), { viewport: { width: w, height: h } }));
      const idle = rules(await page.evaluate(readRun)), idleHint = await endHint();
      await page.locator(".claink-deploy").click(); await page.waitForTimeout(4300);
      const seen = await page.evaluate(inSight);
      await answer();                                              // the manager may have a word once the report is done
      const ran = rules(await page.evaluate(readRun)), ranHint = await endHint(), due = ran.claink.due;
      check(`${w}x${h}: after Run agents, the result, the week's estimate and Cancel seat are in sight in the workspace`, !!seen && seen.result !== false && seen.usage === true && seen.cancel === true && !errors.length, JSON.stringify(seen));
      check(`${w}x${h}: End week names Friday's clAInk invoice: the idle range before a run, what is due after it`,
        idleHint === plain(COPY.UI.endWeek + ". " + H.endWeek(S.fridayPreview(idle))) && idleHint.includes("clAInk −$150–$300") && ranHint === plain(COPY.UI.endWeek + ". " + H.endWeek(S.fridayPreview(ran))) && due > 0 && ranHint.includes("clAInk −$" + due.toLocaleString("en-US") + ","), `"${idleHint}" then "${ranHint}"`);
      await page.locator('[data-ui="end"]').click(); await page.waitForTimeout(700); const ended = await answer();
      const next = rules(await page.evaluate(readRun)), inv = next.logs.find(e => e.tag === "ck.invoice"), at = await page.evaluate(() => { const el = document.querySelector(".claink-console"); return el ? Math.round(el.scrollTop) : null; });
      check(`${w}x${h}: Friday charged what was previewed (more only if an agent looped), and the workspace is back at its top`, !!ended || (!!inv && (inv.d.total === due || (inv.d.looped && inv.d.total > due)) && at === 0 && !errors.length), ended ? "the run ended on Friday: " + ended : `previewed $${due}, charged $${inv && inv.d.total}${inv && inv.d.looped ? " (looped)" : ""}; scrollTop ${at}`);
      await context.close();
    }
    // a window as short as a small laptop's browser leaves: the result may be taller than the room under the title
    // bar; then its heading is what must be in sight
    ({ context, page, errors } = await open(browser, fixture("ck-active-0-strikes"), { viewport: { width: 1366, height: 650 } }));
    await page.locator(".claink-deploy").click(); await page.waitForTimeout(4300);
    const low = await page.evaluate(inSight);
    check("1366x650: after Run agents the result's heading is in sight, and all of it when it fits", !!low && low.resultTop !== false && (low.result !== false || low.usage === false || low.cancel === false) && !errors.length, JSON.stringify(low));
    await context.close();
    ({ context, page, errors } = await open(browser, fixture("ck-active-2-strikes"), { viewport: { width: 1366, height: 768 } }));
    const hot = rules(await page.evaluate(readRun)), note = plain(await page.evaluate(() => { const n = document.querySelector(".claink-strikes .note"); return n ? n.textContent : ""; }));
    check("at two strikes the warning under Run agents says a deal walks when there is one on the board", hot.claink.strikes === 2 && hot.deals.length > 0 && note.includes("seat revoked, a deal walks, and the token true-up") && !errors.length, `${hot.deals.length} deals: "${note}"`);
    await context.close();
  } finally { await browser.close(); }
  const bad = rows.filter(ok => !ok).length;
  console.log(bad ? `\nACTIONS FAILED: ${bad} of ${rows.length} checks` : `\nACTIONS OK: all ${rows.length} checks passed`);
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
