// Fixture for scripts/lint-rng.mjs: the shell may read a clock, but not the dice.
export const started = Date.now();
export const flicker = () => (Math.random() < 0.5 ? "on" : "off"); // OFFENCE math-random
