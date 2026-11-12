import { money } from "../game/util.js";

// The rules dialog: its title, its button, and one paragraph per row. A paragraph is a term (shown bold) followed by
// its body; the body starts with the space that separates the two. A body is a function of the game's own numbers
// (v), so the rules can never disagree with the game:
//   quota           what has to be closed            rechargeEnergy  energy a Recharge gives
//   luckPct         the top of its lucky bonus, %    tripPct         the roll that earns a trip, %
//   crash           stress per quad shot on Friday   seat            what a clAInk seat costs
//   strikes         strikes that revoke it           trueUpLo/Hi     how far in the red the true-up leaves you
//   offerWeek       the last week of the pilot offer
const usd = v => money(v).replace("-", "−");

export const HELP_TITLE = "How it works";
export const HELP_OK = "Got it";
export const HELP_MEMO = "Read the onboarding memo again";
// The rules come in sections; each section is a heading and its paragraphs.
export const HELP = [
  { title: "The quarter", rows: [
    { term: "The goal.", body: v => ` Close ${usd(v.quota)} in 13 weeks. At the QBR: 100% is President’s Club, 80–99% keeps your job, 70–79% is your manager’s call, under 70% you’re out.` },
    { term: "A week.", body: () => ` Five slots and whatever energy you have. Spend them, then end the week.` },
    { term: "Closed (Q)", body: () => ` is revenue this quarter. Behind pace from week 5? Warnings. From week 6, maybe a surprise exit.` },
    { term: "Cash", body: () => ` is salary and 12% commission in, rent out (weeks 1, 5 and 9). At −$1,500 the jacket goes.` }
  ] },
  { title: "The funnel", rows: [
    { term: "Pipeline", body: () => ` is the value of live deals. Actions move them down the funnel: lead, discovery, demo, proposal, close.` },
    { term: "Full-funnel week.", body: () => ` Work three of the four parts (leads, discovery, demos, proposing or closing) for +6% close odds next week. One or none: −6%.` },
    { term: "Skills", body: () => ` boost their matching action and feed the close math.` },
    { term: "Reputation", body: () => ` grows deal size and nudges close odds.` },
    { term: "Product", body: () => ` is how cursed the stack is. Low product sinks demos and closes.` }
  ] },
  { title: "You", rows: [
    { term: "Energy", body: () => ` fuels actions. +15 every Friday.` },
    { term: "Recharge", body: v => ` once a week: +${v.rechargeEnergy} energy, −12 stress, plus a 0–${v.luckPct}% lucky bonus. Over ${v.tripPct}% and your manager signs off a trip. Coffee blunts it.` },
    { term: "Stress", body: () => ` hurts close rates. 80+ can melt you down at week end; 100 is instant.` },
    { term: "Quad shot", body: v => ` hits harder each shot that week. Shot 3+ can put you in orbit; a shot to 100 stress will. Each one: +${v.crash} stress at week end, weaker recharge.` }
  ] },
  { title: "The office", rows: [
    { term: "Manager", body: () => ` nudges close odds, drives PIPs and firing. Emails without calls annoy him.` },
    { term: "CRM cleanup", body: () => ` weekly: prunes dead leads, +manager, freezes warnings, trims fire odds. Boss may nuke a good deal.` },
    { term: "clAInk", body: v => ` is a sponsored AI pilot. Close the ad and it’s gone this run. A ${usd(v.seat)} seat buys one agent run a week, billed Friday, idle weeks too. 1 in 5 closes real deals; the rest burn tokens on billed “outcomes” and earn a strike, sometimes with damage. Strike ${v.strikes}: seat revoked, a deal walks, and a true-up takes all your cash plus ${usd(v.trueUpLo)}–${usd(v.trueUpHi)}. The offer ends after week ${v.offerWeek}. Your manager may notice.` }
  ] },
  { title: "Keyboard", rows: [
    { term: "Keys.", body: () => ` The number row runs the actions in order. E ends the week, H is the Hail Mary, M mutes, ? opens this.` }
  ] }
];
