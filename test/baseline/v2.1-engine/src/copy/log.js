import { EFFECT } from "../game/effects.js";
import { CASH, PAY } from "../game/rules.js";
import { fmtTok, money } from "../game/util.js";
import { CK_QUIP } from "./claink.js";
import { ACHIEVEMENTS } from "./names.js";

// Every line the activity log can show, keyed by tag. The game writes log(state, tag, params): the tag and the params
// are what the game knows (and what the sound director reads); the words live only here.
//
// The voice is the company's: an ordinary corporation that believes it is exceptional, reporting on itself with a
// straight face. A line says what happened, in the fewest words that are still a sentence; the numbers go in `dl`,
// which the interface draws after the sentence as chips. What the chips say is what really happened to the meters
// (params.fx, measured by the rules after clamping), never what the rule intended.
//
// An entry that is a list has variants (src/copy/engine.js): the plain line is listed three times and each
// alternative once, so the plain line is what you read about three times in five, and the same sentence is never
// said twice running.
const usd = v => money(v).replace("-", "−");
const n = (count, one, many) => `${count} ${count === 1 ? one : many || one + "s"}`;
const line = (text, dl) => (dl ? { text, dl } : text);
const signed = v => (v > 0 ? "+" : "−") + Math.abs(v);
const pp = v => `${signed(Math.round(v * 100))} pp signing odds`;      // percentage points, as the handbook calls them
const mostly = (base, ...alts) => [base, base, base, ...alts];

// A line's stat changes, in a fixed order, from what the rules measured. extra: anything else worth a chip.
const METERS = ["energy", "stress", "manager", "reputation", "product"];
const fx = (p, ...extra) => {
  const f = p && p.fx && typeof p.fx === "object" ? p.fx : {};
  const out = METERS.filter(k => f[k]).map(k => `${signed(f[k])} ${k}`);
  if (f.cash) out.splice(1, 0, (f.cash > 0 ? "+" : "") + usd(f.cash));
  return out.concat(extra.filter(Boolean)).join(" · ");
};

