# Tech Sales Trail 2.1.1 — QA report

Report on "Operation Gold Master", the final polish pass on 2.1. Everything in it was run in this repository;
nothing is reported as passed without a log on file. Where something was not run, could not be run, or was looked
at and left alone, it says so. The report keeps four things apart, as the brief asks: what was **changed** (§1),
what was **checked and found sound** (§3), what is **still open** (§4) and what was **turned down** (§5).

| | |
|---|---|
| Status | **Release candidate. Not promoted.** `index.html` is still the 2.1 file (559,646 bytes, sha256 `5c495f1168f2…6dae0e`), held there by the `releases` gate. Promotion is the owner's call. |
| Release file | `Tech_Sales_Trail_2.1.1.html`, 568,319 bytes, sha256 `7d4e1e8a05bcb2f01a6829fecce28c4d762088b7b401acc2dce2845d2c60c3d4` |
| Earlier releases | 2.1, 2.0.1 and 1.21 are in the repository as they shipped, each checked against its recorded size and SHA-256 (`test/baseline/releases.json`) |
| Final gate run | `npm run verify:release`: **29 of 29 steps passed**, 663 s (`qa/2.1.1/evidence/01-verify-release.txt`) |
| Rules | The frozen 2.1 rules and this tree are the same run after every move: 44,000 seeded quarters, 1,893,691 moves, one decided correction (§2) |
| Balance | Frozen. 21 of 22 simulated strategies come out identical to 2.1, count for count, on both seed sets (§6) |
| Saves | Same format (schema 5). Runs played and saved by the 2.1 file open in 2.1.1 as the same run and play on |
| Browser | Chromium (Playwright 1.63). **Firefox and WebKit are not installed here: unverified.** No real phone, tablet or laptop was used. |
| People | **No human playtest was run on 2.1.1.** Simulations are heuristics, not people. |

How the pass was run: the frozen 2.1 build was audited by nine independent reviewers, one per area of the brief,
and every finding was then given to a second reviewer told to doubt it (§8). I inspected the build myself in
parallel. Changes were made on the first reading and several were withdrawn on the second (§5).

## 1. Implemented changes

Source diff against 2.1: 23 files under `src/`, +403 −125 lines. No dependency was added, no
save field, no rule constant changed value. Each row names the test that now holds it.

### Action clarity and feedback (brief §1)

| # | Change | Where | Held by |
|---|---|---|---|
| 1 | With nothing to work on, a pipeline card says what the press is still good for: `skill only` (Discovery, Demo marathon, Close deals) or `no deals` (Proposals). The hint keeps the copydeck's sentence ("No eligible deals. You would still spend a slot and energy.") and adds the training note the deck allows where the action really trains; for Proposals, which trains nothing, it says the press would only count toward a full-funnel week. The count of eligible deals (on the card since 2.1) gained a spoken label. | `src/ui/app/ActionGrid.jsx`, `src/copy/ui.js` (`CARD`, `HINT`) | `actions` gate §1–2 (8 boards, every card against the rules, every press compared before and after) |
| 2 | **The one rule correction**: Proposals with no demoed deal, in a week whose proposal-or-close work is already counted, is refused (§2). | `src/game/actions.js` (`proposeIdle`), `src/game/run.js` | engine `actions.test.mjs`; `equivalence` gate; `actions` gate; 4 mutants |
| 3 | A press that is certain to end the run is marked `Ends the run`, explained in the hint, and confirmed first: stress that would reach 100 (Prospect blitz, Internal politics, Conference run, Hail Mary) or a purchase that would take cash to the Collections line (Conference run, Quad shot). One point or one dollar short of certain, nothing is marked. | `src/game/selectors.js` (`fatalPress`, `purchaseBust`, `stressCost`), `src/ui/Game.jsx`, `src/copy/ui.js` (`CONFIRM`) | engine `actions.test.mjs`; `actions` gate §4 (yes ends the run as the rules say, no changes nothing) |
| 4 | A Friday that is certain to end the run says so before End week is pressed. Rent that would trigger Collections: on the cash card and in End week's hint, with the figures. A coffee crash that would reach 100 stress (13 a shot; nothing on a Friday lowers stress in such a week): in End week's hint and on the stress card, which now keeps "Crash: +N on Friday" from 80 stress up (it used to be replaced by "Dangerous stress level", and on a touch screen the figure was then nowhere). | `selectors.js` (`fridayPreview`: `bust`, `melt`), `Kpis.jsx`, `ui.js` | engine `actions.test.mjs` (the crash ends the run at every roll; one point lower it is a roll); `actions` gate §4 |
| 5 | End week's preview lists the clAInk invoice with salary and rent: what is due after a run, to the dollar, or the idle range. It is as certain as rent and was left out. | `selectors.js` (`fridayPreview.claink`), `ui.js` | engine `claink.test.mjs`; `actions` gate §9 (Friday charged what was previewed) |
| 6 | The quota label never rounds up onto 70%, 80% or 100%, the lines that decide the quarter. At $159,500 of $160,000 it read 100% over a full bar; the QBR, which floors, then said 99% and ended the run on that. Elsewhere it is rounded as before, so it still agrees with the pace line beside it. | `ui.js` (`KPI.ofQuota`), `Kpis.jsx` | engine `copy.test.mjs` (every $37 from $100,000 to $170,000: the label is on the same side of each line as the rule); `actions` gate §7 |
| 7 | Hints state what they omitted: the Hail Mary's energy, Prospect blitz's stress, that a quad shot takes a slot (bought with the last slot to power another action, it ends the week instead). CRM cleanup gives the dollar value of the "dead leads" it would remove: a lead or qualified deal is dead when it is skeptical or five weeks old, whatever its size, and the deal list shows no age, so a count of 2 could be $180,000. "a 85% chance" is "an 85% chance". | `src/copy/ui.js`, `selectors.js` (`crmPreview`) | engine `copy.test.mjs`, `actions.test.mjs`; `actions` gate §5 |
| 8 | The line under the actions no longer names work there is no energy for (it adds what that work takes); a number key on an action that is off moves focus to its card, which says why. | `src/ui/app/Foot.jsx` (`idleHint`), `Game.jsx` | `actions` gate §3 |
| 9 | The hint bar reads its words from the run as it is, for the twelve actions, the Hail Mary and End week. In 2.1 it kept the words from when the pointer arrived: after three quad shots it still described shot 1 beside a card reading "45% heart risk", and after a week turned it previewed the wrong Friday. | `Foot.jsx` (`hintWords`), `ActionGrid.jsx` | `actions` gate §6 |
| 10 | The handbook names what counts toward a full-funnel week (a conference does not), states the stale-lead and demo-backlog rules (they were in the README but not in the game), and says that Collections ends the run. It still fits one screen at 1440×900. | `src/copy/help.js`; thresholds moved to `src/game/rules.js` as named constants, same values | engine `copy.test.mjs` (the handbook is written from the rules) |

