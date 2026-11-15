# Tech Sales Trail 2.1.1 — QA report

Report on "Operation Gold Master", the final polish pass on 2.1. Everything in it was run in this repository;
nothing is reported as passed without a log on file. Where something was not run, could not be run, or was looked
at and left alone, it says so. The report keeps four things apart, as the brief asks: what was **changed** (§1),
what was **checked and found sound** (§3), what is **still open** (§4) and what was **turned down** (§5).

| | |
|---|---|
| Status | **Release candidate. Not promoted.** `index.html` is still the 2.1 file ({{OLD_BYTES}} bytes, sha256 `{{OLD_SHA_SHORT}}`), held there by the `releases` gate. Promotion is the owner's call. |
| Release file | `Tech_Sales_Trail_2.1.1.html`, {{NEW_BYTES}} bytes, sha256 `{{NEW_SHA}}` |
| Earlier releases | 2.1, 2.0.1 and 1.21 are in the repository as they shipped, each checked against its recorded size and SHA-256 (`test/baseline/releases.json`) |
| Final gate run | `npm run verify:release`: **{{VERIFY_STEPS}} steps passed**, {{VERIFY_SECONDS}} s (`qa/2.1.1/evidence/01-verify-release.txt`) |
| Rules | The frozen 2.1 rules and this tree are the same run after every move: {{EQUIV_RUNS}} seeded quarters, {{EQUIV_MOVES}} moves, one decided correction (§2) |
| Balance | Frozen. 21 of 22 simulated strategies come out identical to 2.1, count for count, on both seed sets (§6) |
| Saves | Same format (schema 5). Runs played and saved by the 2.1 file open in 2.1.1 as the same run and play on |
| Browser | Chromium (Playwright 1.63). **Firefox and WebKit are not installed here: unverified.** No real phone, tablet or laptop was used. |
| People | **No human playtest was run on 2.1.1.** Simulations are heuristics, not people. |

## 1. Implemented changes

Source diff against 2.1: {{SRC_FILES}} files under `src/`, +{{SRC_ADDED}} −{{SRC_REMOVED}} lines. No dependency was added, no
save field, no rule constant changed value. Each row names the test that now holds it.

### Action clarity and feedback (brief §1)

| # | Change | Where | Held by |
|---|---|---|---|
| 1 | With nothing to work on, a pipeline card says what the press would still buy: `skill only` (Discovery, Demo marathon, Close deals) or `no deals` (Proposals). The hints say the same, and say when the press would also count toward a full-funnel week. The count of eligible deals (already on the card in 2.1) gained a spoken label. | `src/ui/app/ActionGrid.jsx`, `src/copy/ui.js` (`CARD`, `HINT`) | `actions` gate §1–2 (8 boards, every card against the rules, every press compared before and after) |
| 2 | **The one rule correction**: Proposals with no demoed deal, in a week whose proposal-or-close work is already counted, is refused (§2). | `src/game/actions.js` (`proposeIdle`), `src/game/run.js` | engine `actions.test.mjs`; `equivalence` gate; `actions` gate; 4 mutants |
| 3 | A press that is certain to end the run is marked `Ends the run`, explained in the hint, and confirmed first: stress that would reach 100 (Prospect blitz, Internal politics, Conference run, Hail Mary) or a purchase that would take cash to the Collections line (Conference run, Quad shot). One point or one dollar short of certain, nothing is marked. | `src/game/selectors.js` (`fatalPress`, `purchaseBust`, `stressCost`), `src/ui/Game.jsx`, `src/copy/ui.js` (`CONFIRM`) | engine `actions.test.mjs`; `actions` gate §4 (yes ends the run as the rules say, no changes nothing) |
| 4 | A Friday whose rent would trigger Collections is said on the cash card and in End week's hint, with the figures. | `selectors.js` (`fridayPreview`), `Kpis.jsx`, `ui.js` | `actions` gate §4 |
| 5 | Hints state what they omitted: the Hail Mary's energy, Prospect blitz's stress, that Recharge and Quad shot take a slot; CRM cleanup gives the dollar value of the "dead leads" it would remove (a lead or qualified deal is dead when it is skeptical or five weeks old, whatever its size: a count of 2 could be $180,000). "a 85% chance" is "an 85% chance". | `src/copy/ui.js`, `selectors.js` (`crmPreview`) | engine `copy.test.mjs`, `actions.test.mjs`; `actions` gate §5 |
| 6 | The line under the actions no longer names work there is no energy for; a number key on an action that is off moves focus to its card, which says why. | `src/ui/app/Foot.jsx` (`idleHint`), `Game.jsx` | `actions` gate §3 |
| 7 | The hint bar reads its words from the run as it is. In 2.1 it kept the words from when the pointer arrived: after a press it described the board from before the press (after three quad shots it still described shot 1). | `Foot.jsx` (`hintWords`), `ActionGrid.jsx` | `actions` gate §6 |
| 8 | The handbook names what counts toward a full-funnel week (a conference does not) and states the stale-lead and demo-backlog rules, which were in the README but not in the game. | `src/copy/help.js`; thresholds moved to `src/game/rules.js` as named constants, same values | engine `copy.test.mjs` (handbook written from the rules) |

