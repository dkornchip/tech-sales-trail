import { fmtTok, money } from "../game/util.js";
import { CK_QUIP } from "./claink.js";
import { ACHIEVEMENTS } from "./names.js";

// Every line the activity log can show, keyed by tag. The game writes log(state, tag, params): the tag and the params
// are what the game knows (and what the sound director reads); the words live only here.
//
// The log is the system of record, so it speaks like one: flat, past tense, the turn at the end of the sentence.
// Counts go in the sentence. Stat changes go in `dl`, which the interface draws after it, so no sentence has to
// carry numbers between a setup and its payoff. A line seen often has several wordings (see engine.js).
const usd = v => money(v).replace("-", "−");
const n = (count, one, many) => `${count} ${count === 1 ? one : many || one + "s"}`;
const it = count => (count === 1 ? "it" : "them");
const line = (text, dl) => (dl ? { text, dl } : text);

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
  friday: "Friday",
  hail: "Hail Mary"
};

export const LOG = {
  /* ---- the twelve actions and the Hail Mary ---- */
  "act.prospect": () => ({ bands: [
    [
      p => `Prospect blitz: ${n(p.n, "new lead")}. The rest went to voicemail.`,
      p => `Prospect blitz: ${n(p.n, "new lead")}. One asked how you got this number.`,
      p => `Prospect blitz: ${n(p.n, "new lead")}. Gatekeepers remain undefeated.`
    ],
    undefined,
    [
      p => `Prospect blitz: ${n(p.n, "new lead")}. They can hear what week it is.`,
      p => `Prospect blitz: ${n(p.n, "new lead")}. You have stopped leaving voicemails.`,
      p => `Prospect blitz: ${n(p.n, "new lead")}. The rest went to voicemail.`
    ]
  ] }),
  "act.cadence": p => (p.n === 0
    ? [
      "Email cadence: no replies. Three out-of-office notices, one of them permanent.",
      "Email cadence: no replies. The sequence carries on without you.",
      "Email cadence: no replies. Step 6 of 9 goes out Thursday."
    ]
    : [
      `Email cadence: ${n(p.n, "warm lead")} replied.`,
      `Email cadence: ${n(p.n, "warm lead")}. “Just bumping this” works again.`,
      `Email cadence: ${n(p.n, "warm lead")}. Step 4 of 9 did the work.`
    ]),
  "act.discovery": p => (p.n === 0
    ? [
      "Discovery: nobody qualified. Budget, authority, need and timeline were all elsewhere.",
      "Discovery: nobody qualified. Everyone is “just exploring.”"
    ]
    : [
      `Discovery: ${n(p.n, "lead")} qualified. A budget exists and someone admitted it.`,
      `Discovery: ${n(p.n, "lead")} qualified. Pain was identified. Some of it theirs.`,
      `Discovery: ${n(p.n, "lead")} qualified.`
    ]),
  "act.demo": p => (p.n === 0
    ? [
      "Demo marathon: nobody moved on. Screen share failed twice. Once was the product.",
      "Demo marathon: nobody moved on. They asked whether it integrates. It does not."
    ]
    : [
      `Demo marathon: ${n(p.n, "deal")} advanced. Nobody asked about the roadmap.`,
      `Demo marathon: ${n(p.n, "deal")} advanced. The SE kept you on the happy path.`,
      `Demo marathon: ${n(p.n, "deal")} advanced.`
    ]),
  "act.propose": p => (p.n === 0
    ? [
      "Proposals: none taken. Everyone needs to “socialize it internally.”",
      "Proposals: none taken. They would like it as a one-pager. It is a one-pager."
    ]
    : [
      `${n(p.n, "proposal")} sent, “valid for 30 days.”`,
      `${n(p.n, "proposal")} sent. Their procurement portal has a portal.`,
      `${n(p.n, "proposal")} sent.`
    ]),
  // size: "whale", "big" or "" (the best referral in the batch)
  "act.network": p => line(
    p.size === "whale" ? `Referrals: ${n(p.n, "introduction")}. One is a whale. Tell nobody.`
      : p.size === "big" ? `Referrals: ${n(p.n, "introduction")}. One of them has a real budget.`
        : `Referrals: ${n(p.n, "introduction")}. Small, but they answered.`,
    "+4 reputation"),
  "act.recharge.already": () => "Recharge is once a week. HR was clear about that.",
  // nap: the lucky bonus in percent, 0 when there was none worth mentioning
  "act.recharge": p => line(
    p.nap
      ? ["Recharged. A proper nap. The calendar block said “focus time.”", "Recharged. You slept through a meeting that could have been an email. It was."]
      : ["Recharged. You took your lunch break. All of it.", "Recharged. Camera off counts.", "Recharged. You closed the laptop and it stayed closed."],
    `+${p.energy} energy · −${p.relief} stress`),
  "act.recharge.flat": p => line("Recharged. Caffeine ate the calm.", `+${p.energy} energy`),
  "act.recharge.trip": p => `Your manager approved the ${p.trip} trip. In writing, which is unusual.`,
  "act.crm": p => line([
    `CRM cleanup: ${n(p.pruned, "dead lead")} closed out. The dashboard is prettier.`,
    `CRM cleanup: ${n(p.pruned, "dead lead")} closed out. Next steps now have next steps.`
  ], `+${p.mgr} manager`),
  "act.crm.clean": p => line("CRM cleanup: nothing to clear. You updated the next-step fields anyway.", `+${p.mgr} manager`),
  "act.crm.nuked": p => line(`“Close that out.” Your manager removed ${p.account} himself.`, `${usd(-p.value)} pipeline`),
  "act.politics": () => line([
    "Coffee with the right people. Lunch with their people.",
    "You agreed with your manager in a meeting, where people could see.",
    "You forwarded your manager’s idea back to him as his idea."
  ], "+8 manager · +3 product · −4 reputation · +2 stress"),
  "act.conference": p => line([
    `Conference: ${n(p.n, "badge scan")}, now leads. The lanyard was the highlight.`,
    `Conference: ${n(p.n, "warm lead")} and a tote bag.`,
    `Conference: ${n(p.n, "warm lead")}. The booth was next to Scheisskorp’s. Theirs had espresso.`
  ], "−$800 · +5 stress"),
  "act.hail.none": () => "No late-stage deals to push.",
  "act.hail.blast": () => "Hail Mary: a “last chance” email to every executive you could find.",
  "act.hail.lean": () => "Hail Mary: you leaned on every late-stage deal at once.",
  "act.hail.chaosWon": () => line("It worked. Nobody will say how.", "+8 manager · +4 stress"),
  "act.hail.chaosLost": () => line("Nobody signed. Nobody left, either.", "−4 manager · +6 stress"),
  "act.hail.torched": () => line("Nothing signed, and the deals you leaned on have feelings.", "−8 manager · −4 reputation · +8 stress"),
  "act.hail.cooked": () => line("Something signed. The rest of the pipeline watched it happen.", "−6 manager · −3 reputation · +8 stress"),

  /* ---- coffee ---- */
  "coffee.shot": p => line(
    p.shot <= 1 ? "Quad shot. The first one is free, apart from the $6."
      : p.shot === 2 ? "Second quad shot. The barista knows your order."
        : p.shot === 3 ? "Third quad shot. Your left eyelid has opinions."
          : `Quad shot ${p.shot}. You can hear the fluorescent lights.`,
    `+${p.energy} energy · +${p.stress} stress`),
  "coffee.crash": p => line(["The caffeine came due.", "Friday. Every quad shot sent its invoice."], `+${p.stress} stress`),

  /* ---- closing: src is a key of CLOSE_SOURCE ---- */
  "close.none": p => `${CLOSE_SOURCE[p.src]}: nothing at proposal stage to sign.`,
  "close.signed": p => line(
    p.src === "friday"
      ? `Friday: ${n(p.n, "deal")} signed without being asked. ${usd(p.won)}.`
      : `${CLOSE_SOURCE[p.src]}: ${n(p.n, "deal")} signed for ${usd(p.won)}.`,
    `+${usd(p.keep)} commission`),
  "close.nobody": p => `${CLOSE_SOURCE[p.src]}: nobody signed. Verbal commits only.`,
  "close.lost": p => [
    `Lost ${n(p.n, "late-stage deal")} worth ${usd(p.value)} to “no decision,” the market leader.`,
    `${n(p.n, "late-stage deal")} walked. ${usd(p.value)} of pipeline went with ${it(p.n)}.`
  ],

  /* ---- deals ---- */
  "deal.ghost": () => ({ bands: [
    [
      p => `${p.account} has stopped replying.`,
      p => `${p.account} is “heads down this quarter.”`,
      p => `${p.account} went dark. The read receipts stopped first.`,
      p => `${p.account} would like to “revisit in the new year.”`
    ],
    undefined,
    [
      p => `${p.account} went dark. It is not personal. It is the end of the quarter.`,
      p => `${p.account} has stopped replying.`,
      p => `${p.account} is “heads down this quarter.” So are you.`
    ]
  ] }),
  "deal.lost": p => `${n(p.n, "deal")} lost. ${usd(p.value)} left the pipeline.`,

  /* ---- achievements: key is a key of ACHIEVEMENTS ---- */
  "ach.unlocked": p => `Noted in your file: ${ACHIEVEMENTS[p.key]}.`,

  /* ---- random events ---- */
  "evt.marketing": p => [
    `Marketing delivered ${n(p.n, "lead")} it describes as warm.`,
    `Marketing passed along ${n(p.n, "lead")}. Each downloaded a PDF once.`
  ],
  "evt.competitor.match": () => line("You matched Scheisskorp’s discount.", "+12% close odds · 20% off · this week"),
  "evt.competitor.hold": () => line("You held the price. Somebody had to.", "−8% close odds this week · +4 reputation"),
  "evt.seFumble": p => line(`The SE’s demo environment died in front of ${p.account}.`, "−6 product · +4 stress"),
  "evt.seSave": p => line(`The SE fixed it live in front of ${p.account}. They took notes.`, "+8 product · +3 reputation"),
  "evt.security.own": () => line("You told customers about the breach before the press did.", "+6 reputation · −18 product · −15% close odds for 2 weeks"),
  "evt.security.spin": () => line("The breach is now an “isolated event.”", "−8 reputation · −12 product · −8% close odds this week"),
  "evt.outage": () => line("Cloud outage in demo week. The status page says “investigating.”", "−12 product"),
  "evt.champion": p => line(`Your champion at ${p.account} got promoted. The deal moved up with them.`, "+3 reputation · +3 manager"),
  "evt.caseStudy": () => line("A case study went live. The customer approved most of the quotes.", "+5 reputation · +8% close odds this week"),
  "evt.meme": p => line(`A trade newsletter quoted the product’s error message. ${n(p.n, "inbound lead")} followed.`, "+4 reputation"),
  "evt.freeze": () => line("Their CFO has discovered spreadsheets. Budgets are frozen.", "−12% close odds this week"),
  "evt.crud": () => line("You brought something home from the conference. It was not a lead.", "−10 energy · +6 stress"),
  "evt.rebalance": p => line(`Territory rebalance: ${n(p.n, "account")} of yours now ${p.n === 1 ? "belongs" : "belong"} to someone your manager likes.`, `${usd(-p.value)} pipeline`),
  "evt.pipShred": () => "Your manager shredded the performance plan. “Fresh start.”",
  "evt.favors": p => `Your manager called in favors: ${n(p.n, "warm introduction")}.`,

  /* ---- End Week ---- */
  "week.fullFunnel": () => line("A full-funnel week. Somebody upstairs noticed.", "+6% close odds next week"),
  "week.neglected": () => line("Most of the funnel went untouched this week. It noticed.", "−6% close odds next week"),
  "week.stale": p => `${n(p.n, "lead")} went stale waiting for a discovery call.`,
  "week.backlog": p => `${n(p.n, "qualified deal")} got tired of waiting for a demo and cooled off.`,
  // The log already puts a divider at the top of each week, so most weeks need no sentence (an empty line is not
  // shown). Three weeks change the rules, and say so.
  "week.next": p => (p.week === 5 ? "Pace reviews start this week."
    : p.week === 6 ? "From here, being behind pace can end the quarter early."
      : p.week === 13 ? "The last week. The QBR is on Friday."
        : ""),

  /* ---- money in and out ---- */
  "pay.rent": () => line("Rent came out.", "−$1,600"),
  "pay.salary": () => line("Payroll ran.", "+$1,000"),
  "pay.repoWarn": () => "Cash is under −$1,000. Collections has opened a file on the jacket.",

  /* ---- stress ---- */
  "stress.warn": p => `Stress is at ${p.stress}. Your eye has started doing that.`,

  /* ---- the manager ---- */
  "mgr.emails": () => line("“Nice emails. Now call someone.”", "−3 manager"),

  /* ---- behind pace: the mid-quarter warning ladder ---- */
  "risk.audit": () => "Your manager wants a meeting audit. “For forecasting.”",
  "risk.hygiene": () => "A surprise pipeline hygiene review has appeared on your calendar.",
  "risk.hr": () => "HR is on your next 1:1. Nobody mentions it.",
  "risk.recurring": () => "Recurring meeting about you. Not invited.",

  /* ---- the quarterly review ---- */
  "qbr.final": p => `The quarter closed at ${p.pct}% of quota.`,
  "qbr.hit": () => "QBR: nods all around.",
  "qbr.pip": () => "QBR: a performance plan, “to support you.”",
  "qbr.pipUp": () => "QBR: the performance plan gains milestones.",
  "qbr.macro": () => "QBR: your manager blames “macro.” You live.",
  "qbr.survive": () => "QBR: forty minutes of “context.” You are still on the org chart.",
  "qbr.dodged": () => "QBR: no termination. A performance plan instead.",
  "qbr.dodgedUp": () => "QBR: you kept the job. The performance plan got a second page.",
  "qbr.reassigned": p => `Your manager reassigned ${n(p.n, "large deal")} worth ${usd(p.value)}. “For coverage.”`,
  "qbr.pipGone": () => "Your manager likes you. The performance plan was never filed.",

  /* ---- endings: the line that ends the run ---- */
  "end.club": () => "Quota hit. President’s Club.",
  "end.missed": () => "Under quota. Still employed.",
  "end.fired.qbr": () => "The QBR became an exit interview.",
  "end.fired.under70": () => "Under 70% of quota. The QBR was short.",
  "end.fired.politics": () => "Quota hit. Role eliminated. HR calls these unrelated.",
  "end.fired.review": () => "The forecast review became an exit meeting.",
  "end.fired.org": () => "A surprise “org update.” Your box is not on the new chart.",
  "end.meltdown.stress": () => "Stress reached 100. Containment failed.",
  "end.meltdown.weekend": () => "The weekend did not help. Containment failed.",
  "end.ascension": p => `Quad shot ${p.shot}. Liftoff.`,
  "end.repo": () => "Collections took the jacket.",

  /* ---- clAInk ---- */
  "ck.install": p => line("clAInk seat activated. Charged back to you.", usd(-p.cost)),
  "ck.dismiss": () => "Ad closed. clAInk stays off for this quarter.",
  "ck.expired": () => "clAInk’s pilot pricing ended. The offer is gone.",
  "ck.cancel": p => line("clAInk seat cancelled. They kept your data.", usd(-p.cost)),
  // the Friday invoice. tokens: the week's token count; looped: an agent ran all weekend (the overage)
  "ck.invoice": p => line(`clAInk invoice: ${fmtTok(p.tokens)} tokens and ${n(p.claims, "outcome")}.${p.looped ? " One agent looped all weekend." : ""}`, usd(-p.total)),
  "ck.invoice.idle": p => line(`clAInk invoice: idle agents kept “thinking.” ${fmtTok(p.tokens)} tokens.${p.looped ? " One agent looped all weekend." : ""}`, usd(-p.total)),
  // a run that worked
  "ck.miracle": () => "clAInk actually worked.",
  "ck.signed": p => line(`clAInk closed ${n(p.n, "deal")} for ${usd(p.won)}.`, `+${usd(p.keep)} commission`),
  // a run that closed nothing, and the strike it earned. who and line are the strike card's own words (copy/claink.js)
  "ck.run": p => `clAInk ran: ${n(p.n, "outcome")}, ${fmtTok(p.tokens)} tokens, $0 closed.`,
  "ck.strike": p => `Strike ${p.n} of ${p.of}, filed by ${p.who}. ${p.line}`,
  "ck.strike.hurt": p => `Strike ${p.n} of ${p.of}, filed by ${p.who}. ${p.line}`,
  "ck.farewell": p => line(`Its farewell email cost you ${p.account}.`, `−${p.mgr} manager`),
  "ck.revoked": p => line("Strike 3 of 3. Seat revoked. Finance ran the token true-up.", usd(-p.cost)),
  // the manager notices. miracle: the run that caught his eye actually worked
  "ck.mgr.warning": p => line(`“${CK_QUIP(p.miracle)}” Your manager noticed. Next time, he steps in.`, `−${p.hit} manager`),
  "ck.mgr.circle": p => line("“ChatGDP again?” He will circle back.", `−${p.hit} manager`),
  "ck.mgr.yoink": p => line(`Your manager took ${p.account} to close himself. “Writing lesson.”`, `−${p.hit} manager`)
};
