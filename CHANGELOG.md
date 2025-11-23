# Changelog

## v0.2.1 – Polish (2025-11-24)
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

## v0.1 – Initial Alpha
- First public alpha of Tech Sales Trail.
- Single-page React/HTML sales roguelike.
- Core funnel actions (prospect, discovery, demo, propose, close) and random events.
