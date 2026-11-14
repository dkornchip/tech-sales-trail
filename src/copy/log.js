import { COST } from "../game/rules.js";
import { fmtTok, money } from "../game/util.js";
import { CK_QUIP } from "./claink.js";
import { ACHIEVEMENTS } from "./names.js";

// Every line the activity log can show, keyed by tag. The game writes log(state, tag, params): the tag and the params
// are what the game knows (and what the sound director reads); the words live only here.
//
// The words are the ones the game has always used: short, blunt, the joke in as few of them as it takes. What
// v2.0 changed is the typesetting. The picture in front of a line is drawn from its tag (no emoji), counts are
// real plurals, and a line's stat changes go in `dl`, which the interface draws after the sentence as chips.
const usd = v => money(v).replace("-", "−");
const n = (count, one, many) => `${count} ${count === 1 ? one : many || one + "s"}`;
const line = (text, dl) => (dl ? { text, dl } : text);
const spent = act => `−${COST[act].energy} energy`;   // what the action cost, from the rules' own table

// For the copy lint: lines whose params are codes, with the codes to try.
export const lint = { params: {
  "LOG.close.none": [{ src: "close" }, { src: "hail" }],
  "LOG.close.nobody": [{ src: "close" }, { src: "negotiations" }],
  "LOG.close.signed": [{ src: "close", n: 1, won: 18200, keep: 2184 }, { src: "friday", n: 2, won: 41000, keep: 4920 }, { src: "hail", n: 3, won: 90500, keep: 10860 }],
  "LOG.ach.unlocked": [{ key: "whale" }]
} };

// Where a batch of closes came from: tryCloseSome(state, source).
export const CLOSE_SOURCE = {
  negotiations: "Negotiations",
  close: "Close push",
  friday: "Friday closes",
  hail: "Hail Mary"
};

