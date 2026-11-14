import { money } from "../game/util.js";

// The first day. A new player gets the onboarding memo as the opening, three lines of what the job is, and a tour of
// three stops. A returning player (any saved run, or anyone who has been through this once) gets none of it.
// The memo itself is in memo.js. The tour is People & Culture's: helpful, brief, and sure it has covered everything.
const usd = v => money(v).replace("-", "−");

export const WELCOME = {
  title: "Onboarding",
  // v: { quota, weeks, slots }
  lines: [
    v => `Your quota is ${usd(v.quota)}. You have ${v.weeks} weeks.`,
    v => `Each week is ${v.slots === 5 ? "five" : v.slots} slots and whatever energy you have left.`,
    () => "The rest is under “How it works,” top right."
  ],
  start: "Start week 1",
  close: "Close"
};

// Each stop points at one thing on the main screen: `at` names it (src/ui/FirstRun.jsx knows where each one is).
export const TOUR = [
  { at: "prospect", title: "Deals start here", body: "A prospect blitz finds leads. Then discovery, a demo, a proposal and a close, in that order." },
  { at: "slots", title: "A week is five slots", body: "Every action takes one, and some energy. When either runs out, the week is over." },
  { at: "end", title: "Then end the week", body: "Friday pays your salary. Three times a quarter, it also takes the rent." }
];

export const TOUR_UI = {
  label: "Tour",
  step: (i, total) => `${i} of ${total}`,
  next: "Next",
  done: "Got it",
  skip: "Skip the tour"
};