### Dashboard (brief §2)

| # | Change | Where | Held by |
|---|---|---|---|
| 9 | **Short desktop windows.** From 620 to about 750px of window height the week's card was taller than the window, and that layout does not scroll: at 1280×720 End week and the Hail Mary hung 9px through the card's border, at 1366×700 End week was cut off, at 1366×657 it was entirely off the screen. The card's gaps, padding and action rows now ease down in proportion (fluid `clamp()` on the window height; no new media query). At 746px and above nothing moves. | `src/styles/app.css` (desktop tier) | `layout` gate, which now also measures 1366×657 and 1280×620: 2.1 fails there in 60 places (`qa/2.1.1/evidence/05-layout-short-windows.txt`) |
| 10 | The hint bar is two lines tall whatever it says. A two-line hint (more than a third of them at 1280 wide) sat 1px from the bar's borders; now 5px, and nothing under the bar moves when the hint changes. | `app.css` | `actions` gate §8 (no hint taller than the bar at 1025×768 and 1366×657, 180 hints) |
| 11 | Stat cards: the unfilled part of a meter is visible (it was 1.08:1 against the card; now the tone the past weeks' ticks use); the quota meter is green from 100%; the cash card's second line is level with its neighbours. | `app.css`, `Kpis.jsx` | `actions` gate §7 (quota meter at $160,000 and $159,999); pictures 07, 08 |
| 12 | End week and the Hail Mary have a pressed state; the PIP chip is first in its row, so it is not the one folded into `+N`; a minus sign stays with its amount and a range stays in one piece (`−$1,500`, `$140–$280`). | `app.css`, `Foot.jsx`, `ui.js` (`usd`, `to`) | `lint-copy`; pictures 13 |

### Game feel (brief §3)

| # | Change | Where | Held by |
|---|---|---|---|
| 13 | A signing's log line is toned good (green icon), as a loss is toned bad. The style existed and nothing used it. | `src/ui/app/logLook.js` (`toneFor`) | engine `copy.test.mjs` (whole seeded runs: every signing and nothing else) |
| 14 | The announcer's large-sale line starts at $40,000 (was $45,000). CRM cleanup has an announcer line on every use; a $40,000 signing had none. | `src/engine/audio/tagmap.js` (`BIG_CLOSE`) | `audio` tests ($40,000 announced, $39,999 not) |
| 15 | **Reduced motion:** the change chips on the stat cards were in the page at opacity 0 for their whole 1.7 s (their animation ends on nothing and was cut to nothing). They are shown still. | `app.css` | `actions` gate §7, with and without reduced motion |
| 16 | A deal that moves up a stage fades its next pip in (0.24 s). | `app.css` | looked at |
| 17 | On a phone the bottom notice no longer raises a clAInk run's lines while the workspace that is reporting them, beat by beat, is on the screen (it announced the strike about two seconds before the strike card landed, and covered it). | `src/ui/app/LogPeek.jsx` | `phone` gate still passes; looked at |

### clAInk (brief §4)

| # | Change | Where | Held by |
|---|---|---|---|
| 18 | The policy step, which is what the player accepts, states the recurring obligations in the rules' own numbers: $249 a week plus $140–$280 per outcome in a week with a run, $150–$300 for an idle week, overages of $200–$600, a true-up that takes your cash and $200–$1,800 more, $250 plus usage due to cancel early. In 2.1 only the $500 seat price was stated before purchase. The step still fits its corner at every gated size. | `src/copy/clainkUi.js` (`CK_AD.policy`), `src/ui/ClainkUi.jsx` | `layout` gate (`dock-whole` at 9 sizes); pictures 09 |

### Proofreading (brief §5)

| # | Change | Where | Held by |
|---|---|---|---|
| 19 | After a clAInk run that worked, the manager's dialog opens "Nice week. ChatGDP do that?" and the announcer said and captioned his other opening, "Always on ChatGDP, huh?" (27 of 93 first warnings in the audit's 1,320 quarters). The voice says the one the dialog shows. | `src/copy/pa.js`, `src/engine/audio/voice.js`, `director.js`, `Game.jsx` | `audio` tests (both openings) |
| 20 | "Referrals: 1 introduction. One of them is a whale." is "It is a whale." (about 30% of such lines had one introduction). "1 of your largest deal" is "1 of your largest deals". | `src/copy/log.js` | engine `copy.test.mjs` |
| 21 | A routine line is still never the same twice running, but the wording taken instead is chosen among all the others. 2.1 took the next in the list, so the first alternative came back every other time (payroll's HR joke: 36.6% of Fridays against 21.7% for the other alternative). | `src/copy/engine.js` (`render`) | engine `copy.test.mjs` (the two alternatives within 25% of each other over 3,000 lines) |
| 22 | The chips under a log line are each kept whole when the row wraps, and a second row stays on the right. The stored text is unchanged, to the character. | `Activity.jsx`, `app.css` | `actions` gate §7 |

### Distribution (brief §9)

| # | Change | Where | Held by |
|---|---|---|---|
| 23 | The studio's statement is in the handbook (footer on desktop, last line of the body on narrow screens) and in the README, word for word. | `src/copy/help.js` (`HELP_ABOUT`), `Game.jsx`, `dialogs.css`, `README.md` | `qa/2.1.1/evidence/07-release-file-hygiene.txt` |

### Tests and plumbing

- **`releases` gate** (`scripts/check-releases.mjs`, `test/baseline/releases.json`): 2.1, 2.0.1 and 1.21 are the files
  that shipped, and `index.html` is the promoted one. A build cannot overwrite a kept release by accident.
- **`equivalence` gate** (`test/engine/tools/equivalence.mjs`, `test/baseline/v2.1-engine`): §2 and §6.
- **`actions` gate** (`test/e2e/actions.cjs`): {{ACTIONS_CHECKS}} checks by real presses on the release build. Run against
  the 2.1 file it fails {{ACTIONS_ON_21}} checks and then stops at the first run-ending press, where 2.1 shows no
  confirmation (`qa/2.1.1/evidence/04-actions-gate-on-2.1.txt`).
- The layout gate measures nine desktop sizes (was seven). Engine tests: {{ENGINE_TESTS}} (was 113). The mutation list
  has six new mutants (58 in all).
- The release file is named from the version in `package.json` (`Tech_Sales_Trail_2.1.1.html`).

## 2. The one mechanical correction

**What.** `Proposals`, pressed with no demoed deal, in a week whose proposal-or-close work is already marked done
(by an earlier Proposals or by Close deals), is refused. The card is off and reads `No demoed deals`; the hint
says "No demoed deals, and this week's proposal or close is already counted. Nothing to gain."

**Why it is a defect and not a strategy.** In 2.1 that press cost a slot and 25 energy and returned nothing: no
deal can move, Proposals trains no skill, and the week's full-funnel mark was already set. It is the only action
in the game with a state like that. Discovery, Demo marathon and Close deals with nothing to work on still train
their skill, so they are left alone, as the brief requires; and Proposals with no demoed deal *earlier* in the
week still sets the full-funnel mark (worth +6 points of signing odds next week), so that press is left alone too.

**What was considered and rejected.** Refusing every Proposals press with no demoed deal. That would have removed
the full-funnel credit the empty press can still earn, which is a mechanical reward, and it changed the outcome of
two golden replays. It was implemented first, measured, and narrowed.

**Proof that nothing else moved.** `equivalence` plays the frozen 2.1 rules and this tree side by side, the bot
choosing only from what this tree allows, and requires the whole mechanical state to be equal after every move. At
every step where 2.1 offered a move this tree refuses, the move is made on the 2.1 run and what it changed there is
checked: one slot, 25 energy, a mark no rule then reads differently, its log line, and nothing else; no roll.
{{EQUIV_DETAIL}}

**Effect on the simulations.** None on 21 of the 22 strategies. The 22nd, `novice`, is a deliberately poor bot
that picks among legal moves with little judgment and used to make this press; its endings are unchanged in count
on the first seed set ({{NOVICE_1}}) and {{NOVICE_2}} on the held-out set, with small shifts in its move mix (§6).

**Regression coverage.** `test/engine/actions.test.mjs` (the refusal, its boundary, the earlier-in-the-week press
still allowed); the `equivalence` gate; `test/e2e/actions.cjs` (the card, the hint, a second press changes
nothing); four planted mistakes in `mutation-check.py`, all caught.

## 3. Verified existing behaviour (checked, found sound, not changed)

Checked by the independent audit (§8), by the gates, or by me looking at the build; the source of each is named.

**Numbers the game quotes (truth audit, on the frozen 2.1 release file).** Every card's energy, cash and slot cost
is the rule's and what the press charged. Stage odds quoted 52%, 61%, 38% measured 52.9%, 61.3%, 38.1% over 40,000
rolls each. Deal-row odds of 29%, 26%, 5% signed 29.0%, 26.3%, 4.8% of 12,000 presses each. Lead yields, the
conference bonus (quoted 30%, measured 29.6%), the Hail Mary (quoted four in five and 55%: 79.8% and 55.0%), quad
shot heart risk for shots 1–5, Recharge's ranges, CRM cleanup's manager gain and 15%/25% risk, and the End week
preview (6,000 of 6,000 weeks) all matched. Every blocked card is dimmed, `aria-disabled` and says why with the
right numbers.

**Dashboard (dashboard audit, five laptop sizes, 2.1 file).** Every piece of text reaches 4.5:1 (lowest: End
week's label, 4.55:1; secondary text 5.11:1). Stat cards and the twelve action cards share their geometry to
within 0.4px; no title or cost line is cut at 1280 wide or more. Value and Odds columns use tabular figures and
align to their headings. Hover, pressed and focus states on the action cards are present and distinct; the focus
ring is 2px with a 2px offset. Disabled cards are legible (5.38:1) and unmistakable. The three questions the brief
asks (time and energy left, on track for quota, what can advance) are each answered without hovering at every
size. Empty states read correctly. The settings menu and the folded `+N` chip behave.

**Game feel (feel audit, 2.1 test and release builds).** Every state change is on screen in the first frame after
the press (11–27 ms); two presses 60 ms apart both land; nothing holds input. Change chips last 1.7 s, the count-up
0.65 s, meters 0.15–0.18 s; nothing loops, and nothing is running 1.7 s after an action. A lost deal, a push that
signs nothing, a quiet Friday, a performance warning, a Hail Mary that signs, the President's Club ending and
clAInk's staged report each have their own sound, colour and words. The ASCII cinematics are untouched and are
still, frame for frame, the pictures v1.21 drew (`scenes` gate).

**The log and the announcer (proofreading audit).** 104,318 rendered lines from 1,320 seeded quarters hold no
`undefined`, `NaN`, doubled space, ASCII minus, straight quote, missing final stop or over-length line. All 39
announcer lines and the seven week chapters match the copydeck word for word. Over 28,715 moves the chips of the
lines each move wrote add up exactly to what the meters did. Plurals are right at 0, 1 and many for leads, deals,
introductions, contracts and outcomes (the two exceptions are items 20 above). The caption is the spoken line.

**Endings (my review of all six on the 2.1.1 build, desktop, plus two on a phone).** Each has its title, its
cinematic with caption, a one-line summary that agrees with the run (closed amount and share of quota, cash, the
reason on file), the approved corporate verdict, and Replay and New run with the focus on New run. With reduced
motion the description replaces the animation (`matrix` gate). No ending was changed. Distinctions are covered by
the engine test from 2.1 (only what the run can prove, at most three); the six fixtures used for the pictures are
old saves, which earn none by design.

**A new player's first minutes (my walkthrough of a fresh run, plus the `firstday` gate).** The memo states the
quota, the thirteen weeks, five slots a week and that energy is a separate budget, and points to the handbook. The
three-stop tour names the pipeline in order, the slots and End week, never blocks a press, and can be skipped. On
the first screen the cards now say which actions have nothing to work on yet. Rent, Friday, pace and stress are
explained where they appear (the week strip, the cash card, the quota card, the stress card) and in the handbook.
No tutorial was added.

**Keyboard, focus, captions, mute.** A whole run on the keyboard, tab order, Escape and focus return (`keyboard`
gate: 8 stages, 97 key presses). The confirmations by key press and by click, a "no" changing nothing (`confirm`
gate, and `actions` §4 for the new ones). Captions equal the spoken line, mute and announcer-off behave (`audio`
tests).

**Saves.** All 37 fixtures from v1.21 to 2.1 load both ways and play on (`saves` gate). Six sessions played by
real presses in the 2.1 file, their envelopes handed to the 2.1.1 file in a fresh profile: no recovery dialog, the
same run on screen, mechanical state and log text equal, schema still 5, one more press taken and saved; two of the
six had ended and showed the same ending (`qa/2.1.1/evidence/06-v5-save-compatibility.txt`).

**clAInk's rules.** Purchase, deployment, invoicing on Fridays, idle billing, cancellation and its price, the
three strikes, revocation and the true-up, the week-13 freeze, and the manager's warning and intervention are held
by `test/engine/claink.test.mjs`, by the release gate's thirteen named corner states (the moves the page offers are
the moves the rules allow) and by `resilience`. None of them changed; `equivalence` includes three clAInk
strategies. {{CLAINK_AUDIT}}

## 4. Unresolved issues

Known, not fixed in this pass, each with the reason. None blocks play.

1. **Narrow and short desktop windows.** Under about 1,180px of width the stat cards wrap and the week's card is
   about 34px taller; if the window is also under about 660px tall, End week hangs below the card's edge (at
   1025×620 it is partly cut off by the window, and still reachable by pointer and by the E key). 2.1 lost the
   button entirely at those sizes. A full fix means letting the card scroll or moving the layout's breakpoints,
   both rejected for this pass (§5). The action cost lines are also cut with an ellipsis under about 1,180px
   ("28 energy · skill o…"), as cost lines already were in 2.1.
