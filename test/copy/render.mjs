// Renders every log line many times over, across the quarter, and fails if a sentence ever comes out joined to
// its other wordings, with an undefined in it, or as [object Object].   node test/copy/render.mjs
import { LOG } from "../../src/copy/log.js";
import { render } from "../../src/copy/engine.js";
const P = { n: 2, account: "Pinecone Pizza", value: 12000, won: 18200, keep: 2184, src: "close", key: "whale", shot: 3, energy: 15, stress: 18, relief: 12, nap: 0, trip: "Japan", pruned: 2, mgr: 7, size: "", week: 7, pct: 84, quarter: 1, cost: 500, total: 1089, tokens: 4400000, claims: 4, looped: false, of: 3, who: "Procurement", line: "It tried to buy itself a seat.", miracle: false, hit: 9 };
let bad = 0, seen = 0; const variants = {};
for (const tag of Object.keys(LOG)) for (let k = 0; k < 40; k++) for (const band of [0, 1, 2, 3]) {
  const r = render(LOG[tag], { ...P, n: k % 3, nap: k % 2 ? 19 : 0, shot: 1 + (k % 5) }, { week: 1 + band * 4, band, n: k }, "run|" + tag + "|" + k, k % 4);
  seen++; (variants[tag] = variants[tag] || new Set()).add(r.text);
  if (/undefined|\[object|NaN|,Recharged|\.,[A-Z“]/.test(r.text + r.dl) || !r.text) { bad++; console.log("BAD", tag, JSON.stringify(r)); }
}
console.log(seen, "renderings,", bad, "bad;", Object.values(variants).reduce((a, s) => a + s.size, 0), "distinct sentences across", Object.keys(LOG).length, "tags");
if (bad) process.exit(1);
