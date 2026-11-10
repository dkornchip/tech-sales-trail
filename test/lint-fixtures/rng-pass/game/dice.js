// Fixture for scripts/lint-rng.mjs: the rules may roll the dice, and may read the clock.
export const roll = () => Math.random();
export const pick = arr => arr[Math.floor(Math.random() * arr.length)];
export const stamp = () => Date.now();
