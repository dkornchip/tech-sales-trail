# Changelog

## v1.21 — one screen, a smaller ad, a shorter offer, a clearer warning

### Changed: the whole game fits a 16:9 desktop display, with no page scrolling
- On a two-column display at least 620px tall, the page is one screen: the header keeps its size and the two panels share the rest of the height. The activity log and the deal list scroll inside their own boxes; the Quarter Map spreads its stat cards and action buttons over the height it has, with End Week pinned to its bottom edge. The layout also uses the width of a wide screen (it was capped at 1,400px). A window that is too short for the Quarter Map's content scrolls the page as before.
- Checked headless: at 1920×1080, 1920×950 (a browser window on a 1080p display), 1536×864, 1366×768 and 1280×720 the page height equals the viewport height, with or without deals on the board and with the clAInk ad up or minimized. Phones and tablets keep the stacked, scrolling layout.
- On a desktop display the clAInk ad no longer reserves page space under itself (that reserve is what made the page scroll). It stands at most 60% of the screen tall and scrolls inside itself beyond that, and the activity log keeps a spacer at the end of its own scroll so its last entries can always be scrolled clear of the ad.
- A roomy display (1500×900 and up) gets slightly larger type on the stats, actions, deals and the log.

### Changed: the clAInk ad minimizes
- The ad has a – button next to its ×. Minimized, it's a pill in the same corner: the clAInk mark, the name and the deadline ("Pilot pricing ends Week 3", or "ends this week" in week 3), with expand and close buttons. Esc minimizes the open ad (on the policy step, Esc goes back to the pitch first). Focus follows the button you used, and the rest of a double click can't land on the game behind it.
- Minimized is a UI preference, like the workspace's: it survives a reload, and a new run (New Game, or New Run after an ending) pops the ad up expanded again. Short screens (landscape phones) start with the pill.
- × still turns clAInk off for the run.

### Changed: the pilot offer ends after week 3
- The ad now says "Pilot pricing ends Week 3" (it was week 10). An ad nobody answered expires at End Week of week 3 ("⏳ clAInk's pilot pricing ended. Offer gone.") and disappears for the rest of the run. The fine print and the Rules say so too.
- Saves made past week 3 with the ad still up load with the offer expired.

### Changed: "Always on ChatGDP?" is a warning event
- The first time your manager notices clAInk, it opens as an event like any other, after the run's report has played: "👔 Always on ChatGDP?" — "Always on ChatGDP, huh? That's not writing. Improve your writing skills, or management will start intervening in your deals. Consider this your warning." (After a run that actually worked: "Nice week. ChatGDP do that? Enjoy it. Improve your writing skills, or…".) You acknowledge it with "…Noted, boss".
- The log line carries the warning too: "👔 'Always on ChatGDP, huh?' -9 manager. Warning: improve your writing, or he steps into your deals." The workspace's manager note reads "Work on your writing, or I step in on your deals."
- The PA reads the manager's line when the dialog opens (the workspace no longer reads it at the same time). The Writing Lesson (the second notice onward, when he takes a deal) is unchanged.
- Odds and numbers are unchanged: the 25% notice chance, the -9 manager hit, and the yoink from the second notice on are all v1.19's.

### Changed: the background
- A slight touch-up of the backdrop: a second, finer hatch, a dot weave and a soft vignette over the still gradients. Painted once like the rest of the background: no animation, no blur, no blend modes.

## v1.20 — clAInk goes enterprise, the GPU gets a day off

### Fixed: the game no longer runs your GPU like a jet engine
- The main screen ran 65 animations that never stopped on a fresh run, and more once deals were on the board:
  - three 55vw aurora blobs drifting under a 70px blur with a screen blend
  - a scrolling synthwave grid and 28 floating particles
  - a spinning conic border on both panels and on the clAInk ad
  - a shimmering title, a breathing chip, floating badges, a pulsing End Week
  - a drifting sheen on every stat and scrolling stripes on every bar
  - on every deal you added, a glowing or wobbling mood pill

  Most of these can't run on the compositor, so the browser repainted large parts of the screen every frame. On top of that, every mouse move rewrote a style on both panels (for a cursor glow and a spotlight), and a full-screen noise layer sat over everything.
