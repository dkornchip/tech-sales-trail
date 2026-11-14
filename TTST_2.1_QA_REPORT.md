# Tech Sales Trail 2.1 — QA report

Release candidate for "Operation Final Coat". Everything in this report was run in this repository on the tree
that built `Tech_Sales_Trail_2.1.html`; nothing is reported as passed without a log on file. Where something was
not run, or failed along the way, it says so.

| | |
|---|---|
| Status | **Promoted after this report was written**: on the owner's instruction `index.html` is now a byte-for-byte copy of the release file, and 2.0.1 is kept at `test/baseline/v2.0.1/index.html`. The rows below describe the tree as tested, before promotion. |
| Release file | `Tech_Sales_Trail_2.1.html`, 556,515 bytes, sha256 `ee60e05b8e93…541560` |
| Baseline | `index.html` (2.0.1), 518,108 bytes, sha256 `0272acc61921…293644`: untouched, still the deployed page |
| Branch | `claude/modest-franklin-5cqmn8` (not merged, not promoted, no pull request) |
| Final gate run | `npm run verify:release`: **26 of 26 steps passed**, 515 s (`qa/2.1/evidence/10-final-verify-release.txt`) |
| Browser | Chromium (Playwright 1.63). **Firefox: not installed here, not verified.** |
| Balance | 22 policies × 1,000 seeds per candidate, plus a held-out seed set. Automated heuristics, not human play. |

Contents: 1 what changed · 2 balance · 3 tests · 4 screens and screenshots · 5 saves · 6 copydeck coverage ·
7 size and load · 8 deviations and judgment calls · 9 not run, known limits, risks · 10 how to reproduce

---

## 1. What changed, by area

The brief's anchors are names from the minified 2.0.1 bundle. The repository has the readable source the bundle is
built from, so the work was done there. The anchor column maps each one.

| Brief | Anchor (bundle) | Source | What changed | Held by |
|---|---|---|---|---|
| A1 dice | 80 `Math.random` sites | `src/game/rng.js`, every file in `src/game` | Every mechanical roll comes from a seeded stream carried in the run (`state.rng`); clAInk's jokes use a second stream that no rule reads. A new run is seeded from `crypto.getRandomValues`. Test hooks (`__TST_RNG`, `__TST_SEED`, …) exist only in test builds. | `test/engine/rng.test.mjs`, `replay.test.mjs`; `lint-rng`; `test/e2e/release.cjs` (no hook in the release, a planted one is inert) |
| A1 front door | dispatch in the UI | `src/game/run.js` (`step`, `legalMoves`, `refusal`) | One function changes a run. The interface, the tests and the simulations all go through it, so they play the same game. A move that is not legal changes nothing, however it arrives. | `choices.test.mjs`, `invariants.test.mjs`, release replay (900 presses, page = source after each) |
| A2 effects | shared `modifiers` in `Rs`, `r1` | `src/game/effects.js`; `tryCloseSome` in `deals.js`; `endWeek` in `week.js` | Each bonus or penalty is its own dated entry with its own last week. One selector feeds odds, discount and chips. Sum held to ±30 points. Same source refreshes instead of stacking. | `effects.test.mjs` (9), `week.test.mjs`, mutation check |
| A3 choices | modal state, side key | `state.pending`, `run.js`, `events.js`, `claink.js`, `ui/Game.jsx` | A waiting choice is part of the run, blocks every other move, is answered exactly once and survives a reload. A Friday choice and clAInk's manager can no longer overwrite each other. No choice is asked on the last Friday. | `choices.test.mjs`; `test/e2e/resilience.cjs` §1, §1b (simultaneous choice + acknowledgement, with reloads) |
| A3 events | `Wv` | `randomEvents`, `FRIDAY_EVENTS` in `events.js` | Only eligible events are rolled, each once; the ones that came up are ordered by roll÷chance (fair, no extra roll); at most two applied, at most one choice; an event with nothing to act on takes no slot. Chances and effects unchanged. | `events.test.mjs` (11); integrity diff |
| A4 saves | storage in the UI | `src/game/save.js`, `state.js` (`mergeSaved`), `src/ui/storage.js` | Versioned envelope under new keys; strict rebuild field by field; recovery dialog; legacy keys read and never written. See §5. | `save.test.mjs` (7), `saves` gate (73 loads), `resilience.cjs` §4 |
| A5 QBR | `Zv` | `evaluateQuarter`, `QBR` in `quarter.js` | One resolution: under 70% is fired with no roll and no "dodged" line; percentages floored; the quarter's total kept; politics firing told apart; severities fixed. | `week.test.mjs` ("the QBR: one resolution at each boundary": 69/70/79/80/99/100%, politics) |
| A5 truth | `G(text, dl)` | `log.js` (`snap`, `fxOf`), `actions.js`, `claink.js`, `selectors.js` | Log lines and strike cards carry what really happened to each meter, measured after clamping. Recharge preview off-by-one fixed. An ending is always the last line. | `actions.test.mjs`, `claink.test.mjs`, `copy.test.mjs` |
| B1 pace | `t1`, `n1`, `i1` | `expectedAttainment`, `paceGap` in `rules.js`; `pace` in `selectors.js`; `behindPace`, `midQuarterRisk` in `quarter.js` | One curve for reviews, risk, the dashboard and the manager: [0, .02, .05, .10, .18, .27, .36, .46, .57, .68, .79, .90, 1], 3 points of grace, reviews from week 5, firing from week 6. | `week.test.mjs` (curve, grace, weeks) |
| B2 firing | `n1` | `pipelineRelief`, `fireCap`, `TUNING` in `rules.js`; `midQuarterRisk` | Gap less pipeline relief (stage weights [.05, .12, .25, .45, .60], ≤ 12 points, fading by (13−week)/8, weeks 5–12 only). Weekly caps .12 / .20 / .35 from weeks 6 / 8 / 10; 2% floor. Manager drift against the curve, ±2 a week. | `week.test.mjs` (relief, caps, drift); mutation check |
| C clAInk | `b` and the `Ws` incidents | `src/game/claink.js` | No price or probability changed (asserted). Strike cards quote the measured damage; the churn card no longer names an invented customer; ad dismissal asks first. | `claink.test.mjs` (11); `confirm.cjs` §4 |
| D interface | `tt`, `pr`, `De`, `ht` | `src/ui/app/Kpis.jsx`, `Foot.jsx`, `Quarter.jsx`, `Deals.jsx`, `Ending.jsx`, `Game.jsx`, `ClainkUi.jsx` | Pace words + "Expected by Friday" + marker; per-effect chips; odds wording; four confirmations; ending card with verdict and distinctions; chapter beside the week; dialog marks. | `layout` (328), `matrix` (988), `confirm` (37), `phone` (49), `keyboard` |
| E copy | `vv`, `hv`/`mv`, `av`, `fv`, `uo`, `nv`/`rv`/`st`, `ov`/`iv`/`Ws`/`we`/… | `src/copy/*.js` (`LOG`, `render`/`bandOf`, `EVENT_COPY`, `HELP`, `LINES`, `ENDINGS`/`NOTES`/`SCENE_COPY`, `CK_*`) | Every surface rewritten from the copydeck; variant engine with five week bands (1–3, 4–6, 7–9, 10–12, 13), no immediate repeat, a per-tag counter in the run. | `copy-deck` gate (§6), `lint-copy`, `copy-render`, `copy.test.mjs` |
| E audio | `nl`, `Xo` | `src/engine/audio/voice.js`, `director.js`, `tagmap.js` | A line that matters pre-empts filler (cut off, never overlapped); captions cleared on Load and New run; the "whale" line now announces a whale referral. | `test/audio/behaviour.test.mjs` (15) |

