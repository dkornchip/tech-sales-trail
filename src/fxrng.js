// Cosmetic randomness (scene particles, sound jitter, PA filler odds) never shares a stream with the game's dice.
// In play it is plain Math.random. A test build may pin it with globalThis.__TST_FX; a release has no such hook
// (the bundler drops the branch: see scripts/build.mjs).
export function fxRandom(){
  if (typeof __TST_TEST__ === "undefined" || __TST_TEST__) { const f = globalThis.__TST_FX; if (typeof f === "function") return f(); }
  return Math.random();
}
