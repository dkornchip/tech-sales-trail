'use strict';
/*
 * One session: build A and build B, side by side, fed the same moves.
 *
 * After EVERY move, in this order, the session fails on the first thing that is not identical:
 *   1. trouble      a page error, a console.error, an unexpected request, a timer callback that threw, a move
 *                   that could not be made, a page that did not settle, a replaced Math.random
 *   2. draws        the number of Math.random draws consumed since the last reset (and how many of them came
 *                   from the scripted queue)
 *   3. state        the normalised save (lib/normalise.cjs), field by field
 *   4. dialog       the open dialog's canonical id and its number of options
 *   5. legal        the set of legal moves (minus the documented benign differences in lib/allowlist.cjs)
 *   6. sound        with --sound: the sequence of sound intents and the number of lines actually spoken
 *   7. invariants   per build: a UI-only move changed nothing mechanical; a reload gave back the same state
 *   8. dead end     no legal move at all (there is always one: End Week, a dialog button, or New Run)
 * Scripted scenarios add a ninth check that is about the HARNESS, not the build: the baseline must have gone
 * down the branch the scenario was written to reach, otherwise the scenario is broken and says so.
 */
const { Side } = require('./side.cjs');
const { normalise, stripAllowed, diff } = require('./normalise.cjs');
const { ADDITIVE_KEYS, BENIGN_RULES } = require('./allowlist.cjs');
const { Census, isOver, plain } = require('./census.cjs');
const { choose, mulberry } = require('./policies.cjs');
const { withReload } = require('../drivers/interface.cjs');

// How often a policy session drops into a late-game save instead of making a move.
const LATE_RATE = 0.012;
// Extra settle rounds after an ending opens, in --sound runs.
const ENDING_ROUNDS = 5;

// Moves that only rearrange the interface. Asserted per build: no draw, no change to the normalised state.
const UI_ONLY = new Set(['ck:cta', 'ck:notnow', 'ck:cancel', 'ck:keep', 'ck:minimize', 'ck:expand', 'ck:ad-min', 'ck:ad-expand', 'ui:rules', 'save']);

const fnv = text => { let h = 0x811c9dc5; for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); } return h >>> 0; };
const short = v => { const s = typeof v === 'string' ? v : JSON.stringify(v); return s === undefined ? 'undefined' : s.length > 160 ? s.slice(0, 157) + '...' : s; };

// Walks a list of scripted scenarios: clear any dialog, load the scenario's crafted save, play its steps.
class Script {
  constructor(scenarios) { this.list = scenarios; this.i = 0; this.k = -1; this.finished = []; }
  next(dialog) {
    for (;;) {
      if (this.i >= this.list.length) return null;
      const sc = this.list[this.i];
      if (this.k === -1) {
        if (!sc.save && !sc.storage) { this.k = 0; continue; }
        if (dialog) return { move: /^end:/.test(dialog.id) ? 'newrun' : 'dlg:0', scenario: sc.name, auto: true };
        this.k = 0;
        // sc.storage ({ localStorage key: raw string }) and sc.onLoad (expectations for the state right after the
        // Load button) are for test/saves; the scenarios in lib/scenarios.cjs use neither.
        return { move: 'inject:' + sc.name, save: sc.save, storage: sc.storage || null, expect: sc.onLoad || null, scenario: sc.name, last: !sc.steps.length };
      }
      if (this.k < sc.steps.length) {
        const st = sc.steps[this.k++];
        const o = typeof st === 'string' ? { m: st } : st;
        return { move: o.m, queue: o.q || null, expect: o.x || null, scenario: sc.name, last: this.k === sc.steps.length };
      }
      this.i++; this.k = -1;
    }
  }
}

/*
 * spec  { id, seed, policy, scenarios, maxMoves, motion, fx, startSave, repro(step) }
 *       and, for test/saves only: startStorage ({ localStorage key: raw string } in place before the first load),
 *       expectOnLoad (scenario-style expectations for the state right after that load), playEndings (let an
 *       ending's cutscene cues play out even without --sound, so `said` can be checked)
 * env   { buildA, buildB, driverA, driverB, sound, roundMs, maxRounds, strictNetwork,
 *         seedOffsetB, flavorB, fxB        (selftest only: deliberately different dice / flavor / cosmetic stream in B)
 *         onStep(info)                     (optional progress hook) }
 * Resolves to { ok, id, steps, draws, failure, census, scenarioEnds, notes, ms }.
 */
