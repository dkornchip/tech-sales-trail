// Fixture for scripts/lint-rng.mjs: every line marked OFFENCE must be reported, and nothing else in this folder.
export const shake = () => Math.random() * 4; // OFFENCE math-random
export const Panel = ({ label }) => <div style={{ opacity: Math.random() }}>{label}: it's fine</div>; // OFFENCE math-random
