// Fixture for scripts/lint-rng.mjs: the one cosmetic stream may fall back to Math.random.
export function fxRandom(){
  const f = globalThis.__TST_FX;
  return typeof f === "function" ? f() : Math.random();
}
