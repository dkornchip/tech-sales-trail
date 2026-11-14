// Fixture for scripts/lint-rng.mjs: the seeded stream. Its seed comes from crypto, and its test hooks sit behind
// the build flag, in each of the three shapes a guard can take.
let a = 1;
export const seed = () => globalThis.crypto.getRandomValues(new Uint32Array(1))[0];
export const rnd = () => {
  if (typeof __TST_TEST__ === "undefined" || __TST_TEST__) { const f = globalThis.__TST_RNG; if (typeof f === "function") return f(); }
  a = (a + 0x6D2B79F5) >>> 0;
  return a / 4294967296;
};
export const named = () => ((typeof __TST_TEST__ === "undefined" || __TST_TEST__) && Number.isFinite(globalThis.__TST_SEED) ? globalThis.__TST_SEED : seed());
export const handle = {};
if ((typeof __TST_TEST__ === "undefined" || __TST_TEST__) && typeof window !== "undefined") window.TST_CLAINK = handle;
export const pinned = typeof __TST_TEST__ === "undefined" || __TST_TEST__ ? globalThis.__TST_FX : null;
