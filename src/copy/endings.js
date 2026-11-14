import { money } from "../game/util.js";

// The ending dialog: its title and the line under it, by ending.
//   club       quota hit                      missed     under quota, still employed
//   fired      let go (see cause)             repo       cash ran out and Collections took the jacket
//   ascension  one quad shot too many         meltdown   stress did it
// p: {closed: total closed this run, cash: cash at the end, cause: why the run ended ("claink" when clAInk's bill did it)}
// The words are the ones the game has always ended on. The cutscene's captions are in scenes.js; the announcer's
// line is in pa.js; the log's last line (which says why) is in log.js.
const usd = v => money(v).replace("-", "−");

export const ENDINGS = {
  club: {
    title: () => "President’s Club",
    body: p => `Closed ${usd(p.closed)}. Your ticket to Cabo has been approved.`
  },
  ascension: {
    title: () => "Ascension",
    body: p => `Closed ${usd(p.closed)}. You are no longer within the building’s jurisdiction.`
  },
  meltdown: {
    title: () => "Meltdown",
    body: p => `Closed ${usd(p.closed)}. Normal operations have ceased.`
  },
  missed: {
    title: () => "Barely missed",
    body: p => `Closed ${usd(p.closed)}. Your badge still works. Back to the phones.`
  },
  repo: {
    title: () => "Jacket repo’d",
    body: p => (p.cause === "claink" ? `Cash reached ${usd(p.cash)}. clAInk has delivered its final outcome: Collections.` : `Cash reached ${usd(p.cash)}. Collections recovered the jacket.`)
  },
  fired: {
    title: () => "Terminated",
    body: p => `Closed ${usd(p.closed)}. Your badge access has been terminated.`,
    // the reason on file, by the cause the run recorded (game/legacy.js, causeOf); nothing for a cause it does not know
    note: p => FIRED_BECAUSE[p.cause] || null
  }
};
const FIRED_BECAUSE = {
  review: "Reason on file: mid-quarter performance review.",
  qbr: "Reason on file: the quarter closed below the threshold.",
  politics: "Reason on file: quota achieved. Management relationship not achieved.",
  org: "Reason on file: an organizational announcement."
};

// The company's verdict on the quarter: one line on the ending card, by ending.
export const VERDICT = {
  club: "Congratulations on demonstrating that your territory can support a higher quota.",
  fired: "Your position has been eliminated. Your quota has not.",
  missed: "Your performance has been deemed sufficient to justify another performance review.",
  meltdown: "People & Culture has scheduled a webinar on resilience. Attendance is mandatory.",
  repo: "The jacket has been returned to the appropriate cost center.",
  ascension: "Your departure velocity exceeded all performance expectations."
};

// The card under the cutscene: the quarter in a few numbers, then what the company has put on file.
const count = (k, one, many) => `${k} ${k === 1 ? one : many || one + "s"}`;

export const RESULTS = {
  overline: (week, weeks) => `Week ${week} of ${weeks}`,
  closed: "Closed",
  ofQuota: pct => `${pct}% of quota`,
  cash: "Cash",
  signed: "Deals signed",
  lost: k => `${k} lost`,
  signedSoFar: "Deals signed (incl. reversed)",    // when some of what was signed was later clawed back
  verdict: "Corporate verdict",
  distinctions: "Distinctions",
  top: "Largest deal",
  shots: "Quad shots",
  discounts: "Discounts given",
  pipeline: "Left in pipeline",
  claink: "clAInk",
  clainkBilled: v => `${usd(v)} billed`,
  strikes: k => count(k, "strike"),
  notes: "For the record",
  replay: "Replay",
  skip: "Skip to the end",
  newRun: "New run"
};

