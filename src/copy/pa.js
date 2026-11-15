// What the PA announcer says. Each key is a moment in the game; its value is the list of lines the announcer picks
// from at random (one cosmetic draw). The keys are fixed: the sound engine, the scenes and the tests ask for lines by
// key. Which keys are read by HR, in the other voice, is decided in src/engine/audio/voice.js (HR_KEYS).
// Keep a line short (twelve words at most): speech engines read slowly, and the next line waits for this one to
// finish. The cadence is a recorded announcement that does not care, not a comedian.

// Terminations are read by HR, calmly, and never as a joke at the expense of the person hearing them. The three
// "fired" keys share this one list.
export var HR_LINES = ["As of today, your position with Shitcorp has ended.", "Thank you for joining us. Today is your last day.", "We've reviewed the situation and are ending your employment."];
export var LINES = {
  boot:["Quota assigned. Good morning.", "Corporate objectives loaded."],
  newrun:["New quarter. Same expectations."],
  welcome:["Welcome to Shitcorp. Your badge is ready."],          // the onboarding memo
  club:["President's Club. Please retain your boarding pass."],
  fired:HR_LINES,
  firedOrg:HR_LINES,
  firedReview:HR_LINES,
  burnout:["Containment failed. Evacuate the pod."],
  burnoutCaffeine:["Employee has left designated airspace."],
  missed:["Badge access renewed. Forecast call, Monday."],
  repo:["Jacket owner, please report to Collections."],
  week5:["Performance reviews are now in session."],
  week7:["The forecast has been distributed to leadership."],
  week12:["One week remaining. Please accelerate time."],
  week13:["Final week. Commit means commit."],
  filler:[
    "Pipeline is not revenue.",
    "Mandatory fun begins at four.",
    "The CRM is the source of truth.",
    "Lunch and learn. Lunch not provided.",
    "Hydration is not a substitute for productivity.",
    "Check your forecast before checking the leaderboard.",
    "Please reply only to the sender.",
    "Conference room B requires a reservation.",
    "Fridge cleanout Friday. Pipeline too.",
    "Your calendar has been optimized.",
    "The printer is not an escalation path.",
    "Please do not expense the motivational posters.",
    "Today's wellness webinar has been rescheduled.",
    "Closed Won requires a signature."
  ],
  hr:["Human Resources has joined the meeting."],
  meetings:["Please log all meetings, including meetings about meetings."],
  hygiene:["Pipeline hygiene is everyone's responsibility."],
  whale:["Large opportunity detected. Please inform your manager."],   // a whale among this batch of referrals
  bigClose:["Large sale verified. Ring something."],
  sqlStorm:["Marketing leads delivered. Qualification remains your responsibility."],
  viral:["We are trending. Legal has been notified."],
  outage:["The cloud is experiencing ground-level difficulties."],
  freeze:["Budget freeze reported. Please remain commercially optimistic."],
  rebalance:["Territory realignment has been completed."],
  cash:["Finance would like a word."],
  phones:["The telephone system is fully operational."],
  competitor:["Pricing alert. Please consult the approval matrix."],
  incident:["Security incident. Refer all inquiries to Legal."],
  hydrate:["Wellness reminder. Water is available."],
  closeOut:["Close that out, please."],
  // clAInk. Never "AI" or "clAInk" aloud: speech engines spell them out.
  claink:["Finance has verified agent-generated revenue."],
  sev1:["Severity one incident. The agent is involved."],
  strike:["Governance Council, conference room B.", "Strike recorded."],
  clainkRevoked:["Your agents have been offboarded."],
  chatgdp:["Always on Chat GDP, huh?"],
  yoink:["Manager taking over the account. Observe."],
  repoClaink:["Collections thanks you for your digital transformation."]
};

// The same line as a caption. Spoken lines are plain ASCII and spell some words the way a speech engine needs them;
// on screen they are typeset. WHO is the label in front of the caption.
const SHOWN = { "Chat GDP": "ChatGDP" };
export const captionOf = text => { let t = String(text).replace(/'/g, "\u2019"); for (const k in SHOWN) t = t.split(k).join(SHOWN[k]); return t; };
export const WHO = { pa: "PA", hr: "HR" };

// For the copy lint. These lines are read aloud, so they are plain ASCII (a speech engine can trip on a curly
// apostrophe). The twelve-word limit is for the office PA; HR's terminations are read calmly, in full.
export const lint = { spoken: true, skip: ["captionOf"], exempt: {
  "quotes": ["LINES", "HR_LINES"],
  "len-spoken": ["HR_LINES", "LINES.fired", "LINES.firedOrg", "LINES.firedReview"]
} };