Source diff against the 2.0.1 merge commit: 53 files in `src` (+2,124 / −1,018 lines); 94 files in `test` and
`scripts` (+8,996 / −171).

### Proof that only the intended rules changed

- **Checkpoint P (M1)**: after the dice and the front door went in, and before any rule changed, the whole existing
  2.0.1 verification passed, including move-for-move parity with the frozen v1.21 file: 140 of 140 sessions, 54,158
  steps, 319,780 mechanical draws, 257 scripted scenarios, plus scene and sound parity
  (`qa/2.1/evidence/01-checkpoint-P-verify.txt`). That parity gate was then retired on purpose: the brief's rule
  fixes end it.
- **Integrity diff**: the frozen 2.0.1 rules and the working tree (with the 2.0.1 balance settings and the old
  Friday scan swapped back in) play the same seeds. 6,600 runs, 198,346 moves: 65.5% identical start to finish,
  9.3% differ only on the last Friday (the QBR fix), 25.2% first differ in the odds effects (the shared-timer fix),
  **0 differ anywhere else** (`qa/2.1/evidence/05-m5-integrity-diff.txt`).
- **Final build = selected candidate**: the simulation of the shipped tree reproduces the adopted candidate's
  results exactly on all 22 policies, on both seed sets.

---

## 2. Balance

Authorised by the brief as a design experiment. Quota, schedule, action costs, close odds, coffee and clAInk were
kept fixed.

### Method

- `node test/sim/run.mjs`: whole quarters played headless through the same `step()` the interface uses.
- **Baseline** is the frozen 2.0.1 rules (`test/baseline/checkpoint-engine`, checksum-guarded), proven identical to
  2.0.1 at checkpoint P and seedable.
- **Policies** see only what a player sees (the dashboard, the deal list, legal moves). They cannot read future
  rolls and cannot make an illegal move (0 illegal moves, 0 unfinished runs, asserted by `sim:smoke`).
- **Seeds**: 1–1000 for tuning, per policy, the same seeds for every candidate. **Held-out seeds 5001–6000** were
  used once, to validate the selected candidate. 95% Wilson intervals throughout.
- **These are heuristics, not people.** No human playtest was run. The numbers say how the rules treat seven fixed
  strategies; they do not say how the game feels.

Core policies (`test/sim/lib/policies.mjs`): **novice** (reasonable intent, frequent mistakes), **balanced** (plans
the week from the board: works the funnel from the late stages back, rests, cleans the CRM when a review is near),
**referral** (leads from referrals only), **caller** (cold calls and email), **conference** (conferences when
affordable), **risk** (quad shots and the Hail Mary), **claink** (buys the pilot early, runs it with care).
Probes: expert (balanced without CRM or politics), steady (one action at a time), three clAInk variants, idle,
four single-action spammers, a manager farmer, Hail Mary only, email only, and three that seek an ending.

A note on the bots themselves: the first set chose one action at a time and survived 18–25% of quarters even under
the candidates. A lab run showed that planning the week roughly doubles survival, so the core bots were rewritten
as planners **before** the tables below were produced. That was a change to the bots, not to the game, and both
baseline and candidates were re-run with the same final roster. The old one-at-a-time bot is kept as the "steady"
probe.

Measured strategy distance between core policies (total-variation distance of action mix / lead sources / tools,
`qa/2.1/balance/final.json`): the closest pair is referral vs risk (mix 0.13, sources 0.15): both find leads by
referral, and differ in how they close (risk spends 6.8% of its moves on the Hail Mary, the others 0%). Every other
pair differs by at least 0.33 on lead sources or uses a different tool.

**Baseline: the frozen 2.0.1 rules, seeds 1–1000** (N = 1,000 runs per policy)

| Policy | Survive % (95% CI) | Club % (95% CI) | Missed | Fired | Meltdown | Ascension | Repo | Median attainment % | Median week of loss | Median cash $ | Warned % |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| novice | 0.0 (0.0–0.4) | 0.0 (0.0–0.4) | 0.0 | 99.4 | 0.6 | 0.0 | 0.0 | 0.0 | 7 | 4,703 | 95.3 |
| balanced | 34.0 (31.1–37.0) | 28.5 (25.8–31.4) | 5.5 | 66.0 | 0.0 | 0.0 | 0.0 | 41.9 | 7 | 13,559 | 78.9 |
| referral | 38.9 (35.9–42.0) | 35.3 (32.4–38.3) | 3.6 | 61.1 | 0.0 | 0.0 | 0.0 | 45.3 | 7 | 14,545 | 73.6 |
| caller | 18.5 (16.2–21.0) | 11.9 (10.0–14.1) | 6.6 | 81.5 | 0.0 | 0.0 | 0.0 | 33.7 | 7 | 11,698 | 92.5 |
| conference | 29.9 (27.1–32.8) | 23.9 (21.4–26.6) | 6.0 | 70.1 | 0.0 | 0.0 | 0.0 | 41.6 | 7 | 12,637 | 87.9 |
| risk | 28.7 (26.0–31.6) | 25.6 (23.0–28.4) | 3.1 | 69.8 | 1.5 | 0.0 | 0.0 | 34.0 | 7 | 11,794 | 83.4 |
| claink | 26.1 (23.5–28.9) | 21.8 (19.4–24.5) | 4.3 | 60.2 | 0.0 | 0.0 | 13.7 | 32.5 | 7 | 8,542 | 71.6 |

