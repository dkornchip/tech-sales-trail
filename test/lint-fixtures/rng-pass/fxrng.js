// Fixture for scripts/lint-rng.mjs: the one cosmetic stream may fall back to Math.random, and its pin is a test hook.
export function fxRandom(){
  if (typeof __TST_TEST__ === "undefined" || __TST_TEST__) { const f = globalThis.__TST_FX; if (typeof f === "function") return f(); }
  return Math.random();
}