2. **"Exceptional nap" is the usual nap.** The suffix prints for about 70% of recharges. The copydeck chose the
   adjective and left the condition. Where to draw the line is the editor's call; nothing was changed.
3. **A punchline can repeat under another label.** "Close push: no signatures. Verbal enthusiasm remains strong."
   followed by "Friday closes: no signatures. Verbal enthusiasm remains strong." (about 11% of consecutive pairs),
   and the same sentence about two different accounts on one Friday. The fix lives in `src/game/log.js`; left for
   a pass that is not frozen.
4. **The last Friday quotes next week's signing odds** on a full-funnel or neglected-funnel line, two to five
   lines above the verdict, dimmed behind the ending. There is no next week. Nit; left.
5. **Change chips under a Friday dialog.** When End week opens a choice, the week's chips play dimmed under the
   dialog and are gone before it is answered. The log lists everything Friday did. Left as marginal.
6. **clAInk's result is in the Activity log at once on a desktop**, about two seconds before the workspace's
   staged report reaches it. Item 17 fixed the phone notice; holding log lines back was rejected (§5).
7. **The quota in dollars is not on the main screen** (percentages only; $160,000 is in the memo and the
   handbook). Adding it is new copy outside the copydeck: the owner's or the editor's decision.
8. **Hints quote the rule's full amount when a meter cannot take it** ("+35–52 energy" at 98 energy). The log
   reports the real change and the handbook says "capped by actual meters": the choice 2.1 made. Left.
