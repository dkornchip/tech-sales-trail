# The independent audit of 2.1, its re-check, and what was done about each finding

Before anything was changed, the frozen 2.1 release and test builds were audited by nine separate reviewers, one per
area of the brief. Each pressed the real game, measured, and returned what it had verified as sound, its findings
with evidence and a proposal, and what it could not check. Every finding was then given to a second reviewer whose
instruction was to doubt it: reproduce it, decide whether it is real and whether it was intended, say whether it is
worth doing in a pass whose brief is restraint, name the smallest fix, and report anything the first reviewer missed.

Each area's files are here as they were returned: `<area>.json` (the audit) and `<area>-recheck.json`. The reviewers'
own scripts, timelines and pictures were scratch files and were not kept; paths that begin `test-results/audit/` in
the results point at them. The reviewers saw only the 2.1 build, so some findings describe things this pass had
already changed by the time they came back.

"Re-check" below is the second reviewer's verdict on whether the change was worth making. Where the outcome goes
against it, the QA report (`TTST_2.1.1_QA_REPORT.md`) says why.

## truth

truth: action clarity and player feedback (twelve actions, Hail Mary, End week: rules against card, count badge, hint bar, confirmation, handbook)

| # | Finding | Kind | Re-check | Outcome |
|---|---|---|---|---|
| 1 | With nothing eligible, Discovery, Demo marathon and Close deals still buy a skill and a full-funnel tick, Proposals buys only the tick, and all four hints say only what is lost | misleading | marginal | Changed: the card says `skill only` or `no deals`; the hint keeps the copydeck's sentence and adds its training note. The full-funnel mark is named only for Proposals, where it is all a press can buy (the re-check argued against naming it for the other three). Proposals with nothing left to gain is refused (QA report §2) |
| 2 | A zero count shows nothing on the card, so by touch or number key the slot is spent before any warning can be read | misleading | marginal | Changed: the card says it beside the cost, so touch and number keys see it before the press |
| 3 | The Hail Mary's cost (one slot, 10 energy) is stated nowhere in the game | defect | yes | Changed: the hint gives the energy, as the cards do. The slot is not spelled out (QA report §5) |
| 4 | Only the lethal quad shot is flagged; other presses that are certain to end the run look ordinary | misleading | yes | Changed: marked `Ends the run`, said in the hint, confirmed first; also a Friday whose rent or coffee crash is certain to end the run |
| 5 | A Conference run does not count as lead generation for the full-funnel rule, and the handbook says 'lead generation' | misleading | yes | Changed: the handbook names what counts, and that a conference does not |
| 6 | The idle hint keeps naming an action that is blocked, and a number key on a blocked action says nothing | polish | marginal | Changed: the idle line says what the named action takes when there is not the energy; a number key on an action that is off goes to its card |
| 7 | CRM cleanup's 'dead leads' can be Qualified deals of any size and mood, and nothing shows which ones | polish | marginal | Changed in part: the hint gives the dollar value of the dead leads. The names are not listed and the log line has no chip |
| 8 | Recharge and Quad shot do not say they take a slot, on the card or in the hint | polish | no | Changed for the quad shot only (the new-player audit showed the trap); Recharge left as it was, as the re-check argued (its slot is in the tour) |
| 9 | The stale-lead and demo-backlog rules are in the README but not in the game | polish | marginal | Changed: one sentence in the handbook's Pipeline row |
| 10 | Hints quote the rule's full amount when a meter cannot take it | nit | no | Left (QA report §4) |
| + | End week is not flagged when the coffee crash is certain to reach 100 stress, and from 80 stress the crash figure is not on the Stress card either | found by the re-check | | Changed: the stress card keeps the crash's line from 80 stress and End week says when the crash is certain to end the run |
| + | In desktop windows 1,025 to 1,198 px wide the cost line of three cards ends in an ellipsis; the Conference run card loses '2 slots' | found by the re-check | | Left, listed (QA report §4): cost lines are cut under about 1,200px of width, as in 2.1 |

## dashboard

dashboard: visual refinement of the main screen at laptop sizes (1280x720, 1366x768, 1440x900, 1536x864, 1920x1080), frozen release build 2.1

