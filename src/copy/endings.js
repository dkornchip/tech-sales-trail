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

// For the copy lint: the causes each ending can be given.
export const lint = { params: {
  "ENDINGS.fired.title": [{ cause: "qbr" }, { cause: "politics" }],
  "ENDINGS.fired.body": [{ closed: 61400, cause: "qbr" }, { closed: 61400, cause: "review" }, { closed: 61400, cause: "org" }, { closed: 171300, cause: "politics" }],
  "ENDINGS.repo.body": [{ cash: -1620, cause: "repo" }, { cash: -1740, cause: "claink" }]
} };
