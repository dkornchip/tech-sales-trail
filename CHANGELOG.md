# Changelog

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