| # | Finding | Kind | Re-check | Outcome |
|---|---|---|---|---|
| 1 | Desktop windows shorter than about 746px: the week's card overflows. At 1280x720 Hail Mary and End week hang through the card's border; below 717px they are cut off or off screen, and nothing scrolls | defect | yes | Changed by closing the card up in proportion to the window; a scrolling card and a moved breakpoint were rejected (QA report §5); the narrow-and-short residue is listed (§4) |
| 2 | The hint bar keeps the numbers from before a press while the pointer or focus stays on the button; on Quad shot it goes on describing shot 1 while the card shows 45% heart risk | misleading | yes | Changed: the bar reads its words from the run as it is, for the twelve actions, the Hail Mary and End week |
| 3 | Hints that need two lines are squeezed into the one-line hint bar: the text sits 1px from its borders at 1280 and 1366, 2px at 1440 and 1536 | polish | marginal | Changed: the bar is two lines tall whatever it says |
| 4 | The cash warning breaks between the minus sign and the amount: 'Collections at −' / '$1,500 cash' at 1366 and 1280 | polish | yes | Changed: a minus sign stays with its amount |
| 5 | The Cash card's third line sits 8px above the same line in the three cards beside it | polish | marginal | Changed |
| 6 | Meter tracks are effectively invisible (1.08:1), so the quota bar has no visible end to read the fill and the pace mark against | polish | marginal | Changed: the tone the past weeks' ticks use |
| 7 | The dashboard never states the quota: the Closed card gives percentages only | polish | no | Left for the owner (QA report §4) |
| 8 | With two effect chips showing, 'PIP level N' is folded into '+N' at 1440 wide and below | nit | no | Not changed: tried, then withdrawn after the re-check (it only swaps which chip is folded) |
| 9 | End week and Hail Mary have no pressed state: pressed looks exactly like hovered | nit | no | Not changed: tried, then withdrawn after the re-check (the class is shared by every dialog and tour button) |
| + | The End week hint goes stale too: the auditor reported it as not affected | found by the re-check | | Changed (with finding 2) |
| + | A new player's first day in a short window ends with the page pushed up 60px: the top bar is off screen and cannot be scrolled back | found by the re-check | | No longer happens: with finding 1 fixed the tour has nothing to scroll (measured at 1366x657, 1366x625, 1280x620) |

## feel

feel: microinteractions and game feel (feedback on revenue, stage changes, won/lost, Friday, warnings, Club, clAInk strikes)