9. **One spoken line that simulations never reached**: the manager's "ChatGDP again? We'll circle back." case
   speaks the first opening. Not reached in 2,640 simulated quarters; not changed blind.
10. **For the owner to judge (nothing was changed):**
    - The player character is named "Matt". If that names a real person, consider a neutral default.
    - The copy uses one real product name, "Slack", in a clAInk joke; "ChatGDP" is a parody name; "Fortune
      500,000" is the owner's. No employer, customer or vendor is named anywhere in the release file.
    - The repository has no licence file for the game's own code, and `package.json` names no author or licence.
      Third-party notices are complete and checked by the `notices` gate.
11. **External links were not checked.** The build environment's network policy refuses them. The release file
    contains five URLs, all in the licence banner; nothing in the game requests or links to them.
12. **Environments not available here**: Firefox, WebKit/Safari, any real device, a screen reader, speech output
    (headless Chromium has no voices: the text handed to the speech engine was compared with the caption, the
    sound was not heard).

## 5. Deliberately rejected changes

| Proposal | Why not |
|---|---|
| Refuse every Proposals press with no demoed deal | It removes the full-funnel credit that press can still earn: a mechanical reward. Narrowed to the state where nothing is left to earn (§2). |
| Turn off Discovery, Demo marathon or Close deals when nothing is eligible | They train a skill. The brief: "Do not disable legitimate skill-building strategies." The card says `skill only` instead. |
| Let the week's card scroll inside itself when it does not fit | In this layout the footer already rests in the card's bottom padding at the smallest gated sizes, so the card would scroll by a few pixels and show a scrollbar at sizes that fit today. Closing the card up was chosen instead; the residue is §4.1. |
| Move the one-screen layout's lower bound from 620px to 720px | It would hand a whole band of laptop windows the stacked, scrolling page. Too large a change of look for this pass. |
| Hold clAInk's log lines back until its report has played | Touches the order in which the log is drawn, which the parity harness and the resilience test read; a missed release of the hold would hide lines. Medium risk for a two-second effect. |
| Hold the stat cards' chips while a Friday dialog is open | Changes chip timing for every week with a dialog; the audit itself called leaving it defensible. |
| Replay the week-heading animation on a deal row whose stage changed | It would also play on every row each time the list is first drawn, and the layout gates measure boxes that would be mid-transform. The pip fade (item 16) is the restrained version. |
| A sound or a line for reaching quota | Needs a new trigger outside the log director and a line the copydeck does not have. The green meter (item 11) is a state, not an effect. |
| State the quota in dollars on the Closed card | New copy outside the approved copydeck (§4.7). |
| Print "Exceptional nap" only for the best naps | An editorial choice of threshold (§4.2). |
| Let a plain log line follow itself so the plain wording reaches 60% | Breaks the promise that no sentence is said twice running, which a test holds. |
| Spell out the Hail Mary's slot as well as its energy | The hint then needs three lines in the narrowest desktop window, and a hint bar that grows moves the button under the pointer. The cards give energy only; so does this hint. With no slot left the button is off and says so. |
| No-break spaces inside the stored chip text | The text is saved in runs and read by tests; the same result is drawn without changing a stored character (item 22). |
| Cap quoted amounts by the room left on a meter | §4.8. |
| A general refactor of the hint bar, the layout tiers or the copy engine | Out of scope. Each fix above is the smallest that holds. |

