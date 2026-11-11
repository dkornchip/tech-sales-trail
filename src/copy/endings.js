import { money } from "../game/util.js";

// The ending dialog: its title and the line under it, by ending.
//   club       quota hit                      missed     under quota, still employed
//   fired      let go (see cause)             repo       cash ran out and Collections took the jacket
//   ascension  one quad shot too many         meltdown   stress did it
// p: {closed: total closed this run, cash: cash at the end, cause: why the run ended}
//   fired causes: "qbr" (the review itself), "review" (a mid-quarter pace review), "org" (a reorganisation with no
//   warning), "politics" (quota hit, fired anyway). repo: "claink" when clAInk's bill did it.
// The line is the company's own account of what became of Matt. It reports; it does not comment.
// The cutscene's captions are in scenes.js; the announcer's line is in pa.js.
const usd = v => money(v).replace("-", "−");

export const ENDINGS = {
  club: {
    title: () => "President’s Club",
    body: p => `${usd(p.closed)} closed. Quota met. Matt has been approved for Cabo.`
  },
  ascension: {
    title: () => "Ascension",
    body: p => `${usd(p.closed)} closed. Matt is out of office. Altitude: 408 km.`
  },
  meltdown: {
    title: () => "Meltdown",
    body: p => `${usd(p.closed)} closed. Matt is on leave. The leave has no end date.`
  },
  missed: {
    title: () => "Barely missed",
    body: p => `${usd(p.closed)} closed, short of quota. Matt retains system access.`
  },
  repo: {
    title: () => "Jacket repossessed",
    body: p => (p.cause === "claink"
      ? `Cash reached ${usd(p.cash)} after the token true-up. Collections has recovered the jacket.`
      : `Cash reached ${usd(p.cash)}. Collections has recovered the jacket.`)
  },
  fired: {
    title: p => (p.cause === "politics" ? "Terminated, over quota" : "Terminated"),
    body: p => (p.cause === "politics" ? `${usd(p.closed)} closed: over quota. Matt is no longer with the company. HR considers these facts unrelated.`
      : p.cause === "org" ? `${usd(p.closed)} closed. Matt was part of a strategic realignment.`
        : p.cause === "review" ? `${usd(p.closed)} closed, behind pace. Matt’s role has been impacted.`
          : `${usd(p.closed)} closed. Matt is pursuing other opportunities.`)
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
  notes: "On file",
  replay: "Replay",
  skip: "Skip to the end",
  newRun: "New run"
};

// What the company wrote down about this run. Each line pays off something the run set up, in the voice of whoever
// would have filed it. An ending shows the first two that apply (NOTE_ORDER); a line may differ by ending.
//   f: { trip, account, value (the largest deal), took (the deal your manager took), shots, hails, lunches,
//        cadences, lost, strikes, billed }
export const NOTES = {
  trip: {
    club: f => `The ${f.trip} trip is still approved. It is the same week as Cabo.`,
    missed: f => `The ${f.trip} trip is still approved. Travel has asked which quarter.`,
    fired: f => `The ${f.trip} trip was approved in writing. The writing stays with the company.`,
    repo: f => `The ${f.trip} trip is still approved. Travel goes on the employee’s own card.`,
    meltdown: f => `The ${f.trip} trip has been reclassified as leave.`,
    ascension: f => `The ${f.trip} trip is cancelled. Matt can see ${f.trip} from where he is.`
  },
  top: {
    club: f => `${f.account} signed for ${usd(f.value)}. The slide has your manager’s name on it.`,
    missed: f => `${f.account} signed for ${usd(f.value)}. The forecast had it at twice that.`,
    fired: f => `${f.account} has a new owner. Your manager volunteered.`,
    repo: f => `${f.account} signed for ${usd(f.value)}. Matt’s 12% is with Collections now.`,
    meltdown: f => `${f.account} has been told that Matt is “heads down.”`,
    ascension: f => `${f.account} has been told that their rep is travelling.`
  },
  none: () => "No deals were signed this quarter. The pipeline review is cancelled.",
  took: f => `Your manager closed ${f.took} himself. It counts toward his number.`,
  revoked: () => "clAInk’s seat was revoked at strike 3. clAInk has sent a renewal quote.",
  strikes: f => `clAInk ended the quarter with ${count(f.strikes, "strike")} on file. The Council kept the dates.`,
  billed: f => `clAInk billed ${usd(f.billed)} this quarter. The invoice thanks you for your outcomes.`,
  shots: {
    ascension: f => `${count(f.shots, "quad shot")} this quarter. Facilities has unplugged the machine.`,
    other: f => `${count(f.shots, "quad shot")} this quarter. Facilities has ordered a second machine.`
  },
  hails: f => `${count(f.hails, "Hail Mary", "Hail Marys")} this quarter. Legal has asked to see the emails.`,
  lunches: f => `${count(f.lunches, "lunch", "lunches")} with leadership. Each was expensed by someone else.`,
  cadences: f => `${count(f.cadences, "email cadence")} went out. Unsubscribes are handled by another team.`,
  lost: f => `${count(f.lost, "deal")} left the pipeline. RevOps calls that hygiene.`
};

// Which notes an ending reaches for first.
export const NOTE_ORDER = {
  ascension: ["shots", "trip", "top", "none", "took", "revoked", "strikes", "billed", "hails", "lunches", "cadences", "lost"],
  other: ["top", "none", "trip", "took", "revoked", "strikes", "shots", "billed", "hails", "lunches", "cadences", "lost"]
};

// For the copy lint: the causes each ending can be given.
export const lint = { skip: ["NOTE_ORDER"], params: {
  "ENDINGS.fired.title": [{ cause: "qbr" }, { cause: "politics" }],
  "ENDINGS.fired.body": [{ closed: 61400, cause: "qbr" }, { closed: 61400, cause: "review" }, { closed: 61400, cause: "org" }, { closed: 171300, cause: "politics" }],
  "ENDINGS.repo.body": [{ cash: -1620, cause: "repo" }, { cash: -1740, cause: "claink" }]
} };
