// What the PA announcer says. Each key is a moment in the game; its value is the list of lines the announcer picks
// from at random (one cosmetic draw). The keys are fixed: the sound engine, the scenes and the tests ask for lines by
// key. Which keys are read by HR, in the other voice, is decided in src/engine/audio/voice.js (HR_KEYS).
// Keep a line short: speech engines read slowly, and the next line waits for this one to finish.

// Terminations are read by HR, calmly. The three "fired" keys share this one list.
export var HR_LINES = ["As of today, you're no longer an employee of this organization.","Thanks for coming to this meeting. Today is your last day with Shitcorp.","We've reviewed your performance and decided to part ways."];
export var LINES = {
  boot:["Quota assigned. Good morning."],
  newrun:["New quarter. Same quota."],
  club:["President's Club. Grab your jacket."],
  fired:HR_LINES,
  firedOrg:HR_LINES,
  firedReview:HR_LINES,
  burnout:["Containment failed. Evacuate the pod."],
  missed:["Close. Not closed."],
  repo:["Jacket owner to Collections."],
  week5:["Mid-quarter reviews are in session."],
  week7:["Quarter half over. Coffee too."],
  week12:["One week left. Panic quietly."],
  week13:["Final week. Commit means commit."],
  filler:[
    "Pipeline is not revenue.",
    "Update opportunities before forecast call.",
    "Hydration is a KPI.",
    "Leaderboard updated. Do not look.",
    "Verbal commits are not commits.",
    "Lunch and learn. No lunch.",
    "The CRM is always right.",
    "Mandatory fun begins at four.",
    "Your calendar has been optimized.",
    "Fridge cleanout Friday. Pipeline too."
  ],
  hr:["HR has joined the meeting."],
  meetings:["All meetings are logged. For forecasting."],
  hygiene:["Pipeline hygiene is everyone's job."],
  whale:["Whale on the board."],
  bigClose:["Big deal closed. Ring something."],
  sqlStorm:["Leads delivered. Quality not guaranteed."],
  viral:["We are trending. Legal knows."],
  outage:["The cloud is experiencing weather."],
  freeze:["Budget freeze rumors. Remain calm."],
  rebalance:["Territories realigned. Not in your favor."],
  cash:["Finance would like a word."],
  phones:["Phones are for calling."],
  competitor:["Pricing alert. Competitor panicked."],
  incident:["Security incident. No comment."],
  hydrate:["Wellness reminder. Hydrate."]
};
Object.assign(LINES,{ closeOut:["Close that out."], burnoutCaffeine:["Rep has left the atmosphere."] });
Object.assign(LINES,{ welcome:["Welcome to Shitcorp. Culture is glue."] }); // the onboarding memo
// clAInk. Six words or fewer, and never "AI" or "clAInk": speech engines spell them out.
Object.assign(LINES,{ claink:["Agent outperforming staff. Please clap."], sev1:["Sev one. The agent did it."],
  strike:["Governance Council to room B.","Strike logged. The Council is watching."], clainkRevoked:["Your agent has been offboarded."],
  chatgdp:["Always on Chat GDP, huh?"], yoink:["Manager closing your deal. Take notes."], repoClaink:["Collections thanks the agent."] });

// The same line as a caption. Spoken lines are plain ASCII and spell some words the way a speech engine needs them;
// on screen they are typeset. WHO is the label in front of the caption.
const SHOWN = { "Chat GDP": "ChatGDP", "Sev one": "Sev 1" };
export const captionOf = text => { let t = String(text).replace(/'/g, "\u2019"); for (const k in SHOWN) t = t.split(k).join(SHOWN[k]); return t; };
export const WHO = { pa: "PA", hr: "HR" };

// For the copy lint. These lines are read aloud, so they are plain ASCII (a speech engine can trip on a curly
// apostrophe). The six-word limit is for the office PA; HR's terminations are read calmly, in full.
export const lint = { spoken: true, skip: ["captionOf"], exempt: {
  "quotes": ["LINES", "HR_LINES"],
  "len-spoken": ["HR_LINES", "LINES.fired", "LINES.firedOrg", "LINES.firedReview"]
} };
