// Cosmetic randomness (scene particles, sound jitter, PA filler odds) never shares a stream with the game's dice.
// Tests may install globalThis.__TST_FX to pin it; in play it is plain Math.random.
export function fxRandom(){
  const f = globalThis.__TST_FX;
  return typeof f === "function" ? f() : Math.random();
}
