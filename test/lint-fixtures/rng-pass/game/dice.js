// Fixture for scripts/lint-rng.mjs: the rules roll the run's own stream (rng.js), and may read the clock.
import { rnd } from "./rng.js";
export const roll = () => rnd();
export const pick = arr => arr[Math.floor(rnd() * arr.length)];
export const stamp = () => Date.now();
