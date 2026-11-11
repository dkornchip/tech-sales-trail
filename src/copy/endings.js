import { money } from "../game/util.js";

// The ending dialog: its title and the line under it, by ending.
//   club       quota hit                      missed     70-99% of quota, still employed
//   fired      let go (any reason)            repo       cash ran out and Collections took the jacket
//   ascension  one Quad Shot too many         meltdown   stress did it
// p: {closed: total closed this run, cash: cash at the end, cause: why the run ended ("claink" when clAInk's bill did it)}
// The cutscene's own captions are in scenes.js; the announcer's line is in pa.js.
export const ENDINGS = {
  club: {
    title: () => "President’s Club ✨",
    body: p => `Closed ${money(p.closed)}. Pack for Cabo.`
  },
  ascension: {
    title: () => "Ascension 🚀",
    body: p => `Closed ${money(p.closed)}. Then you went orbital.`
  },
  meltdown: {
    title: () => "Meltdown ☢️",
    body: p => `Closed ${money(p.closed)}. Core breached.`
  },
  missed: {
    title: () => "Barely Missed 😮‍💨",
    body: p => `Closed ${money(p.closed)}. Badge kept. Back to the phones.`
  },
  repo: {
    title: () => "Jacket Repo’d 🧥",
    body: p => (p.cause === "claink" ? `Cash hit ${money(p.cash)}. clAInk sent you to Collections.` : `Cash hit ${money(p.cash)}. The loan came due.`)
  },
  fired: {
    title: () => "Terminated 💼",
    body: p => `Closed ${money(p.closed)}. Your Slack is already gone.`
  }
};
