// Words on the main screen: labels, the cost line under each action, and the hint bar.
// The hint bar tells you what a button will do with the numbers as they stand, or why it can't.
const n = (count, one, many) => `${count} ${count === 1 ? one : many || one + "s"}`;
const pc = p => `${Math.round(p * 100)}%`;
const usd = v => (v < 0 ? "−$" : "$") + Math.abs(Math.round(v)).toLocaleString("en-US");

export const UI = {
  product: "Tech Sales Trail",
  company: "Shitcorp",
  rep: "Matt",
  title: "SDR*",
  rules: "How it works",
  settings: "Settings",
  week: w => `Week ${w}`,
  ofWeeks: total => `of ${total}`,
  slots: "Slots",
  slotsLeft: left => `${left} left`,
  rent: "Rent",
  qbr: "QBR",
  standing: "Standing",
  skills: "Skills",
  deals: "Deals",
  activity: "Activity",
  dealsMeta: (count, pipeline) => (count ? `${count} open · ${usd(pipeline)} in pipeline` : "No open deals"),
  dealCols: ["Account", "Stage", "Mood", "Value", "Odds"],
  oddsUnit: "odds",                   // after a deal's odds where the column has no heading (a phone)
  oddsSr: "Signing chance, conditional on a close attempt: ",   // read out before a deal's odds; the column heading is only visual
  oddsTip: "Signing chance, conditional on a close attempt",    // the Odds column's tooltip
  oddsEarly: "Not ready to sign. Odds apply from Proposal.",     // the tooltip on a deal that is not yet at Proposal
  noDeals: "No open deals. Your phone remains operational.",
  noActivity: "No activity yet. Quota has been assigned.",
  endWeek: "End week",
  hail: "Hail Mary",
  weekDivider: w => `Week ${w}`,
  earlier: "Earlier",
  peekMore: k => `+${k} more in Activity`,
};

export const KPI = {
  energy: "Energy",
  stress: "Stress",
  cash: "Cash",
  closed: "Closed this quarter",
  outOf: "/ 100",
  energyFriday: gain => `+${gain} on Friday`,
  stressEases: by => `Eases ${by} on Friday`,
  stressCrash: by => `Crash: +${by} on Friday`,
  stressDanger: "Dangerous stress level",
  rentThisWeek: () => "Rent is due Friday",
  rentLater: w => `Rent due in week\u00A0${w}`,          // a no-break space: the number stays with "week"
  rentDone: "Rent is paid up",
  collections: at => `Collections at ${usd(at)} cash`,
  ofQuota: share => pc(share),
  onPace: "On pace",
  ahead: pts => `${n(pts, "percentage point")} ahead of\u00A0pace`,
  behind: pts => `${n(pts, "percentage point")} behind\u00A0pace`,
  reviewsSoon: w => `Performance reviews from week\u00A0${w}`,
  expected: share => `Expected by Friday: ${pc(share)} of quota`,
  expectedMark: share => `Expected by Friday: ${pc(share)}`,       // the marker on the quota meter, for screen readers and the tooltip
};

export const STAT = { manager: "Manager", reputation: "Reputation", product: "Product", prospect: "Prospecting", discovery: "Discovery", demo: "Demo", negotiate: "Negotiation" };

// Each action's name and the cost line under it. A cost line is built from the action's real cost
// (c: { energy, slots, cash }, from src/game/rules.js), so the words follow the rules.
const energy = c => `${c.energy} energy`;
export const ACTION = {
  prospect: { title: "Prospect blitz", cost: energy },
  cadence: { title: "Email cadence", cost: energy },
  network: { title: "Referrals", cost: energy },
  discovery: { title: "Discovery", cost: energy },
  demo: { title: "Demo marathon", cost: energy },
  propose: { title: "Proposals", cost: energy },
  close: { title: "Close deals", cost: energy },
  conference: { title: "Conference run", cost: c => `${c.energy} energy · ${usd(c.cash)} · ${n(c.slots, "slot")}` },
  crm: { title: "CRM cleanup", cost: c => `${c.energy} energy · once a week`, used: "Done this week" },
  recharge: { title: "Recharge", cost: () => "Once a week", used: "Used this week" },
  coffee: { title: "Quad shot", cost: (c, stress, crash) => `${usd(c.cash)} · +${stress + crash} stress by Friday`, risk: (c, p) => `${usd(c.cash)} · ${pc(p)} heart risk` },
  politics: { title: "Internal politics", cost: energy }
};

