# The checkpoint engine (frozen)

`src/game` and `src/copy` exactly as they were at commit `b698412` ("checkpoint P"): the v2.0.1 rules, unchanged,
except that every roll comes from a seeded stream the run carries (`src/game/rng.js`) and every move goes through
`step()` (`src/game/run.js`).

That commit was proven to play exactly as v2.0.1 and v1.21 do:

- the whole original verification, including move-for-move parity with the frozen v1.21 file (5,299 moves,
  31,066 rolls, 257 scripted scenarios) and all 38 save fixtures;
- a Node differential against the v2.0.1 source on identical dice: 10,800 runs, 341,826 moves, identical after
  every move (`test/engine/tools/differential.mjs`).

See `qa/2.1/evidence/01-checkpoint-P-verify.txt`.

It is kept for one job: it is the **balance baseline**. The simulations (`test/sim`) play it and the working tree
from the same seeds, so "before" and "after" are measured on the same footing. Do not edit it; `SHA256SUMS` lists
every file and `test/sim/check-baseline.mjs` fails if one changes.