- Now nothing loops on the main screen. The look is the same, painted once: soft static blobs, a still grid, corner-lit panel borders, static glows. Entrances, pops and the hover shine still play. End Week pulses three times when you're out of slots, and a stat bar that turns red pulses three times.
- Dialogs, the boot screen and the clAInk ad no longer blur what's behind them. The page background no longer repaints the whole page on every scroll. The button shine moves by transform.
- Once an ending's timeline has played, it ticks at the 20 fps it draws at, and after 12 seconds it settles on its last frame (Replay restarts it). The boot standby screen ticks at 20 fps instead of every display frame.
- Rendering work, measured with Chromium traces (headless, software raster) over 3-second windows:

| Situation | v1.19 | v1.20 |
|---|---|---|
| Idle main screen, clAInk ad up | 65 endless animations, 1,158 raster tasks (3.4 s) | 0 |
| A dialog open (Rules) | 708 raster tasks (1.7 s) | 0 |
| clAInk workspace after a run | n/a | 0 |
| Boot standby screen | 759 raster tasks (2.2 s) | 30 (4 ms) |
| An ending, 14 s in | 570 raster tasks (1.4 s) | 59 (27 ms), then 0 once it settles |
| Mouse sweeping across the panels (2.7 s trace) | 1,112 raster tasks (2.5 s), about 8 fps | 736 (0.55 s), about 50 fps |

### Changed: clAInk is a real enterprise vendor now
- No more startup begging for a Series A, no founders at an offsite, no rug pull. clAInk is an enterprise agentic platform on pilot at Shitcorp, with a thesis and a use case: "Your reps sell. Our agents do everything else." Its agents research accounts, write the outreach and advance your deals. Outcome-based pricing: you pay for every outcome, plus the tokens it took to get there. SOC 2 Type II, SSO, human-in-the-loop (optional). Fine print: "Pilot results: 1 in 5 agent runs closed real revenue. The other 4 delivered outcomes."
- Activating a seat ($500) first shows the Shitcorp AI Use Policy. Screen readers hear it with the Accept and Not now buttons, and on landscape phones it fits without covering the ad's ×:
  - the seat, the tokens and every "outcome" come out of your commission
  - a run that closes $0 earns a strike from the AI Governance Council
  - strike 3: seat revoked, plus the token true-up
