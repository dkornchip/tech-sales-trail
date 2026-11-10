import { money } from "../game/util.js";

// The Rules dialog ("How It Works"): its title, its button, and one paragraph per row. A paragraph is a term (shown
// bold) followed by its body. A body is a function of the game's own numbers (v), so the rules can never disagree
// with the game:
//   rechargeEnergy  energy a Recharge gives          luckPct    the top of its lucky bonus, in percent
//   tripPct         the roll that earns a trip, %    crash      stress per Quad Shot at week end
//   seat            what a clAInk seat costs         strikes    strikes that revoke it
//   trueUpLo/Hi     how far in the red the true-up leaves you    offerWeek   the last week of the pilot offer
export const HELP_TITLE = "How It Works";
export const HELP_OK = "Got it";
export const HELP = [
  { term: "Energy", body: () => ` fuels actions. Small refill at week end.` },
  { term: "Recharge", body: v => ` once a week: +${v.rechargeEnergy} energy, -12 stress, plus a 0–${v.luckPct}% lucky bonus. Over ${v.tripPct}% and your manager signs off a trip. Coffee blunts it.` },
  { term: "Stress", body: () => ` hurts close rates. 80+ can melt you down at week end; 100 is instant.` },
  { term: "Quad Shot", body: v => ` hits harder each shot that week. Shot 3+ can put you in orbit; a shot to 100 stress will. Each one: +${v.crash} stress at week end, weaker Recharge.` },
  { term: "CRM Cleanup", body: () => ` weekly: prunes dead leads, +manager, freezes warnings, trims fire odds. Boss may nuke a good deal.` },
  { term: "clAInk", body: v => ` is a sponsored AI pilot. Close the ad and it's gone this run. A ${money(v.seat)} seat buys one agent run a week (no energy or slots; billed Friday, idle weeks too): 1 in 5 closes real deals, the rest burn tokens on billed “outcomes” and earn a strike from the AI Governance Council, sometimes with damage. Strike ${v.strikes}: seat revoked, a deal walks, and a token true-up that takes all your cash and leaves you ${money(v.trueUpLo)}–${money(v.trueUpHi)} in the red (more if you're already there). The pilot offer ends after week ${v.offerWeek}. Your manager may notice: the first time is a warning to improve your writing, after that he steps into your deals.` },
  { term: "Cash", body: () => ` is salary and commission in, rent out. At -$1,500 the jacket goes.` },
  { term: "Pipeline", body: () => ` is the value of live deals. Actions move them down the funnel.` },
  { term: "Closed (Q)", body: () => ` is revenue this quarter. Behind pace from week 5? Warnings, or a surprise exit.` },
  { term: "Manager", body: () => ` nudges close odds, drives PIPs and firing. Emails without calls annoy them.` },
  { term: "Reputation", body: () => ` grows deal size and nudges close odds.` },
  { term: "Product", body: () => ` is how cursed the stack is. Low product sinks demos and closes.` },
  { term: "Skills", body: () => ` boost their matching action and feed the close math.` },
  { term: "Modifiers", body: () => ` are short-term close and discount effects from events and full-funnel weeks.` }
];
