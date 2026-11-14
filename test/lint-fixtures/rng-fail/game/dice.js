// Fixture for scripts/lint-rng.mjs: the rules do not roll Math.random any more (they roll the run's own stream),
// and a test hook outside the build flag's branch would ship.
export const roll = () => Math.random(); // OFFENCE math-random
const { random } = Math; // OFFENCE math-random
export const again = () => random() + Date.now();
const hook = globalThis.__TST_RNG; // OFFENCE test-hook
export const scripted = () => (typeof hook === "function" ? hook() : 0.5);
export const seeded = () => window.__TST_SEED; // OFFENCE test-hook
if (typeof window !== "undefined") window.TST_CLAINK = { roll }; // OFFENCE test-hook
// guarded the wrong way round: the hook is in the branch a release keeps
export const wrong = typeof __TST_TEST__ !== "undefined" && !__TST_TEST__ ? 1 : globalThis.__TST_FX; // OFFENCE test-hook
