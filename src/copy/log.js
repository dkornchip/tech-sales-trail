import { fmtTok, money } from "../game/util.js";
import { CK_QUIP } from "./claink.js";
import { ACHIEVEMENTS } from "./names.js";

// Every line the activity log can show, keyed by tag. The game writes log(state, tag, params): the tag and the params
// are what the game knows (and what the sound director reads); the words live only here.
// A line is a function of its params (p). Params are small scalars: counts, dollar amounts (numbers; money() formats
// them), account names, the week. One tag per template; where the game picks between wordings, each has its own tag.

// Where a batch of closes came from: tryCloseSome(state, source).
export const CLOSE_SOURCE = {
  negotiations: "🧾 Negotiations",
  close: "🤝 Close push",
  friday: "🕘 Friday closes",
  hail: "🧪 Hail-Mary"
};

export const LOG = {
  /* ---- the twelve actions and the Hail Mary ---- */
  "act.prospect": p => `📞 Blitz: +${p.n} lead(s). -30 energy.`,
  "act.cadence": p => `✉️ Cadence: +${p.n} warm lead(s). -18 energy.`,
  "act.discovery": p => `🔎 Discovery: ${p.n} qualified. -22 energy.`,
  "act.demo": p => `🖥️ Demos: ${p.n} advanced. -28 energy.`,
  "act.propose": p => `📑 Proposals: ${p.n} sent. -25 energy.`,
  // size: "whale", "big" or "" (the best referral in the batch)
  "act.network": p => `🧑‍🤝‍🧑 Referrals: +${p.n} intro(s). -16 energy.${p.size === "whale" ? " 🐋 Whale." : p.size === "big" ? " 🐳 Big one." : ""}`,
  "act.recharge.already": () => "⏱️ Already recharged this week.",
  // nap: the lucky bonus in percent, 0 when there was none worth mentioning
  "act.recharge": p => `🧘 Recharged. +${p.energy} energy, -${p.relief} stress.${p.nap ? ` Good nap, +${p.nap}%.` : ""}`,
  "act.recharge.flat": p => `🧘 Recharged. +${p.energy} energy. Caffeine ate the calm.`,
  "act.recharge.trip": p => `🏝️ Manager approved your ${p.trip} trip.`,
  "act.crm": p => `🧹 CRM cleanup. -${p.pruned} dead lead(s), +${p.mgr} manager.`,
  "act.crm.clean": p => `🧹 CRM cleanup. Nothing dead. +${p.mgr} manager.`,
  "act.crm.nuked": p => `🗑️ “Close that out.” ${p.account} gone. -${money(p.value)}.`,
  "act.politics": () => "🏛️ Politics: +8 manager, +3 product, -4 rep.",
  "act.conference": p => `🏟️ Conference: +${p.n} leads. -40 energy, -$800.`,
  "act.hail.none": () => "🧪 No late-stage deals to Hail-Mary.",
  "act.hail.blast": () => "🧪 Hail-Mary: “last chance” blast to every exec.",
  "act.hail.lean": () => "🧪 Hail-Mary: leaning on every late deal. Hard.",
  "act.hail.chaosWon": () => "🌪️ Chaos worked. +8 manager, +4 stress.",
  "act.hail.chaosLost": () => "🤕 All noise, no ink. -4 manager, +6 stress.",
  "act.hail.torched": () => "📛 Pipe torched. -8 manager, -4 rep, +8 stress.",
  "act.hail.cooked": () => "😬 Got ink, cooked the pipe. Net -6 manager, -3 rep.",

  /* ---- coffee ---- */
  "coffee.shot": p => `☕ Shot #${p.shot}. +${p.energy} energy, +${p.stress} stress.`,
  "coffee.crash": p => `🥴 Caffeine crash. +${p.stress} stress.`,

  /* ---- closing: src is a key of CLOSE_SOURCE ---- */
  "close.none": p => `${CLOSE_SOURCE[p.src]}: no late-stage deals.`,
  "close.signed": p => `${CLOSE_SOURCE[p.src]}: ${p.n} signed, ${money(p.won)}. You keep ${money(p.keep)}.`,
  "close.nobody": p => `${CLOSE_SOURCE[p.src]}: nobody signed. Verbal commits only.`,
  "close.lost": p => `💀 Lost ${p.n} late-stage deal(s), ${money(p.value)}.`,

  /* ---- deals ---- */
  "deal.ghost": p => `👻 ${p.account} went dark.`,
  "deal.lost": p => `💀 Lost ${p.n} deal(s), ${money(p.value)}.`,

  /* ---- achievements: key is a key of ACHIEVEMENTS ---- */
  "ach.unlocked": p => `🏅 Unlocked: ${ACHIEVEMENTS[p.key]}`,

  /* ---- random events ---- */
  "evt.marketing": p => `📣 Marketing delivered ${p.n} “warm” leads.`,
  "evt.competitor.match": () => "💸 Matched 20%. Wins up, ACV down this week.",
  "evt.competitor.hold": () => "🧱 Held price. Fewer closes this week, +rep.",
  "evt.seFumble": p => `🛠️ SE fumbled ${p.account}. -6 product, +4 stress.`,
  "evt.seSave": p => `🧙 SE saved ${p.account}. +8 product, +3 rep.`,
  "evt.security.own": () => "🔦 Came clean. +rep, closes tank for a bit.",
  "evt.security.spin": () => "🌀 Spun it. Pipe mostly safe, rep takes a hit.",
  "evt.outage": () => "🌩️ Cloud outage ate the demos. -12 product.",
  "evt.champion": p => `🪜 Champion promoted at ${p.account}. Deal moves up.`,
  "evt.caseStudy": () => "📘 Case study live. +rep, +8% close for now.",
  "evt.meme": p => `🐦 Product became a meme. +${p.n} inbound lead(s).`,
  "evt.freeze": () => "🥶 Budget freeze rumor. Closes nerfed this week.",
  "evt.crud": () => "🤒 Conference crud. -10 energy, +6 stress.",
  "evt.rebalance": p => `📉 Territory “rebalance.” Lost ${p.n} top deal(s), ${money(p.value)}.`,
  "evt.pipShred": () => "🛡️ Manager shredded your PIP. “Fresh start.”",
  "evt.favors": p => `🛡️ Manager called in favors. +${p.n} warm intro(s).`,

  /* ---- End Week ---- */
  "week.fullFunnel": () => "🧩 Full-funnel week. +6% close next week.",
  "week.neglected": () => "🪫 Funnel neglected. -6% close next week.",
  "week.stale": p => `🍂 ${p.n} raw lead(s) went stale.`,
  "week.backlog": p => `🕑 Demo backlog: ${p.n} lead(s) went cold.`,
  "week.next": p => `📆 Week ${p.week}.`,

  /* ---- money in and out ---- */
  "pay.rent": () => "🏠 Rent: -$1,600.",
  "pay.salary": () => "💸 Salary: +$1,000.",
  "pay.repoWarn": () => "⚠️ Cash under -$1,000. Finance eyes the jacket.",

  /* ---- stress ---- */
  "stress.warn": p => `🫀 Eye twitch. Stress ${p.stress}.`,

  /* ---- the manager ---- */
  "mgr.emails": () => "📵 “Nice emails. Now call someone.” -3 manager.",

  /* ---- behind pace: the mid-quarter warning ladder ---- */
  "risk.audit": () => "👀 Manager wants a meeting audit. “For forecasting.”",
  "risk.hygiene": () => "📋 Surprise “pipeline hygiene” review.",
  "risk.hr": () => "🧊 HR is on your next 1:1. Nobody mentions it.",
  "risk.recurring": () => "📆 Recurring meeting about you. Not invited.",

  /* ---- the quarterly review ---- */
  "qbr.final": p => `📊 Q${p.quarter} final: ${p.pct}% of quota.`,
  "qbr.hit": () => "🗣️ QBR: nods all around. No PIP.",
  "qbr.pip": () => "🗣️ QBR: soft PIP. More dashboards.",
  "qbr.pipUp": () => "🗣️ QBR: PIP tightens. Milestones now fiction.",
  "qbr.macro": () => "🗣️ QBR: manager blames “macro.” You live.",
  "qbr.survive": () => "🗣️ QBR: passive-aggressive. You survive.",
  "qbr.dodged": () => "📄 Dodged the axe. Landed on a PIP.",
  "qbr.dodgedUp": () => "📄 Barely kept the badge. PIP escalates.",
  "qbr.reassigned": p => `📉 Manager “reassigned” ${p.n} big deal(s), ${money(p.value)}.`,
  "qbr.pipGone": () => "🪄 Manager likes you. PIP vanishes.",

  /* ---- endings: the line that ends the run ---- */
  "end.club": () => "🏆 Number hit. President’s Club.",
  "end.missed": () => "😮‍💨 Under quota. Still employed.",
  "end.fired.qbr": () => "🗣️ QBR became an exit interview.",
  "end.fired.under70": () => "🗣️ QBR: under 70%. Voted off the island.",
  "end.fired.politics": () => "🗡️ Hit quota, fired anyway. Politics.",
  "end.fired.review": () => "📉 Forecast review became an exit meeting.",
  "end.fired.org": () => "🪓 Surprise “org update.” You’re off the chart.",
  "end.meltdown.stress": () => "☢️ Stress 100. Meltdown.",
  "end.meltdown.weekend": () => "☢️ Weekend didn’t help. Meltdown.",
  "end.ascension": p => `🚀 Shot #${p.shot}. Liftoff.`,
  "end.repo": () => "🧥 Collections took the jacket. Last flex, gone.",

  /* ---- clAInk ---- */
  "ck.install": p => `🤖 clAInk seat live. -${money(p.cost)}, charged back to you.`,
  "ck.dismiss": () => "🙅 Ad closed. clAInk is off this run.",
  "ck.expired": () => "⏳ clAInk's pilot pricing ended. Offer gone.",
  "ck.cancel": p => `🔌 clAInk seat cancelled. -${money(p.cost)}. They kept your data.`,
  // the Friday invoice. tokens: the week's token count; looped: an agent ran all weekend (the overage)
  "ck.invoice": p => `🧾 clAInk invoice: -${money(p.total)}. ${fmtTok(p.tokens)} tokens, ${p.claims} outcome${p.claims === 1 ? "" : "s"}.${p.looped ? " One agent looped all weekend." : ""}`,
  "ck.invoice.idle": p => `🧾 clAInk invoice: -${money(p.total)}. Idle agents kept “thinking”: ${fmtTok(p.tokens)} tokens.${p.looped ? " One agent looped all weekend." : ""}`,
  // a run that worked
  "ck.miracle": () => "✨ clAInk actually worked.",
  "ck.signed": p => `🤖 clAInk: ${p.n} signed, ${money(p.won)}. You keep ${money(p.keep)}.`,
  // a run that closed nothing, and the strike it earned. who and line are the strike card's own words (copy/claink.js)
  "ck.run": p => `🤖 clAInk run: ${p.n} outcomes, ${fmtTok(p.tokens)} tokens, $0 closed.`,
  "ck.strike": p => `⚖️ Strike ${p.n}/${p.of} (${p.who}): ${p.line}`,
  "ck.strike.hurt": p => `💥 Strike ${p.n}/${p.of} (${p.who}): ${p.line}`,
  "ck.farewell": p => `💔 Its farewell email lost you ${p.account}. -${p.mgr} mgr.`,
  "ck.revoked": p => `🔒 Strike 3/3. Seat revoked. Token true-up: -${money(p.cost)}.`,
  // the manager notices. miracle: the run that caught his eye actually worked
  "ck.mgr.warning": p => `👔 '${CK_QUIP(p.miracle)}' -${p.hit} manager. Warning: improve your writing, or he steps into your deals.`,
  "ck.mgr.circle": p => `👔 'ChatGDP again?' -${p.hit} manager. He'll circle back.`,
  "ck.mgr.yoink": p => `👔 Boss took ${p.account}. 'Writing lesson.' -${p.hit} mgr.`
};