**Final: the shipped 2.1 rules, seeds 1–1000** (N = 1,000 runs per policy)

| Policy | Survive % (95% CI) | Club % (95% CI) | Missed | Fired | Meltdown | Ascension | Repo | Median attainment % | Median week of loss | Median cash $ | Warned % |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| novice | 1.2 (0.7–2.1) | 0.4 (0.2–1.0) | 0.8 | 96.8 | 2.0 | 0.0 | 0.0 | 0.0 | 9 | 6,370 | 97.3 |
| balanced | 55.1 (52.0–58.2) | 42.8 (39.8–45.9) | 12.3 | 44.9 | 0.0 | 0.0 | 0.0 | 87.3 | 10 | 26,123 | 61.7 |
| referral | 58.7 (55.6–61.7) | 51.1 (48.0–54.2) | 7.6 | 41.3 | 0.0 | 0.0 | 0.0 | 102.1 | 10 | 28,961 | 59.9 |
| caller | 40.6 (37.6–43.7) | 25.9 (23.3–28.7) | 14.7 | 59.4 | 0.0 | 0.0 | 0.0 | 62.8 | 10 | 20,465 | 75.2 |
| conference | 55.4 (52.3–58.5) | 40.5 (37.5–43.6) | 14.9 | 44.6 | 0.0 | 0.0 | 0.0 | 84.2 | 10 | 24,729 | 68.1 |
| risk | 44.3 (41.2–47.4) | 36.6 (33.7–39.6) | 7.7 | 53.1 | 2.6 | 0.0 | 0.0 | 69.3 | 10 | 21,531 | 73.1 |
| claink | 47.9 (44.8–51.0) | 36.6 (33.7–39.6) | 11.3 | 40.5 | 0.0 | 0.0 | 11.6 | 72.2 | 9 | 19,653 | 54.7 |

**Baseline, held-out seeds 5001–6000** (N = 1,000 runs per policy)

| Policy | Survive % (95% CI) | Club % (95% CI) | Missed | Fired | Meltdown | Ascension | Repo | Median attainment % | Median week of loss | Median cash $ | Warned % |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| novice | 0.2 (0.1–0.7) | 0.1 (0.0–0.6) | 0.1 | 99.2 | 0.6 | 0.0 | 0.0 | 0.0 | 7 | 4,579 | 95.9 |
| balanced | 31.9 (29.1–34.9) | 27.9 (25.2–30.8) | 4.0 | 68.1 | 0.0 | 0.0 | 0.0 | 42.4 | 7 | 13,795 | 79.2 |
| referral | 38.0 (35.0–41.0) | 34.0 (31.1–37.0) | 4.0 | 62.0 | 0.0 | 0.0 | 0.0 | 43.9 | 7 | 14,473 | 73.6 |
| caller | 18.4 (16.1–20.9) | 12.4 (10.5–14.6) | 6.0 | 81.6 | 0.0 | 0.0 | 0.0 | 36.0 | 7 | 12,127 | 91.3 |
| conference | 30.8 (28.0–33.7) | 23.7 (21.2–26.4) | 7.1 | 69.2 | 0.0 | 0.0 | 0.0 | 41.5 | 7 | 12,646 | 87.1 |
| risk | 26.9 (24.2–29.7) | 23.8 (21.3–26.5) | 3.1 | 71.7 | 1.4 | 0.0 | 0.0 | 33.3 | 7 | 11,501 | 83.4 |
| claink | 26.1 (23.5–28.9) | 21.8 (19.4–24.5) | 4.3 | 61.2 | 0.0 | 0.0 | 12.7 | 34.4 | 7 | 8,703 | 71.5 |

**Final, held-out seeds 5001–6000** (N = 1,000 runs per policy)

| Policy | Survive % (95% CI) | Club % (95% CI) | Missed | Fired | Meltdown | Ascension | Repo | Median attainment % | Median week of loss | Median cash $ | Warned % |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| novice | 0.6 (0.3–1.3) | 0.1 (0.0–0.6) | 0.5 | 97.3 | 2.1 | 0.0 | 0.0 | 0.0 | 9 | 5,988 | 97.3 |
| balanced | 53.1 (50.0–56.2) | 41.8 (38.8–44.9) | 11.3 | 46.9 | 0.0 | 0.0 | 0.0 | 83.2 | 10 | 25,296 | 67.9 |
| referral | 57.9 (54.8–60.9) | 49.5 (46.4–52.6) | 8.4 | 42.1 | 0.0 | 0.0 | 0.0 | 97.9 | 10 | 28,156 | 63.7 |
| caller | 42.0 (39.0–45.1) | 28.3 (25.6–31.2) | 13.7 | 58.0 | 0.0 | 0.0 | 0.0 | 62.5 | 10 | 20,561 | 75.7 |
| conference | 52.8 (49.7–55.9) | 38.3 (35.3–41.4) | 14.5 | 47.2 | 0.0 | 0.0 | 0.0 | 80.2 | 10 | 23,571 | 69.4 |
| risk | 46.0 (42.9–49.1) | 36.8 (33.9–39.8) | 9.2 | 50.5 | 3.5 | 0.0 | 0.0 | 71.1 | 10 | 22,716 | 73.0 |
| claink | 45.0 (41.9–48.1) | 33.3 (30.4–36.3) | 11.7 | 43.1 | 0.0 | 0.0 | 11.9 | 69.5 | 9 | 18,262 | 56.0 |

**Probes, baseline, seeds 1–1000** (N = 1,000 runs per policy)

