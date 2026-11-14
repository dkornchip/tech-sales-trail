// What the simulations count, and how it is printed.

const quantile = (sorted, q) => { if (!sorted.length) return null; const i = (sorted.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i); return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo); };
const sortNum = xs => xs.slice().sort((a, b) => a - b);
// Wilson score interval for a share k of n, 95%
export const wilson = (k, n) => {
  if (!n) return [0, 0];
  const z = 1.959964, p = k / n, d = 1 + z * z / n, c = p + z * z / (2 * n), w = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n));
  return [Math.max(0, (c - w) / d), Math.min(1, (c + w) / d)];
};
const pct = x => (100 * x).toFixed(1);

const ENDINGS = ["club", "missed", "fired", "meltdown", "ascension", "repo"];
const WARN_TAGS = ["risk.audit", "risk.hygiene", "risk.hr", "risk.recurring"];
const SOURCE_KEYS = ["act:prospect", "act:cadence", "act:network", "act:conference"];
const ACTION_KEYS = ["act:prospect", "act:cadence", "act:network", "act:discovery", "act:demo", "act:propose", "act:close", "act:conference", "act:crm", "act:recharge", "act:coffee", "act:politics", "hail", "ck:deploy"];

// One policy's runs -> one record.
export function summarise(runs) {
  const n = runs.length;
  const endings = Object.fromEntries(ENDINGS.map(e => [e, 0])), causes = {};
  let unfinished = 0, stuck = 0, illegal = 0;
  const moves = {}, tags = {};
  let warned = 0, weeks = 0, fridays = 0;
  for (const r of runs) {
    if (r.ending === "unfinished") unfinished++; else endings[r.ending]++;
    if (r.cause) causes[r.cause] = (causes[r.cause] || 0) + 1;
    if (r.tally.stuck) stuck++;
    illegal += r.tally.illegal;
    for (const [k, v] of Object.entries(r.tally.moves)) moves[k] = (moves[k] || 0) + v;
    for (const [k, v] of Object.entries(r.tally.tags)) tags[k] = (tags[k] || 0) + v;
    if (WARN_TAGS.some(t => r.tally.tags[t])) warned++;
    weeks += r.tally.weeks; fridays += r.tally.weeks;
  }
  const survived = endings.club + endings.missed;
  const att = sortNum(runs.map(r => r.attainment)), cash = sortNum(runs.map(r => r.cash));
  const lost = sortNum(runs.filter(r => r.ending !== "club" && r.ending !== "missed" && r.ending !== "unfinished").map(r => r.week));
  const acts = ACTION_KEYS.reduce((t, k) => t + (moves[k] || 0), 0);
  const mix = Object.fromEntries(ACTION_KEYS.map(k => [k, acts ? (moves[k] || 0) / acts : 0]));
  // where the leads come from: the share of lead-finding presses by source
  const found = SOURCE_KEYS.reduce((t, k) => t + (moves[k] || 0), 0);
  const sources = Object.fromEntries(SOURCE_KEYS.map(k => [k, found ? (moves[k] || 0) / found : 0]));
  const ckRuns = runs.filter(r => r.ck && r.ck.deploys > 0);
  const events = Object.fromEntries(Object.entries(tags).filter(([k]) => k.indexOf("evt.") === 0).map(([k, v]) => [k, fridays ? v / fridays : 0]));
  return {
    n, endings, causes, unfinished, stuck, illegal,
    survival: survived / n, survivalCI: wilson(survived, n), club: endings.club / n, clubCI: wilson(endings.club, n),
    attainment: { p25: quantile(att, 0.25), median: quantile(att, 0.5), p75: quantile(att, 0.75), mean: att.reduce((a, b) => a + b, 0) / n },
    weekOfLoss: { median: quantile(lost, 0.5), p25: quantile(lost, 0.25), n: lost.length },
    cash: { median: quantile(cash, 0.5), p25: quantile(cash, 0.25), p75: quantile(cash, 0.75) },
    warned: warned / n, warnings: Object.fromEntries(WARN_TAGS.map(t => [t, (tags[t] || 0) / n])),
    movesPerRun: Object.values(moves).reduce((a, b) => a + b, 0) / n, weeksPerRun: weeks / n, mix, sources, moves,
    eventsPerFriday: events, eventTotalPerFriday: Object.values(events).reduce((a, b) => a + b, 0), tags,
    claink: { used: ckRuns.length / n, deploysPerUser: ckRuns.length ? ckRuns.reduce((t, r) => t + r.ck.deploys, 0) / ckRuns.length : 0,
      miraclesPerUser: ckRuns.length ? ckRuns.reduce((t, r) => t + r.ck.miracles, 0) / ckRuns.length : 0,
      billedMedian: quantile(sortNum(ckRuns.map(r => r.ck.billed)), 0.5), deliveredMedian: quantile(sortNum(ckRuns.map(r => r.ck.delivered)), 0.5),
      revoked: ckRuns.filter(r => r.ck.status === "revoked").length / (ckRuns.length || 1), repoByClaink: (causes.claink || 0) / n }
  };
}

const pad = (s, w, right) => (right ? String(s).padStart(w) : String(s).padEnd(w));
export function table(policies) {
  const head = ["policy", "N", "survive%", "(95% CI)", "club%", "(95% CI)", "missed", "fired", "melt", "ascend", "repo", "att.med", "att.IQR", "loss wk", "cash med", "warned%"];
  const rows = [head];
  for (const [name, p] of Object.entries(policies)) {
    rows.push([name, p.n, pct(p.survival), `${pct(p.survivalCI[0])}-${pct(p.survivalCI[1])}`, pct(p.club), `${pct(p.clubCI[0])}-${pct(p.clubCI[1])}`,
      pct(p.endings.missed / p.n), pct(p.endings.fired / p.n), pct(p.endings.meltdown / p.n), pct(p.endings.ascension / p.n), pct(p.endings.repo / p.n),
      pct(p.attainment.median), `${pct(p.attainment.p25)}-${pct(p.attainment.p75)}`, p.weekOfLoss.median === null ? "-" : p.weekOfLoss.median.toFixed(0),
      Math.round(p.cash.median), pct(p.warned)]);
  }
  const w = head.map((_, i) => Math.max(...rows.map(r => String(r[i]).length)));
  return rows.map(r => r.map((c, i) => pad(c, w[i], i > 0)).join("  ")).join("\n");
}

// How different two policies' behaviour is, as total-variation distances (0 the same, 1 nothing in common):
//   mix      between their action mixes (which buttons, how often)
//   sources  between where their leads come from (cold calls, email, referrals, conferences)
//   tools    the difference between the shares of their runs that put clAInk to work
// Two policies that differ in kind differ in at least one of the three.
const tv = (a, b) => 0.5 * Object.keys(a).reduce((t, k) => t + Math.abs(a[k] - (b[k] || 0)), 0);
export function mixDistance(policies) {
  const names = Object.keys(policies), out = {};
  for (const a of names) for (const b of names) {
    if (a >= b) continue;
    out[a + " / " + b] = tv(policies[a].mix, policies[b].mix);
  }
  return out;
}
export function strategyDistance(policies) {
  const names = Object.keys(policies), out = {};
  for (const a of names) for (const b of names) {
    if (a >= b) continue;
    out[a + " / " + b] = { mix: tv(policies[a].mix, policies[b].mix), sources: tv(policies[a].sources, policies[b].sources), tools: Math.abs(policies[a].claink.used - policies[b].claink.used) };
  }
  return out;
}
