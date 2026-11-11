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
  dealsMeta: (count, pipeline) => (count ? `${count} open · ${usd(pipeline)} in pipeline` : "None yet"),
  dealCols: ["Account", "Stage", "Mood", "Value", "Odds"],
  noDeals: "No deals. The phone is on your desk.",
  noActivity: "Nothing yet. Quota is waiting.",
  endWeek: "End week",
  hail: "Hail Mary",
  weekDivider: w => `Week ${w}`,
  earlier: "Earlier",
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
  stressDanger: "Danger zone",
  rentThisWeek: () => "Rent is due Friday",
  rentLater: w => `Rent due in week ${w}`,
  rentDone: "Rent is paid up",
  collections: "Collections at −$1,500",
  ofQuota: share => pc(share),
  onPace: "On pace",
  ahead: pts => `${n(pts, "point")} ahead`,
  behind: pts => `${n(pts, "point")} behind pace`,
  reviewsSoon: w => `Reviews from week ${w}`,
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

export const HINT = {
  prospect: () => "Cold calls. 1 to 4 new leads, now and then a fifth.",
  cadence: () => "0 to 3 warmer leads. Your manager notices a week of emails with no calls.",
  network: () => "1 or 2 introductions, usually small. About one in thirty is a whale.",
  discovery: (c, p) => (c ? `${n(c, "lead")} waiting. Each has a ${pc(p)} chance to qualify.` : "No leads to qualify. It would still cost the energy."),
  demo: (c, p) => (c ? `${n(c, "qualified deal")} waiting. Each has a ${pc(p)} chance to move on.` : "Nobody is qualified for a demo. It would still cost the energy."),
  propose: (c, p) => (c ? `${n(c, "demoed deal")} waiting. Each has a ${pc(p)} chance to take a proposal.` : "Nobody has seen a demo. It would still cost the energy."),
  close: c => (c ? `${n(c, "deal")} ready for a signature. The odds are on each row. A miss can lose the deal.` : "Nothing is at proposal yet. It would still cost the energy."),
  conference: c => `3 to 8 warm leads, some of them large. Takes ${n(c.slots, "slot")} and ${usd(c.cash)}.`,
  crm: (pruned, gain, nuke) => `Clears ${n(pruned, "dead lead")}: +${gain} manager.` + (nuke ? ` ${pc(nuke)} chance he closes out a live deal while he is in there.` : ""),
  recharge: r => `+${r.energy[0]} to +${r.energy[1]} energy` + (r.relief[1] > 0 ? `, −${r.relief[0]} to −${r.relief[1]} stress.` : ". The caffeine keeps the stress.") + " A very good nap gets a trip approved.",
  coffee: (shot) => `Shot ${shot.n}: +${shot.energy} energy and +${shot.stress} stress now, +${shot.crash} more on Friday.` + (shot.risk >= 1 ? " This one takes stress to 100." : shot.risk > 0 ? ` ${pc(shot.risk)} chance your heart objects.` : ""),
  politics: () => "+8 manager, +3 product, −4 reputation. People notice who you have lunch with.",
  hail: c => (c ? `One push on ${n(c, "late-stage deal")}. Four times in five, each survivor then has a 55% chance to walk.` : "Needs a deal at proposal or closing."),
  endWeek: f => `Friday: salary +${usd(f.salary)}` + (f.rent ? `, rent −${usd(f.rent)}` : "") + `, energy +${f.energy}, stress ${f.stress < 0 ? "−" + -f.stress : "+" + f.stress}.`,
  blocked: {
    over: () => "The quarter is over.",
    slots: b => (b.need > 1 ? `Needs ${b.need} slots. You have ${b.have}.` : "No slots left this week."),
    energy: b => `Needs ${b.need} energy. You have ${b.have}.`,
    once: () => "Already done this week.",
  },
  idle: {
    over: () => "",
    noSlots: () => "Out of slots. End the week.",
    close: c => `${n(c, "deal")} ${c === 1 ? "is" : "are"} waiting for a signature.`,
    propose: c => `${n(c, "demoed deal")} ${c === 1 ? "needs" : "need"} a proposal.`,
    demo: c => `${n(c, "qualified deal")} ${c === 1 ? "needs" : "need"} a demo.`,
    discovery: c => `${n(c, "lead")} ${c === 1 ? "needs" : "need"} qualifying.`,
    start: () => "No deals yet. A prospect blitz is where they come from.",
  },
};

export const CHIP = {
  closeOdds: (delta, weeks) => `Close odds ${delta > 0 ? "+" : "−"}${Math.abs(Math.round(delta * 100))}% ${weeks > 1 ? `for ${weeks} weeks` : "this week"}`,
  discount: rate => `Discounting ${pc(rate)} this week`,
  rested: "Rested",
  more: k => `${k} more`,
  trip: place => `${place} trip approved`,
  shots: k => n(k, "quad shot"),
  pip: level => `Performance plan, level ${level}`,
};

export const MENU = { title: "Settings", sound: "Sound", voice: "Office announcer", captions: "Captions for the announcer", volume: "Volume", voiceOn: "Announcer on.", save: "Save run", load: "Load saved run", newRun: "New run" };

// One-line confirmations (the toast at the bottom of the screen).
export const TOAST = {
  saved: "Run saved.",
  saveBlocked: "Could not save. This browser is blocking storage.",
  noSave: "No saved run found.",
  damaged: "That save was damaged. A new run has started.",
  soundOn: "Sound on",
  soundOff: "Sound off"
};

// The boot screen's bezel, and names for things that have no visible label (screen readers read these).
export const BOOT = { label: "Shitcorp OS boot screen", brand: "SHITCORP", hint: "M mutes", clockIn: "Clock in", skip: "Skip", booting: "Booting…" };
export const NAMES = { week: "Your week", desk: "Your deals and activity", sound: "Sound", soundTitle: "Sound (M)", ending: "Ending animation", event: "Event" };

// The page that replaces the game when it cannot be drawn (a save that is not a save).
export const CRASH = {
  title: "This run could not be opened",
  body: "The saved run on this browser is damaged. A new run will set it aside and start the quarter over.",
  newRun: "New run"
};

export const STAGE = ["Lead", "Qualified", "Demoed", "Proposal", "Closing"];
export const MOOD = { skeptical: "skeptical", neutral: "neutral", curious: "curious", happy: "happy" };

// For the copy lint: hints that take structured numbers.
// (BOOT.brand is the badge on the monitor's bezel, in the company's capitals.)
export const lint = { exempt: { "sentence-case": ["BOOT.brand"] }, params: {
  "HINT.recharge": [{ energy: [35, 52], relief: [12, 18] }, { energy: [35, 52], relief: [0, 0] }],
  "ACTION.coffee.cost": [{ args: [{ energy: 0, slots: 1, cash: 6 }, 12, 13] }],
  "ACTION.coffee.risk": [{ args: [{ energy: 0, slots: 1, cash: 6 }, 0.18] }],
  "ACTION.conference.cost": [{ energy: 40, slots: 2, cash: 800 }],
  "HINT.conference": [{ energy: 40, slots: 2, cash: 800 }]
} };
