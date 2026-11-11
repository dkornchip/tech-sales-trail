import { CK_QUIP, CK_WARNING } from "./claink.js";

// What each event dialog says, keyed by the event's id (the same ids as EVENTS in src/game/events.js, which holds
// what the buttons do). Every piece is a function of the event's params, even when it takes none:
//   title(p), body(p), and one label per option, by the option's id.
// The two End Week choices take no params. clAInk's manager events do: `miracle` (the run that caught his eye
// actually worked) for the warning, `account` (the deal he took) for the Writing Lesson.
export const EVENT_COPY = {
  "evt:competitor": {
    title: () => "🧨 Competitor Panic",
    body: () => "They cut 25%. Match 20% or hold?",
    options: {
      match: () => "Match 20% (more wins, less $)",
      hold: () => "Hold price (fewer wins, +rep)"
    }
  },
  "evt:security": {
    title: () => "🔐 Security Incident",
    body: () => "A customer got breached. Own it or spin it?",
    options: {
      own: () => "Own it (+rep, fewer wins)",
      spin: () => "Spin it (safer pipe, -\u2060rep)" // word joiner: keeps "-rep" on one line
    }
  },
  "ck:warning": {
    title: () => "👔 Always on ChatGDP?",
    body: p => `“${CK_QUIP(p.miracle)} ${p.miracle?"Enjoy it. ":"That's not writing. "}${CK_WARNING}”`,
    options: {
      ack: () => "…Noted, boss"
    }
  },
  "ck:lesson": {
    title: () => "👔 Writing Lesson",
    body: p => `“Always on ChatGDP, huh? I'll close ${p.account} myself. Watch and work on your writing skills.”`,
    options: {
      ack: () => "…Thanks, boss"
    }
  }
};