| Policy | Survive % (95% CI) | Club % (95% CI) | Missed | Fired | Meltdown | Ascension | Repo | Median attainment % | Median week of loss | Median cash $ | Warned % |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| expert | 37.9 (34.9–40.9) | 32.8 (30.0–35.8) | 5.1 | 62.1 | 0.0 | 0.0 | 0.0 | 47.4 | 7 | 14,866 | 78.7 |
| steady | 18.1 (15.8–20.6) | 12.1 (10.2–14.3) | 6.0 | 81.9 | 0.0 | 0.0 | 0.0 | 31.9 | 10 | 13,273 | 0.0 |
| claink-weekly | 10.6 (8.8–12.7) | 8.2 (6.7–10.1) | 2.4 | 33.4 | 0.0 | 0.0 | 56.0 | 9.7 | 4 | -1,569 | 39.3 |
| claink-budget | 32.9 (30.1–35.9) | 27.6 (24.9–30.5) | 5.3 | 67.1 | 0.0 | 0.0 | 0.0 | 41.3 | 7 | 12,523 | 79.3 |
| idle | 0.0 (0.0–0.4) | 0.0 (0.0–0.4) | 0.0 | 100.0 | 0.0 | 0.0 | 0.0 | 0.0 | 6 | 4,000 | 97.0 |
| spam-prospect | 0.0 (0.0–0.4) | 0.0 (0.0–0.4) | 0.0 | 100.0 | 0.0 | 0.0 | 0.0 | 0.0 | 6 | 4,000 | 96.7 |
| spam-network | 0.0 (0.0–0.4) | 0.0 (0.0–0.4) | 0.0 | 100.0 | 0.0 | 0.0 | 0.0 | 0.0 | 6 | 4,000 | 96.8 |
| spam-cadence | 0.0 (0.0–0.4) | 0.0 (0.0–0.4) | 0.0 | 100.0 | 0.0 | 0.0 | 0.0 | 0.0 | 6 | 4,000 | 95.8 |
| spam-politics | 0.0 (0.0–0.4) | 0.0 (0.0–0.4) | 0.0 | 100.0 | 0.0 | 0.0 | 0.0 | 0.0 | 6 | 4,000 | 97.0 |
| mgr-farm | 2.0 (1.3–3.1) | 0.9 (0.5–1.7) | 1.1 | 98.0 | 0.0 | 0.0 | 0.0 | 10.7 | 9 | 8,394 | 0.0 |
| hail-only | 1.7 (1.1–2.7) | 1.3 (0.8–2.2) | 0.4 | 98.3 | 0.0 | 0.0 | 0.0 | 14.0 | 6 | 7,467 | 96.0 |
| emailer | 3.3 (2.4–4.6) | 2.7 (1.9–3.9) | 0.6 | 96.7 | 0.0 | 0.0 | 0.0 | 16.3 | 7 | 7,888 | 97.4 |
| ascend | 0.0 (0.0–0.4) | 0.0 (0.0–0.4) | 0.0 | 0.0 | 0.0 | 100.0 | 0.0 | 0.0 | 1 | 1,176 | 0.0 |
| burn | 0.0 (0.0–0.4) | 0.0 (0.0–0.4) | 0.0 | 0.0 | 35.6 | 64.4 | 0.0 | 0.0 | 2 | 582 | 0.0 |
| broke | 0.0 (0.0–0.4) | 0.0 (0.0–0.4) | 0.0 | 0.0 | 0.0 | 18.5 | 81.5 | 0.0 | 1 | -1,506 | 0.0 |

**Probes, final, seeds 1–1000** (N = 1,000 runs per policy)

| Policy | Survive % (95% CI) | Club % (95% CI) | Missed | Fired | Meltdown | Ascension | Repo | Median attainment % | Median week of loss | Median cash $ | Warned % |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| expert | 58.9 (55.8–61.9) | 47.3 (44.2–50.4) | 11.6 | 41.1 | 0.0 | 0.0 | 0.0 | 95.8 | 10 | 27,749 | 62.2 |
| steady | 25.0 (22.4–27.8) | 16.0 (13.9–18.4) | 9.0 | 75.0 | 0.0 | 0.0 | 0.0 | 42.7 | 12 | 17,036 | 0.0 |
| claink-weekly | 20.6 (18.2–23.2) | 16.5 (14.3–18.9) | 4.1 | 23.0 | 0.0 | 0.0 | 56.4 | 14.4 | 3 | -1,558 | 30.5 |
| claink-budget | 53.8 (50.7–56.9) | 42.3 (39.3–45.4) | 11.5 | 46.2 | 0.0 | 0.0 | 0.0 | 85.1 | 10 | 24,007 | 62.4 |
| idle | 0.0 (0.0–0.4) | 0.0 (0.0–0.4) | 0.0 | 100.0 | 0.0 | 0.0 | 0.0 | 0.0 | 10 | 6,400 | 98.3 |
| spam-prospect | 0.0 (0.0–0.4) | 0.0 (0.0–0.4) | 0.0 | 100.0 | 0.0 | 0.0 | 0.0 | 0.0 | 9 | 6,000 | 98.1 |
| spam-network | 0.0 (0.0–0.4) | 0.0 (0.0–0.4) | 0.0 | 100.0 | 0.0 | 0.0 | 0.0 | 0.0 | 10 | 6,400 | 98.2 |
| spam-cadence | 0.0 (0.0–0.4) | 0.0 (0.0–0.4) | 0.0 | 100.0 | 0.0 | 0.0 | 0.0 | 0.0 | 9.5 | 6,200 | 98.5 |
| spam-politics | 0.0 (0.0–0.4) | 0.0 (0.0–0.4) | 0.0 | 100.0 | 0.0 | 0.0 | 0.0 | 0.0 | 9 | 6,000 | 98.1 |
| mgr-farm | 4.1 (3.0–5.5) | 1.5 (0.9–2.5) | 2.6 | 95.9 | 0.0 | 0.0 | 0.0 | 13.4 | 11 | 10,252 | 0.0 |
| hail-only | 7.4 (5.9–9.2) | 3.7 (2.7–5.1) | 3.7 | 92.6 | 0.0 | 0.0 | 0.0 | 23.2 | 10 | 11,295 | 95.8 |
| emailer | 9.3 (7.7–11.3) | 4.2 (3.1–5.6) | 5.1 | 90.7 | 0.0 | 0.0 | 0.0 | 29.8 | 9 | 12,297 | 95.0 |
| ascend | 0.0 (0.0–0.4) | 0.0 (0.0–0.4) | 0.0 | 0.0 | 0.0 | 100.0 | 0.0 | 0.0 | 1 | 1,176 | 0.0 |
| burn | 0.0 (0.0–0.4) | 0.0 (0.0–0.4) | 0.0 | 0.0 | 39.3 | 60.7 | 0.0 | 0.0 | 2 | 582 | 0.0 |
| broke | 0.0 (0.0–0.4) | 0.0 (0.0–0.4) | 0.0 | 0.0 | 0.0 | 17.7 | 82.3 | 0.0 | 1 | -1,506 | 0.0 |

**Candidates, one lever at a time** (seeds 1–1000, N = 1,000 per policy; survive % / Club %)

