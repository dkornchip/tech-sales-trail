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
    body: p => `Closed ${usd(p.closed)}. Pack for Cabo.`
  },
  ascension: {
    title: () => "Ascension",
    body: p => `Closed ${usd(p.closed)}. Then you went orbital.`
  },
  meltdown: {
    title: () => "Meltdown",
    body: p => `Closed ${usd(p.closed)}. Core breached.`
  },
  missed: {
    title: () => "Barely missed",
    body: p => `Closed ${usd(p.closed)}. Badge kept. Back to the phones.`
  },
  repo: {
    title: () => "Jacket repo’d",
    body: p => (p.cause === "claink" ? `Cash hit ${usd(p.cash)}. clAInk sent you to Collections.` : `Cash hit ${usd(p.cash)}. The loan came due.`)
  },
  fired: {
    title: () => "Terminated",
    body: p => `Closed ${usd(p.closed)}. Your Slack is already gone.`
  }
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
    club: f => `Your ${f.trip} trip is approved. Same week as Cabo.`,
    missed: f => `Your ${f.trip} trip is still approved. You’ll be on the phones.`,
    fired: f => `Your ${f.trip} trip was approved. So was this.`,
    repo: f => `Your ${f.trip} trip is still approved. Your card isn’t.`,
    meltdown: f => `Your ${f.trip} trip is now medical leave.`,
    ascension: f => `${f.trip} trip cancelled. You can see it from up there.`
  },
  top: {
    club: f => `Biggest deal: ${f.account}, ${usd(f.value)}. Your manager’s name is on the slide.`,
    missed: f => `Biggest deal: ${f.account}, ${usd(f.value)}. Not big enough.`,
    fired: f => `${f.account} has a new owner. Your manager volunteered.`,
    repo: f => `Biggest deal: ${f.account}, ${usd(f.value)}. Collections kept your cut.`,
    meltdown: f => `${f.account} was told you’re “heads down.”`,
    ascension: f => `${f.account} was told you’re traveling.`
  },
  none: () => "Zero deals signed. Impressive, in a way.",
  took: f => `Your manager closed ${f.took} himself. It counts for him.`,
  revoked: () => "clAInk got revoked at strike 3. It sent a renewal quote.",
  strikes: f => `clAInk racked up ${count(f.strikes, "strike")}. The Council remembers.`,
  billed: f => `clAInk billed you ${usd(f.billed)}. Thanks for the outcomes.`,
  shots: {
    ascension: f => `${count(f.shots, "quad shot")}. Facilities unplugged the machine.`,
    other: f => `${count(f.shots, "quad shot")}. Facilities ordered a second machine.`
  },
  hails: f => `${count(f.hails, "Hail Mary", "Hail Marys")}. Legal wants the emails.`,
  lunches: f => `${count(f.lunches, "lunch", "lunches")} with leadership. Somebody else expensed them.`,
  cadences: f => `${count(f.cadences, "email cadence")} sent. Unsubscribes are someone else’s problem.`,
  lost: f => `${count(f.lost, "deal")} lost. RevOps calls it hygiene.`
};

// Which notes an ending reaches for first.
export const NOTE_ORDER = {
  ascension: ["shots", "trip", "top", "none", "took", "revoked", "strikes", "billed", "hails", "lunches", "cadences", "lost"],
  other: ["top", "none", "trip", "took", "revoked", "strikes", "shots", "billed", "hails", "lunches", "cadences", "lost"]
};

// For the copy lint: the causes each ending can be given.
export const lint = { skip: ["NOTE_ORDER"], params: {
  "ENDINGS.repo.body": [{ cash: -1620, cause: "repo" }, { cash: -1740, cause: "claink" }]
} };
