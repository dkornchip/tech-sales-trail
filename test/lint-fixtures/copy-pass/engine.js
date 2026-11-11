// Fixture for scripts/lint-copy.mjs: the variant engine lives next to the copy but is not copy. It is skipped by
// name; if it were called with synthetic params, this would be reported.
export const pick = (entry, ctx) => `undefined lol ${entry} ${ctx}`;
