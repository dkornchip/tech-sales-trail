'use strict';
/*
 * Normalisation: what "the same game state" means across two builds whose copy differs.
 *
 * Both saves are projected onto the v1.21 save shape. Only the fields named below are dropped or reduced to a
 * code; EVERYTHING ELSE IS COMPARED EXACTLY, including the float `manager` stat and including keys this file has
 * never heard of. That last part is what makes an unknown key in build B a failure: it survives normalisation,
 * so it shows up in the diff as "missing in A". The only way to let B add a key is to name it in
 * lib/allowlist.cjs.
 *
 *   logs                      dropped   (all copy; the census reads A's log, nothing compares it)
 *   runId                     dropped   (idGen: a counter plus a timestamp)
 *   deals[].id                dropped   (idGen). Deals are compared BY POSITION: array order is mechanical,
 *                                        because find() and stable sort ties read it
 *   deals[].account           dropped   (a name; the draw that picks it is still counted)
 *   deals[].probNote          code      (driver.canon.probNote: empty / peanut / big / whale / roll:x:y / ai / discount)
 *   achievements[]            key only  (the label is copy)
 *   trip                      index     (driver.canon.trip: position in the TRIPS draw table)
 *   claink.last.lines         length only
 *   claink.last.strike        n and hurt only (who / why / fx are copy); a missing hurt counts as false
 *   claink.last.clear, .farewell, .ping, .announce    dropped (copy; farewell is an account name)
 *   claink.strikeLog[]        n only    (who / line are copy)
 *
 * Kept from clAInk, exactly: status, hidden, deployed, strikes, claims, due, weekTokens, mgr.noticed, mgr.yoinks,
 * deploys, miracles, fakes, incidents, claimed, delivered, billed, lastInvoice, tokens, and in `last`: kind, week,
 * run, tokens, revenue, yoink, warn, cashWarn.
 */

const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);

function normDeal(d, canon) {
  if (!isObj(d)) return d;
  const out = {};
  for (const k of Object.keys(d)) {
    if (k === 'id' || k === 'account') continue;
    out[k] = k === 'probNote' ? canon.probNote(d[k]) : d[k];
  }
  return out;
}

function normLast(L) {
  if (!isObj(L)) return L;
  const out = {};
  for (const k of Object.keys(L)) {
    if (k === 'clear' || k === 'farewell' || k === 'ping' || k === 'announce') continue;
    if (k === 'lines') { out.lines = Array.isArray(L.lines) ? { length: L.lines.length } : L.lines; continue; }
    if (k === 'strike') {
      const S = L.strike;
      if (!isObj(S)) { out.strike = S; continue; }
      const s = {};
      for (const j of Object.keys(S)) { if (j === 'who' || j === 'why' || j === 'fx') continue; s[j] = S[j]; }
      // v1.21 writes the strike-3 card without `hurt` (game.jsx:1339) and its own save sanitiser adds
      // hurt:false on the next load (game.jsx:1166). Both mean "no damage", so a missing flag reads as false;
      // otherwise the baseline would fail its own reload round trip after every revoked seat.
      s.hurt = !!S.hurt;
      out.strike = s;
      continue;
    }
    out[k] = L[k];
  }
  return out;
}

function normClaink(c) {
  if (!isObj(c)) return c;
  const out = {};
  for (const k of Object.keys(c)) {
    if (k === 'last') { out.last = normLast(c.last); continue; }
    if (k === 'strikeLog') {
      out.strikeLog = Array.isArray(c.strikeLog) ? c.strikeLog.map(e => {
        if (!isObj(e)) return e;
        const o = {};
        for (const j of Object.keys(e)) { if (j === 'who' || j === 'line') continue; o[j] = e[j]; }
        return o;
      }) : c.strikeLog;
      continue;
    }
    out[k] = c[k];
  }
  return out;
}

// `canon` is driver.canon for the build this state came from.
function normalise(state, canon) {
  if (!isObj(state)) return state;
  const out = {};
  for (const k of Object.keys(state)) {
    if (k === 'logs' || k === 'runId') continue;
    if (k === 'deals') { out.deals = Array.isArray(state.deals) ? state.deals.map(d => normDeal(d, canon)) : state.deals; continue; }
    if (k === 'achievements') { out.achievements = Array.isArray(state.achievements) ? state.achievements.map(a => (isObj(a) ? a.key : a)) : state.achievements; continue; }
    if (k === 'trip') { out.trip = canon.trip(state.trip); continue; }
    if (k === 'claink') { out.claink = normClaink(state.claink); continue; }
    out[k] = state[k];
  }
  return out;
}

// "deals[].tier" style patterns: a path with every array index written as [].
const patternOf = p => p.replace(/\[\d+\]/g, '[]');

// Remove allowlisted additive keys from a normalised state of build B (see lib/allowlist.cjs).
function stripAllowed(node, allow, at) {
  if (!allow || !allow.length) return node;
  if (Array.isArray(node)) return node.map((v, i) => stripAllowed(v, allow, `${at}[${i}]`));
  if (!isObj(node)) return node;
  const out = {};
  for (const k of Object.keys(node)) {
    const p = at ? `${at}.${k}` : k;
    if (allow.includes(patternOf(p))) continue;
    out[k] = stripAllowed(node[k], allow, p);
  }
  return out;
}

const MISSING = '(missing)';

// Field-level differences between two normalised states: [{path, a, b}].
function diff(a, b, at, out) {
  out = out || [];
  at = at || '';
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) out.push({ path: at + '.length', a: a.length, b: b.length });
    const n = Math.max(a.length, b.length);
    for (let i = 0; i < n; i++) {
      if (i >= a.length) out.push({ path: `${at}[${i}]`, a: MISSING, b: b[i] });
      else if (i >= b.length) out.push({ path: `${at}[${i}]`, a: a[i], b: MISSING });
      else diff(a[i], b[i], `${at}[${i}]`, out);
    }
    return out;
  }
  if (isObj(a) && isObj(b)) {
    const keys = Array.from(new Set([...Object.keys(a), ...Object.keys(b)]));
    for (const k of keys) {
      const p = at ? `${at}.${k}` : k;
      const inA = Object.prototype.hasOwnProperty.call(a, k), inB = Object.prototype.hasOwnProperty.call(b, k);
      if (!inA) out.push({ path: p, a: MISSING, b: b[k] });
      else if (!inB) out.push({ path: p, a: a[k], b: MISSING });
      else diff(a[k], b[k], p, out);
    }
    return out;
  }
  // Exact: 50.2 and 50.199999999999996 are different, and so are 0 and "0", null and undefined. (Both sides come
  // out of JSON.parse, so there is no NaN and no -0 to special-case.)
  if (a !== b) out.push({ path: at || '(root)', a, b });
  return out;
}

// Compare a raw A state with a raw B state. Returns [] when they are the same game.
function compareStates(rawA, rawB, canonA, canonB, allowB) {
  const a = normalise(rawA, canonA);
  const b = stripAllowed(normalise(rawB, canonB), allowB || [], '');
  return diff(a, b);
}

module.exports = { normalise, stripAllowed, diff, compareStates, MISSING };
