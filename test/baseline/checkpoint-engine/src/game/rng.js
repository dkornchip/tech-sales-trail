// The game's dice.
//
// A run carries its own generator: state.rng = { v, seed, core, fl }. `core` is the mechanical stream (every roll
// that decides something, clAInk's included) and `fl` is clAInk's flavor stream (the numbers in its reports, which
// decide nothing). Both are mulberry32 positions, so a run can be saved, reloaded and replayed: the same state and
// the same move always give the same result, and a punchline can never move a mechanical roll.
//
// The rules only draw inside a step (run.js): rolling() loads the positions from the state going in, the rules call
// rnd() and the helpers below, and the positions are written into the state coming out. Nothing draws while the
// interface renders, previews an action or words a log line.
//
// Development and test builds can replace the mechanical source (globalThis.__TST_RNG, a function) and name the
// seed of a new run (globalThis.__TST_SEED, a number). The release build is compiled with __TST_TEST__ false, and
// the bundler removes those branches: a released file has no hook to find.

const STEP = 0x6D2B79F5;
const advance = a => (a + STEP) >>> 0;
const output = a => { let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
// one well-mixed 32-bit number out of two
const mix = (seed, salt) => Math.floor(output(advance((seed ^ salt) >>> 0)) * 4294967296) >>> 0;

let core = 0, fl = 0, open = false;
let strays = 0;               // draws made outside a step: none in a healthy build (tests assert it)

// A seed nobody chose: from the platform's own generator, or the clock where there is none. Never Math.random.
export const freshSeed = () => {
  try {
    const c = globalThis.crypto;
    if (c && typeof c.getRandomValues === "function") return c.getRandomValues(new Uint32Array(1))[0] >>> 0;
  } catch { /* fall through to the clock */ }
  const now = Date.now(), fine = typeof performance !== "undefined" && performance.now ? Math.floor(performance.now() * 1000) : 0;
  return mix(now >>> 0, (fine ^ Math.floor(now / 4294967296)) >>> 0);
};

// The generator of a new run. An explicit seed is for tests and replays; play uses a fresh one.
export const newRng = seed => {
  let s = Number.isFinite(seed) ? seed >>> 0 : null;
  if (s === null && (typeof __TST_TEST__ === "undefined" || __TST_TEST__) && Number.isFinite(globalThis.__TST_SEED)) s = globalThis.__TST_SEED >>> 0;
  if (s === null) s = freshSeed();
  return { v: 1, seed: s, core: mix(s, 0x9E3779B9), fl: mix(s, 0x85EBCA6B) };
};

// A generator read back from a save: whole numbers in range, or a new one.
const u32 = v => Number.isFinite(v) && v >= 0 && v <= 4294967295 && Math.floor(v) === v;
export const sanitizeRng = raw => (raw && typeof raw === "object" && u32(raw.seed) && u32(raw.core) && u32(raw.fl)
  ? { v: 1, seed: raw.seed, core: raw.core, fl: raw.fl } : newRng());

// Runs fn with the dice of `state` loaded, and returns [what fn returned, the generator after it].
// (A step inside a step shares the outer one's dice; the rules never nest them.)
export const rolling = (state, fn) => {
  if (open) return [fn(), null];
  const r = state && state.rng && u32(state.rng.core) && u32(state.rng.fl) ? state.rng : newRng();
  core = r.core; fl = r.fl; open = true;
  try {
    const out = fn();
    return [out, core === r.core && fl === r.fl && r === state.rng ? r : { v: 1, seed: r.seed, core, fl }];
  } finally { open = false; }
};

const stray = () => { strays++; return output(advance(freshSeed())); };
export const strayDraws = () => strays;

// One mechanical roll in [0, 1).
export const rnd = () => {
  if (typeof __TST_TEST__ === "undefined" || __TST_TEST__) { const f = globalThis.__TST_RNG; if (typeof f === "function") return f(); }
  if (!open) return stray();
  core = advance(core);
  return output(core);
};
// One flavor roll in [0, 1): clAInk's report numbers and the names it makes up.
export const flavor = () => {
  if (!open) return stray();
  fl = advance(fl);
  return output(fl);
};

export const rand = (a, b) => rnd() * (b - a) + a;
export const randi = (a, b) => Math.floor(rand(a, b + 1));
export const choice = arr => arr[Math.floor(rnd() * arr.length)];
