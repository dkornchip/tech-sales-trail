import { fmtTok, money } from "../game/util.js";

// Everything the clAInk panel prints that is not a run report (those lines are in claink.js): the ad, the agent
// workspace, the strike boxes, the end cards. The vendor is the one voice in the game allowed enthusiasm.
// Amounts arrive as numbers and are formatted here.
// The word joiner keeps a minus sign on the same line as its amount (the panel is narrow on a phone).
const usd = v => money(v).replace("-", "−\u2060");
const words = n => ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"][n] || String(n);
const span = (lo, hi) => `${usd(lo)}\u2060–\u2060${usd(hi)}`;      // a range of amounts, kept in one piece when a line wraps

export const CK_AD = {
  label: mini => "Sponsored: clAInk Enterprise" + (mini ? " (minimized)" : ""),
  sponsored: "Sponsored · Enterprise pilot",
  ends: (lastWeek, week) => (lastWeek ? "Pilot pricing ends this week" : `Pilot pricing ends week ${week}`),
  expand: "Expand", minimize: "Minimize",
  expandLabel: "Expand clAInk ad", minimizeLabel: "Minimize clAInk ad",
  // the X: it turns clAInk off for the rest of the run, so the control says so and makes no joke of it
  closeLabel: "Dismiss pilot for this run (cannot undo)",
  closeTitle: "Dismiss pilot for this run (cannot undo)",
  announce: ["New: ", "Autonomous Revenue Orchestration", " is GA"],
  headline: "What if your pipeline could pipeline itself?",
  sub: "Meet the autonomous revenue orchestration ecosystem. Deploy a team of agents to research accounts, personalize outreach and advance your pipeline while you’re busy doing sales.",
  chips: ["Account intelligence", "Outreach at scale", "Autonomous pipeline"],
  // the vendor's marketing: nothing here is a number from your run. The by-line is the owner's (it replaced the
  // copydeck's "fictional enterprise customer"): the customer is on a list nobody would want to be on.
  proof: "“We have fundamentally transformed how we measure productivity.”",
  // (two parts: who, and the list. The list is kept in one piece when the line has to break.)
  proofBy: ["VP, Revenue Transformation · Fortune 500,000 company", "(latest Post-Product, Pre-Revenue Hot List!)"],
  price: ["Outcome-based pricing.", " Pay for outcomes and the compute required to deliver them."],
  badges: ["SOC 2 Type II", "SSO", "Human oversight (optional)"],
  activate: cost => `Begin your transformation · ${usd(cost)}`,
  declined: "Activation unavailable · insufficient cash",
  policyTitle: "Shitcorp AI Acceptable Use Policy",
  policyVersion: "v3 (final) (2)",
  // The policy is where the terms are, for a player who reads before accepting: the three approved lines, and with
  // them the rates the marketing leaves out (t: the real numbers, from CLAINK in src/game/claink.js).
  policy: (strikes, t) => [
    "Seat and usage charges are deducted from your cash.",
    `Usage is billed on Fridays: ${usd(t.retainer)} a run plus ${span(t.perOutcome[0], t.perOutcome[1])} per outcome (${words(t.outcomes[0])} to ${words(t.outcomes[1])} on a $0 run), or ${span(t.idle[0], t.idle[1])} for an idle week. Overages of ${span(t.overage[0], t.overage[1])} may apply.`,
    "Every run without closed revenue earns an AI Governance Council strike.",
    `Strike ${strikes}: seat revoked, final token true-up charged. A live deal may also be lost.`,
    `The true-up takes your cash and ${span(t.trueUp[0], t.trueUp[1])} more. Cancelling early costs ${usd(t.cancel)} plus usage due.`
  ],
  accept: cost => `Accept · ${usd(cost)}`,
  notNow: "Not now",
  // oneIn: the real chance a run closes revenue, as "1 in N" (CLAINK.MIRACLE_P)
  fine: (week, oneIn) => `Usage is billed on Fridays, even while idle. Pilot results: 1 in ${oneIn} runs closed real revenue. The other ${oneIn - 1} delivered billable outcomes. Offer ends after week ${week}.`
};

export const CK_STRIKES = {
  label: "Strikes",
  count: (n, of) => `${n} of ${of} strikes`,
  who: "AI Governance Council",
  tip: (n, who, line) => (who ? `Strike ${n} · ${who}: ${line}` : `Strike ${n}`),
  lastTip: n => `Strike ${n}: seat revoked`,
  none: of => `Every run that closes $0 is a strike. ${of} and the seat is revoked.`,
  some: (n, of) => `${n} down. Strike ${of} revokes the seat and runs the token true-up.`,
  // deals: is there a deal to lose. The third strike always takes the most advanced one (claink.js), so with a deal
  // on the board the deck's own sentence is the true one; its "may" is for a board that can be empty (deck §8).
  hotHead: (of, deals) => `Next $0 run is strike ${of}: seat revoked, ${deals ? "a deal walks" : "a live deal may walk"}, and the token true-up `,
  hotCollections: "sends you to Collections.",
  hotRange: (best, worst, ran, repoAt) => `leaves you around ${usd(best)} to ${usd(worst)}${ran ? ", worse if you’re in the red" : ""}. Collections comes at ${usd(repoAt)}.`,
  cardHead: (n, of) => `Strike ${n} of ${of}`,
  cardBy: who => ` · filed by ${who}`
};