| Candidate | Settings | novice | balanced | referral | caller | conference | risk | claink | expert |
|---|---|---|---|---|---|---|---|---|---|
| baseline | frozen 2.0.1 rules | 0.0 / 0.0 | 34.0 / 28.5 | 38.9 / 35.3 | 18.5 / 11.9 | 29.9 / 23.9 | 28.7 / 25.6 | 26.1 / 21.8 | 37.9 / 32.8 |
| C0 | 2.1 integrity fixes only (2.0.1 balance settings) | 0.2 / 0.2 | 34.3 / 31.1 | 40.4 / 36.2 | 17.0 / 12.8 | 30.5 / 23.9 | 26.3 / 23.2 | 27.2 / 23.3 | 38.2 / 34.6 |
| C1 | C0 + pace curve | 0.4 / 0.2 | 49.6 / 38.1 | 53.7 / 46.3 | 34.6 / 22.4 | 49.2 / 35.4 | 35.3 / 28.0 | 40.4 / 30.9 | 51.6 / 41.8 |
| C2a | C1 + pipeline relief | 0.6 / 0.2 | 51.0 / 39.0 | 54.7 / 47.3 | 35.1 / 22.6 | 50.8 / 36.2 | 36.8 / 28.8 | 41.8 / 31.6 | 52.8 / 42.5 |
| C2b | C1 + weekly firing caps | 0.8 / 0.3 | 51.3 / 39.2 | 56.5 / 48.2 | 36.1 / 22.9 | 52.9 / 37.6 | 40.4 / 31.1 | 42.2 / 31.8 | 55.2 / 44.1 |
| C2 | C1 + relief + caps | 0.9 / 0.3 | 51.7 / 39.4 | 56.9 / 48.6 | 36.5 / 23.0 | 53.3 / 37.7 | 40.8 / 31.3 | 42.8 / 32.1 | 55.7 / 44.4 |
| C3 | C2 + manager follows the curve (±2 a week) — adopted | 1.2 / 0.4 | 55.1 / 42.8 | 58.7 / 51.1 | 40.6 / 25.9 | 55.4 / 40.5 | 44.3 / 36.6 | 47.9 / 36.6 | 58.9 / 47.3 |

### What the numbers say

- **Pace curve** is the largest single lever: balanced survival 34% → 50%. Relief and caps add about 2 points
  together; the manager following the curve adds about 3.5.
- **Held-out validation** agrees with the tuning seeds: balanced 31.9% → 53.1% survival, 27.9% → 41.8% Club.
- **Against the goals** ("competent balanced heuristic ~60–80% survival, ~20–45% Club"): Club is inside the range
  (42.8%). **Survival is below it (55.1%, CI 52.0–58.2).** A lab run with mid-quarter firing switched off entirely
  put the same bot at 65.8% (400 seeds): the rest of its losses are the under-70% rule at the QBR, which the brief
  keeps. A softer variant of the brief's numbers gained about 1 point, so the brief's own calibration was shipped
  unchanged. The remaining gap is reported, not forced.
- **Novice materially lower** (1.2%); **reckless materially riskier** (risk 44.3% vs 55.1%, with meltdowns);
  **an exceptional strategy can beat baseline** (expert 58.9% / 47.3% Club).
- **Referrals are not dominant.** Referral-only leads balanced by 3.6 points of survival (overlapping intervals)
  and equals the expert bot; a pure referral spammer survives 0%. No referral lever was applied.
- **CRM is no longer mandatory.** Under 2.0.1 pacing the planner needed weekly CRM cleanups; under 2.1 the expert
  bot (no CRM at all) does better than balanced, which the brief asked to be checked as a symptom of the curve.
- **The Hail Mary is not a dominant close.** Only the risk bot leans on it and it does worse; "Hail Mary only"
  survives 2.6%.
- **Where runs end**: median week of loss moved from 7 to 10. Mid-quarter review firings fell (balanced 630 → 373
  per 1,000) while QBR firings rose (12 → 67): more runs now reach the QBR and some fail there.
- **Warnings** are seen by fewer runs before any firing (balanced 78.9% → 61.7%); the later rungs are reached more
  often because runs last longer (recurring warning 25.9% → 35.8%).
- **Friday events** (balanced, per Friday): total 1.12 → 1.13. Early-listed events fell and late-listed rose, as
  predicted: marketing .226 → .195, seFumble .124 → .108, competitor (either answer) .163 → .136; caseStudy
  .075 → .089, meme .066 → .085, freeze .068 → .082, crud .062 → .078.
- **clAInk** (the careful bot): bought in every run, 2.5 runs per quarter, 0.5 genuine closes, median billed
  $2,936 (was $2,956), median delivered $0, seat revoked 5.8% (7.3%), repossessed by a clAInk bill 11.6% (13.7%).
  Weekly use is still ruinous (56% repossessed), as intended.

Raw counts, action mix, lead sources, warning incidence by cause, event frequencies and clAInk totals for every
policy and candidate are in `qa/2.1/balance/*.json`; the printed tables are in `qa/2.1/balance/tables/`.

---

## 3. Tests

### Final gate run (`npm run verify:release`, 26/26)

