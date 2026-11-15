# Developing Tech Sales Trail

How the game is built, where things live, and what `npm run verify` checks. For what the game is and how to play
it, see the [README](../README.md).

## The short version

```
npm install              # esbuild, React, the fonts, the icons
npm run build            # src/ -> dist/index.html, the release build: no test hooks in it
npm run build:test       # src/ -> dist-test/index.html, the same game with the hooks the tests script it through
npm run verify           # both builds, then every check below
npm run release          # src/ -> ./Tech_Sales_Trail_<version>.html (2.1.1; a .0 patch is left off: 2.1)
npm run verify:release   # verify, and that the committed release file is exactly what the source builds
```

The checks drive a real browser with [Playwright](https://playwright.dev), which is not in `package.json`.
Install it once beside the project: `npm install --no-save playwright && npx playwright install chromium`.

## Releases and `index.html`

The build puts everything (React, the game, the styles, two fonts, the icons) into one HTML file that makes no
network requests.

- A release is written as `Tech_Sales_Trail_<version>.html` by `npm run release` (the version in `package.json`).
- `index.html` at the root is the file GitHub Pages serves. It is a byte-for-byte copy of the release the owner
  has promoted (today: `Tech_Sales_Trail_2.1.1.html`). The build never writes it; promoting a release is the owner's
  call.
- Releases are kept as shipped: `Tech_Sales_Trail_2.1.1.html` and `Tech_Sales_Trail_2.1.html` at the root, and
  `v2.0.1` and `v1.21` under `test/baseline/` (the scene and save tests still compare against v1.21).
  `test/baseline/releases.json` records each one's size and SHA-256 and which one is promoted; the `releases` step
  of `npm run verify` fails if any of them, or `index.html`, is no longer that file.
- A release candidate is not in that record until it is promoted. While the version in `package.json` is that of
  a promoted release, the release file is held twice: by its record here, and by the `released` step (it must be
  what the source builds). A change to the source after a promotion therefore starts with a new version number.

To promote a release, on the owner's instruction only: copy its file over `index.html`; add it to
`test/baseline/releases.json` with its size and SHA-256 and set `"promoted"`; bring the README's "what's new" and
its two sentences about confirmations up to date; run `npm run verify:release`.

## Where things live

| Where | What |
|---|---|
| `src/game/` | The rules, as pure functions of the run's state. `run.js` is the front door: `step(state, move)` is the only way a run changes, for the interface and for the tests alike. `rng.js` is the run's own seeded dice, saved with the run. `rules.js` holds every cost, chance and balance setting once; the interface and the handbook read the same numbers. |
| `src/copy/` | Every word the player reads. `engine.js` chooses between a line's wordings without touching the game's dice. |
| `src/ui/` | The interface (React). `src/styles/tokens.css` is the only file that names a colour or a size. |
| `src/engine/` | The ASCII scene engine and the synthesized sound. |
| `scripts/` | The build, the lints, `verify.mjs`, `copy-coverage.mjs`, and `screenshots.cjs` (plays the game and takes the README's pictures). |
| `test/` | See below. |
| `docs/2.1/` | The brief and the editorial copydeck v2.1 was built from, and the notes on the copydeck rows that are not rendered word for word. |
| `qa/2.1/` | The evidence behind `TTST_2.1_QA_REPORT.md`: gate logs, balance data, screenshots. |

The rule for changes: **jokes never touch dice.** Anything cosmetic draws from its own stream (`src/fxrng.js`);
every roll of the rules comes from the run's seeded stream, inside a move.

## What `npm run verify` checks

It runs these in order and stops at the first that fails.

- **lints**: `Math.random` only in the cosmetic stream and test hooks only behind the build flag (`lint:rng`);
  house style, and length budgets for log lines and announcer lines, on every string (`lint:copy`); colours and
  sizes only from the tokens (`lint:css`); every log line, dialog and announcement is wired and renders in every
  wording.
- **copy-deck** (`scripts/copy-coverage.mjs`): every row of the editorial copydeck (`docs/2.1`) is rendered by the
  build, or has a reason on file (`docs/2.1/copy-coverage-notes.json`).
- **fonts and notices**: the bundled fonts are what the pinned packages generate and cover every character the
  scenes draw; `THIRD-PARTY-NOTICES.md` is current.
- **engine** (`test/engine/`, Node): every rule with scripted dice (actions, closes, the Hail Mary, End Week,
  reviews, the QBR at each boundary, Friday events, effects, clAInk, saves), the dice themselves (same seed and
  moves, same run; a run saved and read back carries on exactly; nothing rolls outside a move), invariants after
  every move of random and scripted play, and golden replays of seeded runs.
- **audio** (`test/audio/`, Node): what the sound engine decides, against a fake speaker: which log line makes
  which sound, what a batch plays, that the announcer never talks over itself, that a line that matters cuts off
  filler, captions, mute.
- **releases** (`scripts/check-releases.mjs`): every earlier release kept in the repository is the file that
  shipped, and `index.html` is the one the owner promoted.
- **sim-smoke** (`test/sim/`): the simulation kit plays whole quarters with policy bots on the frozen balance
  baseline (`test/baseline/checkpoint-engine`) and on the working tree, and the frozen engines are intact.
  `npm run sim -- --seeds 1000` prints the balance tables. The bots are heuristics; they are not playtests.
- **equivalence** (`test/engine/tools/equivalence.mjs`): the frozen 2.1 rules (`test/baseline/v2.1-engine`) and
  the working tree are played side by side from the same seeds by every policy bot. After every move the two runs
  must be the same run (every meter, deal, flag, counter, effect, pending choice, the log's tags in order and the
  position of both dice streams; words are not compared). A move 2.1 allowed and the tree refuses must be a
  correction listed in that file, and is proven there to have been worth nothing in 2.1. A patch release that is
  meant to be presentation-only passes this unchanged.
- **scenes**: every frame of every ASCII scene's picture is exactly v1.21's. (v2.1 rewrote the captions under them;
  the copy lint and the copydeck gate hold those.)
- **fixtures** and **saves** (`test/saves/`): saves from every state and ending of v1.21, and older, load, show
  what they should, and play on. The fixtures are regenerated from the frozen v1.21 file and must match what is
  committed.
- **release** (`test/e2e/release.cjs`): the shipped file exposes no test hook, ignores one planted from outside,
  and replays move for move against `src/game` from the run it saved. At every press, and in a fixed list of
  states the dice rarely deal, the moves the page offers are the moves the rules allow.
- **offline**, **first day**, **confirm**, **resilience**, **phone**, **keyboard**, **layout** (`test/e2e/`): no
  network and the bundled fonts in use; the onboarding memo and tour; the four confirmations by real clicks and key
  presses (a "no" must leave the run exactly as it was); reloads, damaged saves, duplicate names and an ending whose
  cutscene cannot play; a touch screen at phone sizes and on its side; a whole run on the keyboard; one screen at
  nine desktop sizes (two of them short: 1366×657 and 1280×620, a laptop with the browser's toolbars showing) and a
  phone, with nothing covered or cut off, clAInk's ad showing all of itself (on an empty board and beside ten
  deals), and clAInk's window taking only the room the deal list and the log do not need.
- **actions** (`test/e2e/actions.cjs`, on the release build): what the page says a press will do is what it does.
  Crafted boards are opened, the cards are read, the rules are asked about the same run, the card is pressed and
  the run the page saves is compared with the run before: the count of eligible deals, `skill only`, `no deals`, a
  card that is off, a press that would end the run (marked, said, confirmed; "no" changes nothing), a Friday that
  would end it, the hint after a press, the change chips with reduced motion, the quota label at the lines that
  decide the quarter, that no hint is taller than the hint bar, clAInk's workspace following a run to its result
  and Friday's invoice being what was previewed, and an ending shown as it is with reduced motion.
- **matrix** (`test/e2e/matrix.cjs`): eight screen sizes (1440×900 down to 320×568, a phone on its side, 200% zoom)
  × thirteen states (a new player's first screen, the main screen, clAInk's offer open and minimized, a Friday
  choice, a clAInk incident, the handbook, six endings), from `file://` with the network refused. `--shots <dir>`
  saves the pictures.
- **released** (with `verify:release`): the committed release file is exactly what the source builds.

`npm run test:selftest` turns the tests on themselves: each one is given a planted fault and must report it.
`python3 test/engine/tools/mutation-check.py` plants small mistakes in the rules, one at a time, and reports any
the engine tests fail to catch.

## Tools for changing the rules

- `node test/sim/run.mjs --policies all --seeds 1000` plays 1,000 quarters per policy on the working tree;
  `--engine baseline` plays the frozen 2.0.1 rules on the same seeds; `--tuning '<json>'` tries a balance candidate
  over the shipped defaults (`TUNING_DEFAULTS` in `src/game/rules.js`).
- `node test/engine/tools/integrity-diff.mjs` plays the frozen 2.0.1 rules and the working tree side by side and
  sorts every difference into the 2.1 fixes that explain it, or "anything else".
- `node test/engine/tools/equivalence.mjs --seeds 1000` is the `equivalence` step at full size: the frozen 2.1
  rules against the working tree, 22 policies, every move.
- `node test/e2e/tools/shot.cjs --out <file> --state '<json>' --size 1366x657 --do hover:'[data-act="close"]'`
  takes one picture of the game in any state at any size, for looking at a change before and after it.
- Up to v2.0.1 the build was also held move for move, and sound for sound, to the frozen v1.21 file
  (`test/parity/run.cjs`). v2.1 changes rules on purpose, so that comparison ended at the last commit where it held;
  the evidence is in `qa/2.1/evidence/`. The harness stays, because the scene, save and browser tests are built on
  it; `npm run parity:selftest` still proves it catches planted bugs.

## The README's pictures

`node scripts/screenshots.cjs` plays the test build from fixed seeds and writes four PNGs to
`test-results/screenshots/` (the main screen, clAInk's workspace, the President's Club ending, the first day). The
README uses WebP copies in `screenshots/`:

```
python3 -c "
from PIL import Image
for n in ['main', 'claink', 'ending', 'first-day']:
    Image.open(f'test-results/screenshots/{n}.png').convert('RGB').save(f'screenshots/{n}.webp', 'WEBP', quality=82, method=6)
"
```