### Dashboard (brief §2)

| # | Change | Where | Held by |
|---|---|---|---|
| 11 | **Short desktop windows.** From 620 to about 750px of window height the week's card was taller than the window, and that layout does not scroll: at 1280×720 End week and the Hail Mary hung 9px through the card's border, at 1366×700 End week was cut off, at 1366×657 it was entirely off the screen, and the first-day tour left the page pushed up with the top bar gone. The card's gaps, padding and action rows now ease down in proportion (fluid `clamp()` on the window height; no new media query). At 746px and above nothing moves. | `src/styles/app.css` (desktop tier) | `layout` gate, which now also measures 1366×657 and 1280×620: 2.1 fails there in 60 places (`qa/2.1.1/evidence/05-layout-short-windows.txt`) |
| 12 | The hint bar is two lines tall whatever it says. A two-line hint (more than a third of them at 1280 wide) sat 1px from the bar's borders; now 5px, and nothing under the bar moves when the hint changes. No hint needs a third line at any width of this layout. | `app.css` | `actions` gate §8 (1025×768 and 1366×657, 180 hints) |
| 13 | Stat cards: the unfilled part of a meter is visible (it was 1.08:1 against the card; now the tone the past weeks' ticks use); the quota meter is green from 100%; the cash card's second line is level with its neighbours. A minus sign stays with its amount and a range stays in one piece (`−$1,500`, `$140–$280`). | `app.css`, `Kpis.jsx`, `ui.js` (`usd`, `to`) | `actions` gate §7; pictures 07, 08, 13 |

### Game feel (brief §3)

| # | Change | Where | Held by |
|---|---|---|---|
| 14 | A signing's log line is toned good (green icon) in the log and in the phone's notice, as a loss is toned bad. The style existed and nothing used it. | `src/ui/app/logLook.js` (`toneFor`) | engine `copy.test.mjs` (whole seeded runs: every signing and nothing else) |
| 15 | **Reduced motion:** the change chips on the stat cards were in the page at opacity 0 for their whole 1.7 s (their animation ends on nothing and was cut to nothing). They are shown still. | `app.css` | `actions` gate §7, with and without reduced motion |
| 16 | **Touch:** the first tap on End week or the Hail Mary acts. In 2.1 the tap brought the focus, the focus raised a three- or four-line hint, the bar grew, and the button had moved from under the finger before it lifted: a tap in the upper part of End week did nothing, and the Hail Mary always needed two (2.0.1's hints were shorter). On a touch screen those two hints are now raised by the press, not by the focus. Seen in Chromium's touch emulation; iPhones probably never had it. | `Foot.jsx` | `phone` gate (a tap 15% of the way down End week ends the week) |
| 17 | A caption that does not fit one line of the top bar is shown whole, on up to three lines (a tablet upright, a phone on its side). It was cut with an ellipsis, punchline first: 5 of 54 lines at 768×1024 and 33 of 54 at 667×375. With the sound off the caption is the announcement. | `app.css` (stacked tier) | `phone` gate (768×1024, 740×360, 667×375) |
| 18 | On a phone the bottom notice no longer raises a clAInk run's lines while the workspace that is reporting them, beat by beat, is on the screen (it announced the strike about two seconds before the strike card landed, and covered it). | `src/ui/app/LogPeek.jsx` | `phone` gate still passes; looked at |

### clAInk (brief §4)

| # | Change | Where | Held by |
|---|---|---|---|
| 19 | The policy step, which is what the player accepts, states the recurring obligations in the rules' own numbers: $249 a run plus $140–$280 per outcome (two to five on a $0 run), or $150–$300 for an idle week; overages of $200–$600; a true-up that takes your cash and $200–$1,800 more; $250 plus usage due to cancel early. In 2.1 only the $500 seat price was stated before purchase, and a $0 run bills $529 to $1,649. The three approved lines are untouched; the terms are a marked list. The step still fits its corner at every gated size. | `src/copy/clainkUi.js` (`CK_AD.policy`), `src/ui/ClainkUi.jsx`, `claink.css` | engine `copy.test.mjs`; `layout` gate (`dock-whole` at 9 sizes); picture 09 |
| 20 | **The workspace follows a run to its result.** On a laptop-height window the workspace is shorter than a run's report and stayed at its top: at 1280×720 the strike card (what the run took), "Closed: $0", the week's estimate and "Cancel seat" landed wholly below its fold. A run the player presses is now followed as each beat lands (the workspace's own scroll, never the page's); it rests with the result card's top in sight, and returns to its top when the week turns. | `ClainkUi.jsx` | `actions` gate §9 (1280×720, 1366×768, 1366×650) |
| 21 | At two strikes the warning under Run agents says "a deal walks" when there is a deal on the board: the third strike always takes the most advanced one. The copydeck gives both wordings and keeps "a live deal may walk" for a board that can be empty; 2.1 used it always. | `clainkUi.js` (`CK_STRIKES.hotHead`) | engine `copy.test.mjs`; `actions` gate §9 |
| 22 | When the workspace scrolls, its scrollbar is thin and in clAInk's colours instead of the browser's default (the only unstyled one in the game; headless pictures never showed it). | `claink.css` | looked at |

### Proofreading (brief §5)

| # | Change | Where | Held by |
|---|---|---|---|
| 23 | After a clAInk run that worked, the manager's dialog opens "Nice week. ChatGDP do that?" and the announcer said and captioned the opening for a run that failed, "Always on ChatGDP, huh?" (about a quarter of first warnings). The announcer has one approved line for this dialog; after a run that worked it now leaves the dialog to speak for itself. No new copy. | `src/engine/audio/director.js`, `Game.jsx` | `audio` tests |
| 24 | "Referrals: 1 introduction. One of them is a whale." is "It is a whale." (about 30% of such lines had one introduction). "1 of your largest deal" is "1 of your largest deals". | `src/copy/log.js` | engine `copy.test.mjs` |
| 25 | The chips under a log line are each kept whole when the row wraps, and a second row stays on the right. The stored text is unchanged, to the character. | `Activity.jsx`, `app.css` | `actions` gate §7 |
| 26 | The recovery dialog says what is kept aside before it says what to do ("…or return to a valid saved run. It will be kept aside…" read as the valid run). | `src/copy/ui.js` (`RECOVERY.body`) | `resilience`, `phone` gates |

### Endings (brief §6)

| # | Change | Where | Held by |
|---|---|---|---|
| 27 | The Barely missed scene is given the floored share of quota, as the card and the QBR's own line use. With the exact share, a run that closed $159,600 played "QUOTA 100%" and "100% OFF" above a tile reading "99% of quota"; scene and card disagreed for half of all amounts. The scene's pictures are untouched. | `src/ui/Game.jsx` | `actions` gate §10; `scenes` gate |
| 28 | The Ascension card's quad-shot count includes the shot that ended the run (the scene said "Shot #3", the card "Quad shots 2"). Display only: the story and the save are as they were, so Ascensions saved earlier are corrected too. | `selectors.js` (`runFacts`) | engine `actions.test.mjs` |
| 29 | **Reduced motion.** An ending opens at its first line. It opened already scrolled to its end, so on a phone or a laptop-height window the title, the company's line and the top of the still were never shown. The announcer's line for the ending is captioned under its title; it was captioned in the top bar behind the dialog, and on a phone nowhere. And New run does not answer for the ending's first 0.7 s: with no scene to hold the focus, a second press of the key that ended the week started a new run before the ending had been seen and wrote over its save. | `src/ui/Ending.jsx`, `src/engine/scenes/player.js` | `actions` gate §10 (1366×657 and 390×844) |
| 30 | On a phone held sideways the card's tiles are two by two, as on an upright phone. Four across they were 102px wide and cut "$171,3…" and "107% of …". | `src/styles/dialogs.css` | `actions` gate §10 (667×375, 844×390) |

### Distribution (brief §9)

| # | Change | Where | Held by |
|---|---|---|---|
| 31 | The studio's statement is in the handbook (footer on desktop, last line of the body on narrow screens) and in the README, word for word. | `src/copy/help.js` (`HELP_ABOUT`), `Game.jsx`, `dialogs.css`, `README.md` | `qa/2.1.1/evidence/07-release-file-hygiene.txt` |
| 32 | The release file's header credits Feather for the ten bundled icons derived from it (they stay under its MIT licence and its author's copyright; the header credited them to Lucide). `THIRD-PARTY-NOTICES.md` names scheduler, which the header already listed. | `scripts/build.mjs`, `scripts/notices.mjs` | `notices` gate |
| 33 | The recovery dialog's buttons wrap on a small phone. "Open your saved run · week 12 (earlier version)" ran off a 320px or 375px screen: the way back to a good run for a player coming from 2.0.1. | `dialogs.css` | `phone` gate (320px, 375px) |
| 34 | The README no longer says the office PA is "synthesized in the page": it is read by the browser's speech voice, which in Chrome and Edge can be an online one (§4.14). | `README.md` | |

### Tests and plumbing

- **`releases` gate** (`scripts/check-releases.mjs`, `test/baseline/releases.json`): 2.1, 2.0.1 and 1.21 are the files
  that shipped, and `index.html` is the promoted one. A build cannot overwrite a kept release by accident.
- **`equivalence` gate** (`test/engine/tools/equivalence.mjs`, `test/baseline/v2.1-engine`): §2 and §6.
- **`actions` gate** (`test/e2e/actions.cjs`): 104 checks by real presses on the release build. Run against the 2.1
  file it fails 30 checks and then stops at the first run-ending press, where 2.1 shows no
  confirmation (`qa/2.1.1/evidence/04-actions-gate-on-2.1.txt`).
- The layout gate measures nine desktop sizes (was seven). The phone gate has 55 checks (was 49). Engine tests: 120
  (was 113). The mutation list has six new mutants (58 in all).
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
two golden replays. It was implemented first, measured, and narrowed. The audit's re-check would have refused
nothing at all; the brief asks for a disabled state where an action offers no benefit, and this is the one state
where that is literally true.

**Proof that nothing else moved.** `equivalence` plays the frozen 2.1 rules and this tree side by side, the bot
choosing only from what this tree allows, and requires the whole mechanical state to be equal after every move. At
every step where 2.1 offered a move this tree refuses, the move is made on the 2.1 run and what it changed there is
checked: one slot, 25 energy, a mark no rule then reads differently, its log line, and nothing else; no roll.
Over 44,000 seeded quarters and 1,893,691 moves, 2.1 had the press on offer at 24,190 steps of 10,670 runs, and at every one it bought nothing.

**Effect on the simulations.** None on 21 of the 22 strategies. The 22nd, `novice`, is a deliberately poor bot
that picks among legal moves with little judgment and used to make this press. On seeds 1–1000 its endings are the same in count (4 club, 8 missed, 968 fired, 20 meltdown); on the held-out seeds they shift by a run or two (1 club, 5 missed, 973 fired, 21 meltdown in 2.1; 1 club, 6 missed, 971 fired, 22 meltdown now), and its survival reads 0.6% → 0.7%. It plays 45.13 → 45.22 moves a run (§6).

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
0.65 s, meters 0.15–0.18 s; nothing loops, and nothing is running 1.7 s after an action. A signing already has the
cash sound, green chips, the count-up and the meter; a lost deal, a push that signs nothing, a quiet Friday, a
performance warning, a Hail Mary that signs, the President's Club ending and clAInk's staged report each have
their own sound, colour and words. A stage change is shown four ways in its first frame (pips, stage name, count
badges, log line) and needed nothing added. The ASCII cinematics are untouched and are still, frame for frame, the
pictures v1.21 drew (`scenes` gate).

**The log and the announcer (proofreading audits).** 104,318 rendered lines from 1,320 seeded quarters hold no
`undefined`, `NaN`, doubled space, ASCII minus, straight quote, missing final stop or over-length line. All 39
announcer lines and the seven week chapters match the copydeck word for word, and so does every string of the
handbook, the memo, the tour, the Friday dialogs, clAInk's ad, workspace and reports, the endings and the scene
captions that was rendered. Over 28,715 moves the chips of the lines each move wrote add up exactly to what the
meters did. Plurals are right at 0, 1 and many for leads, deals, introductions, contracts and outcomes (the two
exceptions are item 24). The caption is the spoken line.

**Endings (endings audit, plus my own review of all six on the 2.1.1 build).** All six open cleanly from play: no
blank frame, no second dialog, no moving scene. Each has its title, its cinematic with caption, a summary that
agrees with the run the page saved (37 cards: closed, floored share of quota, cash, the reason on file), the
approved corporate verdict, and Replay and New run on screen and reachable by keyboard at 1366×768 and on a phone.
58 strings of copydeck section 11 match. Distinctions are earned and withheld correctly in 22 crafted runs. No
ending was redesigned; items 27 to 30 correct two numbers and four edges.

**A new player's first minutes (new-player audit, plus my walkthrough and the `firstday` gate).** The memo is open
3.0 s after "Clock in". The three job lines (33 words) and the three tour stops (74 words) correctly teach the
quota, slots against energy, and the funnel, at 1366×768 with a mouse and at 390×844 by touch. Manager standing,
what stress costs and the balance rule are in the handbook at first and turn up in play when they start to matter.
The tour never blocks a press and can be skipped. Nothing needed adding to the opening, and no tutorial was added;
what a newcomer would misread was in the hints and the handbook (items 1, 3, 7, 8, 10).

**Keyboard, focus, captions, mute.** A whole run on the keyboard, tab order, Escape and focus return (`keyboard`
gate: 8 stages, 98 key presses). The confirmations by key press and by click, a "no" changing nothing (`confirm`
gate, and `actions` §4 for the new ones). Captions equal the spoken line, mute and announcer-off behave (`audio`
tests).

**Saves.** All 37 fixtures from v1.21 to 2.1 load both ways and play on (`saves` gate). Six sessions played by
real presses in the 2.1 file, their envelopes handed to the 2.1.1 file in a fresh profile: no recovery dialog, the
same run on screen, mechanical state and log text equal, schema still 5, one more press taken and saved; sessions
that had ended showed the same ending (`qa/2.1.1/evidence/06-v5-save-compatibility.txt`).

**clAInk (clAInk audit: 137 static states at six sizes, plus scripted runs).** The price line, the $500 button and
the fine print survive every ad layout at every size; the open ad never scrolls inside itself. Numbers agree
between ad, bars, workspace, handbook, log and rules. The workspace's arithmetic is the rules' ("Estimated this
week: $669" is what Friday charged; the cancel question's $919 is $250 plus that). Billable outcomes are distinct
from revenue wherever both show. Strike cards say what each incident took. The cancel control is quiet, works,
and is disabled when paying would reach Collections. The contrast with Shitcorp is intact: gradients, pill
buttons and glow appear only inside clAInk's surfaces. Purchase, deployment, invoicing, idle billing,
cancellation, the three strikes, revocation and the true-up, and the week-13 freeze are held by
`test/engine/claink.test.mjs`, by the release gate's thirteen named corner states and by `resilience`. No clAInk
number changed; `equivalence` includes three clAInk strategies.

**Distribution (hygiene audit, and §9).** No secret, no personal data, no test hook, no console output, and not
one request beyond the document itself in nine played weeks and 25 named states.

## 4. Unresolved issues

Known, not fixed in this pass, each with the reason. None blocks play.

1. **Narrow and short desktop windows.** Under about 1,180px of width the stat cards wrap and the week's card is
   about 34px taller; if the window is also under about 660px tall, End week hangs below the card's edge (at
   1025×620 it is partly cut off by the window, and still reachable by pointer and by the E key). 2.1 lost the
   button entirely at those sizes. A full fix means letting the card scroll or moving the layout's breakpoints,
   both rejected for this pass (§5). Under about 1,200px the action cost lines are also cut with an ellipsis
   ("28 energy · skill o…", "40 energy · $800 · 2…"), as cost lines already were in 2.1.
2. **The onboarding memo needs a window 664px tall.** Below that it scrolls inside its dialog with its button
   pinned; at 625px the pinned button covers a line. The button is always there. Making the memo fit means
   dropping its chapter line there, which is a design decision.
3. **The finished ending card is 24px taller than a 768px-tall window** (Ascension more), so the scroll that
   brings the paperwork into view slices the first line. 2.1's verdict and distinctions outgrew a threshold set in
   2.0.1. The fix shrinks the scene for windows 760 to 859px tall, which trades the cinematic's size; left.
4. **"Exceptional nap" is the usual nap.** The suffix prints for about 70% of recharges. The copydeck chose the
   adjective and left the condition. Where to draw the line is the editor's call.
5. **Repetition in the log, three kinds, all left as 2.1.** A line's first alternative comes back more often than
   its second (payroll's HR joke on 36.6% of Fridays against 21.7%); a punchline can repeat under another label
   ("Close push: no signatures. Verbal enthusiasm remains strong." then "Friday closes: …", about 11% of
   consecutive pairs); the last Friday still quotes next week's signing odds. The first was fixed and then
   withdrawn (§5); the second lives in `src/game/log.js`; the third is a nit.
6. **Feedback timing, two kinds.** When End week opens a choice, the week's change chips play dimmed under the
   dialog and are gone before it is answered. On a desktop a clAInk run's result is in the Activity log at once,
   about two seconds before the workspace's staged report reaches it (item 18 fixed the phone's notice only). And
   for about a tenth of a second between a confirmation and an ending the dashboard shows undimmed.
7. **Things the game never spells out.** The quota in dollars is not on the main screen (it is in the memo and
   the handbook); "QBR" and "pp" are never expanded (the README does); that strikes 1 and 2 can do real damage is
   not said before the first incident (38% do; the README says so); the Hail Mary's hint gives its energy and not
   its slot. Each is new copy outside the copydeck or has no room in the handbook at 1440×900: the owner's or the
   editor's decision.
8. **Hints quote the rule's full amount when a meter cannot take it** ("+35–52 energy" at 98 energy; End week's
   "energy +15" at 95). The log reports the real change and the handbook says "capped by actual meters": the
   choice 2.1 made.