// What the quarter left behind. Each line pays off something the run set up. An ending shows the first two that
// apply (NOTE_ORDER); a line may differ by ending.
//   f: { trip, account, value (the largest deal), took (the deal your manager took), shots, hails, lunches,
//        cadences, lost, strikes, billed }
export const NOTES = {
  trip: {
    club: f => `Your ${f.trip} trip was approved. So was Cabo.`,
    missed: f => `Your ${f.trip} trip remains approved. Please be reachable.`,
    fired: f => `Your ${f.trip} trip was approved. So was your offboarding.`,
    repo: f => `Your ${f.trip} trip remains approved. Your card does not.`,
    meltdown: f => `Your ${f.trip} trip may require a different kind of leave form.`,
    ascension: f => `Your ${f.trip} trip is unnecessary. You can see it from here.`
  },
  top: {
    club: f => `Largest sale: ${f.account}, ${usd(f.value)}. Management has prepared a slide.`,
    missed: f => `Largest sale: ${f.account}, ${usd(f.value)}. It was not enough.`,
    fired: f => `Largest sale: ${f.account}, ${usd(f.value)}. Account continuity will be discussed without you.`,
    repo: f => `Largest sale: ${f.account}, ${usd(f.value)}. Finance would like to discuss your commission.`,
    meltdown: f => `Largest sale: ${f.account}, ${usd(f.value)}. Your out-of-office reply is active.`,
    ascension: f => `Largest sale: ${f.account}, ${usd(f.value)}. You’re traveling.`
  },
  none: () => "No deals signed. An unusually clean commission statement.",
  // the manager took the deal; whether he closed it is not something the run knows
  took: f => `Your manager took ${f.took}. You received a coaching opportunity.`,
  revoked: () => "clAInk was revoked after strike 3. It remains confident about renewal.",
  strikes: f => `clAInk received ${count(f.strikes, "strike")}. The Council remembers.`,
  billed: f => `clAInk billed ${usd(f.billed)}. Thank you for the transformation.`,
  shots: {
    ascension: f => `${count(f.shots, "quad shot")}. Facilities unplugged the machine.`,
    other: f => `${count(f.shots, "quad shot")}. Facilities is reviewing its supply contract.`
  },
  hails: f => `${count(f.hails, "Hail Mary", "Hail Marys")}. Legal would like the emails.`,
  lunches: f => `${count(f.lunches, "lunch", "lunches")} with leadership. You have been described as visible.`,
  cadences: f => `${count(f.cadences, "email cadence")}. An impressive volume of correspondence.`,
  // the count is of deals the log recorded as lost (walked, or lost at a close); leads that went stale are not in it
  lost: f => `${count(f.lost, "documented deal")} lost. RevOps calls it hygiene.`
};

// Distinctions: up to three on the ending card, each for something the run can prove (ui/Ending.jsx has the
// conditions). They are a line on this card and nothing more: no unlock is kept and no ending changes.
// Listed in the order they are offered: what the ending itself earned, then the risks taken, then the rest.
export const DISTINCTIONS = [
  { key: "americanDream", title: "The American Dream", sub: "Quota achieved. Asset recovered." },
  { key: "rightStuff", title: "The Right Stuff", sub: "Exceeded the office’s certified flight envelope." },
  { key: "whale", title: "Whale hunter", sub: v => `Closed at least ${usd(v)} in a single qualifying close push.` },
  { key: "digital", title: "Digital Transformation", sub: "The project exceeded its activity objectives." },
  { key: "leader", title: "A Natural Leader", sub: "Demonstrated exceptional ability to delegate upward." },
  { key: "optics", title: "Vice President of Optics", sub: "Leadership was delighted. Finance was not." },
  { key: "patriot", title: "Expense Account Patriot", sub: "A committed supporter of the branded tote-bag economy." }
];

// Which notes an ending reaches for first.
export const NOTE_ORDER = {
  ascension: ["shots", "trip", "top", "none", "took", "revoked", "strikes", "billed", "hails", "lunches", "cadences", "lost"],
  other: ["top", "none", "trip", "took", "revoked", "strikes", "shots", "billed", "hails", "lunches", "cadences", "lost"]
};

// For the copy lint: the causes each ending can be given.
export const lint = { skip: ["NOTE_ORDER"], params: {
  "ENDINGS.repo.body": [{ cash: -1620, cause: "repo" }, { cash: -1740, cause: "claink" }],
  "ENDINGS.fired.note": [{ cause: "review" }, { cause: "qbr" }, { cause: "politics" }, { cause: "org" }],
  "DISTINCTIONS[2].sub": [{ args: [65000] }]
}, exempt: { "sentence-case": ["DISTINCTIONS"] } };