- **Three strikes replace the red flags and the Trust & Safety meter.** Three boxes in the workspace, and each strike is filed by someone at Shitcorp, with a reason:
  - a run that only wasted money: Finance ("5.6M tokens. $0 closed. Please explain, in fewer tokens."), IT Security (it asked for admin on the CEO's inbox, 4,000 times), Procurement (it tried to buy itself a second seat), HR (it nominated itself Rep of the Month), Facilities, Legal, RevOps or the CRO's office
  - a run that did damage names it: Marketing Ops (24 "quick follow-ups" in an hour, your best deal fled), Legal (a negotiation sub-agent offered 45% off, in writing), IT Security (it "shared context" with Scheisskorp's agent, two deals gone), Customer Success (it auto-upgraded a customer to the 3x tier, they churned, commission clawed back)

  The note under the boxes says what the next strike costs. At two strikes it works out where the true-up would leave you, and says so plainly when that's Collections.
- **Strike 3** is the Council revoking your seat. Finance runs the token true-up: clAInk's billing agent, the one agent with a perfect record, works out that it comes to everything you have, plus a bit (and more if you're already in the red). On its way out, your agent emails your best deal: "It's not you, it's me." They agree. The end card recaps all three strikes and what the pilot cost (tokens, pipeline "influenced", real revenue, charged back). HR reads the PA line: "Your agent has been offboarded."
- **Token burn is the pitfall.** Every run report, invoice and true-up says how many tokens it took. Idle weeks still bill, because background agents keep "thinking". The overage is an agent that looped all weekend.
- A run that closes nothing reports its vanity metric first ("Influenced $78,000 of pipeline (all of it)"), then the billed busywork: "Drafted 1,400 emails. Sent 0.", "Booked 3 meetings with other agents", "Wrote Pinecone Pizza a haiku. Unprompted.", "Spun up 600 sub-agents to agree on tone".
- Cancelling is an early termination fee ($250 plus the week's usage), with a retention offer: "Enterprise Plus hits 21% success. Just $4,999/wk." Your data stays "to improve the models."

### Changed: one thing at a time
- A run plays out in the workspace beat by beat: agents working, with the token count ticking up, then the outcomes one at a time, then "Closed: $0", then the strike card, then your manager. It takes about 2.5 seconds; click the report or press Esc to skip. Reduced motion (even switched on mid-game), a minimized workspace or a reload shows it all at once.
- Each beat is voiced as it lands: a tick per outcome, then a stamp, a glitch or a blue screen when the strike card lands (with the cash alarm, if the run took you under -$1,000), then your manager. The workspace doesn't shrink while a report plays, so a double click on Run agents can't land on the game behind it.
- The strike box fills when the strike card lands, and this week's bill shows after the report, not while the agents are still "working".
- The Writing Lesson (your manager takes a deal) waits until the report has played instead of popping over it, and the PA still reads it. It waits for the Rules to close. If the week has moved on, the run has ended or been replaced (New Game, Load), or another event is waiting, it stays in the log only.
- A run logs two lines (three at strike 3, plus your manager if he noticed), down from as many as five. The strike's line carries its damage: the deal that fled, the discount and the manager hit, the deals shared, or the churn and its commission clawback.
- The always-on upsell line is gone from the workspace (it's the retention offer now).

### Balance
- Unchanged. Every number is v1.19's (odds, fees, damage, the true-up), so v1.19's tables below still apply. The jokes draw from their own random stream now, so a punchline can't move a mechanical draw.
- Checked two ways, running the v1.19 and v1.20 engines headless:
  - With v1.19's cosmetic draws moved to their own stream the way v1.20 does it, both engines give identical results over 20,000 random install, run, invoice and cancel sequences (108,611 steps): 0 differences in cash, deals, closed revenue, manager, reputation, status, strikes, bills, Collections or the manager's deal grabs.
  - Over 100,000 randomized sequences per policy (riding to strike 3, cancelling at two strikes), the largest gap between the versions in any outcome was 1.06 standard errors.

### Saves
- v1.19 saves load. Red flags become strikes (strikes filed before v1.20 read "A run that closed $0."). A rug-pulled console becomes a revoked seat with its strike-3 card and recap. A v1.19 incident shows as its strike card.

## v1.19 — clAInk.io, the AI agent that works 20% of the time

### Added
- **clAInk.io**, a sponsored AI sales agent from a frontier startup that is very much raising. Its ad pops up at the start of every run: "✦ Introducing clAInk 4o: agents for your agents", "Trusted by 3 of the Fortune 5,000,000", "🚀 Raising our Series A. SAFEs welcome, DMs open 🙏", "SOC 2 (vibes)", "⏳ Offer ends Week 10". **Close the ad and clAInk is off for the rest of the run.** Install takes two clicks ($500). The card is declined if it would send you to Collections, and the offer ends after week 10.
- Buying swaps the ad for **clAInk's own Agent Console**. Drag it anywhere by its title bar, or with the arrow keys on the ⠿ grip. Minimize it to a pill that stays put and drags too. It remembers where you left it, and short screens start with the pill.
- **Deploy once a week, free** (no energy, no slots). Week 13 is a quarter-end freeze: no deploys. Every deploy rolls on its own:
  - **20%: "✨ It actually worked."** It signs exactly its $12–22k target in real deals: your most advanced deal at stage 2 or later that fits, plus a buyer nobody had met for the rest. A small remainder is upsold onto your deal instead. It also moves two more deals a stage. A big week, but one week.
  - **80%: fake wins.** The dashboard brags ("Signed Pinecone Pizza · $27,300") about deals that are still sitting in your pipeline. Nothing real changes, every claimed "outcome" goes on Friday's invoice, and a 🚩 goes up. 38% of the first two fakes also cause a SEV-1:
    - a slop grenade (your best deal flees)
    - a hallucinated 45% discount
    - your pipeline emailed to a rival
    - a customer auto-renewed at 3x who churned (22% of your closed revenue, at least $1,500 and at most $45,000, comes back with its commission)
  - **The third fake is the rug pull.** clAInk maxes out your card with an "annual prepay": you land around -$200 to -$1,800, worse if you were already in the red. It also sells your CRM (a deal is gone), costs some of your manager's trust, and the console turns into a 404 page. At two red flags the console warns you, with those numbers.
- **"Always on ChatGDP?"** Each use has a 25% chance your manager notices (once per run, -9 manager). After that, any use has a 25% chance he takes your best deal "to show you how to work on your writing skills": a Writing Lesson dialog and another -9 each time.
- **A real chance of bankruptcy.** Every charge comes out of your cash:
  - $249 for each week you deploy
  - $140–280 per claimed outcome
  - $150–300 for an idle week
  - a 10% chance of a $200–600 token overage on any Friday invoice
  - a $250 exit fee plus the week's usage (refused if it would repo you)
  If clAInk sends you to Collections, the ending, the scene note and the PA ("Collections thanks the agent.") say so.
- Sounds and PA lines for every clAInk event.

### Balance
Simulated by running the game's own code headless, against the same seeds without clAInk:
- **Regular bot:** reaches President's Club 6% of the time without clAInk. Pooled over 60,000 runs per policy.
- **Strong bot:** reaches it 19%. Pooled over 20,000 runs per policy.

| How you use clAInk | Club, regular bot | Club, strong bot | Goes broke |
|---|---|---|---|
| Ride it to the third fake, from week 1 | -3.9 pp | -11.0 pp | 56% |
| Ride it to the third fake, from week 5 | -2.2 pp | -6.3 pp | 12–16% |
| Quit after the first miracle, from week 1 | -2.2 pp | -5.4 pp | 40–43% |
| Stop at two red flags, from week 1 | -0.9 pp | -1.1 pp | 6% |
| Stop at two red flags, from week 5 | -0.4 pp | -0.4 pp | 0% |

- **Best as a desperation play.** Installing at week 5 or later and deploying only after a week you're behind pace (stopping at two red flags) roughly breaks even for the regular bot (+0.1 to +0.2 pp). For the strong bot it edges out not installing by about +1 pp. A single deploy, then cancel, is about 0 pp for the regular bot and +0.3 pp for the strong one. From week 1 the same plays cost 0.4–1.3 pp and about 6% go broke, and deploying while you're on pace costs you.
- **The tradeoff.** The plan aimed for riding it out to go broke about 25% of the time, careful play at least 10%, and careful week-1 play within ±0.5 pp. Those can't all hold together: a rider pays every fee a careful player pays, plus more weeks of them, plus the rug pull. So any fee level that puts careful players at risk sends riders broke about half the time. The tuning puts a real bankruptcy risk on anyone who installs while broke or rides it to the rug pull, steepest for whoever ignores two red flags. Careful play from week 5 never goes broke. Careful week-1 play costs about 0.9 pp, most of it that 6% bankruptcy risk. Damage that would also erase the strong bot's comeback edge drags ordinary careful play down further, so the edge stays.
- Miracles land 20% of the time, and the manager's notice and deal grabs 25%.
- A run that never installs clAInk plays like v1.18: the same endings and the same random draws. The only change is that a rent repo now ends the week right away, so the ending is the last log line.

### Fixed (vs the clAInk prototype)
- The window's × only minimized it, to a pill that could never be dismissed. It reopened on every reload and kept stale state across New Game and Load. Now the ad's × turns clAInk off for the run, and the console minimizes, drags and stays inside the screen and its safe areas.
- The window covered the bottom of the deals and the log on phones. The ad now reserves page space and scrolls inside itself on short screens.
- These no longer happen:
  - One click installed (a double click installed and deployed).
  - A held Enter or a double click on clAInk's controls carried on into the game (End Week, Discovery, Conference).
  - Cancelling and re-buying gave a second deploy in the same week.
  - Buying, deploying and cancelling skipped the invoice.
  - A week-13 invoice could turn President's Club into a repo.
  - Saves weren't validated.
- Built on v1.18. The prototype was a v1.16 copy that would have undone the v1.17 and v1.18 changes.

## v1.18 — Metal endings, HR does the firing

### Changed
- The "Burnout" and "Cardiac" endings are gone. Dying to coffee is now **ASCENSION**: the chair starts to rattle, the desk ignites, and you ride a column of espresso fire up through the drop ceiling, the plenum and the roof, past drifting Slack pings, into orbit over the curve of the Earth. Cut to the office: a smoking crater in the carpet, a Post-it on the monitor ("OOO. Forever.") and one unread. Dying to stress is **MELTDOWN**: the desk is a reactor control room, core temp climbs to quota, containment degrades, the geiger readout fills, the monitor glass cracks, the room runs to slag, and the blue screen reads `Stop code: SOUL_NOT_FOUND`.
- Both endings have their own scores: a sub-bass rumble, ignition, a liftoff roar, ceiling tiles crashing, geiger clicks, glass, slag hiss, and a stinger each. No sirens anywhere.
- **Terminations are read by HR** in a female voice, calmly: "As of today, you're no longer an employee of this organization." / "Thanks for coming to this meeting. Today is your last day with Shitcorp." / "We've reviewed your performance and decided to part ways." The badge-reader buzzers are gone.
- **Recharge** luck is now 0–50%. Roll over 40% and your manager approves a trip (Japan, Whistler, Cancun, Thailand or Dubai), shown as a badge in the status row for the rest of the run.
- Log lines and PA: "🚀 Shot #3. Liftoff.", "☢️ Stress 100. Meltdown.", "Rep has left the atmosphere.", "Containment failed. Evacuate the pod."

## v1.17 — Announcer on Windows, luckier naps, gentler coffee

### Fixed
- The PA announcer was silent on Windows in Edge and Chrome. Three engine quirks were to blame: voice objects go stale when the browser reloads its voice list (a stale voice speaks nothing), the engine can report "speaking" forever after an utterance that never ends (Edge's online voices with no network, or the silent unlock primer), and an unreferenced utterance can be dropped mid-queue. The voice is now kept by name and resolved at speak time, busy-ness is tracked by the game rather than the browser flag, the current line is held, local voices win over Edge's "Online (Natural)" ones, and a voice that fails gets one retry on the browser default.

### Changed
- **Recharge** rolls a lucky-nap bonus of 0–25% on both the energy gain and the stress relief, once per use (+35–44 energy, -12–15 stress on a clean week). The button shows the range.
- **Caffeine compounds half as hard.** Each extra Quad Shot in a week now adds +3 stress instead of +6 (12, 15, 18…), energy fades 18→16→15→14→12 instead of 18→15→12→9→6, and each shot blunts Recharge by 2 instead of 4. The week-end crash and heart risk are unchanged.

## v1.16 — Welcome to Shitcorp

### Added
- The Rules now open with an onboarding memo from Shitcorp People & Culture: the next disruptor in SaaS, culture as glue, a comp plan that makes gorillionaires, and your new title, Associate Account Executive. Then the confetti cannon fizzles and HR stamps **SDR\*** over the title. Footnote: admin and streamlining purposes.
- The gag replays every time you open the Rules. Click the memo to skip to the stamp. Reduced motion shows the stamped memo, no animation.
- New sounds: a deflating party horn and HR's rubber stamp. The PA welcomes you once per visit (reduced motion included). Close the Rules before it speaks and it waits for next time.

### Fixed
- Dialogs on phones and in landscape no longer open scrolled to the bottom: the action buttons stay pinned at the bottom of the dialog.

## v1.15 — CRM Cleanup, lethal caffeine, anime cutscenes

### Added
- **🧹 CRM Cleanup**, the 12th action (once a week, 15 energy): prunes dead leads, raises manager trust, and freezes this week's mid-quarter warning escalation while trimming firing odds. 15% chance (25% with a cold manager) the manager says "close that out" and a good mid-funnel deal is gone.
- Anime-style camera for every ending: push-ins, Dutch tilt, tracking shots with parallax, whip pans with ASCII smear, slash-cut wipes, impact frames (max 2 per second), focus and speed lines, and block-letter title cards (CLUB, FIRED, BURNOUT, MISSED, REPO). Burnout has a caffeine variant (CARDIAC, flatline).

### Changed
- **Caffeine and stress now end runs.** Each Quad Shot in a week costs more stress (12, 18, 24...) for less energy; shot 3+ can stop your heart, and any shot that takes stress to 100 will. Caffeinated weeks crash +13 stress per shot at week end, skip the weekly recovery, and weaken Recharge. Stress 80+ rolls for burnout at week end; any spike to 100 mid-week burns out on the spot. The Stress card and Quad Shot button show the crash and heart risk before you commit.
- Simulated balance (300 runs per play style): no-coffee play 0% burnout (unchanged); one coffee a week ~50% burnout (was 0%); coffee spam 100% (was 5%).
- Boot screen cut from ~8 s to ~2.3 s from click to playable: logo slam, quota bar stalls at 74%, error, clock in. One "press any key"; M mutes during boot.
- Announcer, activity log, event, help ("How It Works", opened from **Rules**) and ending copy rewritten shorter: log lines average 39 characters (was 64), every PA line is six words or fewer. Sounds and PA lines still fire on the same events.
- Endings record their cause in state instead of parsing log text.

### Fixed
- Ending cutscene clipped its right-hand columns at some widths (font sizing measured a transformed box).
- An event dialog could stack on top of the ending dialog.
- Mid-week stress spikes from Hail-Mary, events and reviews no longer skip burnout.
- Big-close PA line never played in locales without comma thousands separators.
- Main panel overflowed sideways on phones; Hail-Mary button wrapped and stayed clickable below 10 energy.
- A late Skip tap on the boot screen no longer lands on a game action; holding a key no longer skips the boot.
- Help closes with Esc; dialogs are labelled for screen readers; toasts show above open dialogs.

## v1.14 — Sound, PA announcer, ASCII scene engine

### Added
- Web Audio sound engine (synthesized, no samples): every log line maps to a sound effect; stress at 70+ adds a heartbeat that speeds up as it climbs.
- Office PA announcer (browser speech synthesis) for week milestones, big events and endings.
- Header controls: Sound on/off (`M` toggles), Announcer on/off, volume slider. Settings persist.
- ASCII scene engine for the five endings (President's Club, Fired, Burnout, Barely Missed, Repo'd): multi-beat storyboards with particles, captions, glitch and shake cues, plus Skip and Replay. The old two-frame flipbook remains as a fallback.
- SHITCORP OS boot screen, shown once per tab session.
- In-page toast replaces `alert()` for Save/Load messages.

### Fixed
- An event that fired on the final week no longer leaks into the next run.
- Dialogs no longer run off short screens.

## v1.13 — 2026-09-20

### Fixed
- `ageAndGhost` reassigned state inside the filter callback, so on any week a deal went dark the filtered/aged list was written to a stale object and discarded — ghosted deals never left the board and deal ages never advanced on those weeks.
- `Actions` was declared inside `Game`, causing React to remount the entire action grid on every state change (lost hover/focus, no transitions).
- Header New Game / Save / Load handlers were re-bound on every render; now bound once and read live state through a ref.
- Page refresh restored the last *manual* save instead of the autosave; refresh now resumes the autosave, Load still prefers the manual save.
- Negative cash displayed as `$-1,500`; Manager displayed raw floats.
- Save/load now tolerate blocked `localStorage` instead of throwing.

### Changed
- Vendored script hosts moved from unpkg to cdnjs (React 18.3.1, ReactDOM 18.3.1, babel-standalone 7.28.4) with pinned versions.
- Visual pass only: animated conic-gradient panel borders, cursor spotlight, particle field, synthwave grid floor, aurora blobs, gradient title, pulsing End Week, button shimmer sweeps, striped/pulsing stat bars, count-up tweens on numbers, card/log entrance animations, CRT scanlines on endings, grain overlay. Layout, copy, and mechanics unchanged. `prefers-reduced-motion` respected.


## v1.12 – Full UI Refresh (2026-01-23)
- Replaced the main HTML with the refreshed Tech Sales Trail UI and full game logic.
- Added new actions (referrals, conferences, internal politics) and expanded random events.
- Updated save/autosave keys and endgame cutscenes to match the new build.

## v1.11 – Pace & Pressure (2026-01-18)
- Added Stats Help modal and pace tracking against quota.
- Expanded mid-quarter performance warnings, firing risk, and high-risk Hail-Mary outcomes.
- Tuned quota expectations and event mix for a sharper one-quarter run.

## v0.2.1 – Polish (2025-11-23)
- Prevented overlapping modal random events from overwriting each other; now only the first decision event triggers per week.

## v0.2 – One-Quarter Alpha (2025-11-23)
- Switched from multi-quarter sim to a single, high-stakes quarter.
- Added “jacket repo” financial failure ending (warning at -$1,000, repo at -$1,500).
- Restored and tightened burnout mechanics (coffee spam and high stress can fry you).
- Reworked Hail-Mary Close: now costs energy, can lose deals, and affects manager relationship.
- Made random discount event use clamped conversion modifiers to avoid insane win rates.
- Fixed modal behavior so events and endings truly lock the screen.
- Fixed ASCII cutscene jitter by using a fixed-height cutscene box.
- Improved layout: taller log window, scrollable deals list, slightly smaller UI so everything fits at 100% zoom.

## v0.1 – Initial Alpha (2025-11-15)
- First public alpha of Tech Sales Trail.
- Single-page React/HTML sales roguelike.
- Core funnel actions (prospect, discovery, demo, propose, close) and random events.