export const LOG = {
  /* ---- the twelve actions and the Hail Mary ---- */
  "act.prospect": p => line(`Blitz: +${n(p.n, "lead")}.`, spent("prospect")),
  "act.cadence": p => line(`Cadence: +${n(p.n, "warm lead")}.`, spent("cadence")),
  "act.discovery": p => line(`Discovery: ${p.n} qualified.`, spent("discovery")),
  "act.demo": p => line(`Demos: ${p.n} advanced.`, spent("demo")),
  "act.propose": p => line(`Proposals: ${p.n} sent.`, spent("propose")),
  // size: "whale", "big" or "" (the best referral in the batch)
  "act.network": p => line(`Referrals: +${n(p.n, "intro")}.${p.size === "whale" ? " Whale." : p.size === "big" ? " Big one." : ""}`, `${spent("network")} · +4 reputation`),
  // nap: the lucky bonus in percent, 0 when there was none worth mentioning
  "act.recharge": p => line(`Recharged.${p.nap ? ` Good nap, +${p.nap}%.` : ""}`, `+${p.energy} energy · −${p.relief} stress`),
  "act.recharge.flat": p => line("Recharged. Caffeine ate the calm.", `+${p.energy} energy`),
  "act.recharge.trip": p => `Manager approved your ${p.trip} trip.`,
  "act.crm": p => line(`CRM cleanup. −${n(p.pruned, "dead lead")}.`, `+${p.mgr} manager`),
  "act.crm.clean": p => line("CRM cleanup. Nothing dead.", `+${p.mgr} manager`),
  "act.crm.nuked": p => line(`“Close that out.” ${p.account} gone.`, `${usd(-p.value)} pipeline`),
  "act.politics": () => line("Politics.", "+8 manager · +3 product · −4 reputation · +2 stress"),
  "act.conference": p => line(`Conference: +${n(p.n, "lead")}.`, `${spent("conference")} · ${usd(-COST.conference.cash)} · +5 stress`),
  "act.hail.blast": () => "Hail Mary: “last chance” blast to every exec.",
  "act.hail.lean": () => "Hail Mary: leaning on every late deal. Hard.",
  "act.hail.chaosWon": () => line("Chaos worked.", "+8 manager · +4 stress"),
  "act.hail.chaosLost": () => line("All noise, no ink.", "−4 manager · +6 stress"),
  "act.hail.torched": () => line("Pipe torched.", "−8 manager · −4 reputation · +8 stress"),
  "act.hail.cooked": () => line("Got ink, cooked the pipe.", "−6 manager · −3 reputation · +8 stress"),

  /* ---- coffee ---- */
  "coffee.shot": p => line(`Shot #${p.shot}.`, `+${p.energy} energy · +${p.stress} stress`),
  "coffee.crash": p => line("Caffeine crash.", `+${p.stress} stress`),

  /* ---- closing: src is a key of CLOSE_SOURCE ---- */
  "close.none": p => `${CLOSE_SOURCE[p.src]}: no late-stage deals.`,
  "close.signed": p => `${CLOSE_SOURCE[p.src]}: ${p.n} signed, ${usd(p.won)}. You keep ${usd(p.keep)}.`,
  "close.nobody": p => `${CLOSE_SOURCE[p.src]}: nobody signed. Verbal commits only.`,
  "close.lost": p => `Lost ${n(p.n, "late-stage deal")}, ${usd(p.value)}.`,

  /* ---- deals ---- */
  "deal.ghost": p => `${p.account} went dark.`,
  "deal.lost": p => `Lost ${n(p.n, "deal")}, ${usd(p.value)}.`,

  /* ---- achievements: key is a key of ACHIEVEMENTS ---- */
  "ach.unlocked": p => `Unlocked: ${ACHIEVEMENTS[p.key]}.`,

  /* ---- random events ---- */
  "evt.marketing": p => `Marketing delivered ${p.n} “warm” ${p.n === 1 ? "lead" : "leads"}.`,
  "evt.competitor.match": () => line("Matched 20%. Wins up, ACV down this week.", "+12% close odds · 20% off · this week"),
  "evt.competitor.hold": () => line("Held price. Fewer closes this week.", "−8% close odds this week · +4 reputation"),
  "evt.seFumble": p => line(`SE fumbled ${p.account}.`, "−6 product · +4 stress"),
  "evt.seSave": p => line(`SE saved ${p.account}.`, "+8 product · +3 reputation"),
  "evt.security.own": () => line("Came clean. Closes tank for a bit.", "+6 reputation · −18 product · −15% close odds for 2 weeks"),
  "evt.security.spin": () => line("Spun it. Pipe mostly safe, rep takes a hit.", "−8 reputation · −12 product · −8% close odds this week"),
  "evt.outage": () => line("Cloud outage ate the demos.", "−12 product"),
  "evt.champion": p => line(`Champion promoted at ${p.account}. Deal moves up.`, "+3 reputation · +3 manager"),
  "evt.caseStudy": () => line("Case study live.", "+5 reputation · +8% close odds this week"),
  "evt.meme": p => line(`Product became a meme. +${n(p.n, "inbound lead")}.`, "+4 reputation"),
  "evt.freeze": () => line("Budget freeze rumor. Closes nerfed this week.", "−12% close odds this week"),
  "evt.crud": () => line("Conference crud.", "−10 energy · +6 stress"),
  "evt.rebalance": p => `Territory “rebalance.” Lost ${n(p.n, "top deal")}, ${usd(p.value)}.`,
  "evt.pipShred": () => "Manager shredded your PIP. “Fresh start.”",
  "evt.favors": p => `Manager called in favors. +${n(p.n, "warm intro")}.`,

  /* ---- End Week ---- */
  "week.fullFunnel": () => line("Full-funnel week.", "+6% close odds next week"),
  "week.neglected": () => line("Funnel neglected.", "−6% close odds next week"),
  "week.stale": p => `${n(p.n, "raw lead")} went stale.`,
  "week.backlog": p => `Demo backlog: ${n(p.n, "lead")} went cold.`,
  // The log already puts a divider at the top of each week, so most weeks need no sentence (an empty line is not
  // shown). Three weeks change the rules, and say so.
  "week.next": p => (p.week === 5 ? "Pace reviews start this week."
    : p.week === 6 ? "From now on, behind pace can get you fired."
      : p.week === 13 ? "Last week. QBR on Friday."
        : ""),

  /* ---- money in and out ---- */
  "pay.rent": () => line("Rent.", "−$1,600"),
  "pay.salary": () => line("Salary.", "+$1,000"),
  "pay.repoWarn": () => "Cash under −$1,000. Finance eyes the jacket.",

  /* ---- stress ---- */
  "stress.warn": p => `Eye twitch. Stress ${p.stress}.`,

  /* ---- the manager ---- */
  "mgr.emails": () => line("“Nice emails. Now call someone.”", "−3 manager"),

  /* ---- behind pace: the mid-quarter warning ladder ---- */
  "risk.audit": () => "Manager wants a meeting audit. “For forecasting.”",
  "risk.hygiene": () => "Surprise “pipeline hygiene” review.",
  "risk.hr": () => "HR is on your next 1:1. Nobody mentions it.",
  "risk.recurring": () => "Recurring meeting about you. Not invited.",

  /* ---- the quarterly review ---- */
  "qbr.final": p => `Q${p.quarter} final: ${p.pct}% of quota.`,
  "qbr.hit": () => "QBR: nods all around. No PIP.",
  "qbr.pip": () => "QBR: soft PIP. More dashboards.",
  "qbr.pipUp": () => "QBR: PIP tightens. Milestones now fiction.",
  "qbr.macro": () => "QBR: manager blames “macro.” You live.",
  "qbr.survive": () => "QBR: passive-aggressive. You survive.",
  "qbr.dodged": () => "Dodged the axe. Landed on a PIP.",
  "qbr.dodgedUp": () => "Barely kept the badge. PIP escalates.",
  "qbr.reassigned": p => `Manager “reassigned” ${n(p.n, "big deal")}, ${usd(p.value)}.`,
  "qbr.pipGone": () => "Manager likes you. PIP vanishes.",

  /* ---- endings: the line that ends the run ---- */
  "end.club": () => "Number hit. President’s Club.",
  "end.missed": () => "Under quota. Still employed.",
  "end.fired.qbr": () => "QBR became an exit interview.",
  "end.fired.under70": () => "QBR: under 70%. Voted off the island.",
  "end.fired.politics": () => "Hit quota, fired anyway. Politics.",
  "end.fired.review": () => "Forecast review became an exit meeting.",
  "end.fired.org": () => "Surprise “org update.” You’re off the chart.",
  "end.meltdown.stress": () => "Stress 100. Meltdown.",
  "end.meltdown.weekend": () => "Weekend didn’t help. Meltdown.",
  "end.ascension": p => `Shot #${p.shot}. Liftoff.`,
  "end.repo": () => "Collections took the jacket. Last flex, gone.",

  /* ---- clAInk ---- */
  "ck.install": p => line("clAInk seat live. Charged back to you.", usd(-p.cost)),
  "ck.dismiss": () => "Ad closed. clAInk is off this run.",
  "ck.expired": () => "clAInk’s pilot pricing ended. Offer gone.",
  "ck.cancel": p => line("clAInk seat cancelled. They kept your data.", usd(-p.cost)),
  // the Friday invoice. tokens: the week's token count; looped: an agent ran all weekend (the overage)
  "ck.invoice": p => line(`clAInk invoice: ${fmtTok(p.tokens)} tokens, ${n(p.claims, "outcome")}.${p.looped ? " One agent looped all weekend." : ""}`, usd(-p.total)),
  "ck.invoice.idle": p => line(`clAInk invoice. Idle agents kept “thinking”: ${fmtTok(p.tokens)} tokens.${p.looped ? " One agent looped all weekend." : ""}`, usd(-p.total)),
  // a run that worked
  "ck.miracle": () => "clAInk actually worked.",
  "ck.signed": p => `clAInk: ${p.n} signed, ${usd(p.won)}. You keep ${usd(p.keep)}.`,
  // a run that closed nothing, and the strike it earned. who and line are the strike card's own words (copy/claink.js)
  "ck.run": p => `clAInk run: ${n(p.n, "outcome")}, ${fmtTok(p.tokens)} tokens, $0 closed.`,
  "ck.strike": p => `Strike ${p.n}/${p.of} (${p.who}): ${p.line}`,
  "ck.strike.hurt": p => `Strike ${p.n}/${p.of} (${p.who}): ${p.line}`,
  "ck.farewell": p => line(`Its farewell email lost you ${p.account}.`, `−${p.mgr} manager`),
  "ck.revoked": p => `Strike 3/3. Seat revoked. Token true-up: ${usd(-p.cost)}.`,
  // the manager notices. miracle: the run that caught his eye actually worked
  "ck.mgr.warning": p => line(`“${CK_QUIP(p.miracle)}” Warning: improve your writing, or he steps into your deals.`, `−${p.hit} manager`),
  "ck.mgr.circle": p => line("“ChatGDP again?” He’ll circle back.", `−${p.hit} manager`),
  "ck.mgr.yoink": p => line(`Boss took ${p.account}. “Writing lesson.”`, `−${p.hit} manager`)
};