Nothing was added because capacity was available: no new mechanic, ending, currency, achievement, tutorial,
dependency, animation system or save field.

## 6. Tests and evidence

### Final gate run (`npm run verify:release`, {{VERIFY_STEPS}})

{{GATE_TABLE}}

### Seeded equivalence with 2.1

`node test/engine/tools/equivalence.mjs --seeds 1000` on both seed sets (`qa/2.1.1/evidence/02-equivalence.txt`):

{{EQUIV_TABLE}}

The golden replays (58 seeded runs) keep every mechanical digest; the word digests of 50 were regenerated for
items 20 and 21.

### Balance: is it still the 2.1 candidate?

`node test/sim/run.mjs --policies all --seeds 1000` from seed 1 and from seed 5001, compared count for count with
the 2.1 records in `qa/2.1/balance/` (`qa/2.1.1/evidence/03-balance-vs-2.1.txt`; the full tables are in
`qa/2.1.1/balance/`). These are automated heuristics. They are not playtests.

{{BALANCE_TABLE}}

### Other evidence

| What | Result | File |
|---|---|---|
| The `actions` gate run against the 2.1 release | {{ACTIONS_ON_21}} checks fail, then it stops where 2.1 has no confirmation | `evidence/04-actions-gate-on-2.1.txt` |
| The layout gate at 1366×657 and 1280×620, 2.1 against 2.1.1 | 2.1: 60 failures; 2.1.1: 0 | `evidence/05-layout-short-windows.txt` |
| 2.1 saves in 2.1.1 | 12 of 12 checks | `evidence/06-v5-save-compatibility.txt` |
| Release-file hygiene scan | §9 | `evidence/07-release-file-hygiene.txt` |
| Mutation check: planted mistakes in the rules | {{MUTATION}} | `evidence/08-mutation-check.txt` |
| Self-tests: each browser gate given a planted fault | {{SELFTEST}} | `evidence/09-selftests.txt` |
| The week's card and the hint bar measured at fourteen window sizes; every hint counted for lines | End week inside the card at every size from 1180×657 up; 480 hints, none over two lines | `evidence/10-hint-bar-and-card-measurements.txt` |
| The release file itself from `file://`: the size matrix and the offline run | {{RELEASE_FILE_RUN}} | `evidence/11-release-file-matrix-offline.txt` |
| The independent audit's findings, area by area, as returned | §8 | `qa/2.1.1/audit/` |