// For the copy lint: lines whose params are codes or need real shapes, with the values to try; and the lines that
// are allowed more than 100 characters (150 at most), because they carry an account name or are the ones that matter.
const FX = { energy: -30, stress: 2 };
export const lint = { params: {
  "LOG.act.prospect": [{ n: 1, fx: FX }, { n: 5, fx: FX }],
  "LOG.act.cadence": [{ n: 0, fx: FX }, { n: 1, fx: FX }, { n: 3, fx: FX }],
  "LOG.act.discovery": [{ n: 0, of: 0, fx: FX }, { n: 0, of: 3, fx: FX }, { n: 1, of: 3, fx: FX }, { n: 4, of: 6, fx: FX }],
  "LOG.act.demo": [{ n: 0, of: 0, fx: FX }, { n: 0, of: 3, fx: FX }, { n: 1, of: 3, fx: FX }, { n: 4, of: 6, fx: FX }],
  "LOG.act.propose": [{ n: 0, of: 0, fx: FX }, { n: 0, of: 3, fx: FX }, { n: 1, of: 3, fx: FX }, { n: 4, of: 6, fx: FX }],
  "LOG.act.network": [{ n: 1, size: "", fx: { energy: -16, reputation: 4 } }, { n: 2, size: "big", fx: FX }, { n: 2, size: "whale", fx: FX }],
  "LOG.act.recharge": [{ energy: 35, relief: 12, nap: 0, fx: { energy: 35, stress: -12 } }, { energy: 50, relief: 17, nap: 42, fx: { energy: 50, stress: -17 } }],
  "LOG.act.conference": [{ n: 3, fx: { energy: -40, cash: -800, stress: 5 } }, { n: 8, buzz: true, fx: { energy: -40, cash: -800, stress: 5 } }],
  "LOG.act.hail.cooked": [{ walked: 0, fx: FX }, { walked: 2, fx: FX }],
  "LOG.coffee.shot": [{ shot: 1, fx: { energy: 18, stress: 12, cash: -6 } }, { shot: 2, fx: FX }, { shot: 4, fx: FX }],
  "LOG.close.none": [{ src: "close" }, { src: "hail" }],
  "LOG.close.nobody": [{ src: "close" }, { src: "negotiations" }, { src: "friday" }],
  "LOG.close.signed": [{ src: "close", n: 1, won: 18200, keep: 2184 }, { src: "friday", n: 2, won: 41000, keep: 4920, off: 10250 }, { src: "hail", n: 3, won: 190500, keep: 22860 }],
  "LOG.ach.unlocked": [{ key: "whale" }],
  "LOG.evt.champion": [{ account: "Caffeine Cathedral", moved: true, fx: FX }, { account: "Caffeine Cathedral", moved: false, fx: FX }],
  "LOG.evt.crud": [{ conf: true, fx: FX }, { conf: false, fx: FX }],
  "LOG.week.next": [{ week: 2 }, { week: 4 }, { week: 5 }, { week: 6 }, { week: 7 }, { week: 10 }, { week: 12 }, { week: 13 }],
  "LOG.pay.rent": [{ rent: 1600, short: false }, { rent: 1600, short: true }, {}],
  "LOG.pay.salary": [{ salary: 1000 }, {}],
  "LOG.ck.mgr.warning": [{ miracle: true, hit: 9 }, { miracle: false, hit: 0 }],
  "LOG.ck.invoice": [{ total: 669, tokens: 2676000, claims: 2, looped: false }, { total: 1269, tokens: 5076000, claims: 1, looped: true }],
  "LOG.ck.invoice.idle": [{ total: 150, tokens: 600000, looped: false }, { total: 900, tokens: 3600000, looped: true }]
}, limits: { "len-log": {
  "LOG.act.politics": 150, "LOG.act.hail.lean": 150, "LOG.evt.seSave": 150, "LOG.evt.seFumble": 150, "LOG.evt.marketing": 150, "LOG.evt.meme": 150, "LOG.evt.rebalance": 150,
  "LOG.qbr.reassigned": 150, "LOG.pay.salary": 150, "LOG.week.next": 150, "LOG.ck.mgr.yoink": 150, "LOG.ck.mgr.warning": 150, "LOG.ck.strike": 150, "LOG.ck.strike.hurt": 150,
  "LOG.act.crm.nuked": 150, "LOG.close.signed": 150, "LOG.ck.expired": 150, "LOG.end.repo": 150, "LOG.end.fired.org": 150, "LOG.act.conference": 150, "LOG.deal.ghost": 150,
  "LOG.act.prospect": 150, "LOG.act.crm": 150, "LOG.ck.invoice": 150, "LOG.ck.invoice.idle": 150, "LOG.coffee.shot": 150, "LOG.evt.champion": 150, "LOG.end.club": 150
} } };

// Where a batch of closes came from: tryCloseSome(state, source).
export const CLOSE_SOURCE = {
  negotiations: "Negotiations",
  close: "Close push",
  friday: "Friday closes",
  hail: "Hail Mary"
};
const src = p => CLOSE_SOURCE[p.src] || CLOSE_SOURCE.close;

// The line that opens a week: its chapter's memo, in the weeks that have one. (The log already puts a divider at
// the top of each week, so a week with nothing to announce writes nothing.)
export const CHAPTER_LINE = {
  4: "Leadership would like increased visibility into pipeline. Visibility is outperforming pipeline.",
  5: "Performance reviews begin this week. Please ensure your forecast is visible.",
  6: "Behind-pace reviews can now result in termination. HR has cleared its calendar.",
  7: "Your forecast has been circulated among increasingly senior people.",
  10: "Nonessential meetings have been replaced with essential meetings about the quarter.",
  12: "Management would like next week’s revenue to arrive this week.",
  13: "Final week. QBR on Friday. There will be no further forecasts."
};

