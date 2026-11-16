// The words in the ASCII scenes: the caption band under each ending, the title card that slams in, the one-line
// description (the aria-label, and the note shown instead of the animation under reduced motion), and the words drawn
// inside the pictures. Timing, colour and layout stay with each scene in src/engine/scenes/defs.
//
// Per scene:
//   title    the caption's headline (typed first)
//   a, b     the two caption sets, two short lines each; b replaces a part-way through, then they alternate.
//            A set may be a function of the ending's meta ({cause, shots, pct}).
//   card     the title-card word. The block font only has the letters S H I T C O R P L U B F E D N M A W.
//   summary  one sentence; summaryBy[cause] replaces it for one cause of the ending.
//   text     words drawn in the art (signs, screens, labels). The picture is 64 columns wide: a longer word can
//            run into what is next to it. Sprite art, which has lettering of its own, is in the engine's sprites.js;
//            a text marked "(on the sprite)" is painted over that lettering and must match it.

// The open-plan desk (ASCENSION and MELTDOWN both start at it): the monitor and the meter beside it.
export const DESK_TEXT = {
  forecast: "Q1 FORECAST",
  commit: "> commit?",
  reactor: "REACTOR Q1",        // the same desk, as MELTDOWN's reactor room
  rods: "> rods: ok",
  coolant: "> coolant: none",
  meterStress: "STRESS",
  meterHeart: "HEART",          // with a few coffees in
  meterCore: "CORE TEMP",
  containment: "CONTAINMENT",
  nominal: "NOMINAL",
  degraded: "DEGRADED",
  failed: "FAILED",
  bpm: "BPM "
};

export const SCENE_COPY = {
  /* PRESIDENT'S CLUB: jet lands on the beach, jacket descends, fireworks */
  club: {
    title: "PRESIDENT’S CLUB",
    a: ["Jacket secured.","Revenue verified."],
    b: ["Next quarter:","Higher quota."],
    card: "CLUB",
    summary: "A jet lands on the beach, the jacket descends, fireworks rain commission."
  },

  /* FIRED: access denied, walk of shame, elevator goes down */
  fired: {
    title: "YOU’RE DONE",
    a: ["Badge deactivated.","Please return equipment."],
    b: ["New org chart.","Your quota lives on."],
    card: "FIRED",
    summary: "Badge denied, box carried past staring coworkers, elevator down.",
    text: {
      // the badge reader's screen: three states, each 13 characters wide
      ready: "    READY    ",
      checking: "   . . .     ",
      denied: "ACCESS DENIED",
      reader: "SHITCORP SECURE",   // (on the sprite)
      badge: "SHITCORP",           // (on the sprite)
      badgeVoid: "VOID",
      clock: "[ 4:59 PM FRI ]",
      rip: "rip",
      box: "[BOX]"                 // (on the sprite)
    }
  },

  /* ASCENSION (caffeine): the desk ignites and the rep rides espresso fire into orbit */
  ascension: {
    title: "ASCENSION",
    a: function(m){ return [m.shots > 1 ? "Shot #"+m.shots+"." : "One shot too many.","Orbit achieved."]; },
    b: ["Out of office.","Beyond the office."],
    card: "ASCENSION",
    summary: "The desk ignites and you ride a column of espresso fire through the ceiling into orbit. A crater and a Post-it remain.",
    text: {
      // notifications drifting past on the way up, lowest first
      pings: ["(1)","@matt","(3)","ping","(99+)","1:1?","(2)","re: re: re:"],
      hvac: "[HVAC]",
      crater: "\\__( crater )__/",
      // the Post-it on the monitor afterwards, and the unread count blinking under it (same width, on and off)
      postit: "OOO. Forever. ",
      unread: "(1) unread",
      unreadOff: "(1)       "
    }
  },

  /* MELTDOWN (stress): core temp hits quota, containment fails, the desk runs to slag */
  meltdown: {
    title: "MELTDOWN",
    a: ["Core temp: quota.","Containment failed."],
    b: ["Stop code:","SOUL_NOT_FOUND"],
    card: "MELTDOWN",
    summary: "Core temp hits quota, containment fails, the desk melts to slag, blue screen.",
    text: {
      alarm: "!! CONTAINMENT FAILED !!",
      // the blue screen
      problem: "Your rep ran into a problem and needs to cool down.",
      cause: "Core temp: QUOTA. Containment: none.",
      complete: "% complete",      // after a number that counts up
      stopCode: "Stop code: SOUL_NOT_FOUND",
      failed: "What failed: containment.sys"
    }
  },

  /* BARELY MISSED: the bar stalls, then a long walk under a personal rain cloud */
  missed: {
    title: "BARELY MISSED",
    a: ["Quota missed.","Badge still works."],
    b: ["QBR adjourned.","Back on Monday."],
    card: "MISSED",
    summary: "The quota bar stalls short, then a rain cloud follows you home.",
    text: {
      quota: "QUOTA",
      stalled: "STALLED",
      // shop signs on the walk home; the second one shows how much of quota you made
      closed: "CLOSED",
      off: function(pct){ return pct+"% OFF"; },
      loans: "LOANS"
    }
  },

  /* REPO: the tow truck takes the jacket */
  repo: {
    title: "REPOSSESSED",
    a: ["Jacket financed.","Payments missed."],
    b: ["Collections:","Asset recovered."],
    card: "REPO",
    summary: "A tow truck hauls off the President’s Club jacket.",
    summaryBy: { claink: "A tow truck hauls off the jacket. clAInk billed it as an outcome." },
    text: {
      billboard: "PRESIDENT'S CLUB",   // (on the sprite: the sprite's own lettering uses a straight apostrophe)
      building: "COLLECTIONS  DEPT.",  // (on the sprite)
      truck: "REPO"                    // (on the sprite)
    }
  },

  /* BOOT: SHITCORP OS */
  boot: {
    summary: "SHITCORP OS boots and reports quota exceeds pipeline.",
    text: {
      logo: "SHITCORP",               // in the block font: see `card` above for its letters
      os: "SHITCORP OS v4.3",
      loading: "Loading quota",
      error: "ERROR: quota exceeds pipeline.",
      week: function(week){ return "Week "+week+"/13. Welcome to the office."; }
    }
  },
  // standby screen shown before the first click (it shares the boot screen's logo)
  standby: {
    summary: "SHITCORP OS standby screen.",
    text: {
      version: "O S   v 4 . 3",
      prompt: "[ PRESS ANY KEY ]"
    }
  }
};

// For the copy lint. The CRT is a terminal: its banners, signs and stop codes are in capitals because that is how a
// terminal prints them, and the billboard's apostrophe has to match the sprite it is painted over.
export const lint = { exempt: {
  "sentence-case": ["DESK_TEXT", "SCENE_COPY.club.title", "SCENE_COPY.fired.title", "SCENE_COPY.fired.text", "SCENE_COPY.ascension.title", "SCENE_COPY.ascension.text",
    "SCENE_COPY.meltdown.title", "SCENE_COPY.meltdown.b", "SCENE_COPY.meltdown.text", "SCENE_COPY.missed.title", "SCENE_COPY.missed.text", "SCENE_COPY.repo.title",
    "SCENE_COPY.repo.text", "SCENE_COPY.boot.text", "SCENE_COPY.standby.text", "SCENE_COPY.club.card", "SCENE_COPY.fired.card", "SCENE_COPY.ascension.card",
    "SCENE_COPY.meltdown.card", "SCENE_COPY.missed.card", "SCENE_COPY.repo.card"],
  "quotes": ["SCENE_COPY.repo.text.billboard"]
} };
