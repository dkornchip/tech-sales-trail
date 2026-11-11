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
    { term: "The goal.", body: v => ` Close ${usd(v.quota)} in 13 weeks. At the QBR, 100% is President’s Club, 80–99% keeps your job, 70–79% is your manager’s call, and under 70% is nobody’s call.` },
    { term: "A week.", body: () => ` Five slots and whatever energy you have. Spend them, then end the week.` },
    { term: "Pace.", body: () => ` Week 7 of 13 means about half your quota should be closed. From week 5, being behind brings warnings. From week 6, it can end the quarter.` },
    { term: "Cash.", body: () => ` Salary and 12% commission come in. Rent goes out in weeks 1, 5 and 9. At −$1,500, Collections takes the jacket.` }
  ] },
  { title: "The funnel", rows: [
    { term: "The funnel.", body: () => ` A lead is qualified by discovery, shown a demo, sent a proposal, then closed. Each of those buttons works on every deal waiting at that stage.` },
    { term: "A full week.", body: () => ` The funnel has four parts: finding leads, discovery, demos, and proposing or closing. Work three in a week and next week’s close odds rise 6%. Work one or none and they fall 6%.` },
    { term: "Skills", body: () => ` grow as you use them, and each one improves the odds of its own action.` },
    { term: "Reputation", body: () => ` makes deals bigger and closes a little likelier.` },
    { term: "Product", body: () => ` is how well the software holds up. When it is low, demos and closes suffer.` }
  ] },
  { title: "You", rows: [
    { term: "Energy", body: () => ` pays for actions. You get 15 back every Friday.` },
    { term: "Recharge,", body: v => ` once a week: +${v.rechargeEnergy} energy and −12 stress, up to ${v.luckPct}% more after a good nap. A very good nap (over ${v.tripPct}%) gets a trip approved. Quad shots blunt it.` },
    { term: "Stress", body: () => ` lowers your close odds. At 80 or more, a weekend can end the quarter. At 100, it ends on the spot.` },
    { term: "Quad shot.", body: v => ` Energy now, stress now, and ${v.crash} more stress on Friday. Each shot in a week hits harder. From the third, your heart gets a vote.` }
  ] },
  { title: "The office", rows: [
    { term: "Your manager", body: () => ` improves your close odds and decides what happens when you are behind. A week of emails with no calls costs you with him.` },
    { term: "CRM cleanup,", body: () => ` once a week: clears dead leads, pleases your manager and softens that week’s pace review. He may close out a live deal while he is in there.` },
    { term: "clAInk", body: v => ` is a sponsored AI pilot. A ${usd(v.seat)} seat buys one agent run a week, billed on Friday whether or not you ran it. One run in five closes real deals. The others bill you for “outcomes” and earn a strike, and some strikes do damage. Strike ${v.strikes} revokes the seat, loses a deal and takes all your cash plus ${usd(v.trueUpLo)}–${usd(v.trueUpHi)}. The offer ends after week ${v.offerWeek}; close the ad and it is gone for the quarter. Your manager may notice.` }
  ] },
  { title: "Keyboard", rows: [
    { term: "Keys.", body: () => ` The number row runs the actions in order. E ends the week, H is the Hail Mary, M mutes, ? opens this.` }
  ] }
];