export const LOG = {
  /* ---- the twelve actions and the Hail Mary ---- */
  "act.prospect": () => mostly(
    p => line(`Cold calls: ${p.n} new ${p.n === 1 ? "lead" : "leads"}.`, fx(p)),
    p => line(`The telephone remains operational. ${p.n} new ${p.n === 1 ? "lead" : "leads"}.`, fx(p)),
    p => line(`You found ${p.n} potential ${p.n === 1 ? "customer" : "customers"}. Management will call this momentum.`, fx(p))),
  "act.cadence": p => (p.n > 0
    ? line(mostly(`Outreach campaign: ${p.n} warm ${p.n === 1 ? "lead" : "leads"}.`, `Personalized at scale. ${p.n} warm ${p.n === 1 ? "lead" : "leads"}.`, `The inbox produced ${p.n} warm ${p.n === 1 ? "lead" : "leads"}.`), fx(p))
    : line(mostly("Outreach campaign: 0 warm leads.", "Outreach campaign delivered enthusiasm to the Internet. No leads.", "A well-formatted email campaign. No responses that became leads."), fx(p))),
  // of: how many deals were waiting. With none waiting the line is the plain count: nobody was asked anything.
  "act.discovery": p => line(p.n > 0 || !p.of ? `Discovery: ${p.n} ${p.n === 1 ? "deal" : "deals"} qualified.`
    : mostly("Discovery: 0 deals qualified.", "Discovery: no deals qualified.", "Discovery: everyone would like to learn a little more. No deals qualified."), fx(p)),
  "act.demo": p => line(p.n > 0 || !p.of ? `Demos: ${p.n} ${p.n === 1 ? "deal" : "deals"} advanced.`
    : mostly("Demos: 0 deals advanced.", "Demos: the product was discussed. No deals advanced.", "The roadmap remains promising. No demos advanced."), fx(p)),
  "act.propose": p => line(p.n > 0 || !p.of ? `Proposals sent: ${p.n}.`
    : mostly("Proposals sent: 0.", "No proposals sent. The pricing spreadsheet survives another day.", "Proposals: no deals advanced."), fx(p)),
  // size: "whale", "big" or "" (the best referral in the batch)
  "act.network": p => line(`Referrals: ${p.n} ${p.n === 1 ? "introduction" : "introductions"}.${p.size === "whale" ? " One of them is a whale." : p.size === "big" ? " One of them is substantial." : ""}`, fx(p)),
  // nap: the lucky bonus in percent, 0 when there was none worth mentioning
  "act.recharge": p => line(`Took a break.${p.nap ? ` Exceptional nap (+${p.nap}%).` : ""}`, fx(p)),
  "act.recharge.flat": p => line("Rested. The coffee has filed an objection.", fx(p)),
  "act.recharge.trip": p => `Management approved your trip to ${p.trip}. File it under morale.`,
  "act.crm": () => mostly(
    p => line(`CRM cleanup: ${p.pruned} dead ${p.pruned === 1 ? "lead" : "leads"} removed.`, fx(p)),
    p => line(`RevOps has improved the denominator. ${p.pruned} dead ${p.pruned === 1 ? "lead" : "leads"} removed.`, fx(p)),
    p => line(`Pipeline hygiene: ${p.pruned} dead ${p.pruned === 1 ? "lead" : "leads"} deleted in the name of transparency.`, fx(p))),
  "act.crm.clean": p => line("No dead leads. Management appreciates the administrative effort.", fx(p)),
  "act.crm.nuked": p => line(`Your manager closed out ${p.account}. It was in the way of the dashboard.`, `${usd(-p.value)} pipeline`),
  "act.politics": () => mostly(
    p => line("Lunch with leadership. You described the roadmap as visionary. Nobody asked which roadmap.", fx(p)),
    p => line("Leadership lunch. You agreed with the last person who spoke.", fx(p)),
    p => line("You asked a strategic question and received three slide decks.", fx(p))),
  // buzz: the conference also lifted this week's signing odds
  "act.conference": () => mostly(
    p => line(`Conference: ${p.n} new ${p.n === 1 ? "lead" : "leads"} and a lanyard.`, fx(p, p.buzz ? `${pp(EFFECT.conference.conv)} this week` : "")),
    p => line(`${n(p.n, "lead")} and a tote bag from a company with better branding.`, fx(p, p.buzz ? `${pp(EFFECT.conference.conv)} this week` : "")),
    p => line(`A full day of networking. ${n(p.n, "lead")}.`, fx(p, p.buzz ? `${pp(EFFECT.conference.conv)} this week` : ""))),
  "act.hail.blast": p => line("You emailed every available executive. The subject line contains “FINAL.”", fx(p)),
  "act.hail.lean": p => line("You explained your quarter-end situation to people who do not work here.", fx(p)),
  "act.hail.chaosWon": p => line("It worked. Leadership will now refer to this as a strategy.", fx(p)),
  "act.hail.chaosLost": p => line("The emails were delivered. The signatures were not.", fx(p)),
  "act.hail.torched": p => line("Management is reviewing your interpretation of urgency.", fx(p)),
  // walked: how many late deals left because of the push
  "act.hail.cooked": p => line(p.walked ? "A signature came in. The rest of the forecast is not taking your calls." : "A signature came in. Management disliked the method.", fx(p)),

  /* ---- coffee ---- */
  "coffee.shot": p => line(mostly(`Quad shot #${p.shot}. Facilities has concerns.`,
    ...(p.shot === 1 ? ["Quad shot #1. Return to your workstation.", "Coffee: the official beverage of individual contributors."]
      : p.shot === 2 ? ["Quad shot #2. A bold interpretation of work-life balance.", "Quad shot #2. You have typed the password correctly on the fourth try."]
        : [`Quad shot #${p.shot}. Your desk is now an experimental facility.`, `Quad shot #${p.shot}. The office first-aid kit has been relocated to your vicinity.`])), fx(p)),
  "coffee.crash": p => line("The coffee has begun the collection process.", fx(p) || `+${p.stress} stress`),

  /* ---- closing: src is a key of CLOSE_SOURCE ---- */
  "close.none": p => line(`${src(p)}: no deals ready to sign.`, fx(p)),
  // off: what was given away in discounts on this batch
  "close.signed": p => line(mostly(
    `${src(p)}: ${p.n} signed, ${usd(p.won)} closed. Commission: ${usd(p.keep)}.`,
    `${src(p)}: Finance has accepted ${p.n} actual ${p.n === 1 ? "contract" : "contracts"}. ${usd(p.won)} closed; ${usd(p.keep)} commission.`,
    `${src(p)}: ${p.n} signed. ${usd(p.won)} is no longer a hypothetical. Commission ${usd(p.keep)}.`), fx(p, p.off ? `${usd(p.off)} given in discounts` : "")),
  "close.nobody": () => ({ bands: [
    p => line(mostly(`${src(p)}: no signatures. Verbal enthusiasm remains strong.`, `${src(p)}: no signatures. We’re still building relationships.`, `${src(p)}: the buyers are aligned in principle. No signatures.`), fx(p)),
    p => line(mostly(`${src(p)}: no signatures. Verbal enthusiasm remains strong.`, `${src(p)}: everybody is aligned, except on signing.`, `${src(p)}: no signatures. Next steps have next steps.`), fx(p)),
    p => line(mostly(`${src(p)}: no signatures. Verbal enthusiasm remains strong.`, `${src(p)}: no signatures. The forecast call will be interesting.`, `${src(p)}: still waiting on paper.`), fx(p)),
    p => line(mostly(`${src(p)}: no signatures. Verbal enthusiasm remains strong.`, `${src(p)}: no signatures. Leadership is requesting visibility.`, `${src(p)}: no signatures. Time has become a negotiation point.`), fx(p))
  ] }),
  "close.lost": p => `${p.n} late-stage ${p.n === 1 ? "deal" : "deals"} lost · ${usd(p.value)}.`,

  /* ---- deals ---- */
  "deal.ghost": () => mostly(
    p => `${p.account} has described silence as its preferred next step.`,
    p => `${p.account} has moved to a highly asynchronous communication model.`,
    p => `${p.account} is pursuing a strategic silence initiative.`),
  "deal.lost": p => `${p.n} ${p.n === 1 ? "deal" : "deals"} lost · ${usd(p.value)}.`,

  /* ---- achievements: key is a key of ACHIEVEMENTS ---- */
  "ach.unlocked": p => `Distinction earned: ${ACHIEVEMENTS[p.key]}.`,

  /* ---- Friday events ---- */
  "evt.marketing": p => `Marketing delivered ${p.n} “warm” ${p.n === 1 ? "lead" : "leads"}. The spreadsheet was color-coded.`,
  "evt.competitor.match": () => line("You matched the discount. Finance requests that you make it up in volume.", `${pp(EFFECT.competitorMatch.conv)} · ${Math.round(EFFECT.competitorMatch.disc * 100)}% off what you sign · this week`),
  "evt.competitor.hold": p => line("You defended value. The margin remains intact, in theory.", fx(p, `${pp(EFFECT.competitorHold.conv)} this week`)),
  "evt.seFumble": p => line(`The demo for ${p.account} demonstrated a remarkable amount of potential.`, fx(p)),
  "evt.seSave": p => line(`Your SE answered a technical question at ${p.account} without consulting the roadmap.`, fx(p)),
  "evt.security.own": p => line("You told the customer what happened. Legal has asked for a copy of the email.", fx(p, `${pp(EFFECT.securityOwn.conv)} for ${EFFECT.securityOwn.weeks} weeks`)),
  "evt.security.spin": p => line("The incident is now classified as an unexpected learning opportunity.", fx(p, `${pp(EFFECT.securitySpin.conv)} this week`)),
  "evt.outage": p => line("The cloud has encountered a terrestrial problem.", fx(p)),
  // moved: the deal really went up a stage (one already at Closing has nowhere to go)
  "evt.champion": p => line(`Your champion at ${p.account} got promoted. ${p.moved === false ? "The deal stays where it is." : "For once, so did the deal."}`, fx(p)),
  "evt.caseStudy": p => line("A customer agreed to be quoted. Marketing has entered its Renaissance.", fx(p, `${pp(EFFECT.caseStudy.conv)} next week`)),
  "evt.meme": p => line(`The product is trending. ${p.n} inbound ${p.n === 1 ? "lead" : "leads"}; Legal is monitoring the situation.`, fx(p)),
  "evt.freeze": () => line("A budget freeze is rumored. Every CFO is waiting for the other CFOs.", `${pp(EFFECT.freeze.conv)} next week`),
  // conf: you were at a conference this week or last
  "evt.crud": p => line(p.conf ? "You brought something back from the conference. It isn’t an opportunity." : "Something is circulating around the office. It isn’t pipeline.", fx(p)),
  "evt.rebalance": p => `Territory optimization: ${p.n} of your largest ${p.n === 1 ? "deal" : "deals"}, ${usd(p.value)}, reassigned.`,
  "evt.pipShred": () => "Your PIP has been withdrawn. Management calls this a coaching success.",
  "evt.favors": p => `Your manager made some calls. ${p.n} warm ${p.n === 1 ? "introduction" : "introductions"}.`,

  /* ---- End Week ---- */
  "week.fullFunnel": () => line("A balanced week. For once, the funnel resembles a funnel.", `${pp(EFFECT.fullFunnel.conv)} next week`),
  "week.neglected": () => line("Parts of your funnel have been declared a nature reserve.", `${pp(EFFECT.neglect.conv)} next week`),
  "week.stale": p => `${p.n} raw ${p.n === 1 ? "lead" : "leads"} went stale.`,
  "week.backlog": p => `${p.n} ${p.n === 1 ? "lead" : "leads"} cooled off in the demo queue.`,
  // week: the week that is starting
  "week.next": p => CHAPTER_LINE[p.week] || "",

  /* ---- money in and out ---- */
  // short: the rent took the cash below zero
  "pay.rent": p => line(p.short ? "Rent charged." : "Rent paid. Your landlord continues to demonstrate excellent retention.", usd(-(p.rent || PAY.rent))),
  "pay.salary": () => mostly(
    p => line("Payroll deposited.", `+${usd(p.salary || PAY.salary)}`),
    p => line("Salary deposited. HR has confirmed your continued existence.", `+${usd(p.salary || PAY.salary)}`),
    p => line("Payroll cleared.", `+${usd(p.salary || PAY.salary)}`)),
  "pay.repoWarn": () => line("Finance would like to discuss the jacket.", `Collections at ${usd(CASH.repoAt)} cash`),

  /* ---- stress ---- */
  "stress.warn": p => `Your eye has developed its own KPI. Stress: ${p.stress}.`,

  /* ---- the manager ---- */
  "mgr.emails": p => line("“Excellent email campaign. Have you considered the telephone?”", fx(p) || "−3 manager"),

  /* ---- behind pace: the mid-quarter warning ladder ---- */
  "risk.audit": p => line("Your manager has requested a meeting audit. The meeting to discuss it is booked.", fx(p)),
  "risk.hygiene": p => line("Pipeline hygiene review. Please bring the applicable spreadsheets.", fx(p)),
  "risk.hr": p => line("HR has accepted your next one-to-one invitation.", fx(p)),
  "risk.recurring": () => "A recurring meeting about your performance has appeared on someone’s calendar.",

  /* ---- the quarterly review ---- */
  "qbr.final": p => `Q${p.quarter} final: ${p.pct}% of quota.`,
  "qbr.hit": () => "QBR: leadership applauds the territory’s potential.",
  "qbr.pip": () => "QBR: new developmental milestones, effective immediately.",
  "qbr.pipUp": () => "QBR: the milestones now have milestones.",
  "qbr.macro": () => "QBR: your manager attributes the miss to macroeconomic headwinds.",
  "qbr.survive": () => "QBR: leadership has elected to continue monitoring you.",
  "qbr.dodged": () => "The badge still works. You have a new improvement plan.",
  "qbr.dodgedUp": () => "You kept your badge. The improvement plan has acquired additional pages.",
  "qbr.reassigned": p => `Your manager reassigned ${p.n} ${p.n === 1 ? "deal" : "deals"} worth ${usd(p.value)}. In the interest of continuity.`,
  "qbr.pipGone": () => "The improvement plan is no longer necessary. No one explains why.",

  /* ---- endings: the line that ends the run ---- */
  "end.club": () => "President’s Club. Your territory has been deemed capable of a higher quota.",
  "end.missed": () => "Under quota. Badge access renewed.",
  "end.fired.qbr": () => "The QBR has been reclassified as an exit interview.",
  "end.fired.under70": () => "Below 70% of quota. HR has prepared the paperwork.",
  "end.fired.politics": () => "You hit quota. Leadership has chosen a different direction.",
  "end.fired.review": () => "The forecast review turned into a meeting with HR.",
  "end.fired.org": () => "An organizational announcement has been made. You are not on the new chart.",
  "end.meltdown.stress": () => "Stress reached 100. The employee has stopped responding.",
  "end.meltdown.weekend": () => "The weekend was insufficient to restore normal operating conditions.",
  "end.ascension": p => `Quad shot #${p.shot}. Your departure velocity exceeded expectations.`,
  "end.repo": () => "Collections has recovered the jacket. Please remove it from your profile picture.",

  /* ---- clAInk ---- */
  "ck.install": p => line("clAInk seat activated. The expense has been allocated to you.", usd(-p.cost)),
  "ck.dismiss": () => "Sponsored pilot dismissed for this quarter.",
  "ck.expired": () => "clAInk’s pilot offer has expired. You have missed an opportunity to be invoiced.",
  "ck.cancel": p => line("clAInk seat canceled. Your data will continue its career.", usd(-p.cost)),
  // the Friday invoice. tokens: the week's token count; looped: an agent ran all weekend (the overage)
  "ck.invoice": p => line(`clAInk invoice: ${fmtTok(p.tokens)} tokens, ${p.claims} ${p.claims === 1 ? "outcome" : "outcomes"}.${p.looped ? " An agent worked on itself all weekend." : ""}`, usd(-p.total)),
  "ck.invoice.idle": p => line(`clAInk idle invoice: ${fmtTok(p.tokens)} tokens. Nothing was delegated.${p.looped ? " An agent worked on itself all weekend." : ""}`, usd(-p.total)),
  // a run that worked
  "ck.miracle": () => "Finance has verified an actual clAInk sale.",
  "ck.signed": p => `clAInk: ${p.n} signed, ${usd(p.won)} closed. Commission: ${usd(p.keep)}.`,
  // a run that closed nothing, and the strike it earned. who and line are the strike card's own words (copy/claink.js)
  "ck.run": p => `clAInk: ${p.n} billable ${p.n === 1 ? "outcome" : "outcomes"}, ${fmtTok(p.tokens)} tokens, $0 closed.`,
  "ck.strike": p => `Strike ${p.n}/${p.of} (${p.who}): ${p.line}`,
  "ck.strike.hurt": p => `Strike ${p.n}/${p.of} (${p.who}): ${p.line}`,
  "ck.farewell": p => line(`clAInk’s farewell email cost you ${p.account}.`, p.mgr ? `−${p.mgr} manager` : ""),
  "ck.revoked": p => `Third strike. Seat revoked. Final true-up: ${usd(p.cost)} charged.`,
  // the manager notices. miracle: the run that caught his eye actually worked. hit: what it really cost with him
  "ck.mgr.warning": p => line(`“${CK_QUIP(p.miracle)}” Your manager has issued a writing warning.`, p.hit ? `−${p.hit} manager` : ""),
  "ck.mgr.circle": p => line("“ChatGDP again? We’ll circle back.”", p.hit ? `−${p.hit} manager` : ""),
  "ck.mgr.yoink": p => line(`Your manager took ${p.account} for a practical lesson in account ownership.`, p.hit ? `−${p.hit} manager` : "")
};