// The hint bar: what a button would do with the numbers as they stand. Factual first. Every number here is handed
// in by the interface from the rules (src/game/selectors.js), so a hint cannot promise what the button will not do.
// An action that would find nothing to work on says so, and says that it would still cost what it costs.
const fifths = p => { const k = Math.round(p * 5); return Math.abs(p * 5 - k) < 1e-9 && k > 0 && k < 5 ? `${["", "One time", "Two times", "Three times", "Four times"][k]} in five` : `${pc(p)} of the time`; };
export const HINT = {
  prospect: () => "Cold calls. Usually 1–4 new leads; occasionally a fifth. Costs time and energy.",
  cadence: () => "0–3 warmer leads. A week of emails without calls costs manager approval.",
  // whale: the chance each introduction is a whale
  network: (c, whale) => `1–2 introductions, usually small. Each has roughly a ${pc(whale)} chance of being a whale.`,
  discovery: (c, p) => (c ? `${n(c, "lead")} waiting. Each has a ${pc(p)} chance to qualify. Trains discovery.` : "No eligible deals. You would still spend a slot and energy."),
  demo: (c, p) => (c ? `${n(c, "qualified deal")} waiting. Each has a ${pc(p)} chance to advance. Trains demos.` : "No eligible deals. You would still spend a slot and energy."),
  propose: (c, p) => (c ? `${n(c, "demoed deal")} waiting. Each has a ${pc(p)} chance to reach Proposal.` : "No eligible deals. You would still spend a slot and energy."),
  close: c => (c ? `${n(c, "eligible deal")}; each has its own signing odds. Failed attempts may lose deals.` : "No deals are ready to sign. You would still spend a slot and energy."),
  // buzz: the chance it also lifts signing odds; lift: by how much (a fraction), this week only
  conference: (c, stress, buzz, lift) => `3–8 warm leads; some are large. ${n(c.slots, "slot")}, ${c.energy} energy, ${usd(c.cash)}, +${stress} stress. ${pc(buzz)} chance of +${Math.round(lift * 100)} pp signing odds this week.`,
  crm: (pruned, gain, nuke) => `Removes ${n(pruned, "dead lead")}: +${gain} manager. Once per week.` + (nuke ? ` Your manager may remove a live deal while he’s in the CRM (${pc(nuke)}).` : ""),
  recharge: r => `+${r.energy[0]}–${r.energy[1]} energy` + (r.relief[1] > 0 ? `, −${r.relief[0]}–${r.relief[1]} stress` : ", no stress relief") + ". Once per week. Coffee reduces relief. A rare great nap approves a trip.",
  coffee: (shot) => `Shot ${shot.n}: +${shot.energy} energy, +${shot.stress} stress now, +${shot.crash} more on Friday.` + (shot.risk >= 1 ? " This shot reaches 100 stress and ends the run." : shot.risk > 0 ? ` ${pc(shot.risk)} chance it ends the run.` : " Later shots give less and risk more."),
  politics: () => "Lunch with leadership. +8 manager · +3 product · −4 reputation · +2 stress.",
  // blast: the chance nobody walks; walk: the chance each late deal left walks otherwise
  hail: (c, blast, walk) => (c ? `One close attempt against all proposal/closing deals. ${fifths(1 - blast)}, each remaining late deal then has a ${pc(walk)} chance to walk.` : "No late-stage deals to rescue."),
  endWeek: f => `Friday: salary +${usd(f.salary)}` + (f.rent ? `, rent −${usd(f.rent)}` : "") + `, energy +${f.energy}, stress ${f.stress < 0 ? "−" + -f.stress : "+" + f.stress}. Friday events and collections may change this.`,
  blocked: {
    over: () => "The quarter is over.",
    slots: b => (b.need > 1 ? `Needs ${b.need} slots. You have ${b.have}.` : "No slots left this week."),
    energy: b => `Needs ${b.need} energy. You have ${b.have}.`,
    once: () => "Already done this week.",
    rested: () => "You have already used this week’s recharge.",
    waiting: () => "Something needs your answer first.",
  },
  idle: {
    over: () => "",
    noSlots: () => "No slots left. End the week.",
    close: c => `${n(c, "deal")} ready for a close attempt.`,
    propose: c => `${n(c, "demoed deal")} ready for a proposal.`,
    demo: c => `${n(c, "qualified deal")} ready for a demo.`,
    discovery: c => `${n(c, "lead")} ready for discovery.`,
    start: () => "No leads. Prospect or ask for referrals.",
  },
};

// The status chips. weeks: how many playable weeks an effect has left, this one included.
const left = weeks => (weeks > 1 ? `${weeks} weeks left` : "this week");
export const CHIP = {
  closeOdds: (delta, weeks) => `Close odds ${delta > 0 ? "+" : "−"}${Math.abs(Math.round(delta * 100))} pp · ${left(weeks)}`,
  discount: (rate, weeks) => `Discount ${pc(rate)} · ${left(weeks || 1)}`,
  rested: "Rested",
  more: k => `${k} more`,
  trip: place => `${place} trip approved`,
  shots: k => n(k, "quad shot"),
  pip: level => `PIP level ${level}`,
};

export const MENU = { title: "Settings", sound: "Sound", voice: "Office announcer", captions: "Captions for the announcer", volume: "Volume", voiceOn: "Announcer on.", save: "Save run", load: "Load saved run", newRun: "New run" };