9. **Three one-character inconsistencies that follow the copydeck to the letter**, for the editor: a full stop
   after "$0 in pipeline." and none after "$40,000 in pipeline"; "End Week advances the quarter" beside a button
   called "End week"; "Collections take the jacket" where Collections is singular everywhere else.
10. **Line breaks left as they fall:** "true-" / "up" in the two-strike warning at 1366×768; a number parted from
    its word in two hints on a phone; one-word last lines in three headings on a phone.
11. **On a touch screen the hints for End week and the Hail Mary can no longer be read before the tap** (item 16;
    it was always so for the twelve actions). What makes a Friday fatal is on the cash and stress cards.
12. **One spoken line that simulations never reached**: the manager's "ChatGDP again? We'll circle back." case
    speaks his first opening. Not reached in 2,640 simulated quarters; not changed blind.
13. **For the owner to judge (nothing was changed):**
    - The player character is named "Matt". If that names a real person, consider a neutral default.
    - `docs/2.1/TTST_2.1_Claude_Code_Implementation.md` and the copydeck's header name five people with job
      titles. They read as the by-line of a brief written in a studio's voice. If they are real people, two
      role-only lines would replace them; the names would remain in the repository's history.
    - The copy uses one real product name, "Slack", in a clAInk joke; "ChatGDP" is a parody name; "Fortune
      500,000" is the owner's. No employer, customer or vendor is named anywhere in the release file.
    - The game has no licence or copyright line of its own (`package.json` names no author or licence), which
      means all rights reserved by default. The release file carries a name and a link for each third-party work,
      not the licence texts; those are in `THIRD-PARTY-NOTICES.md`.
