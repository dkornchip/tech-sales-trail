// Chooses the wording of a line. An entry in a copy module can be:
//   a string                          one wording
//   a function (p, c) => entry        built from what the game knows (p) and, if it cares, the context (c)
//   an array of entries               variants: one is chosen, and never the one chosen last time
//   { bands: [early, mid, late, last] }   one entry per stretch of the quarter (weeks 1-4, 5-8, 9-12, 13);
//                                         a missing stretch falls back to the one before it
// and what finally comes out is a string, or { text, dl } where dl is the line's stat changes
// ("−8 manager · +4 stress"), which the interface draws after the sentence.
//
// c = { week, band, n }: week of the quarter, its stretch (0 to 3), and how many times this line has been written
// before in this run (as far as the log remembers).
//
// The choice between variants is a hash of the run, the line and n. It rolls no dice and stores nothing but itself,
// so a punchline can never move a mechanical draw and a reloaded run reads the same.
export const lint = { skip: true };

export const bandOf = week => (week >= 13 ? 3 : week >= 9 ? 2 : week >= 5 ? 1 : 0);

const hash = text => { let h = 2166136261; for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

export function render(entry, params, ctx, seed, last) {
  const c = ctx || { week: 1, band: 0, n: 0 };
  let v = -1, e = entry;
  for (let depth = 0; depth < 8; depth++) {
    if (Array.isArray(e)) {
      const i0 = hash(seed + "|" + depth) % e.length;
      const i = e.length > 1 && v < 0 && i0 === last ? (i0 + 1) % e.length : i0;
      if (v < 0) v = i;                       // the outermost choice is the one remembered
      e = e[i];
    } else if (typeof e === "function") {
      e = e(params || {}, c);
    } else if (e && typeof e === "object" && Array.isArray(e.bands)) {
      let b = Math.min(c.band, e.bands.length - 1);
      while (b > 0 && e.bands[b] === undefined) b--;
      e = e.bands[b];
    } else break;
  }
  if (e && typeof e === "object") return { text: String(e.text), dl: e.dl ? String(e.dl) : "", v };
  return { text: String(e), dl: "", v };
}