// One-line confirmations (the toast at the bottom of the screen).
export const TOAST = {
  saved: "Run saved.",
  saveBlocked: "Could not save. Browser storage is unavailable.",
  noSave: "No saved run found.",
  damaged: "This saved run could not be opened. Your current run is unchanged.",
  newer: "This saved run is from a newer version of the game. Your current run is unchanged.",
  soundOn: "Sound on",
  soundOff: "Sound off"
};

// The boot screen's bezel, and names for things that have no visible label (screen readers read these).
export const BOOT = { label: "Shitcorp OS boot screen", product: "Tech Sales Trail", brand: "SHITCORP", hint: "M mutes", sound: "Sound", soundTitle: "Sound (M)", clockIn: "Clock in", skip: "Skip", booting: "Loading corporate objectives…" };

// Confirmations: asked only before something that cannot be taken back. The prompts are the approved ones; the
// buttons say what they do.
export const CONFIRM = {
  newRun: { title: "New run", body: "Start over? This quarter’s unsaved progress will be lost.", yes: "Start over", no: "Keep playing" },
  dismissAd: { body: "Dismiss the offer for this run? Minimizing keeps it available.", yes: "Dismiss", no: "Keep" },
  hail: { title: "Hail Mary", body: "This may save the week or destroy the pipeline. Continue?", yes: "Throw it", no: "Not yet" },
  coffee: { title: "Quad shot", body: "This shot reaches 100 stress and ends the run.", yes: "Drink it anyway", no: "Put it down" }
};

// The chapters of the quarter: the name shown beside the week (where there is room), by the week it starts in.
export const CHAPTERS = [[1, "The Honeymoon"], [4, "Alignment"], [7, "The Reckoning"], [10, "The Siege"], [13, "Judgment Day"]];
export const chapterOf = week => { let name = CHAPTERS[0][1]; for (const [from, title] of CHAPTERS) if (week >= from) name = title; return name; };
export const NAMES = { week: "Your week", desk: "Your deals and activity", sound: "Sound", soundTitle: "Sound (M)", ending: "Ending animation", event: "Event" };

// The page that replaces the game when it cannot be drawn (a save that is not a save).
// The dialog for a stored run that would not open. It offers only what can actually be done: a new run, and each
// other stored run that does open. slot: "autosave" or "save"; legacy: stored by an earlier version of the game.
export const RECOVERY = {
  title: "This saved run could not be opened",
  body: (status, others) => `${status === "newer" ? "It was saved by a newer version of the game." : "The run stored in this browser is damaged."} ${others ? "Start a new run or return to a valid saved run." : "Start a new run."} It will be kept aside, not deleted.`,
  newRun: "Start a new run",
  open: (slot, week, legacy) => `Open ${slot === "save" ? "your saved run" : "the autosave"} · week ${week}${legacy ? " (earlier version)" : ""}`
};

export const CRASH = {
  title: "This run could not be opened",
  body: "The run saved in this browser is damaged. A new run sets it aside and starts the quarter over.",
  newRun: "New run"
};

export const STAGE = ["Lead", "Qualified", "Demoed", "Proposal", "Closing"];
export const MOOD = { skeptical: "skeptical", neutral: "neutral", curious: "curious", happy: "happy" };

// For the copy lint: hints that take structured numbers.
// (BOOT.brand is the badge on the monitor's bezel, in the company's capitals.)
// (BOOT.brand is the badge on the housing, in the company's capitals; UI.peekMore names the Activity panel.)
export const lint = { exempt: { "sentence-case": ["BOOT.brand", "UI.peekMore"] }, params: {
  "HINT.network": [{ args: [0, 0.03] }],
  "HINT.discovery": [{ args: [0, 0.6] }, { args: [1, 0.6] }, { args: [3, 0.6] }], "HINT.demo": [{ args: [0, 0.5] }, { args: [1, 0.5] }, { args: [3, 0.5] }],
  "HINT.propose": [{ args: [0, 0.55] }, { args: [1, 0.55] }, { args: [3, 0.55] }], "HINT.close": [{ args: [0] }, { args: [1] }, { args: [4] }],
  "HINT.conference": [{ args: [{ energy: 40, slots: 2, cash: 800 }, 5, 0.3, 0.08] }],
  "HINT.hail": [{ args: [2, 0.2, 0.55] }, { args: [0, 0.2, 0.55] }, { args: [1, 0.25, 0.5] }],
  "KPI.collections": [{ args: [-1500] }],
  "CHIP.closeOdds": [{ args: [0.12, 1] }, { args: [-0.15, 2] }],
  "CHIP.discount": [{ args: [0.2, 1] }],
  "HINT.recharge": [{ energy: [35, 52], relief: [12, 18] }, { energy: [35, 52], relief: [0, 0] }],
  "ACTION.coffee.cost": [{ args: [{ energy: 0, slots: 1, cash: 6 }, 12, 13] }],
  "ACTION.coffee.risk": [{ args: [{ energy: 0, slots: 1, cash: 6 }, 0.18] }],
  "ACTION.conference.cost": [{ energy: 40, slots: 2, cash: 800 }]
} };