async function runSession(browser, spec, env) {
  const t0 = Date.now();
  const roundMs = env.roundMs || 2000, maxRounds = env.maxRounds || 8;
  const pageSeed = spec.seed >>> 0;
  const common = { motion: spec.motion, roundMs, maxRounds };
  const A = new Side(Object.assign({ label: 'A', build: env.buildA, driver: env.driverA, seed: pageSeed, fx: spec.fx, flavor: 0.5 }, common));
  const B = new Side(Object.assign({ label: 'B', build: env.buildB, driver: env.driverB, seed: (pageSeed + (env.seedOffsetB || 0)) >>> 0,
    fx: env.fxB || spec.fx, flavor: env.flavorB === undefined ? 0.5 : env.flavorB }, common));
  const census = new Census();
  const result = { ok: true, id: spec.id, steps: 0, draws: 0, failure: null, census, scenarioEnds: {}, notes: {}, ms: 0 };
  const history = [];       // the last moves, for the failure report
  const benign = (env.driverB.benign || []).map(name => { const r = BENIGN_RULES[name]; if (!r) throw new Error(`driver ${env.driverB.name}: unknown benign rule ${name}`); return r; });
  const canonA = env.driverA.canon, canonB = env.driverB.canon;
  // env.self: A is build B too (test/saves --a self), so the keys B adds are taken out of both
  const normA = s => (env.self ? stripAllowed(normalise(s, canonA), ADDITIVE_KEYS, '') : normalise(s, canonA));
  const normB = s => stripAllowed(normalise(s, canonB), ADDITIVE_KEYS, '');

  let a = null, b = null, stateA = null, stateB = null, step = -1, move = '(load)';
  const failWith = (kind, lines, diffs) => {
    result.ok = false;
    result.failure = {
      kind, session: spec.id, seed: spec.seed, policy: spec.policy || null, motion: spec.motion, fx: spec.fx, step, move,
      scenario: history.length ? history[history.length - 1].scenario || null : null,
      lines: lines || [], diffs: diffs || [],
      drawsA: a ? a.draws : null, drawsB: b ? b.draws : null,
      lastMoves: history.slice(-10).map(h => `${h.step}:${h.move}${h.queue ? '[q' + h.queue + ']' : ''}`),
      lastLogsA: (a && a.logs || []).slice(-4).map(l => l.msg), lastLogsB: (b && b.logs || []).slice(-4).map(l => l.msg),
      repro: spec.repro ? spec.repro(Math.max(1, step + 1), history.length ? history[history.length - 1].scenario : null) : null
    };
    return result;
  };

  // Checks 1 to 5 (and 6 with --sound): is B where A is?
  const compare = () => {
    const trouble = [].concat(A.drainTrouble().map(t => 'A ' + t), B.drainTrouble().map(t => 'B ' + t));
    for (const [side, s] of [['A', a], ['B', b]]) {
      for (const t of s.thrown || []) trouble.push(`${side} ${t}`);
      if (s.actError) trouble.push(`${side} could not make the move: ${s.actError}`);
      if (s.settled === false) trouble.push(`${side} did not settle within ${maxRounds} rounds of ${roundMs} ms`);
      if (!s.rngIntact) trouble.push(`${side} replaced Math.random: the dice are no longer the harness's`);
      if (s.state === null) trouble.push(`${side} has no autosave to read`);
    }
    if (trouble.length) return failWith('trouble', trouble);
    if (a.wall !== b.wall) return failWith('harness', [`fake clocks disagree: A ${a.wall} B ${b.wall}`]);
    if (a.draws !== b.draws || a.fromQueue !== b.fromQueue)
      return failWith('draws', [`Math.random draws since the last reset: A ${a.draws} (${a.fromQueue} scripted), B ${b.draws} (${b.fromQueue} scripted)`]);
    stateA = JSON.parse(a.state); stateB = JSON.parse(b.state);
    const d = diff(normA(stateA), normB(stateB));
    if (d.length) return failWith('state', [`${d.length} field(s) differ`], d.slice(0, 40));
    const da = a.dialog, db = b.dialog;
    if ((da ? da.id : null) !== (db ? db.id : null) || (da ? da.options : 0) !== (db ? db.options : 0))
      return failWith('dialog', [`open dialog: A ${da ? da.id + ' (' + da.options + ' options)' : 'none'}, B ${db ? db.id + ' (' + db.options + ' options)' : 'none'}`]);
    const la = withReload(a.legal, da), lb = withReload(b.legal, db);
    const missing = la.filter(m => !lb.includes(m)), extra = lb.filter(m => !la.includes(m));
    const excused = missing.filter(m => benign.some(r => r.move === m && r.when(stateA)));
    if (extra.length || missing.length > excused.length)
      return failWith('legal', [`legal moves differ. only in A: ${missing.filter(m => !excused.includes(m)).join(' ') || '-'}   only in B: ${extra.join(' ') || '-'}`,
        `A: ${la.join(' ')}`, `B: ${lb.join(' ')}`]);
    a.choosable = la.filter(m => !excused.includes(m));
    a.excused = excused;
    if (env.sound) {
      // a driver may reduce its build's trace for a move whose route differs (canon.sound, e.g. a control that moved into a menu)
      // Typing ticks (play:key) follow the words a scene types: how many there are, and where they fall between
      // the other sounds, is the length of each sentence. Where build B's words were rewritten
      // (canon.rewrittenCaptions) the ticks are left out of both traces; every other sound is still compared in order.
      const runs = list => (canonB.rewrittenCaptions ? list.filter(t => t !== 'play:key') : list);
      const heard = (canon, list) => runs(canon.sound ? canon.sound(list, move) : list);
      const sa = heard(canonA, a.sound).join(' '), sb = heard(canonB, b.sound).join(' ');
      if (sa !== sb) return failWith('sound', ['sound intents differ', `A: ${sa || '(none)'}`, `B: ${sb || '(none)'}`]);
      if (a.speech.length !== b.speech.length) return failWith('sound', [`lines spoken: A ${a.speech.length} ${short(a.speech)}, B ${b.speech.length} ${short(b.speech)}`]);
    }
    // For refactors that must not change a single word: the log lines written this step (text and kind), and
    // everything a player can read on the page. Off by default, because the rewrite changes both on purpose.
    if (env.strictLogs) {
      const la2 = JSON.stringify(a.logs), lb2 = JSON.stringify(b.logs);
      if (la2 !== lb2 || a.logCount !== b.logCount || a.logsSwapped !== b.logsSwapped) {
        const i = a.logs.findIndex((l, k) => JSON.stringify(l) !== JSON.stringify(b.logs[k]));
        return failWith('logs', [`log lines differ (A wrote ${a.logs.length}, B wrote ${b.logs.length}; totals ${a.logCount} / ${b.logCount})`,
          `A: ${JSON.stringify(a.logs[i < 0 ? a.logs.length - 1 : i] || null)}`, `B: ${JSON.stringify(b.logs[i < 0 ? b.logs.length - 1 : i] || null)}`]);
      }
    }
    if (env.strictText && a.text !== b.text) {
      const ta = a.text.split('\n'), tb = b.text.split('\n');
      let i = 0; while (i < ta.length && i < tb.length && ta[i] === tb[i]) i++;
      return failWith('text', [`the visible page text differs at line ${i + 1} (A has ${ta.length} lines, B has ${tb.length})`,
        `A: ${JSON.stringify((ta[i] || '(end)').slice(0, 300))}`, `B: ${JSON.stringify((tb[i] || '(end)').slice(0, 300))}`]);
    }
    return null;
  };

  // Check 9: is the baseline where the scenario (or a save fixture) says it should be? Returns what is wrong.
  // `dock` and `said` are asked of BOTH builds, because nothing else compares them: the dock id is not part of
  // parity, and sound intents are only compared with --sound.
  const expectations = (x, ctx) => {
    // (plain(): an emoji with and without its variation selector is the same emoji)
    const msgs = a.logsSwapped ? [] : a.logs.map(l => plain(l.msg)), bad = [];
    for (const t of x.log || []) if (!msgs.some(m => m.indexOf(plain(t)) >= 0)) bad.push(`expected a log line containing ${JSON.stringify(t)}; got ${JSON.stringify(msgs)}`);
    for (const t of x.nolog || []) if (msgs.some(m => m.indexOf(plain(t)) >= 0)) bad.push(`expected NO log line containing ${JSON.stringify(t)}`);
    if ('dialog' in x && (a.dialog ? a.dialog.id : null) !== x.dialog) bad.push(`expected dialog ${x.dialog}, got ${a.dialog ? a.dialog.id : null}`);
    if ('cause' in x && stateA.endCause !== x.cause) bad.push(`expected endCause ${x.cause}, got ${stateA.endCause}`);
    for (const k of x.hits || []) if (!ctx.hits.includes(k)) bad.push(`expected census key ${k}; this step hit ${ctx.hits.join(' ')}`);
    for (const m of x.legal || []) if (!a.choosable.includes(m)) bad.push(`expected ${m} to be legal; legal: ${a.choosable.join(' ')}`);
    for (const m of x.illegal || []) if (a.choosable.includes(m)) bad.push(`expected ${m} NOT to be legal`);
    if (x.state && !x.state(stateA)) bad.push(`state check failed: ${x.state}`);
    if ('draws' in x && ctx.drawsUsed !== x.draws) bad.push(`expected the move to consume ${x.draws} draw(s), it consumed ${ctx.drawsUsed}`);
    if ('dock' in x) for (const [side, s] of [['A', a], ['B', b]]) if (s.dock !== x.dock) bad.push(`expected clAInk dock ${x.dock}, ${side} shows ${s.dock}`);
    for (const key of x.said || []) for (const [side, s] of [['A', a], ['B', b]]) {
      if (!s.sound.some(t => t === 'say:' + key || t.indexOf('say:' + key + '!') === 0)) bad.push(`expected ${side} to ask the announcer for "${key}"; its sound intents: ${s.sound.join(' ') || '(none)'}`);
    }
    return bad;
  };

  try {
    [a, b] = await Promise.all([A.open(browser, spec.startSave || null, spec.startStorage || null), B.open(browser, spec.startSave || null, spec.startStorage || null)]);
    // What drew from Math.random before the dice were reset. The baseline's game logic draws nothing at load
    // (newGame and mergeSaved are draw-free); what does is the framework. Build B must not draw more than a few.
    result.notes.earlyA = { draws: A.boots[0].earlyDraws, by: A.boots[0].early };
    result.notes.earlyB = { draws: B.boots[0].earlyDraws, by: B.boots[0].early };
    result.notes.bootSeen = [A.boots[0].bootSeen, B.boots[0].bootSeen];
    if (B.boots[0].earlyDraws > 4) return failWith('trouble', [`B drew from Math.random ${B.boots[0].earlyDraws} times while loading (more than 4): ${B.boots[0].early.join(' ; ')}`]);
    if (A.boots[0].bootSeen !== B.boots[0].bootSeen) return failWith('trouble', [`boot overlay: A ${A.boots[0].bootSeen ? 'shown' : 'not shown'}, B ${B.boots[0].bootSeen ? 'shown' : 'not shown'}`]);
    for (const [side, s] of [['A', A], ['B', B]]) {
      if (!s.audio || !s.audio.on || !s.audio.voice) return failWith('trouble', [`${side}: sound or announcer is off (${JSON.stringify(s.audio)}); the sound engine would decide nothing`]);
    }
    if (compare()) return result;
    if (spec.expectOnLoad) {
      const bad = expectations(spec.expectOnLoad, { hits: [], drawsUsed: 0 });
      if (bad.length) return failWith('scenario', bad.map(t => `${spec.id} (on load): ${t}`));
    }
    census.sound(a.sound, a.speech);      // what the boot screen played
    if (env.strictNetwork && B.net.fonts) return failWith('trouble', [`B made ${B.net.fonts} network request(s) besides its own document (Google Fonts)`]);

    const script = spec.scenarios && spec.scenarios.length ? new Script(spec.scenarios) : null;
    const rng = mulberry(fnv('pick:' + spec.id));
    let mem = {};
    let scripted = !!script;

    for (step = 0; step < spec.maxMoves; step++) {
      const legal = a.choosable;
      if (!legal.length) return failWith('dead-end', [`no legal move. dialog ${a.dialog ? a.dialog.id : 'none'}, run over: ${isOver(stateA)}`]);

      let pick = null;
      if (scripted) {
        pick = script.next(a.dialog);
        if (!pick) { scripted = false; if (!spec.policy) break; }
      }
      if (!pick && spec.lateStarts && legal.includes('load') && rng() < LATE_RATE) {
        // drop into a late-game save (see LATE_STARTS in lib/scenarios.cjs); the dice carry on where they are
        const k = Math.floor(rng() * spec.lateStarts.length);
        pick = { move: 'inject:late-' + k, save: spec.lateStarts[k](), keepDice: true };
      }
      if (!pick) pick = { move: choose(spec.policy, { legal, state: stateA, dialog: a.dialog, rng, mem, step }) };
      move = pick.move;
      const isInject = move.indexOf('inject:') === 0;
      const domMove = isInject ? 'load' : move;
      if (!legal.includes(domMove) && (a.excused || []).includes(domMove)) {
        // A reviewed, benign difference (lib/allowlist.cjs): build B does not offer this move here, so a script that
        // presses it has nothing to compare. The step is skipped in both builds and counted.
        result.notes.excusedSteps = (result.notes.excusedSteps || 0) + 1;
        continue;
      }
      if (!legal.includes(domMove)) {
        return failWith(pick.scenario ? 'scenario' : 'harness', [`${pick.scenario ? 'scenario ' + pick.scenario + ': ' : ''}move ${move} is not legal in the baseline here. legal: ${legal.join(' ')}`]);
      }
      history.push({ step, move, queue: pick.queue ? pick.queue.length : 0, scenario: pick.scenario });

      const prevA = stateA, prevB = stateB, prevDialog = a.dialog, prevDrawsA = a.draws, prevDrawsB = b.draws;
      if (move === 'reload') {
        [a, b] = await Promise.all([A.reload(), B.reload()]);
      } else {
        if (isInject) {
          // A scenario starts from its own dice as well as its own save, so it plays out the same whether it runs
          // alone (--scenario) or in the middle of the suite.
          const dice = pick.keepDice ? null : fnv('scenario:' + pick.scenario);
          const diceB = dice === null ? null : (dice + (env.seedOffsetB || 0)) >>> 0;
          if (pick.storage) await Promise.all([A.store(pick.storage, dice), B.store(pick.storage, diceB)]);
          else await Promise.all([A.inject(pick.save, dice), B.inject(pick.save, diceB)]);
        }
        [a, b] = await Promise.all([A.step(domMove, pick.queue), B.step(domMove, pick.queue)]);
        // Both builds must have lived through the same amount of fake time, or cooldowns and timestamps drift.
        if (a.rounds !== b.rounds && a.settled && b.settled) {
          const lag = a.rounds < b.rounds ? 'a' : 'b';
          const more = await (lag === 'a' ? A : B).extra(Math.abs(a.rounds - b.rounds));
          const old = lag === 'a' ? a : b;
          more.sound = old.sound.concat(more.sound); more.speech = old.speech.concat(more.speech); more.logs = old.logs.concat(more.logs);
          more.logsSwapped = old.logsSwapped; more.rounds = Math.max(a.rounds, b.rounds);
          if (lag === 'a') a = more; else b = more;
        }
      }
      // With --sound, an ending gets to play out: its cutscene cues run for about nine seconds, and the next move
      // (New Run) would otherwise cut them off half way.
      if ((env.sound || spec.playEndings) && a.dialog && /^end:/.test(a.dialog.id) && !(prevDialog && prevDialog.id === a.dialog.id) && a.settled && b.settled) {
        const [ma, mb] = await Promise.all([A.extra(ENDING_ROUNDS), B.extra(ENDING_ROUNDS)]);
        for (const [old, more] of [[a, ma], [b, mb]]) {
          more.sound = old.sound.concat(more.sound); more.speech = old.speech.concat(more.speech); more.logs = old.logs.concat(more.logs);
          more.logsSwapped = old.logsSwapped; more.rounds = old.rounds + ENDING_ROUNDS;
        }
        a = ma; b = mb;
      }
      result.steps++;
      if (compare()) return result;
      // draws compared: the dice restart at every reload and every scenario
      result.draws += move === 'reload' || (isInject && !pick.keepDice) ? a.draws : Math.max(0, a.draws - prevDrawsA);

      // 7. per-build invariants
      const uiOnly = UI_ONLY.has(move) || (move === 'dlg:0' && prevDialog && prevDialog.id === 'help');
      if (uiOnly || move === 'reload') {
        const what = move === 'reload' ? 'roundtrip' : 'ui-move';
        for (const [side, before, after, norm, d0, d1] of [['A', prevA, stateA, normA, prevDrawsA, a.draws], ['B', prevB, stateB, normB, prevDrawsB, b.draws]]) {
          const d = diff(norm(before), norm(after));
          if (d.length) return failWith(what, [move === 'reload' ? `${side}: the state read back after a reload is not the state before it` : `${side}: UI-only move ${move} changed the game state`], d.slice(0, 20));
          if (move !== 'reload' && d0 !== d1) return failWith(what, [`${side}: UI-only move ${move} consumed ${d1 - d0} draw(s)`]);
        }
      }

      const hits = census.step({ move, prev: prevA, cur: stateA, snap: a, prevDialog });
      census.sound(a.sound, a.speech);
      if (/^(newrun|newgame|load|inject:|reload)/.test(move)) mem = {};

      // 9. did the baseline go where the scenario says it should?
      if (pick.expect) {
        const bad = expectations(pick.expect, { hits, drawsUsed: a.draws - prevDrawsA });
        if (bad.length) return failWith('scenario', bad.map(t => `scenario ${pick.scenario}: ${t}`));
      }
      if (pick.scenario && pick.last) result.scenarioEnds[pick.scenario] = JSON.stringify({ state: normA(stateA), dialog: a.dialog });
      if (env.onStep) env.onStep({ step, move, a, b });
    }
    result.notes.flavorCalls = [a.flavorCalls, b.flavorCalls];
    result.notes.fxDraws = [a.fxDraws, b.fxDraws];
    result.notes.net = { A: Object.assign({}, A.net), B: Object.assign({}, B.net) };
    return result;
  } catch (e) {
    return failWith('harness', ['the harness itself threw: ' + String(e && e.stack || e).slice(0, 1200)]);
  } finally {
    result.ms = Date.now() - t0;
    await Promise.all([A.close(), B.close()]);
  }
}

