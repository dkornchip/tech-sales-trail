'use strict';
/*
 * Two short lists of deliberate, reviewed differences between the baseline and a newer build. Both are data:
 * adding a line here is the only way to make the harness accept a difference, and each line needs a reason.
 */

// 1. Additive save keys. Paths (array indices written as []) that build B may carry and the baseline does not.
//    They are removed from B's normalised state before the comparison. A key that is NOT listed here and is
//    not in the baseline's save fails every step it appears in.
//    Example for later: 'story', 'sv', 'deals[].tier', 'claink.last.more'.
const ADDITIVE_KEYS = [
  // v2.0: what the run is remembered for (src/game/story.js). Written as log lines are written, read only by the
  // ending screen; no rule reads it and nothing draws for it.
  'story'
];

// 2. Benign legal-move differences: moves the baseline offers and a newer build may withhold. Each rule has a
//    name; a driver opts in by listing the name in its `benign` array (drivers/v121.cjs lists none). A rule
//    applies only while `when(stateA)` is true, and only ever excuses a move that is MISSING from B. While a rule
//    applies, the runner also stops choosing that move, since B could not make it.
const BENIGN_RULES = {
  // v1.21 leaves Recharge enabled after it was used that week; pressing it only logs "Already recharged"
  // (game.jsx:1571-1575): no draw, no state change outside the log. The redesign disables the button instead.
  'recharge-when-rested': {
    move: 'act:recharge',
    when: stateA => !!stateA && stateA.restedThisWeek === true,
    why: 'v1.21 keeps Recharge enabled after use and only logs a line; newer builds disable it'
  }
};

module.exports = { ADDITIVE_KEYS, BENIGN_RULES };