The scripts behind rows that are not gates are in `qa/2.1.1/tools/`.

## 7. Screens: what was looked at

Automated layout assertions say nothing is covered or cut off; they do not say it looks right. I looked at every
picture below myself, at full size.

- **Before and after, fifteen pairs** (`qa/2.1.1/screenshots/before-after/`, the 2.1 release against the 2.1.1
  release in the same state at the same size): 01 cards with nothing to work on; 02 and 03 a short window
  (1366×657, 1280×720); 04 a two-line hint; 05 a press that ends the run; 06 rent that would trigger Collections;
  07 and 08 the stat cards, early and at quota; 09 clAInk's policy; 10 log chips; 11 the handbook; 12 the change
  chip with reduced motion; 13 cash below zero; 14 a phone's first screen; 15 a signed $42,000 deal.
- **The size matrix on the release file** (`qa/2.1.1/screenshots/matrix/`): thirteen states at 1440×900, 768×1024
  and 390×844.
- The six ending cards and the first-run memo and tour, at 1366×768 and on a phone, during the review in §3.

What I was looking for and found intact: the dark, flat, corporate dashboard with one accent colour; no gradient,
badge or illustration added; clAInk still the only gradient on the screen, in its own purple-to-cyan, with its own
type and rounded buttons; the ASCII scenes untouched. The two-line hint bar is the one change of proportion a
returning player will notice.

