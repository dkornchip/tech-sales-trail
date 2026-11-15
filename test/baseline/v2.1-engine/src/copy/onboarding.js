import { money } from "../game/util.js";

// The first day. A new player gets the onboarding memo as the opening, three lines of what the job is, and a tour of
// three stops. A returning player (any saved run, or anyone who has been through this once) gets none of it.
// The memo itself is in memo.js. The tour is People & Culture's: helpful, brief, and sure it has covered everything.
// What it says about slots and energy is what the rules do (most actions take one slot, a conference two; running
// out of energy does not end the week while a Recharge or a quad shot is still on the table).
const usd = v => money(v).replace("-", "−");

export const WELCOME = {
  title: "New employee orientation",
  // v: { quota, weeks, slots }
  lines: [
    v => `Your quota is ${usd(v.quota)}. You have ${v.weeks} weeks.`,
    v => `Each week starts with ${v.slots} time slots. Energy is a separate budget.`,
    () => "The employee handbook is under “How it works.” Nobody has read it. You should."
  ],
  // the first chapter's memo line (the later ones arrive in the log as their weeks begin: copy/log.js, CHAPTER_LINE)
  chapter: "Management confirms this is a growth territory. It does not specify what is growing.",
  start: "Start week 1",
  close: "Close"
};

// Each stop points at one thing on the main screen: `at` names it (src/ui/FirstRun.jsx knows where each one is).
export const TOUR = [
  { at: "prospect", title: "First, find a customer", body: "Prospect to find leads, qualify them in discovery, demo, propose, then close. A full pipeline is not a full wallet." },
  { at: "slots", title: "Your week has five slots", body: "Most actions use one slot and energy; conferences use two. Recharge restores energy if you have a slot left." },
  { at: "end", title: "Friday comes for everyone", body: "End the week to collect salary, recover some energy and face the office. Rent is due on weeks 1, 5 and 9." }
];

export const TOUR_UI = {
  label: "Tour",
  step: (i, total) => `${i} of ${total}`,
  next: "Next",
  done: "Got it",
  skip: "Skip the tour"
};
