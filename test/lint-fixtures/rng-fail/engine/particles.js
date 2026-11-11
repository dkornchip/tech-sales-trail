// Fixture for scripts/lint-rng.mjs: the ways of reaching Math.random that a text search misses.
export const a = () => Math["random"](); // OFFENCE math-random
export const b = () => globalThis.Math.random(); // OFFENCE math-random
const { random } = Math; // OFFENCE math-random
export const c = () => random();
const M = Math; // OFFENCE math-alias
export const d = () => M.random();
export const e = fn => fn(Math); // OFFENCE math-alias