| Gate | What it holds | Result |
|---|---|---|
| build, build-test | the release build (no test hook) and the test build | ok |
| lint-rng | `Math.random` only in the cosmetic stream; test hooks only behind the build flag | 0 offenders in 86 files |
| lint-copy | house style, PA lines ≤ 12 words, log lines ≤ 100 characters (≤ 150 for named lines), captions ≤ 61 | 0 violations |
| lint-css | design tokens only (clAInk's stylesheet excepted) | 0 findings |
| copy-check | every log tag has words, every word has a tag, no prose in the rules | ok |
| copy-render | every log line, every variant, every week band | 15,360 renderings, 0 bad, 202 distinct sentences, 96 tags |
| copy-deck | the copydeck row by row (§6) | 359 applied, 21 noted, 0 open |
| fonts, notices | bundled fonts and third-party notices are current | ok |
| engine | `node --test test/engine` | 113 tests, 12 files |
| audio | behavioural sound tests against a fake speaker | 15 tests |
| sim-smoke | bots finish every run legally on both engines; invariants | 11 checks |
| scenes | every frame of every scene's picture against v1.21 | 24 cases, 1,718 frames identical |
| fixtures | 25 generated save fixtures are what the baseline writes | ok |
| saves | every fixture, both ways in (page load and the Load button) | 37 fixtures, 73 loads, 1,442 moves compared |
| release | no hooks in the shipped bundle; a planted hook is inert; page = source | 14 checks; 6 sessions, 900 presses |
| offline | `file://`, no requests, plays to the end | 44 checks |
| firstday | onboarding memo and tour | 26 checks |
| confirm | the four confirmations and caption clean-up, by real presses | 37 checks |
| resilience | reloads, damaged saves, simultaneous choice + acknowledgement, storage denied | 80 checks |
| phone | touch screens 320–390 wide and sideways | 49 checks |
| keyboard | keyboard-only passes, tab order, Escape, focus | 8 stages, 98 key presses, 0 findings |
| layout | one screen, nothing covered or clipped, 7 states × 7 desktop sizes + phone | 328 checks |
| matrix | the brief's eight sizes × twelve states, reduced motion (§4) | 988 checks |
| released | the committed release file is exactly what the source builds | ok |

### Brief §F, item by item

| §F | Covered by |
|---|---|
| 1 Engine | `test/engine`: actions and every blocked action (12), stage transitions, close arithmetic and the Hail Mary's branches (10), End Week order, salary, rent, aging, funnel bonus, coffee, CRM once a week, reviews, QBR boundaries, politics, six endings (23), every Friday event and both options of each choice (11). Branches are forced with scripted dice in Node; there is no cheat in the release. |
| 2 Effects | `effects.test.mjs`: simultaneous full-funnel, freeze, competitor and security effects; exact expiries; the ±30 cap; chips equal state. `events.test.mjs`: eligibility, caps, one choice. `choices.test.mjs`, `week.test.mjs`, `rng.test.mjs`: a finished run takes no further move. |
| 3 clAInk | `claink.test.mjs`: install, decline, dismiss, expiry, eligible and blocked runs, success, failure, the four incidents, first warning and later theft, idle and overage invoices, cancellation (affordable and not), third strike and true-up, repo priority, week 13 freeze, totals. Minimize / expand is UI: `keyboard`, `matrix`, `confirm`. |
| 4 Save | `save.test.mjs`, `saves`, `resilience` §1–§4: new and legacy saves (v1.14 to v2.0.1, manual and autosave), same-seed continuity through storage, mid-choice reload and Load, new run after an ending, storage denied, invalid JSON and invalid state, missing story or cause, no duplicated events or invoices, focus after recovery. |
| 5 Browser | Chromium only. Sizes, states and screenshots: §4. Console errors and network requests are asserted in `offline`, `matrix`, `confirm`. |
| 6 Editorial | §6, plus `copy-render` (no `undefined`, `NaN`, `[object Object]`, empty lines), `lint-copy` (lengths, long account names, negative money), `copy.test.mjs` (numbers quoted = rules; log budgets over real runs). |

### Other evidence

- **Mutation check** (`test/engine/tools/mutation-check.py`): 51 plausible mistakes planted in `src/game`, one at a
  time, including 14 in the 2.1 tuning and distinction code. The engine suite catches **48**. The 3 survivors
  change no behaviour (two independent statements swapped; a guard End Week never reaches; a guard whose factor is
  already zero). `qa/2.1/evidence/09-mutation-check.txt`.
- **Lint self-test** (`node test/lint-fixtures/selftest.mjs`): 20/20; every lint rule fires on its planted fixture.
- **The matrix and the offline test were also run on `Tech_Sales_Trail_2.1.html` itself**
  (`qa/2.1/evidence/11-release-file-matrix-offline.txt`): 988/988 and 44/44.
- **Endings reached by play in the browser, in the release build**: President's Club, barely missed, fired (review
  and QBR) and repossessed (by a clAInk bill) in the release test's six scripted sessions; ascension by a real click
  on a certain-death quad shot (`confirm`); meltdown by a real click at 99 stress
  (`qa/2.1/evidence/13-meltdown-by-play.txt`). All six are also loaded from saved runs at every size in the matrix,
  and every way into each ending is forced in the engine tests.
- Milestone gate logs: `qa/2.1/evidence/00`–`08`.

### What failed along the way (all fixed; listed so the record is complete)

- A new facts test caught a real defect introduced during this work: a harmful clAInk strike recorded its dice
  roll where the incident kind belonged. Fixed, with a test.
- After the copy rewrite: the scene gate (captions rewritten, as intended: it now compares pictures), one first-day
  check and two phone checks that asserted old wording, and 49 layout findings (the new "Expected by Friday" line
  was clipped and pushed the dashboard 24 px past one screen at 1280×720). The card was widened and its spacing
  tightened until the layout gate passed with no known-failure entries.
- An audio test used a seed whose clAInk run ends in week 3; it now uses a seed with a full pilot.
- Earlier milestones: a 1-in-5 flake in two browser suites (a seeding guard that did not survive a reload) was
  found and fixed in M3.

---

## 4. Screens and screenshots

`test/e2e/matrix.cjs` opens the shipped file from `file://` with every network request refused, at:
**1440×900, 1024×768, 768×1024 (touch), 320×568, 375×667, 390×844 (phones), 667×375 (a phone on its side), and
1440×900 at 200% zoom** (emulated as 720×450 CSS pixels at device scale 2).

States: the main screen mid-quarter; clAInk's offer open and minimized; a Friday choice (the security incident);
a clAInk incident (the strike card in the workspace); the handbook; and the six endings with their cards.

Checked at every size and state (988 checks, all pass): no horizontal scroll; End Week, the Hail Mary and the first
and last action (or every dialog button) can be brought on screen and are not under anything, including clAInk's
window; clAInk's own controls are on screen and on top; minimized, the workspace leaves End Week clear; focus is
inside an open dialog; each ending's card arrives with a verdict and numbers and New run is pressable; no request
left the file; no console errors. With reduced motion (1440×900 and 390×844) each ending shows its description
instead of the animation and the card is there at once.

**Screenshots** (36, JPEG, taken from the release file): `qa/2.1/screenshots/<state>@<size>.jpg` for
`main`, `ad-open`, `ad-minimized`, `choice`, `incident`, `handbook`, `end-club`, `end-missed`, `end-fired`,
`end-repo`, `end-meltdown`, `end-ascension` at `1440x900`, `768x1024` and `390x844`. The other five sizes were
checked and photographed but not committed (`node test/e2e/matrix.cjs --shots <dir>` reproduces all 96).

**Qualitative review** (owner amendment 6; done by looking at the screenshots, in addition to the assertions):

- The dark two-column desk, the type, the icons and the one-screen fit at 1280×720 are as in 2.0.1. The fourth
  stat card is wider than the other three; it reads as the primary number and nothing else moved.
- The boot CRT and all six ASCII endings are the 2.0.1 pictures (1,718 frames compared). New captions fit the
  caption band; the verdict and distinctions sit on the card below the scene, not in it.
- clAInk is still the only glossy thing on the screen: purple gradient, pill buttons, enthusiastic type. Its new
  copy stays inside its own window; the rest of Shitcorp does not speak that way. The dismissal question is styled
  as part of the ad.
- The dialog marks are small outline icons in the house style (a price tag, a shield, a clipboard), not
  illustrations; they do not compete with the title.
- On phones the offer and the strike card are readable without zooming and never cover End Week; the chapter name
  is hidden there.
