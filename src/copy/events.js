import { CK_QUIP, CK_WARNING } from "./claink.js";

// What each event dialog says, keyed by the event's id (the same ids as EVENTS in src/game/events.js, which holds
// what the buttons do). Every piece is a function of the event's params, even when it takes none:
//   title(p), body(p), and for each option, by its id: its label, or { label, effect } where effect is what
//   choosing it does, shown under the label so nobody has to guess.
// The two End Week choices take no params. clAInk's manager events do: `miracle` (the run that caught his eye
// actually worked) for the warning, `account` (the deal he took) for the writing lesson.
export const EVENT_COPY = {
  "evt:competitor": {
    title: () => "Competitor panic",
    body: () => "They cut 25%. Match 20% or hold?",
    options: {
      match: () => ({ label: "Match 20%", effect: "More wins, less money: +12% close odds and 20% off every deal, this week" }),
      hold: () => ({ label: "Hold price", effect: "Fewer wins: −8% close odds this week, +4 reputation" })
    }
  },
  "evt:security": {
    title: () => "Security incident",
    body: () => "A customer got breached. Own it or spin it?",
    options: {
      own: () => ({ label: "Own it", effect: "+6 reputation, −18 product, −15% close odds for 2 weeks. Each demoed deal has a 30% chance to walk." }),
      spin: () => ({ label: "Spin it", effect: "−8 reputation, −12 product, −8% close odds this week. Each demoed deal has a 15% chance to walk." })
    }
  },
  "ck:warning": {
    title: () => "Always on ChatGDP?",
    body: p => `“${CK_QUIP(p.miracle)} ${p.miracle ? "Enjoy it. " : "That’s not writing. "}${CK_WARNING}”`,
    options: {
      ack: () => "…Noted, boss"
    }
  },
  "ck:lesson": {
    title: () => "Writing lesson",
    body: p => `“Always on ChatGDP, huh? I’ll close ${p.account} myself. Watch and work on your writing skills.”`,
    options: {
      ack: () => "…Thanks, boss"
    }
  }
};

// For the copy lint: the two replies open on an ellipsis, so their first word is still the start of the sentence.
export const lint = { exempt: { "sentence-case": ["EVENT_COPY.ck:warning.options.ack", "EVENT_COPY.ck:lesson.options.ack"] } };
