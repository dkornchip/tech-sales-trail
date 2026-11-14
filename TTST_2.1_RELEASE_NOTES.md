# Tech Sales Trail 2.1 — "Operation Final Coat"

One file: open `index.html` (or its identical copy `Tech_Sales_Trail_2.1.html`) in a browser and play. No install,
no server, no network. 2.1 was promoted to `index.html`, the file the public link serves, on the owner's
instruction; the 2.0.1 file is kept as shipped at `test/baseline/v2.0.1/index.html`.

2.1 is a polish pass. The job, the quota ($160,000), the thirteen weeks, the twelve actions, the Hail Mary, clAInk,
the six endings and their ASCII scenes are all still here. What changed is how fair the quarter is, how truthful the
screen is, how safe your save is, and how the company talks.

## What is new for players

### A fairer quarter
- **Pace follows a real quarter.** The game used to expect a thirteenth of quota every week from the first Friday.
  It now expects a slow start and a strong finish (2% by week 2, 18% by week 5, 46% by week 8, 79% by week 11), and
  the dashboard, the warnings and your manager all use that one curve.
- **Reviews look at your pipeline, not only your closed number.** Reviews still start in week 5 and can still end
  the run from week 6. A healthy board of live deals now softens an early review (it never counts as revenue, and
  never at the QBR), and a mid-quarter review cannot fire you at more than 12% in weeks 6–7, 20% in weeks 8–9 and 35%
  in weeks 10–12.
- **Your manager judges you against the same curve**, a little each Friday (at most 2 points either way), instead of
  marking you down every week until you had closed half of quota.
- **The QBR says one thing.** Under 70% of quota you are out, and the log no longer says you "dodged the axe" first.
  The politics firing at 100% (a manager below 25) is still rare and is now told apart from a performance firing.
- **Bonuses and penalties each keep their own clock.** A pricing choice, a security incident, a case study, a budget
  freeze, a conference and the full-funnel bonus used to share one number and one timer, so one could cut another
  short or wipe it out. Each now lasts exactly as long as it says, and the total is held to 30 points either way.
- **Friday events are dealt fairly.** An event that had nothing to act on used to take one of the two slots, and
  events written first in the list crowded out the rest. Chances are unchanged; who gets the slots is now fair.

### A screen that tells the truth
- "Closed this quarter" shows where you stand in words ("12 percentage points behind pace") and what Friday expects
  ("Expected by Friday: 36% of quota"), with a marker on the meter.
- Status chips show each effect with its own size and time left ("Close odds −6 pp · this week").
- Log lines show what really happened to your numbers: a meter that was already at its limit is not said to have
  moved.
- The Odds column says what it is: the chance of signing if you attempt a close.
- The handbook ("How it works") is rewritten from the live rules, so its numbers cannot drift from the game's.
- The ending card adds the company's verdict on your quarter and up to three distinctions your run actually earned.

### Fewer accidents
The game now asks before four things that cannot be taken back, and only those: starting a new run in the middle of
a quarter, the first Hail Mary of a run, a quad shot that is certain to end the run, and dismissing clAInk's offer
(minimizing it never asks, and keeps the offer). "No" changes nothing.

### Saves you can trust
- A save that cannot be opened is never played and never overwritten. A dialog says so and offers only what can
  really be done: a new run, or another valid save if you have one. The unreadable one is set aside, not deleted.
- Loading a damaged manual save leaves the run on your desk exactly as it was.
- Runs saved by 2.0 and 2.0.1 (and earlier) open in 2.1, including a choice you had not answered yet.
- A choice or a word from your manager that is waiting for an answer survives a reload, and is asked exactly once.

### The writing
Every line in the game was rewritten from the approved editorial copydeck: the onboarding memo, the log, the
announcer and HR, the event dialogs, the handbook, clAInk's ad, workspace, invoices and strikes, the endings and
their story cards. Shitcorp is an ordinary company that believes it is exceptional; the joke is how it talks, never
that you are foolish for trying to make a living. Routine lines now have a few wordings and never repeat twice
running, and each chapter of the quarter (The Honeymoon, Alignment, The Reckoning, The Siege, Judgment Day) has its
own memo line.

### Sound
- A line that matters (a cash warning, HR) is no longer lost because the announcer was making small talk: the small
  talk is cut off, never talked over.
- The announcer's caption leaves with the run it belonged to when you load or start over.

## What did not change
- Quota, schedule, salary, rent, commission, action costs, close odds, coffee, the Hail Mary's odds and every clAInk
  price and probability are as they were in 2.0.1.
- The boot screen, the six ASCII endings (picture for picture), keyboard shortcuts, the phone layout, captions,
  mute, reduced motion and offline play.
- It is still one HTML file (556,515 bytes; 2.0.1 was 518,108).

## Known limitations
- **Balance is tuned against bots, not people.** In 1,000 simulated quarters per strategy, a competent balanced
  heuristic survives about 55% of quarters (2.0.1: 34%) and reaches President's Club in about 43% (2.0.1: 29%). The
  studio's goal for survival was 60–80%. The brief's balance levers are all applied; closing the rest of the gap
  would need changes the brief ruled out (quota, schedule, the under-70% rule). Human playtests should decide.
- **Chromium only.** Every browser test ran in Chromium. Firefox is not installed in the build environment and is
  unverified.
- **2.1 saves are 2.1's.** 2.1 reads older saves and keeps its own under new keys, so the 2.0.1 page beside it keeps
  its run; 2.0.1 cannot open a run saved by 2.1.
- **The announcer's voice depends on your device.** Captions carry every line when there is no voice.
- **Left out on purpose** (optional in the copydeck): the manager's context cues, the alternate office posters and
  clAInk's marketing footnote. The chapter name beside the week is hidden on phones, where there is no room for it.

## Files
- `Tech_Sales_Trail_2.1.html` — the game.
- `TTST_2.1_QA_REPORT.md` — what was changed, measured and tested, with the evidence on file under `qa/2.1/`.
- Source in `src/`, tests in `test/`, `npm run verify` runs every gate.