14. **The announcer's voice.** In Chrome and Edge the game prefers "Google UK English Male" and "Microsoft Aria",
    which are online voices: the browser sends the announcer's lines (fixed sentences) to its speech service. The
    page itself makes no request. Preferring a local voice is a two-line change that would alter how the announcer
    sounds for most desktop players, and nobody could hear it here, so it is left to the owner; the README now
    says what happens and how to keep everything on the device.
15. **External links were not checked.** The build environment's network policy refuses them. The release file
    contains five URLs, all in the licence banner; nothing in the game requests or links to them.
16. **Environments not available here**: Firefox, WebKit/Safari, any real device, a screen reader, speech output
    (headless Chromium has no voices: the text handed to the speech engine was compared with the caption, the
    sound was not heard), and Chrome's classic scrollbars in the gates (Playwright hides them).

## 5. Deliberately rejected changes

**Made on the audit's first reading, withdrawn on its second.** Each was real as an observation and small as a
change; the re-check's argument was that it was preference, not defect.

| Change | Why it was withdrawn |
|---|---|
| The announcer's large-sale line from $40,000 instead of $45,000 | The line has been at $45,000 since v1.14 and is the audio suite's contract. It would not have cured the asymmetry it was aimed at (an ordinary $20,000 signing would still pass unannounced while CRM cleanup has a line; that line is the joke), and a signing already has its sound, chips, count-up and now a green log line. |
| Choosing a line's alternative wording evenly instead of taking the next in the list | No player can perceive one HR line a quarter moving, and every seeded run would have read differently. |
| The PIP chip first in its row | It only swaps which chip is folded into `+N`: "Discount 20% · this week" would be hidden instead. |
| A pressed state on End week and the Hail Mary | The rule would have reached every dialog and tour button, which share the class; both buttons answer at once. |
| A fade on a deal's next pip when its stage changes | A stage change is already shown four ways in its first frame. |
| "Takes a slot." on Recharge's hint | The tour says it ("Recharge restores energy if you have a slot left"). Kept on the quad shot, where the trap is. |
| Naming the full-funnel mark in the empty-stage hints of Discovery, Demo marathon and Close deals | It advertises that three empty presses earn +6 points, which changes how the game is played without changing a rule. The copydeck's own training note says enough. It is named only for Proposals, where it is all a press can buy and what makes the off state explicable. |
| A new announcer line for the manager's other opening | The announcer has one approved line for that dialog. Saying nothing needs no new copy. |

