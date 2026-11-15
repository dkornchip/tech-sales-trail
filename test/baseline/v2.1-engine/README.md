# The v2.1 engine (frozen)

`src/game` and `src/copy` exactly as they were at commit `c7f62f9`: the rules and the words of Tech Sales Trail 2.1
as released (`Tech_Sales_Trail_2.1.html`).

It is kept for one job: a patch release is compared with it. `test/engine/tools/equivalence.mjs` plays these rules
and the working tree side by side from the same seeds and requires the same run after every move; a move the
working tree no longer allows has to be a correction that was decided and is listed there. `npm run verify` runs
it (the `equivalence` step).

Do not edit it; `SHA256SUMS` lists every file and `test/sim/check-baseline.mjs` fails if one changes.
