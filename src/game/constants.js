export const QUARTER_WEEKS = 13;
export const MAX_QUARTERS = 1;

// Where a run is stored. v2.1 writes a versioned envelope (src/game/save.js) under its own keys. The keys of earlier
// versions are still read, newest first, and are never written or removed: the earlier page may still be in use in
// the same browser, and its run is not ours to overwrite.
export const SAVE_KEY = "tst-save-v5";
export const AUTOSAVE_KEY = "tst-autosave-v5";
export const LEGACY_SAVE_KEYS = ["tst-save-v4-3", "tst-save-v4-2"];
export const LEGACY_AUTOSAVE_KEYS = ["tst-autosave-v4-3", "tst-autosave-v4-2"];
export const LEGACY_PENDING_KEY = "tst-pending-v2";    // where v2.0 kept an End Week choice that was on screen
export const SET_ASIDE_KEY = "tst-set-aside-v5";       // a stored run that could not be opened, kept when a new one takes its place


// The mood values a save stores, in order from worst to best (a failed close can knock a deal down one).
// What a player reads for a mood, a stage or an account is in src/copy/names.js.
export const MOODS=["skeptical","neutral","curious","happy"];