**Proposed and not made.**

| Proposal | Why not |
|---|---|
| Refuse every Proposals press with no demoed deal | It removes the full-funnel credit that press can still earn: a mechanical reward. Narrowed to the state where nothing is left to earn (§2). |
| Turn off Discovery, Demo marathon or Close deals when nothing is eligible | They train a skill. The brief: "Do not disable legitimate skill-building strategies." The card says `skill only` instead. |
| Let the week's card scroll inside itself when it does not fit | In this layout the footer already rests in the card's bottom padding at the smallest gated sizes, so the card would scroll by a few pixels and show a scrollbar at sizes that fit today. Closing the card up was chosen instead; the residue is §4.1. |
| Move the one-screen layout's lower bound from 620px to 720px | It would hand a whole band of laptop windows the stacked, scrolling page. Too large a change of look for this pass. |
| Hold clAInk's log lines back until its report has played | Touches the order in which the log is drawn, which the parity harness and the resilience test read; a missed release of the hold would hide lines. Medium risk for a two-second effect. |
| Hold the stat cards' chips while a Friday dialog is open | Changes chip timing for every week with a dialog; the audit itself called leaving it defensible. |
| Replay the week-heading animation on a deal row whose stage changed | It would also play on every row each time the list is first drawn, and the layout gates measure boxes that would be mid-transform. |
| A sound or a line for reaching quota | Needs a new trigger outside the log director and a line the copydeck does not have. The green meter is a state, not an effect. |
| Prefer a local voice for the announcer | §4.14. |
| Shrink the ending's scene in windows 760 to 859px tall; drop the fade on the ending's backdrop; drop the memo's chapter line in short windows | Each trades an approved presentation for an edge (§4.2, 4.3, 4.6). |
| State the quota in dollars on the Closed card; spell out QBR and pp in the handbook; restore "sometimes with real damage" | New copy outside the approved copydeck, or no room in the handbook (§4.7). |
| Print "Exceptional nap" only for the best naps | An editorial choice of threshold (§4.4). |
| Spell out the Hail Mary's slot as well as its energy | The hint then needs three lines in the narrowest desktop window, where the bar has room for two. The cards give energy only; so does this hint. With no slot left the button is off and says so. |
| No-break spaces inside the stored chip text; word joiners after hyphens | The chip text is saved in runs and read by tests, and the same result is drawn without changing a stored character (item 25). A break after a hyphen is correct typesetting. |
| Edit the names out of the owner's documents | They are the owner's documents (§4.13). |
| A general refactor of the hint bar, the layout tiers or the copy engine | Out of scope. Each fix above is the smallest that holds. |

