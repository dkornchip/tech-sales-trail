// Fixture for scripts/lint-copy.mjs: the lines the voice bible says must survive the rewrite word for word. If the
// lint ever reports one of these, the lint is wrong, not the line.
export const keepers = [
  "ERROR: quota exceeds pipeline.",
  "Quota assigned. Good morning.",
  "New quarter. Same quota.",
  "Close. Not closed.",
  "Pipeline is not revenue.",
  "Lunch and learn. No lunch.",
  "The cloud is experiencing weather.",
  "Territories realigned. Not in your favor.",
  "One week left. Panic quietly.",
  "Fridge cleanout Friday. Pipeline too.",
  "WE’RE A FAMILY*",
  "*at-will",
  "“Different direction.” (Not you.)",
  "Your rep ran into a problem and needs to cool down.",
  "OOO. Forever.",
  "HR is on your next 1:1. Nobody mentions it.",
  "Recurring meeting about you. Not invited.",
  "Nobody signed. Verbal commits only.",
  "QBR: your manager blames “macro.” You live.",
  "“Nice emails. Now call someone.”",
  "Flagged 0 risks. Confidence: 99%",
  "Your agent nominated itself for Rep of the Month. It’s currently winning.",
  "Pay for every outcome, plus the tokens it took to get there.",
  "Human-in-the-loop (optional)",
  "Shitcorp AI Use Policy v3 (final) (2)",
  "No strike. Legal is reading it anyway.",
  "Your calendar has been optimized.",
  "Leaderboard updated. Do not look.",
  "Borrow from tomorrow.",
  "Caffeine ate the calm.",
  "How cursed the stack is."
];
export const enriched = ({ n }) => `Enriched ${n},000 CRM fields with “Unknown”`;
export const booked = ({ n }) => `Booked ${n} meetings with other agents`;
export const scored = ({ n }) => `Scored ${n} leads. All “medium.”`;
export const farewell = ({ account }) => `Its farewell email to ${account}: “It’s not you, it’s me.” They agreed.`;
export const influenced = ({ value }) => `Influenced $${Math.abs(value).toLocaleString("en-US")} of pipeline (all of it)`;