| # | Finding | Kind | Re-check | Outcome |
|---|---|---|---|---|
| 1 | Reduced motion hides every change chip: they sit at opacity 0 for their whole 1.7 s | defect | yes | Changed: the chips show, still, with reduced motion |
| 2 | A signed deal is the quietest line in the log: grey icon, while lost deals are red and warnings amber | polish | marginal | Changed: a signing's line is toned good in the log and in the phone's notice |
| 3 | The announcer marks CRM cleanup every time and a $40,000 signing never (the line is drawn at $45,000) | polish | no | Not changed: tried, then withdrawn after the re-check (the line has been at $45,000 since v1.14 and is the audio suite's contract; a tuning preference, not a defect) |
| 4 | clAInk's staged strike report is given away about two seconds early by the log, the phone notice and the change chips | polish | yes | Changed for the phone's notice only; holding the log back was rejected (QA report §5) |
| 5 | Reaching quota is not marked: at 106% the meter is the same grey bar and the moment is an ordinary close | polish | marginal | Changed: the quota meter is green from 100% (a state; no sound, no line) |
| 6 | On a Friday with a choice, the week's change chips play dimmed under the dialog and are gone before it is answered | polish | no | Left (QA report §4) |
| 7 | A stage change is applied in one frame with no mark on the rows that moved | nit | no | Not changed: a pip fade was tried and withdrawn after the re-check (the change is already shown four ways in the first frame) |
| + | The stat card rounds the share of quota up across the lines that decide the ending: it says 100% (or 70%) and the QBR then says 99% (69%) and ends the run on that | found by the re-check | | Changed: the label never rounds up onto 70%, 80% or 100% |

## claink

clAInk.io (id: claink): the advertisement, the two-step purchase with its policy step, the agent workspace, the two minimized bars, and what a player can learn of the financial terms before buying. Scratch work is in test-results/audit/claink/.

| # | Finding | Kind | Re-check | Outcome |
|---|---|---|---|---|
| 1 | What a run costs is never stated before the first bill: not in the ad, the policy step, the handbook, or on the Run button | misleading | yes | Changed, in the policy step the player accepts: the rates, and how many outcomes a run bills. The handbook row and the Run button's note are as they were |
| 2 | On laptop-height windows, pressing Run agents lands the strike card, 'Closed: $0' and the Friday estimate out of sight, and the workspace does not follow | defect | yes | Changed: the workspace follows a run to its result and returns to its top when the week turns |
| 3 | End week's Friday preview lists salary and rent but not the clAInk invoice | misleading | yes | Changed: End week names the invoice |
| 4 | The handbook no longer says a strike can do damage, and words the true-up less plainly than 2.0.1 did | misleading | marginal | Left for the owner (QA report §4): the true-up is now plain in the policy; that strikes 1 and 2 can do damage is still not said before the first incident |
| 5 | 'A live deal may walk' at two strikes, but the rule always takes your most advanced deal | misleading | marginal | Changed with the copydeck's own two wordings: `a deal walks` when there is one, `a live deal may walk` when there is none |
| 6 | At 1366x768 and 1280x720 'Cancel seat' and the usage line sit below the workspace's fold once any report is showing | polish | no | Covered by finding 2 |
| 7 | When the workspace scrolls it shows the browser's default 15 px scrollbar, the only unstyled one in the game | nit | yes | Changed |
| + | The audit's smallest desktop window is taller than a real small laptop's: at 1366x650 the workspace has about 220 to 255 px under its title bar | found by the re-check | | Covered: the follow is checked at 1366x650 and rests at the card's top when the result does not all fit |
| + | The policy step's three terms are a list with no markers, and on a phone they run together | found by the re-check | | Already done in this pass (list markers) |

## prooflog

prooflog: editorial proofread of the activity log, its variants, the week chapters and the office announcer (src/copy/log.js, engine.js, pa.js; src/engine/audio/voice.js, director.js, tagmap.js), read as rendered in the frozen release build

| # | Finding | Kind | Re-check | Outcome |
|---|---|---|---|---|
| 1 | After a clAInk run that worked, the announcer speaks and captions the failure quip under the manager's dialog | defect | marginal | Changed, the smaller way the re-check proposed: no announcer line for the warning after a run that worked (no new copy) |
| 2 | Stat chips break in the middle of a chip, and the wrapped row loses its alignment | polish | yes | Changed without altering the stored text: each chip is drawn whole |
| 3 | A single referral is described as “One of them” | defect | yes | Changed |
| 4 | “1 of your largest deal” | defect | yes | Changed |
| 5 | Avoiding a repeat always lands on the first alternative, so its joke returns every other time | polish | no | Not changed: tried, then withdrawn after the re-check (imperceptible, and every seeded run would read differently) |
| 6 | “Exceptional nap” is the usual nap | polish | no | Left for the editor (QA report §4) |
| 7 | The no-repeat check is blind when only an account name or a source label differs | polish | no | Left (QA report §4) |
| 8 | The last Friday still quotes next week's signing odds | nit | no | Left (QA report §4) |
| + | With reduced motion, the ending's announcer line never reaches the ending dialog; on a phone it is not shown anywhere | found by the re-check | | Changed: with reduced motion the ending's line is captioned under the ending's title |

## proofui

proofui: editorial proofread of everything that is not the activity log (dashboard labels, cost lines, hint bar, Friday dialogs, handbook, onboarding and memo, clAInk ad / workspace / reports / strikes, endings and scene captions, confirmations, recovery). Frozen release build 2.1.0 at 1366x768 and 390x844 touch, plus the test build for scripted clAInk runs. Read-only; scratch in test-results/audit/proofui/

| # | Finding | Kind | Re-check | Outcome |
|---|---|---|---|---|
| 1 | The Cash warning and three hints let a minus sign, a number or a separator come loose at the line end | polish | yes | Changed for the cash warning, End week's rent and every amount and range; the politics and CRM hints still wrap between a number and its word on a phone (left) |
| 2 | After a run that worked, the manager's warning is announced with the quip for a run that failed | misleading | marginal | Changed (as prooflog 1) |
| 3 | The Hail Mary takes a slot and 10 energy and nothing on the page says so | misleading | yes | Changed: the energy (as truth 3) |
| 4 | Recovery dialog: the Open buttons are cut off on small phones | defect | yes | Changed: the buttons wrap |
| 5 | Recovery dialog: «It will be kept aside» reads as the run you are about to start | misleading | marginal | Changed: the reassurance comes first |
| 6 | On a tablet-width window the top bar cuts the announcer's longer lines, punchline first | polish | marginal | Changed: up to three lines in the top bar on stacked layouts wider than a phone |
| 7 | The End week hint promises energy and relief that a nearly full or nearly empty meter cannot take | nit | no | Left (QA report §4) |
| 8 | On a phone, three headings leave one word on their last line, and two effect lines part a number from its word | nit | no | Left: nits |
| 9 | Two hyphenated terms break at their hyphen: «true-» / «up» at 1366x768 and «out-» / «of-office» on a phone | nit | no | Left: a break after a hyphen is correct |
| 10 | Three one-character inconsistencies that follow the copydeck to the letter (for the editor to rule on) | nit | no | Left for the editor (QA report §4) |
| + | On a phone the first tap on End week (upper part of the button) or on Hail Mary shows the hint instead of acting; 2.0.1 did not do this | found by the re-check | | Changed: on a touch screen the footer's buttons act on the first tap |
| + | On a phone held sideways (667x375, a matrix size) the top bar cuts 33 of the 54 announcer lines, not only the long ones | found by the re-check | | Changed (with finding 6): checked at 667x375 and 740x360 |

## endings

endings: ending presentation (six endings: transition, identity, summary, verdict, distinctions, replay)

| # | Finding | Kind | Re-check | Outcome |
|---|---|---|---|---|
| 1 | Barely missed: the cutscene rounds the share of quota up (it can say QUOTA 100%), the card floors it | misleading | yes | Changed: the scene is given the floored share |
| 2 | Ascension: the card's quad-shot count leaves out the shot that ended the run | defect | yes | Changed: the card counts the shot that ended the run |
| 3 | 1366x768: the finished card is taller than the window, so the scroll to the paperwork slices the first line or takes the title off screen | polish | marginal | Left (QA report §4): the fix trades the size of the scene |
| 4 | Quad-shot confirmation to Ascension: the dashboard flashes at full brightness between the two dialogs | polish | marginal | Left (QA report §4) |
| 5 | Reduced motion: the ending opens already scrolled to its end, so on a phone or a 768px window the title and the company's line are never shown | polish | yes | Changed: with reduced motion the ending opens at its first line |
| 6 | Reduced motion: the announcer's ending line is captioned behind the dialog on a desktop and not at all on a phone | polish | marginal | Changed (as prooflog m1) |
| 7 | A small phone on its side (667x375): the card's numbers are cut with an ellipsis ('$171,3...') | polish | yes | Changed, with the condition the re-check found the CSS lint allows |
| 8 | Desktop: the announcer's caption from the move before the fatal one stays in the top bar behind the ending | nit | no | Left: the re-check judged it immaterial |
| + | Reduced motion: a second Enter after the Enter that ended the week starts a new run, so the ending is never seen and its autosave is overwritten | found by the re-check | | Changed: with reduced motion New run does not answer for the ending's first 0.7 s |
| + | 844x390, a phone on its side: the two longest account names are cut on the Largest deal tile | found by the re-check | | Covered by finding 7 |

## newplayer

New-player experience (newplayer): a first run on the frozen 2.1 release, at 1366×768 with a mouse and at 390×844 by touch

| # | Finding | Kind | Re-check | Outcome |
|---|---|---|---|---|
| 1 | The hint bar keeps what it said before the press while the pointer (or the focus) stays on the button | defect | yes | Changed (as dashboard 2) |
| 2 | Nothing says that Collections ends the run, and a conference can take you there in one click | misleading | yes | Changed: `Ends the run` on the card and a confirmation; said on the cash card and End week for rent; the handbook's Cash row ends `That ends the run.` |
| 3 | Full-funnel week: a conference is not “lead generation”, and the handbook does not say so | misleading | yes | Changed (as truth 5) |
| 4 | With no energy for it, the idle hint still names the action | polish | marginal | Changed (as truth 6) |
| 5 | QBR is never spelled out in the game | nit | no | Left (QA report §4): the handbook has no room at 1440x900; the README defines it |
| 6 | “pp” is never spelled out, and the first Friday can ask for a choice in it | nit | marginal | Left (QA report §4) |
| 7 | A quad shot takes a slot, and neither its card nor its hint says so | nit | marginal | Changed |
| + | At the usual laptop browser sizes the onboarding memo does not fit, and the pinned button cuts a line in half | found by the re-check | | Left, listed (QA report §4): the memo needs a window 664px tall |

## hygiene

hygiene: public distribution hygiene of the frozen release build (test-results/audit/build/release.html, version 2.1.0) and of the repository as it would be published

| # | Finding | Kind | Re-check | Outcome |
|---|---|---|---|---|
| 1 | The game carries no fiction or non-affiliation statement; the only one is the last line of the README, and it says neither 'independent' nor 'unaffiliated' | polish | yes | Changed: the statement is in the handbook and the README |
| 2 | In Chrome and Edge the announcer picks an online speech voice over the local ones, so its lines are synthesized by Google's or Microsoft's service | defect | marginal | Not changed in the game (the owner's call, and nobody could hear it here); the README no longer says the PA is synthesized in the page (QA report §4) |
| 3 | Two tracked documents name five people with job titles | misleading | no | Left for the owner (QA report §4): the names are in the owner's own documents |
| 4 | Handed on by itself, the game file lacks one copyright notice (Feather, for 10 of its 56 icons) and every licence text | defect | marginal | Changed for the copyright notice (Feather is credited in the file's header); carrying the licence texts in the file is the owner's call |
| 5 | The game has no licence or copyright line of its own | polish | no | Left for the owner (QA report §4) |
| 6 | THIRD-PARTY-NOTICES.md does not name scheduler, which the file's own header lists as bundled | nit | no | Changed |
