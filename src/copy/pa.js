// What the PA announcer says. Each key is a moment in the game; its value is the list of lines the announcer picks
// from at random (one cosmetic draw). The keys are fixed: the sound engine, the scenes and the tests ask for lines by
// key. Which keys are read by HR, in the other voice, is decided in src/engine/audio/voice.js (HR_KEYS).
// Keep a line short: speech engines read slowly, and the next line waits for this one to finish.

// Terminations are read by HR, calmly, and say only what HR would say. One list per way of being let go.
export var HR_LINES = ["Thank you for joining. Today is your last day with Shitcorp.","We have reviewed the quarter and decided to part ways."];
export var LINES = {
  boot:["Quota assigned. Good morning."],
  newrun:["New quarter. Same quota."],
  club:["President's Club. Collect your jacket."],
  fired:HR_LINES,
  firedOrg:["Your role was affected by a realignment. This is not about performance."],
  firedReview:["We looked at the forecast together. Today is your last day."],
  burnout:["Containment failed. Evacuate the pod."],
  missed:["Close. Not closed."],
  repo:["Jacket owner to Collections."],
  week5:["Pace reviews are now in session."],
  week7:["Halfway. The quota has not moved."],
  week12:["One week left. Panic quietly."],
  week13:["Final week. Commit means commit."],
  filler:[
    "Pipeline is not revenue.",
    "Update opportunities before the forecast call.",
    "Leaderboard updated. Do not look.",
    "Lunch and learn. No lunch.",
    "Your calendar has been optimized.",
    "Fridge cleanout Friday. Pipeline too.",
    "Parking validation ends at six.",
    "The all-hands has moved again.",
    "Please update your next steps.",
    "This announcement has been recorded."
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
Object.assign(LINES,{ claink:["Agent closed a deal. Staff notified."], sev1:["Sev one. The agent did it."],
  strike:["Governance Council to room B.","Strike logged. The Council is watching."], clainkRevoked:["Your agent has been offboarded."],
  chatgdp:["Always on Chat GDP, huh?"], yoink:["Manager closing your deal. Take notes."], repoClaink:["Collections thanks the agent."] });

// For the copy lint. These lines are read aloud, so they are plain ASCII (a speech engine can trip on a curly
// apostrophe). The six-word limit is for the office PA; HR's terminations are read calmly, in full.
export const lint = { spoken: true, exempt: {
  "quotes": ["LINES", "HR_LINES"],
  "len-spoken": ["HR_LINES", "LINES.fired", "LINES.firedOrg", "LINES.firedReview"]
} };