- Seen and left alone: saved fixtures show 2.0.1 wording in the log lines and strike cards they were saved with.
  That is correct: old text is kept as written, never re-rendered under new rules.

---

## 5. Save migration

- **Format**: one envelope `{ app, schemaVersion: 5, build, savedAt, state, pendingEvents, rngState }` under
  `tst-save-v5` (manual) and `tst-autosave-v5` (autosave). The two slots are independent.
- **Legacy**: `tst-save-v4-3`, `tst-save-v4-2`, `tst-autosave-v4-3`, `tst-autosave-v4-2` and 2.0's pending-choice
  key are **read and never written or removed**, so the 2.0.1 page on the same origin keeps its run.
- **Reading**: parse → is it a run at all → rebuild field by field against a whitelist (numbers in range, unique
  deal ids, pipeline recomputed, at most one ending, known choices and achievements only, short plain text) →
  check the result. Old `modifiers` become one dated legacy effect that lasts as long as its timer had left; a
  held 2.0 choice is honoured once; a save without dice gets new ones; a save without a story says nothing it
  cannot vouch for.
- **Newer schema**: left unread and untouched; the dialog says it was saved by a newer version.
- **Damage**: never played, never overwritten. The recovery dialog offers a new run and each other stored run that
  does open; the bad one is copied to `tst-set-aside-v5` first; autosave waits while the dialog is open. A damaged
  manual Load leaves the current run as it is. A browser that refuses storage stays playable and says so once.