function formatFailure(f) {
  const out = [];
  out.push(`PARITY FAILURE  [${f.kind}]  session ${f.session}`);
  out.push(`  seed ${f.seed}   policy ${f.policy || '(scripted)'}   motion ${f.motion}   fx ${f.fx.mode === 'const' ? f.fx.value : 'seeded'}${f.scenario ? '   scenario ' + f.scenario : ''}`);
  out.push(`  step ${f.step}   move ${f.move}`);
  out.push(`  draws consumed   A ${f.drawsA}   B ${f.drawsB}`);
  for (const l of f.lines) out.push('  ' + l);
  if (f.diffs.length) {
    out.push('  path'.padEnd(44) + 'A'.padEnd(30) + 'B');
    for (const d of f.diffs) out.push('  ' + String(d.path).padEnd(42) + short(d.a).padEnd(30) + short(d.b));
  }
  out.push(`  last moves: ${f.lastMoves.join('  ')}`);
  if (f.lastLogsA.length) out.push(`  A's last log lines: ${f.lastLogsA.map(short).join(' | ')}`);
  if (f.lastLogsB.length) out.push(`  B's last log lines: ${f.lastLogsB.map(short).join(' | ')}`);
  if (f.repro) out.push(`  reproduce: ${f.repro}`);
  return out.join('\n');
}

module.exports = { runSession, formatFailure, UI_ONLY, fnv };
