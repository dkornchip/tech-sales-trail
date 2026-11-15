import { CLOSE_TAGS } from "../../engine/audio/tagmap.js";      // the lines that record a signing (the sound knows them as cash)

// How a log line looks: its icon, by the family of its tag. Lines from saves made before tags existed
// are recognised by the emoji they started with, which is then dropped from the text.
const BY_FAMILY = [
  ["act.prospect", { icon: "phone" }], ["act.cadence", { icon: "mail" }], ["act.network", { icon: "users" }], ["act.discovery", { icon: "search" }],
  ["act.demo", { icon: "presentation" }], ["act.propose", { icon: "file-text" }], ["act.conference", { icon: "tickets" }], ["act.crm", { icon: "list-checks" }],
  ["act.recharge", { icon: "battery-charging" }], ["act.politics", { icon: "landmark" }], ["act.hail", { icon: "dices" }], ["coffee", { icon: "coffee" }],
  ["close", { icon: "handshake" }], ["deal.ghost", { icon: "ghost" }], ["deal", { icon: "briefcase" }], ["pay", { icon: "banknote" }], ["week", { icon: "calendar" }],
  ["stress", { icon: "activity" }], ["mgr", { icon: "user-round" }], ["risk", { icon: "triangle-alert" }], ["qbr", { icon: "gavel" }], ["end", { icon: "flag" }],
  ["ck", { icon: "bot" }], ["ach", { icon: "badge-check" }], ["evt", { icon: "megaphone" }], ["sys", { icon: "info" }],
];
const FALLBACK = { icon: "dot" };

export const iconFor = e => {
  if (e.tag) for (const [prefix, look] of BY_FAMILY) if (e.tag === prefix || e.tag.indexOf(prefix + ".") === 0) return look.icon;
  return e.kind === "bad" || e.kind === "warn" ? "triangle-alert" : FALLBACK.icon;
};

// How a line is toned: the rules mark what went wrong (bad) and what to watch (warn). Revenue that was recognised
// is the one thing the log marks as good: a signature, whoever got it. (The rules call those lines plain "info":
// the tone is how the page shows them, not a rule.)
export const toneFor = e => (e.kind === "bad" || e.kind === "warn" ? e.kind : e.tag && Object.prototype.hasOwnProperty.call(CLOSE_TAGS, e.tag) ? "good" : "");

// "📞 Blitz: +3 lead(s)." -> "Blitz: +3 lead(s)."  (render only; a save is never rewritten)
export const legacyText = msg => String(msg || "").replace(/^(?:[\p{Extended_Pictographic}\p{Emoji_Presentation}‍️⃣]|\p{Emoji_Modifier})+\s*/u, "");
