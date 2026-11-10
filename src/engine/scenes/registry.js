/* ======================================================================
   SCENES. Each has: dur (ms of timeline before the idle loop), cap (caption schedule; capBy = per meta.cause),
   summary (summaryBy = per meta.cause),
   cues [{t, sfx | say | amb | shake | glitch | whip | slash | impact | zoom | slam | pulse | lines | card | letterbox,
          key:true = still fires on Skip (sound cues only), cause / notCause = only for that meta.cause}],
   cam [{t, x, y, z, r, e}] camera keys: look-at offset from the art's centre (cells), zoom, roll (deg),
          e = ease into the key (io | i | o | l | cut); drift = idle sway after dur; draw(g, ctx)
   Lateral moves are tracking shots inside the grid (a world offset scrolls the set), so the CSS camera
   only ever zooms in and never shows the edge of the art.
   ====================================================================== */
export var SCENES = {};
