// What a run is remembered for: a few counts and names the ending screen quotes back.
// It is kept as lines are written to the log, from what those lines already say. The rules never read it and it
// rolls no dice, so it cannot change how a run plays. A save made before v2.0 has none (story: null): its history
// is unknown, and the ending screen then quotes only what the rest of the save can vouch for.

// log tag -> the count it adds to
const COUNTS = {
  "coffee.shot": "shots",
  "act.cadence": "cadences",
  "act.politics": "lunches",
  "act.conference": "conferences",
  "act.hail.blast": "hails",
  "act.hail.lean": "hails"
};
const COUNT_KEYS = ["shots", "cadences", "lunches", "hails", "lost", "conferences"];

// v: which counts this story has kept from its first week. 2 (v2.1) added conferences and whether the manager's
// take was the largest deal on the board, and whether signed revenue was later reversed; a story begun earlier
// (no v) cannot vouch for those, and says nothing.
export const newStory = () => ({ v: 2, signed: 0, top: null, took: null, tookLargest: false, reversed: false, n: {} });

const bump = (story, key, by) => ({ ...story, n: { ...story.n, [key]: (story.n[key] || 0) + by } });

// The story after one more log line. Returns the same object when the line adds nothing.
export const tally = (story, tag, p) => {
  if (!story || typeof story !== "object") return story;
  p = p || {};
  if (COUNTS[tag]) return bump(story, COUNTS[tag], 1);
  if (tag === "close.signed" || tag === "ck.signed") {
    const top = p.top && (!story.top || p.top.value > story.top.value) ? { account: p.top.account, value: p.top.value } : story.top;
    return { ...story, signed: story.signed + (p.n || 0), top };
  }
  if (tag === "deal.lost" || tag === "close.lost") return bump(story, "lost", p.n || 0);
  if (tag === "ck.mgr.yoink") return { ...story, took: p.account || story.took, tookLargest: !!story.tookLargest || !!p.largest };
  // a customer the agents upgraded and lost: revenue already counted as signed came back
  if (tag === "ck.strike.hurt" && p.incident === "churn") return story.reversed ? story : { ...story, reversed: true };
  if (tag === "evt.rebalance" && p.n > 0) return { ...story, tookLargest: true };      // a rebalance always starts with the largest
  return story;
};

// A story read back from a save: only the shape above survives, with sane numbers and short names.
export const sanitizeStory = raw => {
  if (!raw || typeof raw !== "object") return null;
  const num = v => (Number.isFinite(v) && v > 0 ? Math.min(Math.floor(v), 1e9) : 0);
  const name = v => (typeof v === "string" && v ? v.slice(0, 60) : null);
  const out = newStory();
  if (raw.v === 2) { out.tookLargest = !!raw.tookLargest; out.reversed = !!raw.reversed; } else { delete out.v; delete out.tookLargest; delete out.reversed; }
  out.signed = num(raw.signed);
  if (raw.top && typeof raw.top === "object" && name(raw.top.account)) out.top = { account: name(raw.top.account), value: num(raw.top.value) };
  out.took = name(raw.took);
  if (raw.n && typeof raw.n === "object") for (const k of COUNT_KEYS) { const v = num(raw.n[k]); if (v) out.n[k] = v; }
  return out;
};
