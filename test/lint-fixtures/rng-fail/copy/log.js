// Fixture for scripts/lint-rng.mjs: copy that rolls its own dice and reads the clock.
export const pickOne = lines => lines[Math.floor(Math.random() * lines.length)]; // OFFENCE math-random
export const stamp = () => `Logged at ${Date.now()}.`; // OFFENCE copy-clock
export const today = () => `It is ${new Date().getDay() === 5 ? "Friday" : "not Friday"}.`; // OFFENCE copy-clock
export const when = () => `Filed ${Date()}.`; // OFFENCE copy-clock
export const elapsed = () => `Took ${Math.round(performance.now())} ms.`; // OFFENCE copy-clock