Nothing was added because capacity was available: no new mechanic, ending, currency, achievement, tutorial,
dependency, animation system, announcer line or save field.

## 6. Tests and evidence

### Final gate run (`npm run verify:release`, 29 of 29)

| Gate | What it holds | Result |
|---|---|---|
| build, build-test | the release build (no test hook) and the test build | ok |
| lint-rng | `Math.random` only in the cosmetic stream; test hooks only behind the build flag | 86 files under src (1 may read Math.random), 0 offenders |
| lint-copy | house style, PA lines ≤ 12 words, log lines ≤ 100 characters (≤ 150 for named lines) | 0 violations |
| lint-css | design tokens only; media queries from the allowed set | 0 findings |
| copy-check | every log tag has words, every word has a tag, no prose in the rules | ok |
| copy-render | every log line, every variant, every week band | 15360 renderings, 0 bad; 202 distinct sentences across 96 tags |
| copy-deck | the copydeck row by row | 357 rows applied as written, 23 noted with a reason, 0 open |
| fonts, notices | bundled fonts and third-party notices are current | ok |
| releases | 2.1, 2.0.1 and 1.21 are the files that shipped; `index.html` is the promoted one | 2.1, 2.0.1, 1.21 are the files that shipped; index.html is 2.1 |
| engine | `node --test test/engine` | 120 tests passed in 12 files, 5.4 s |
| audio | behavioural sound tests against a fake speaker | 15 tests passed in 1 files, 0.4 s |
| sim-smoke | bots finish every run legally on the frozen engines and the tree; invariants | all 12 checks passed, 21.1 s |
| equivalence | the frozen 2.1 rules and the tree, side by side, 22 policies × 20 seeds | the same run after every move; one decided correction |
| scenes | every frame of every scene's picture against v1.21 | 24 cases, 1,718 frames identical |
| fixtures | the generated save fixtures are what the baseline writes | 25 generated fixtures are exactly what the baseline writes |
| saves | every fixture, both ways in (page load and the Load button) | 37 fixtures, 73 loads, 1,442 moves compared |
| release | no hooks in the shipped bundle; a planted hook is inert; page = source, in six sessions and thirteen named states | 27 checks |
| offline | `file://`, no requests, plays to the end | 44 checks |
| firstday | onboarding memo and tour; nothing on the memo cut off | 27 checks |
| confirm | the confirmations and caption clean-up, by real presses | 37 checks |
| actions | what the page says a press will do is what it does (§1) | 104 checks |
| resilience | reloads, damaged saves, simultaneous choice + acknowledgement, storage denied | 80 checks |
| phone | touch screens 320–390 wide and sideways; a tablet's captions | 55 checks |
| keyboard | keyboard-only passes, tab order, Escape, focus | 8 stages, 98 key presses (84 of them Tab or Shift+Tab) |
| layout | one screen, nothing covered or clipped; clAInk's ad whole and its window taking only spare room; 10 states × 9 desktop sizes + phone | 708 checks, 0 failures |
| matrix | eight sizes × thirteen states, reduced motion | 1120 checks |
| released | the committed release file is exactly what the source builds | ok |

