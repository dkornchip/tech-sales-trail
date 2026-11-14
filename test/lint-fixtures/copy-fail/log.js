// Fixture for scripts/lint-copy.mjs: every rule, broken on purpose. test/lint-fixtures/selftest.mjs requires the
// lint to report each one. (The strings are the kind the game had before the rewrite.)
export const emoji = ["📞 Blitz complete.", "New: Autonomous Pipeline ✦", "Seat revoked ⚠️"];
export const quotes = ['Your manager said "macro".', "It's not you."];
export const plural = "Blitz complete. 3 lead(s) added.";
export const minus = ["Rent paid. Cash is now -$1,600.", "Politics: -8 manager."];
// only wrong when the money is negative: found by the lint's "negative money" params, not by reading the source
export const rent = ({ cash }) => `Rent paid. Cash is now ${cash}.`;
export const ellipsis = "Agents working...";
export const banned = [
  "Buff manager, tax reputation.", "Out of mana.", "Good vibes only.", "An epic quarter.", "Quota missed, lol."
];
// over 100 characters as written
export const long = "The forecast call ran long, then longer, then it was moved to a recurring series that nobody is able to decline.";
// over 100 characters only with a long list of long names: found by the lint's params
export const ghosted = ({ names }) => `These accounts stopped answering this week: ${names.join(", ")}.`;
// a template that renders undefined or NaN
export const broken = [({ n }) => `Leads added: ${[n][1]}.`, ({ pct }) => `${pct / "quota"}% of quota.`];
// a line its module has pleaded for (lint.limits, below): no plea buys more than 150 characters
export const pleaded = "The quarterly business review has been moved to a larger room, then to a smaller room, then to a call, then to an email, and finally to a shared document nobody opened.";
// a function no synthetic params can satisfy
export const uncallable = ({ deals }) => deals.first.account.toUpperCase();
export const lint = { limits: { "len-log": { pleaded: 400 } } };
