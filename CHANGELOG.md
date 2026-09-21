# Changelog

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