### Seeded equivalence with 2.1

`node test/engine/tools/equivalence.mjs --seeds 1000` on both seed sets (`qa/2.1.1/evidence/02-equivalence.txt`):

| Seeds | Policies | Runs | Moves made on both | The same run after every move | Differs | Proposals with nothing to gain: on offer in 2.1 |
|---|---|---|---|---|---|---|
| 1–1000 | 22 | 22,000 | 945,669 | 22,000 of 22,000 | 0 | at 11,989 steps of 5,330 runs |
| 5001–6000 | 22 | 22,000 | 948,022 | 22,000 of 22,000 | 0 | at 12,201 steps of 5,340 runs |

The 58 golden replays keep every mechanical digest, ending, week, closed amount and cash. The word digests of 10
were regenerated for item 24 (a single introduction; one reassigned deal).

### Balance: is it still the 2.1 candidate?

`node test/sim/run.mjs --policies all --seeds 1000` from seed 1 and from seed 5001, compared count for count with
the 2.1 records in `qa/2.1/balance/` (`qa/2.1.1/evidence/03-balance-vs-2.1.txt`; the full tables are in
`qa/2.1.1/balance/`). These are automated heuristics. They are not playtests.

| Strategy | Survival, seeds 1–1000: 2.1 → 2.1.1 | President's Club | Survival, seeds 5001–6000: 2.1 → 2.1.1 | President's Club |
|---|---|---|---|---|
| balanced | 55.1% → 55.1% | 42.8% → 42.8% | 53.1% → 53.1% | 41.8% → 41.8% |
| referral | 58.7% → 58.7% | 51.1% → 51.1% | 57.9% → 57.9% | 49.5% → 49.5% |
| expert | 58.9% → 58.9% | 47.3% → 47.3% | 58.1% → 58.1% | 45.6% → 45.6% |
| conference | 55.4% → 55.4% | 40.5% → 40.5% | 52.8% → 52.8% | 38.3% → 38.3% |
| claink | 47.9% → 47.9% | 36.6% → 36.6% | 45.0% → 45.0% | 33.3% → 33.3% |
| risk | 44.3% → 44.3% | 36.6% → 36.6% | 46.0% → 46.0% | 36.8% → 36.8% |
| caller | 40.6% → 40.6% | 25.9% → 25.9% | 42.0% → 42.0% | 28.3% → 28.3% |
| novice | 1.2% → 1.2% | 0.4% → 0.4% | 0.6% → 0.7% | 0.1% → 0.1% |

On both seed sets 21 of the 22 strategies are identical to 2.1 in every count the simulation keeps (endings, causes, attainment, cash, moves, action mix, warnings, events): the eight above except `novice`, and fourteen probes. The balanced heuristic is where the brief reported it: 55.1% survival and 42.8% President's Club, 53.1% survival on the held-out seeds.

### Other evidence

