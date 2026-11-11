// Fixture for scripts/lint-rng.mjs: copy takes its variation from the params it is given (a seeded flavor stream),
// never from Math.random, and never reads a clock. "Date.now" in a string is only a string.
export const blitz = ({ n, rng }) => (rng() < 0.5 ? `Blitz complete. ${n} leads added.` : `${n} leads added. Date.now is not a plan.`);
export const rounded = ({ cash }) => `$${Math.round(cash).toLocaleString("en-US")}`;
