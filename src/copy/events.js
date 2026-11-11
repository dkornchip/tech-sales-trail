import { CK_QUIP, CK_WARNING } from "./claink.js";

// What each event dialog says, keyed by the event's id (the same ids as EVENTS in src/game/events.js, which holds
// what the buttons do). Every piece is a function of the event's params, even when it takes none:
//   title(p), body(p), and for each option, by its id: its label, or { label, effect } where effect is what
//   choosing it does, shown under the label so nobody has to guess.
// The two End Week choices take no params. clAInk's manager events do: `miracle` (the run that caught his eye
// actually worked) for the warning, `account` (the deal he took) for the writing lesson.
export const EVENT_COPY = {
  "evt:competitor": {
    title: () => "Scheisskorp cut prices by 25%",
    body: () => "Every late-stage buyer you have just received the same email. Your manager would like your plan within the hour.",
    options: {
      match: () => ({ label: "Match them", effect: "+12% close odds and 20% off every deal, this week" }),
      hold: () => ({ label: "Hold the price", effect: "−8% close odds this week, +4 reputation" })
    }
  },
  "evt:security": {
    title: () => "A customer was breached",
    body: () => "It came in through the product. Legal has drafted two statements and would like you to pick one before the customer does.",
    options: {
      own: () => ({ label: "Tell customers first", effect: "+6 reputation, −18 product, −15% close odds for 2 weeks. Each deal that has seen a demo has a 30% chance to leave." }),
      spin: () => ({ label: "Call it an isolated event", effect: "−8 reputation, −12 product, −8% close odds this week. Each deal that has seen a demo has a 15% chance to leave." })
    }
  },
  "ck:warning": {
    title: () => "Always on ChatGDP?",
    body: p => `“${CK_QUIP(p.miracle)} ${p.miracle ? "Enjoy it. " : "That is not writing. "}${CK_WARNING}”`,
    options: {
      ack: () => "Noted"
    }
  },
  "ck:lesson": {
    title: () => "Writing lesson",
    body: p => `“ChatGDP again. I’ll close ${p.account} myself. Watch how a person writes an email.”`,
    options: {
      ack: () => "Understood"
    }
  }
};
