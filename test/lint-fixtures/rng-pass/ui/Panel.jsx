// Fixture for scripts/lint-rng.mjs: an interface file that never rolls. Math.random() in this comment is not an
// offence, nor is the string below, nor is the rest of Math, nor is a clock (the interface may read one).
import { fxRandom } from "../fxrng.js";

export const hint = "Math.random is for the rules";
export const jitter = () => Math.floor(fxRandom() * 6) + Math.max(1, Math.PI);
export const now = () => performance.now() + Date.now();
// apostrophes in JSX text are where a hand-rolled comment stripper goes wrong; the lint parses the file instead
export const Panel = ({ label }) => <div title="it's not Math.random">{label}: it's fine, isn't it // Math.random()</div>;
