import { EFFECT } from "../game/effects.js";

// What each event dialog says, keyed by the event's id (the same ids as EVENTS in src/game/events.js, which holds
// what the buttons do). Every piece is a function of the event's params, even when it takes none:
//   title(p), body(p), and for each option, by its id: its label, or { label, effect } where effect is what
//   choosing it does, shown under the label so nobody has to guess.
// The effect lines are factual and are built from the rules' own numbers (EFFECT in src/game/effects.js, and the
// walk chances the rules export), so a retune cannot leave them behind. The joke is in the title and the body.
// The two End Week choices take no params. clAInk's manager events do: `miracle` (the run that caught his eye
// actually worked) for the warning, `account` (the deal he took) for the coaching session.
const pts = v => `${v > 0 ? "+" : "−"}${Math.abs(Math.round(v * 100))}`;
const pc = v => `${Math.round(v * 100)}%`;
const weeks = k => (k === 1 ? "this week" : `for ${k} weeks`);
// the chance each deal at Demoed or later walks (src/game/events.js, SECURITY_WALK; the facts test holds them equal)
export const WALK = { own: 0.30, spin: 0.15 };

export const EVENT_COPY = {
  "evt:competitor": {
    title: () => "Pricing alignment initiative",
    body: () => "Scheisskorp has cut prices by 25%. Management reminds you that customers buy value, then forwards a discount authorization form.",
    options: {
      match: () => ({ label: `Match with ${pc(EFFECT.competitorMatch.disc)} discount`, effect: `${pts(EFFECT.competitorMatch.conv)} percentage points signing odds; ${pc(EFFECT.competitorMatch.disc)} off eligible sales ${weeks(EFFECT.competitorMatch.weeks)}.` }),
      hold: () => ({ label: "Defend our value", effect: `${pts(EFFECT.competitorHold.conv)} percentage points signing odds ${weeks(EFFECT.competitorHold.weeks)}; +4 reputation.` })
    }
  },
  "evt:security": {
    title: () => "Customer incident — internal statement",
    body: () => "A customer has been breached. Legal has drafted two descriptions of the same event. Choose the one you intend to send.",
    options: {
      own: () => ({ label: "Disclose the incident", effect: `+6 reputation, −18 product, ${pts(EFFECT.securityOwn.conv)} pp odds ${weeks(EFFECT.securityOwn.weeks)}; each deal at Demoed or later has a ${pc(WALK.own)} chance to walk.` }),
      spin: () => ({ label: "Issue a carefully worded statement", effect: `−8 reputation, −12 product, ${pts(EFFECT.securitySpin.conv)} pp odds ${weeks(EFFECT.securitySpin.weeks)}; each deal at Demoed or later has a ${pc(WALK.spin)} chance to walk.` })
    }
  },
  "ck:warning": {
    title: () => "Writing development opportunity",
    body: p => (p.miracle
      ? "“Nice week. ChatGDP do that? Enjoy it. I’d like you to develop your own written communication skills before I start intervening in your deals.”"
      : "“Always on ChatGDP, huh? That’s not writing. Improve your written communication skills, or I’ll start intervening in your deals.”"),
    options: {
      ack: () => "Noted, boss."
    }
  },
  "ck:lesson": {
    title: () => "Practical coaching session",
    body: p => `“I’ll take ${p.account} from here. Watch how I handle the account. We’ll work on your writing next time.”`,
    options: {
      ack: () => "Thanks, boss."
    }
  }
};