Not judged: how any of it looks on a real laptop panel, a real phone, or in another browser engine.

## 8. The independent audit

Before changing anything I had the frozen 2.1 build audited by separate reviewers, one per area of the brief, each
told to press the real build, measure, and report what was already sound as well as what was not. I did my own
inspection in parallel, and several findings were reached twice (the short-window overflow, the stale hint, the
quiet signing, the minus-sign break).

{{AUDIT_TABLE}}

Every finding and its outcome is in `qa/2.1.1/audit/README.md`; the findings as returned are beside it.

## 9. Distribution hygiene

Scan of `Tech_Sales_Trail_2.1.1.html` (`qa/2.1.1/tools/hygiene.py`):

- **Network:** no `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `sendBeacon`, external script, stylesheet,
  image or font. The `offline` gate plays the file from `file://` with every request refused and counts none.
- **Links:** five URLs, all in the licence banner (the two font repositories and three licence texts). The game
  has no outbound link.
- **Test hooks:** none (`release` gate: no hook in the bundle, and one planted from outside is inert).
  `TST_AUDIO`, `TST_SCENES` and `TST_TOAST` are the game's own module names.
- **Diagnostics:** `console.error` only, from React. No `debugger`, no source map, no notes to self.
- **Personal or local traces:** no e-mail address, no home directory or host name, nothing shaped like a
  credential.
- **Third-party notices:** `THIRD-PARTY-NOTICES.md` is current (`notices` gate): React (MIT), Inter and JetBrains
  Mono (OFL 1.1), Lucide (ISC), bundled; their licence texts are in the file's banner.
- **The statement** asked for by the brief is in the handbook and the README.
- **Storage:** the game reads and writes only its own `tst-` keys in the browser's local storage.

Items for the owner's judgment are in §4.10.

## 10. How to reproduce

```bash
npm ci
```

```bash
npm install --no-save playwright && npx playwright install chromium
```

```bash
npm run verify:release
```

```bash
node test/engine/tools/equivalence.mjs --seeds 1000 --from 1
```

```bash
node test/sim/run.mjs --policies all --seeds 1000 --from 1
```

```bash
node test/sim/run.mjs --policies all --seeds 1000 --from 5001
```

```bash
python3 test/engine/tools/mutation-check.py
```

```bash
node test/e2e/actions.cjs Tech_Sales_Trail_2.1.html
```

```bash
node qa/2.1.1/tools/v5-compat.cjs Tech_Sales_Trail_2.1.html Tech_Sales_Trail_2.1.1.html .
```

```bash
python3 qa/2.1.1/tools/hygiene.py Tech_Sales_Trail_2.1.1.html
```