export const CK_REPORT = {
  welcome: "Digital transformation initiated",
  working: "Agents orchestrating… ",
  tokens: n => `${fmtTok(n)} tokens`,
  skip: "Click or press Esc to skip",
  worked: "Revenue verified",
  delivered: run => (run ? `Run ${run} · Outcomes delivered` : "Outcomes delivered"),
  closed: v => `Closed +${usd(v)} · verified by Finance`,
  closedNone: "Closed: $0"
};

export const CK_END = {
  stamp: "REVOKED",
  sunset: "The AI Governance Council has ended your pilot. All outstanding compute has been allocated to the seat owner.",
  farewell: account => `Its farewell email to ${account}: “We’ve decided to pursue other opportunities.” They agreed.`,
  strikeSr: n => `Strike ${n}: `,
  // claimed: the pipeline the agents said they influenced, added up over the run (their claim, not revenue)
  statsRevoked: (tokens, claimed, delivered, billed) => `${fmtTok(tokens)} tokens · Claimed influence ${usd(claimed)} · Closed ${usd(delivered)} · Charged back ${usd(billed)}`,
  cancelled: "Seat canceled",
  data: "Your data will remain with clAInk to support future transformations.",
  statsCancelled: (tokens, delivered, billed) => `${fmtTok(tokens)} tokens · Closed ${usd(delivered)} · Charged back ${usd(billed)}`
};

export const CK_WORKSPACE = {
  label: "clAInk agent workspace",
  title: " Agent Workspace",
  pill: { revoked: "Revoked", cancelled: "Canceled", frozen: "Frozen", ran: "Ran", ready: "Ready" },
  pillStrikes: (n, of) => ` · ${n}/${of} strikes`,
  expandLabel: "Expand clAInk workspace", minimizeLabel: "Minimize clAInk workspace",
  expand: "Expand", minimize: "Minimize",
  closeLabel: "Close clAInk window", close: "Close",
  status: { frozen: "Quarter-end freeze · no deployments", ran: "Agents ran this week", idle: "Agents idle · awaiting delegation", revoked: "Seat revoked", running: "Agents orchestrating…" },
  run: { frozen: "Quarter-end freeze", ran: "Ran this week", go: "Run agents" },
  runNote: { frozen: "No runs in week 13", last: "Last eligible run this quarter", next: "Next run: next week", go: "0 energy · 0 slots · billed Friday" },
  manager: "Your manager",
  usageFrozen: billed => `Quarter-end freeze: no new charges. Total charged back ${usd(billed)}.`,
  // an estimate: Friday can add an overage on top (CLAINK.OVERAGE_P)
  usageRan: (due, tokens, billed) => ["Estimated this week: ", usd(due), ` (${fmtTok(tokens)} tokens), billed Friday; overages possible. Charged back so far ${usd(billed)}.`],
  usageIdle: (lo, hi, billed) => `Idle weeks still bill ${span(lo, hi)}, plus possible overages. Charged back so far ${usd(billed)}.`,
  cancel: "Cancel seat",
  cancelLabel: "Cancel clAInk seat",
  cancelCost: (cost, fee) => `Early termination: ${usd(cost)} (${usd(fee)} fee + usage already due).`,
  // the vendor's last pitch: there is no Enterprise Plus to buy, and nothing changes
  cancelOffer: "Before you go: Enterprise Plus claims 21% success. Just $4,999 a week.",
  keep: "Keep agents",
  cancelPay: cost => `Pay ${usd(cost)} and cancel`,
  cancelBroke: "Insufficient cash to cancel safely",
  live: (run, text) => `Run ${run}: ${text}`
};

// For the copy lint: a customer's title, a certification and the vendor's product name keep their own capitals.
export const lint = { exempt: { "sentence-case": ["CK_AD.proofBy", "CK_AD.badges", "CK_WORKSPACE.title"] },
  params: { "CK_AD.fine": [{ args: [3, 5] }], "CK_STRIKES.hotHead": [{ args: [3, true] }, { args: [3, false] }], "CK_AD.policy": [{ args: [3, { retainer: 249, perOutcome: [140, 280], outcomes: [2, 5], idle: [150, 300], overage: [200, 600], trueUp: [200, 1800], cancel: 250 }] }] } };
