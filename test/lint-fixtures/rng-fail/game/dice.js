// Fixture for scripts/lint-rng.mjs: allowed here, so nothing in this file is reported.
export const roll = () => Math.random();
const { random } = Math;
export const again = () => random() + Date.now();