| What | Result | File |
|---|---|---|
| The `actions` gate run against the 2.1 release | 30 checks fail, then it stops where 2.1 has no confirmation | `evidence/04-actions-gate-on-2.1.txt` |
| The layout gate at 1366×657 and 1280×620, 2.1 against 2.1.1 | 2.1: 60 failures; 2.1.1: 0 | `evidence/05-layout-short-windows.txt` |
| 2.1 saves in 2.1.1 | 16 of 16 checks, eight sessions | `evidence/06-v5-save-compatibility.txt` |
| Release-file hygiene scan | §9 | `evidence/07-release-file-hygiene.txt` |
| Mutation check: planted mistakes in the rules | 55 of 58 caught; the 3 that survive are listed with the reason each changes nothing a test can see | `evidence/08-mutation-check.txt` |
| Self-tests: each browser gate given a planted fault | lint rules 20 of 20, 13 planted save faults, 16 layout checks and 5 keyboard breakages: every one reported | `evidence/09-selftests.txt` |
| The week's card and the hint bar measured at a range of window sizes; every hint counted for lines; a new player's memo and tour in short windows | End week inside the card at every size from 1180×657 up; 480 hints, none over two lines; the tour never scrolls the page | `evidence/10-card-hint-and-first-day-measurements.txt` |
| The release file itself from `file://`: the size matrix and the offline run | matrix 1,120 checks, offline 44 checks, all passed | `evidence/11-release-file-matrix-offline.txt` |
| The independent audit: every finding, its re-check and its outcome | §8 | `qa/2.1.1/audit/` |

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
- During the pass: the six ending cards and the first-run memo and tour at 1366×768 and on a phone; clAInk's
  workspace after a run at 1280×720, 1366×768 and 1440×900; clAInk's policy on a tablet; the top bar with a long
  caption on a tablet and a sideways phone; the week's card at 1025×768.

What I was looking for and found intact: the dark, flat, corporate dashboard with one accent colour; no gradient,
badge or illustration added; clAInk still the only gradient on the screen, in its own purple-to-cyan, with its own
type and rounded buttons; the ASCII scenes untouched. The two-line hint bar is the one change of proportion a
returning player will notice. Reviewing the pictures also found things the gates had passed: the stale hint under
a card that had just changed, and the two-line hint pressed against its borders.

Not judged: how any of it looks on a real laptop panel, a real phone, or in another browser engine.

## 8. The independent audit

Nine reviewers, one per area of the brief (action truth, dashboard, game feel, clAInk, the log and announcer, the
rest of the copy, endings, the new player, distribution), each working read-only on a frozen copy of the 2.1
builds: press the real game, measure, report what is already sound as well as what is not. Then nine more, one
per area, each given the first reviewer's findings with the instruction to doubt them: reproduce, decide whether
real and whether intended, say whether it is worth doing in a pass whose brief is restraint, name the smallest
fix, and report anything missed.

| Area | Findings | Re-check: worth doing yes / marginal / no | Found by the re-check | Changed | Withdrawn after the re-check | Left or covered elsewhere |
|---|---|---|---|---|---|---|
| Action truth (brief §1) | 10 | 3 / 5 / 2 | 2 | 10 | 0 | 2 |
| Dashboard (§2) | 9 | 3 / 3 / 3 | 2 | 7 | 2 | 2 |
| Game feel (§3) | 7 | 2 / 2 / 3 | 1 | 5 | 2 | 1 |
| clAInk (§4) | 7 | 4 / 2 / 1 | 2 | 5 | 0 | 4 |
| Proofread: log and announcer (§5) | 8 | 3 / 1 / 4 | 1 | 5 | 1 | 3 |
| Proofread: everything else (§5) | 10 | 3 / 3 / 4 | 2 | 8 | 0 | 4 |
| Endings (§6) | 8 | 4 / 3 / 1 | 2 | 6 | 0 | 4 |
| New player (§7) | 7 | 3 / 3 / 1 | 1 | 5 | 0 | 3 |
| Distribution (§9) | 6 | 1 / 2 / 3 | 0 | 3 | 0 | 3 |
| **All nine** | **72** | **26 / 24 / 22** | **13** | **54** | **5** | **26** |

What the second reading changed: it withdrew eight things I had already built (§5), it found thirteen things the
first reading had missed (among them the quota label rounding up at the decisive line, the coffee crash that End
week did not flag, and the lost first tap on a touch screen), and it corrected a proposal that would not have
shipped as written (a media condition the CSS lint refuses).
Several findings were reached independently by more than one reviewer and by me (the short-window overflow, the
stale hint, the minus-sign break, the Hail Mary's unstated cost).

Every finding, its re-check and its outcome is in `qa/2.1.1/audit/README.md`; the reviewers' results as returned
are beside it.

## 9. Distribution hygiene

Scan of `Tech_Sales_Trail_2.1.1.html` (`qa/2.1.1/tools/hygiene.py`; the hygiene audit of the 2.1 file agrees):

- **Network:** no `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `sendBeacon`, external script, stylesheet,
  image or font. The `offline` gate plays the file from `file://` with every request refused and counts none. The
  one thing that can leave the device is the announcer's line, when the browser reads it with an online voice
  (§4.14).
- **Links:** five URLs, all in the licence banner (the two font repositories and three licence texts). The game
  has no outbound link.
- **Test hooks:** none (`release` gate: no hook in the bundle, and one planted from outside is inert).
  `TST_AUDIO`, `TST_SCENES` and `TST_TOAST` are the game's own module names.
- **Diagnostics:** `console.error` only, on error paths (React's, and the game's error boundary). No `debugger`,
  no source map, no notes to self.
- **Personal or local traces:** no e-mail address, no home directory or host name, nothing shaped like a
  credential in the file. (The hygiene audit ran 20 credential patterns over the 394 files tracked at 2.1 and
  found none.)
- **Customer names:** none of the 57 account names is a real company's.
- **Third-party notices:** the file's header names exactly what is bundled (React, React DOM and scheduler, MIT;
  Inter and JetBrains Mono, OFL 1.1; Lucide, ISC, with the ten icons derived from Feather credited to it, MIT).
  `THIRD-PARTY-NOTICES.md` carries the licence texts and is current (`notices` gate).
- **The statement** asked for by the brief is in the handbook and the README.
- **Storage:** the game reads and writes only its own `tst-` keys in the browser's local storage.

Items for the owner's judgment are in §4.13 and §4.14.

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
