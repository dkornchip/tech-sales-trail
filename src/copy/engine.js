// Chooses the wording of a line. An entry in a copy module can be:
//   a string                          one wording
//   a function (p, c) => entry        built from what the game knows (p) and, if it cares, the context (c)
//   an array of entries               variants: one is chosen. A wording that is listed more than once is chosen
//                                     that much more often (the plain line three times and two alternatives once
//                                     each: the plain line 60% of the time)
//   { bands: [a, b, c, d, e] }        one entry per chapter of the quarter (weeks 1-3, 4-6, 7-9, 10-12, 13);
//                                     a missing chapter falls back to the one before it
// and what finally comes out is a string, or { text, dl } where dl is the line's stat changes
// ("−8 manager · +4 stress"), which the interface draws after the sentence.
//
// c = { week, band, n }: week of the quarter, its chapter (0 to 4), and how many times this line has been written
// before in this run (the run keeps that count itself, so it does not depend on how much of the log is still kept).
//
// The choice between variants is a hash of the run, the line and n. It rolls no dice and stores nothing, so a
// punchline can never move a mechanical draw and a reloaded run reads the same. The same sentence is never said
// twice running: if the choice comes out word for word as `lastText` (what this line said last time), the next
// variant is taken instead, as long as there is one that reads differently.
export const lint = { skip: true };

export const bandOf = week => (week >= 13 ? 4 : week >= 10 ? 3 : week >= 7 ? 2 : week >= 4 ? 1 : 0);

const hash = text => { let h = 2166136261; for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

export function render(entry, params, ctx, seed, lastText) {
  const c = ctx || { week: 1, band: 0, n: 0 };
  // Follow an entry down to what it finally says. `salt` keeps a nested choice independent of the one above it;
  // `shift` moves the first choice made along its list (0: the hashed choice itself).
  const settle = (start, salt, shift) => {
    let e = start, first = true;
    for (let depth = 0; depth < 8; depth++) {
      if (Array.isArray(e)) {
        const i0 = hash(seed + "|" + salt + depth) % e.length;
        e = e[(i0 + (first ? shift : 0)) % e.length];
        first = false;
      } else if (typeof e === "function") {
        e = e(params || {}, c);
      } else if (e && typeof e === "object" && Array.isArray(e.bands)) {
        let b = Math.min(c.band, e.bands.length - 1);
        while (b > 0 && e.bands[b] === undefined) b--;
        e = e.bands[b];
      } else break;
    }
    return e;
  };
  const say = shift => {
    const out = settle(entry, "", shift);
    if (out && typeof out === "object") {
      // { text, dl }: the sentence may itself have variants
      const text = settle(out.text, "t", shift);
      return { text: String(text && typeof text === "object" ? text.text : text), dl: out.dl ? String(out.dl) : "" };
    }
    return { text: String(out), dl: "" };
  };
  let r = say(0);
  for (let shift = 1; shift < 8 && lastText && r.text === lastText; shift++) { const next = say(shift); if (next.text !== lastText) { r = next; break; } }
  return r;
}
