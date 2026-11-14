import { fmtTok, money } from "../game/util.js";

// Everything the clAInk panel prints that is not a run report (those lines are in claink.js): the ad, the agent
// workspace, the strike boxes, the end cards. The vendor is the one voice in the game allowed enthusiasm.
// Amounts arrive as numbers and are formatted here.
// The word joiner keeps a minus sign on the same line as its amount (the panel is narrow on a phone).
const usd = v => money(v).replace("-", "−\u2060");

export const CK_AD = {
  label: mini => "Sponsored: clAInk Enterprise" + (mini ? " (minimized)" : ""),
  sponsored: "Sponsored · Enterprise pilot",
  ends: (lastWeek, week) => (lastWeek ? "Pilot pricing ends this week" : `Pilot pricing ends week ${week}`),
  expand: "Expand", minimize: "Minimize",
  expandLabel: "Expand clAInk ad", minimizeLabel: "Minimize clAInk ad",
  closeLabel: "Close ad. clAInk will be off for this run",
  closeTitle: "Close (turns clAInk off for this run)",
  announce: ["New: ", "Autonomous Pipeline", " is GA"],
  headline: "Your reps sell. Our agents do everything else.",
  sub: "Up to 70% of a rep’s week is busywork. clAInk runs a team of autonomous agents that research accounts, write the outreach and advance your deals, around the clock.",
  chips: ["Account research", "Outreach at scale", "Deal advancement"],
  proof: "“Our agents completed 1.2 million tasks last quarter.”",
  proofBy: "VP of RevOps, Fortune 500 logistics company",
  price: ["Outcome-based pricing.", " Pay for every outcome, plus the tokens it took to get there."],
  badges: ["SOC 2 Type II", "SSO", "Human-in-the-loop (optional)"],
  activate: cost => `Activate seat · ${usd(cost)}`,
  declined: "Declined · cash too low",
  policyTitle: "Shitcorp AI Use Policy",
  policyVersion: "v3 (final) (2)",
  policy: strikes => [
    "The seat, the tokens and every “outcome” come out of your commission.",
    "A run that closes $0 earns a strike from the AI Governance Council.",
    `Strike ${strikes}: seat revoked, plus the token true-up.`
  ],
  accept: cost => `Accept · ${usd(cost)}`,
  notNow: "Not now",
  fine: week => `Charged back to you under the Shitcorp AI Use Policy. Usage is invoiced every Friday. Pilot results: 1 in 5 agent runs closed real revenue. The other 4 delivered outcomes. Offer ends after week ${week}.`
};

export const CK_STRIKES = {
  label: "Strikes",
  count: (n, of) => `${n} of ${of} strikes`,
  who: "AI Governance Council",
  tip: (n, who, line) => (who ? `Strike ${n} · ${who}: ${line}` : `Strike ${n}`),
  lastTip: n => `Strike ${n}: seat revoked`,
  none: of => `Every run that closes $0 is a strike. ${of} and the seat is revoked.`,
  some: (n, of) => `${n} down. Strike ${of} revokes the seat and runs the token true-up.`,
  hotHead: of => `Next $0 run is strike ${of}: seat revoked, a deal walks, and the token true-up `,
  hotCollections: "sends you to Collections.",
  hotRange: (best, worst, ran, repoAt) => `leaves you around ${usd(best)} to ${usd(worst)}${ran ? ", worse if you’re in the red" : ""}. Collections comes at ${usd(repoAt)}.`,
  cardHead: (n, of) => `Strike ${n} of ${of}`,
  cardBy: who => ` · filed by ${who}`
};

export const CK_REPORT = {
  welcome: "Welcome aboard",
  working: "Agents working… ",
  tokens: n => `${fmtTok(n)} tokens`,
  skip: "Click or press Esc to skip",
  worked: "It actually worked",
  delivered: run => (run ? `Run ${run} · outcomes delivered` : "Outcomes delivered"),
  closed: v => `Closed +${usd(v)} · verified by Finance`,
  closedNone: "Closed: $0"
};

export const CK_END = {
  stamp: "REVOKED",
  sunset: "The AI Governance Council has sunset your agents. They will be missed by no one.",
  farewell: account => `Its farewell email to ${account}: “It’s not you, it’s me.” They agreed.`,
  strikeSr: n => `Strike ${n}: `,
  statsRevoked: (tokens, claimed, delivered, billed) => `${fmtTok(tokens)} tokens · Influenced ${usd(claimed)} · Closed ${usd(delivered)} · Charged back ${usd(billed)}`,
  cancelled: "Seat cancelled",
  data: "Your data stays with clAInk “to improve the models.”",
  statsCancelled: (tokens, delivered, billed) => `${fmtTok(tokens)} tokens · Closed ${usd(delivered)} · Charged back ${usd(billed)}`
};

export const CK_WORKSPACE = {
  label: "clAInk agent workspace",
  title: " Agent Workspace",
  pill: { revoked: "Revoked", cancelled: "Cancelled", frozen: "Frozen", ran: "Ran", ready: "Ready" },
  pillStrikes: (n, of) => ` · ${n}/${of} strikes`,
  expandLabel: "Expand clAInk workspace", minimizeLabel: "Minimize clAInk workspace",
  expand: "Expand", minimize: "Minimize",
  closeLabel: "Close clAInk window", close: "Close",
  status: { frozen: "Quarter-end freeze · no runs", ran: "Agents ran this week", idle: "Agents idle · awaiting delegation", revoked: "Seat revoked", running: "Agents running…" },
  run: { frozen: "Quarter-end freeze", ran: "Ran this week", go: "Run agents" },
  runNote: { frozen: "no runs in week 13", last: "last run this quarter", next: "next run: next week", go: "0 energy · 0 slots · billed Friday" },
  manager: "Your manager",
  usageFrozen: billed => `Quarter-end freeze: nothing more gets billed · Charged back so far ${usd(billed)}`,
  usageRan: (due, tokens, billed) => ["This week: ", usd(due), ` (${fmtTok(tokens)} tokens), billed Friday · Charged back so far ${usd(billed)}`],
  usageIdle: (lo, hi, billed) => `Idle weeks still bill ${usd(lo)}–${usd(hi)}: background agents keep “thinking” · Charged back so far ${usd(billed)}`,
  cancel: "Cancel seat",
  cancelLabel: "Cancel clAInk seat",
  cancelCost: (cost, fee) => `Early termination: ${usd(cost)} (${usd(fee)} fee + this week’s usage).`,
  cancelOffer: "Before you go: Enterprise Plus hits 21% success. Just $4,999 a week.",
  keep: "Keep agents",
  cancelPay: cost => `Pay ${usd(cost)} and cancel`,
  cancelBroke: "Can’t afford the fee",
  live: (run, text) => `Run ${run}: ${text}`
};

// For the copy lint: a customer's title, a certification and the vendor's product name keep their own capitals.
export const lint = { exempt: { "sentence-case": ["CK_AD.proofBy", "CK_AD.badges", "CK_WORKSPACE.title"] } };
