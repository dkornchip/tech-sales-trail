# Tech Sales Trail 2.1.1 — "Operation Gold Master"

One file: open `Tech_Sales_Trail_2.1.1.html` in a browser and play. No install, no server, no network.

**This is a release candidate.** It has not been promoted: `index.html`, the file the public link serves, is still
2.1, and stays so until the owner says otherwise. 2.1 (`Tech_Sales_Trail_2.1.html`), 2.0.1 and 1.21 are kept in the
repository exactly as they shipped.

2.1.1 is the last polish pass before public release. It changes how clearly the game speaks, not how it plays. The
quota, the thirteen weeks, the twelve actions, every probability and reward, the pace curve, the firing rules, the
economy, clAInk's prices and the six endings are the ones 2.1 shipped with. A run saved by 2.1 opens and carries on;
the save format is the same.

## What is new for players

### A card says what the press would buy
- **When an action has nothing to work on, its card says what is left.** Discovery, Demo marathon and Close deals
  still train their skill, so the card reads `skill only`, and they stay available: practising with an empty stage
  is a legitimate way to play. Proposals trains nothing, so its card reads `no deals`.
- **One press that bought nothing is now refused.** Proposals with no demoed deal, in a week where your
  proposal-or-close work was already counted, used to take a slot and 25 energy and give nothing back. The card is
  now off and says why. (Earlier in the week the same press still counts toward a full-funnel week, and is still
  allowed.) This is the only change to what the rules allow.
- **A press that would end the run says so and asks first.** If the stress an action adds would reach 100, or what
  it costs would take your cash to Collections, the card reads `Ends the run`, the hint says exactly why, and a
  confirmation stands between you and it. "No" changes nothing.
- **A Friday that would end the run says so before you press End week:** rent that would trigger Collections, or a
  coffee crash that would take your stress to 100. End week's preview also lists the clAInk invoice, which it used
  to leave out.
- **The quota number is exact where it matters.** At $159,500 of $160,000 the card used to say 100%, and the
  quarterly review then said 99%. The card no longer rounds up onto 70%, 80% or 100%.
- **Hints say what they used to leave out:** what the Hail Mary costs, that a Prospect blitz adds stress, that a
  quad shot takes a slot, and how many dollars of pipeline CRM cleanup would remove. (A lead or qualified deal
  counts as "dead" when it is skeptical or five weeks old, whatever it is worth.)
- **The hint keeps up with you.** After a press, with the pointer still on the card, the hint bar now describes the
  board as it is. It used to go on describing the board from before the press.
- **The line under the actions** no longer points you at work you have no energy for; it says what that work takes.
  Pressing the number key of an action that is off takes you to its card, which says why it is off.
- **The handbook** now names what counts toward a full-funnel week (a conference does not), says when stale leads
  and a backlog of qualified deals start to cost you, and says that Collections ends the run.

### A screen that fits your laptop
- **End week stays on the screen.** On a laptop with the browser's toolbars showing (a window about 620 to 750
  pixels tall) the week's card was taller than the window, and that page does not scroll: End week and the Hail
  Mary hung out of the card, or off the bottom of the screen. The card now closes up to fit.
- The hint bar has room for a two-line hint, and nothing moves under it when the hint changes.
- The stat cards' meters show how far there is to go, not only how far you have come; the quota meter turns green
  when you reach quota; the four cards line up.
- A minus sign no longer ends a line with its amount on the next one.

### Phones and tablets
- **The first tap on End week or the Hail Mary works.** On a touch screen the hint used to grow under your finger
  between press and release, and a tap near the top of the button did nothing.
- **Captions are shown whole** on a tablet held upright and a phone held sideways. The longer lines used to be cut
  with an ellipsis, and with the sound off the caption is the announcement.
- On a phone held sideways, the ending card's numbers are no longer cut ("$171,3…").
- If a saved run cannot be opened, the dialog's buttons now fit a small phone, and it says first that the damaged
  run is kept aside, then what you can do.
- The notice at the bottom of the screen no longer gives away the result of a clAInk run two seconds before
  clAInk's own report gets there.

### Good news looks like good news
- A signed deal's line in the log is marked in green, as a lost deal's is in red.
- **If your device asks for reduced motion,** the small "+$40,000" chips on the stat cards now show. They were
  being drawn invisibly.

### clAInk tells you the bill before you sign
- The policy you accept now states the recurring costs, in the game's real numbers: the fee per run, the price per
  billable outcome and how many a run bills, what an idle week costs, that overages may apply, what the
  third-strike true-up takes, and what cancelling costs. Before 2.1.1 none of the recurring rates was stated
  anywhere until the first invoice.
- **You see what a run did.** On a laptop the agent workspace is shorter than a run's report, and it used to stay
  at the top: the strike card, the week's estimate and "Cancel seat" landed out of sight. It now follows the run to
  its result, and goes back to the top when the week turns.
- At two strikes the warning says a deal walks, not that one may: the third strike always takes your most advanced
  deal.
- Nothing about clAInk's prices, odds or strikes changed.

### Endings
- The "Barely missed" scene no longer says QUOTA 100% above a card that says 99%.
- The Ascension card counts the quad shot that ended the run.
- **With reduced motion,** an ending now opens at its title instead of scrolled to its end, shows the announcer's
  line under the title, and cannot be skipped by pressing the same key twice.

### A proofread
- After a clAInk run that actually worked, your manager's dialog opens "Nice week. ChatGDP do that?" and the
  announcer used to say his other line over it. The announcer now leaves that dialog to speak for itself.
- "Referrals: 1 introduction. One of them is a whale." now reads "It is a whale."
- "1 of your largest deal" is "1 of your largest deals".
- The small chips under a log line are no longer broken in the middle when the row wraps.

### About
The handbook ("How it works") now carries this statement: *Tech Sales Trail is an independently developed fictional
satire of the technology sales industry. It is not affiliated with or endorsed by any employer or technology
vendor.*

## What did not change
- The balance. The 2.1 balance candidate is frozen until people have played it. The simulated quarters come out
  exactly as they did in 2.1 for 21 of the 22 strategies tested; the 22nd is a deliberately poor "novice" bot that
  used to press the empty Proposals card described above (see the QA report).
- The save format, and every older save's way in.
- The writing, apart from the lines listed above. The approved copydeck is still the authority.
- The six ASCII endings and the boot screen, frame for frame.
- The office announcer's lines and when they are said, apart from the one case under "A proofread".
- The live page.

## Known limits
- Tested in Chromium only. Firefox, Safari and real phones were not available where this was built and are
  unverified. The announcer was not heard: the text it is given was compared with its captions.
- No human playtest has been run on 2.1.1. The simulations are heuristics, not people.
- In a desktop window narrower than about 1,180 pixels and shorter than about 660, the week's card can still be
  taller than the window (the stat cards wrap there). End week stays reachable; it can hang below the card's edge.
  Below 620 pixels of height, and at 1,024 pixels of width or less, the page stacks and scrolls as before.
- In a window under 664 pixels tall the onboarding memo scrolls inside its dialog, with its button pinned.
- In Chrome and Edge the office announcer may be read by an online voice, which means the browser sends its lines
  to a speech service. Switching "Office announcer" off keeps everything on the device. Whether the game should
  prefer a local voice is the owner's decision (it changes how the announcer sounds).

Details, evidence and everything that was looked at and deliberately left alone: `TTST_2.1.1_QA_REPORT.md`.