- **Tested**: all 38 legacy fixtures (v1.14 to v2.0.1) decode to what the 2.0.1 rules read from them, field for
  field (`save.test.mjs`); 37 open in the browser both ways in, 73 loads (`saves`; the 38th, corrupt JSON, is the
  recovery dialog's case in `resilience` §4); a run that goes through storage every other move plays exactly as
  one that never did.
- **Not possible**: 2.0.1 opening a 2.1 save.

---

## 6. Copydeck coverage

`scripts/copy-coverage.mjs` reads the copydeck row by row, cuts each approved text into sentences and looks for
each sentence among every string the copy modules can render (1,927 strings; placeholders match live values;
typography compared loosely). It proves the words are in the build. It does not prove every path that prints them
was played: `copy-render`, the engine tests and the browser tests cover the paths they cover, and no claim is made
that every generated combination was exercised.

| Deck section | Rows | Applied as written | Noted (with reason) | Open |
|---|---:|---:|---:|---:|
| 2. Opening and onboarding | 27 | 26 | 1 | 0 |
| 3. Dashboard surface and helper text | 37 | 32 | 5 | 0 |
| 4. EVERY activity event key — vv registry | 97 | 96 | 1 | 0 |
| 5. Variant library — add to vv via hv selector | 19 | 17 | 2 | 0 |
| 6. Quarter chapters and managerial context | 8 | 8 | 0 | 0 |
| 7. Modal decisions — av (option IDs unchanged) | 17 | 17 | 0 | 0 |
| 8. Shitcorp internal handbook — fv (rules must remain factual) | 18 | 15 | 3 | 0 |
| 9. Public address and audio — uo, nl, Xo | 38 | 37 | 1 | 0 |
| 10. clAInk editorial pack — complete surface mapping | 76 | 69 | 7 | 0 |
| 11. Endings — st, nv, rv, ht | 43 | 42 | 1 | 0 |
| **Total** | **380** | **359** | **21** | **0** |

Rows noted, with the reason on file:

| Row | Kind | Reason |
|---|---|---|
| 2:Zn.skip | instruction | The deck says to keep the existing Skip and Sound labels; they are unchanged. |
| 3:De.blocked | instruction | Blocked-action notices keep the exact slots and energy needed and held, once-a-week and quarter-over wording (HINT.blocked). |
| 3:Un.damaged | typeset | The recovery dialog says 'Start a new run or return to a valid saved run.' only when a valid saved run exists, and 'Start a new run.' when none does; 'if available' is resolved by the dialog instead of printed. |
| 3:Conference | instruction | Conference hint shows the action's real slots, energy, cash and stress, and the real chance and duration of the signing-odds bonus (HINT.conference, from rules.js). |
| 3:Recharge | instruction | Recharge hint shows the real energy and relief ranges, once a week, coffee reducing relief and the trip (HINT.recharge); no cash is implied. |
| 3:Hail Mary | instruction | The approved sentences are rendered (HINT.hail); the rest of the row is direction: cost is on the button, the no-eligible state has its own line, and the numbers come from rules.js. |
| 4:week.next | instruction | A pointer to the chapter table in section 6, which is applied (CHAPTER_LINE). |
| 5:act.prospect | conditional | The count is of leads found, not conversations held, so the deck's own alternative is used: 'You found {n} potential customers. Management will call this momentum.' |
| 5:act.discovery | conditional | The game does not track identified needs, so the deck's own alternative is used: 'No deals qualified.' |
| 8:Quad shot | typeset | 'Use live tooltip for odds' is direction to the player's eye; the handbook says 'The button shows the odds as they stand.' and the Quad shot hint carries the live risk. |
| 8:clAInk | instruction | The approved sentences are rendered from the live configuration; the last sentence of the row is direction. |
| 8:Keys | instruction | The Keys section lists the hotkeys the source actually binds (unchanged from 2.0.1), shown only where there is a keyboard. |
| 9:uo | instruction | Table header. |
| 10:vn | instruction | Strike counters keep their exact counts, thresholds, projected cash range and Collections warning; 'a deal walks' became 'a live deal may walk'. |
| 10:Xn.tokens | instruction | Token count and skip guidance kept as they were. |
| 10:Tr.statsRevoked/statsCancelled | instruction | End-card totals kept; the pipeline figure is now labelled 'Claimed influence'. |
| 10:ue.usageRan | typeset | Rendered in three parts so the amount can be set in bold: 'Estimated this week: ' + amount + ' (N tokens), billed Friday; overages possible. Charged back so far ...'. |
| 10:ue | instruction | Control labels (Expand, Minimize, Close, Cancel seat) kept plain. |
| 10:Optional tiny marketing footnote: “Activity gene | skipped | Optional marketing footnote: left out so the ad does not grow (the deck allows it only if it adds no obstruction). |
| 10:Fs.influenced | typeset | '{n-3} more outcome(s), also billed' is rendered with a real plural: '1 more outcome, also billed' / '2 more outcomes, also billed'. |
| 11:ascension | typeset | Both approved forms are implemented: 'Shot #N.' when the fatal shot was not the first, 'One shot too many.' otherwise. |

Not in the table because the deck marks them optional and they were not built: the manager's context cues (§6),
the alternate posters and decorative art microcopy (§12).

Budgets (owner amendment 5): activity-log lines ≤ 100 characters, ≤ 150 for the lines `src/copy/log.js` names;
announcer lines ≤ 12 words. Enforced by `lint-copy` on every rendering and re-checked over the logs of 90 real
simulated runs (`copy.test.mjs`).

---

## 7. Size and load

| | 2.0.1 `index.html` | 2.1 `Tech_Sales_Trail_2.1.html` |
|---|---:|---:|
| Bytes | 518,108 | 556,515 (+7.4%) |
| gzip -9 | 201,456 | 214,807 |
| DOM nodes on the desk | 628 | 665 |
| JS heap after load | 10 MB | 10 MB |
| Open → desk interactive, headless Chromium, `file://`, median of 7 | 247 ms (193–295) | 256 ms (211–309) |

One file, no network, no new dependency. The simulation harness plays about 107 whole quarters a second on this
machine. No deeper profiling was done. (`qa/2.1/evidence/12-size-and-load.txt`)

---

## 8. Deviations and judgment calls

1. **v1.21 parity retired by design** after its last green run at checkpoint P, replaced by engine tests, golden
   replays, the integrity diff, behavioural audio tests and a page-equals-source check on the release bundle.
2. **Scene captions**: the scene gate now compares pictures only. The boot screen's last line ("Welcome to the
   office.") is accepted as a typed row; everything else in the art is frame-identical to v1.21.
3. **Balance**: the brief's full package was adopted with its own numbers; no further tuning; no referral lever.
   Survival for the balanced bot is below the goal (§2).
4. **"Since 1998"** in the memo is kept as the deck approves it, although the brief asks to avoid years.
5. **Announcer "whale" line** moved to whale referrals: its old trigger could never speak, and the new wording
   describes a lead.
6. **Two log rows retired**: `act.hail.none` and `act.recharge.already` cannot occur any more (the rules refuse the
   move). Their approved text is used in the hints for those blocked states.
7. **Truth over the joke**: `evt.champion` has a second wording for a deal that cannot move up; the churn strike
   says "A customer" (the game keeps no list of who signed); "Deals signed (incl. reversed)" appears when signed
   revenue was later clawed back; the lost-deals story card says "documented deals".
8. **Legacy saves**: an old bonus with no time left on it is honoured for the current week only.
9. **Acknowledgements** from your manager open when clAInk's report finishes or on your next move, not over it.
10. **Confirmations**: the deck approves the questions; the button labels ("Start over" / "Keep playing", "Throw
    it" / "Not yet", "Drink it anyway" / "Put it down", "Dismiss" / "Keep") are plain functional labels of mine.
    The Hail Mary asks on the first throw of a run only; the quad shot only when the shot is certain to end the run.
11. **Fired, reason on file**: the deck offers an optional cause line without text; four short factual lines were
    written (review, below threshold, politics, organizational announcement).
12. **Dashboard**: the fourth stat card is 1.75× the others and card spacing went from 6 to 4 px, so that the new
    "Expected by Friday" line fits on one screen at 1280×720.
13. **Dialog marks** reuse the game's existing icon set (Lucide) instead of new drawings; the strike card gets a
    stamp icon. No new art asset.
14. **Policy bots were rewritten once** (§2) before the reported runs.
15. **Copydeck**: 21 rows are not rendered word for word; each has its reason in the table in §6.
16. **Reviews by independent agents** planned for the checkpoint diff, the copy audit and the final diff were not
    run: the orchestration tool's approval could not be obtained in this session. The mutation check, the
    integrity diff, the copy-coverage gate and the facts tests were built to cover that ground mechanically. They
    are not a substitute for a second reader.
17. **README** still describes the deployed 2.0.1 game, with a section on the 2.1 candidate; it should be revised
    when 2.1 is promoted.

---

## 9. Not run, known limits, remaining risks

**Not run**
- Firefox (not installed). Safari and real phones (sizes and touch were emulated in Chromium).
- Human playtests. A screen reader pass by a person (roles, labels, live regions and focus are asserted by tests).
- Real speech: tests use a fake speaker; device voices were not heard.
- 200% zoom was emulated by viewport and device scale, not by browser zoom.
- Performance beyond the load measurement in §7.

**Limits of the tests**
- Balance bots are heuristics; survival targets are goals for people.
- The harness answers "yes" to confirmations inside one press so that a harness move stays one rules move; the
  "no" paths are covered only by `confirm.cjs`.
- Copy coverage proves strings exist, not that every path was played.
- Three mutants survive (behaviour-neutral).

**Risks for the owner to weigh**
- **Survival at 55% for the balanced bot** may still feel harsh, or the softer mid-quarter may feel too safe to
  people; only playtests can say. All balance knobs are in one table (`TUNING_DEFAULTS`, `src/game/rules.js`).
- **Manager drift** now rewards being ahead of the curve early (at most +2 a week). The "favors" event did not
  become more frequent in simulation (0.001 per Friday before and after), but approval-heavy human play was not
  observed.
- **Event mix shifted** slightly toward late-listed events (§2) as a consequence of fair ordering.
- **Promotion**: copying the release file over `index.html` makes 2.1 the public game; players' 2.0.1 runs then
  open in 2.1 and are saved onward in the 2.1 format.

**Decisions left open**
1. Promote 2.1 to `index.html` (and when).
2. Whether to tune further toward 60–80% survival after human play, and with which lever.
3. Whether to build the optional items (manager context cues, posters, marketing footnote).
4. A Firefox / Safari / device pass before public release.

---

## 10. How to reproduce

```bash
npm ci
```

```bash
npm run verify:release
```

```bash
node test/sim/run.mjs --engine baseline --policies all --seeds 1000 --from 1
```

```bash
node test/sim/run.mjs --policies all --seeds 1000 --from 1
```

```bash
node test/sim/run.mjs --policies all --seeds 1000 --from 5001
```

```bash
node test/engine/tools/integrity-diff.mjs
```

```bash
python3 test/engine/tools/mutation-check.py
```

```bash
node scripts/copy-coverage.mjs --verbose
```

```bash
node test/e2e/matrix.cjs Tech_Sales_Trail_2.1.html --shots qa/2.1/screenshots --keep 1440x900,768x1024,390x844 --jpeg
```

Candidates are run with `--tuning '<json>'` over the shipped defaults, or `--tuning v201` for the 2.0.1 balance
settings on the 2.1 rules; the settings in force are recorded in each result file.
