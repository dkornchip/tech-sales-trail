'use strict';
/*
 * The census: which branches of the game a set of runs actually went through, and the floors a run set must meet.
 *
 * It is derived from the BASELINE only: the moves made, the baseline's new log lines, its state and its dialog.
 * The baseline is frozen, so matching on its emoji-prefixed log text is safe here (and only here): the build
 * under test is never read for this, and its copy is free to change.
 *
 * A parity run that never fired anyone, never revoked a seat and never rolled a QBR proves very little, however
 * green it is. In --full mode every floor below must be met or the run fails.
 */

// [census key, text the baseline's log line starts with]. First match wins per line; order matters where one
// prefix is a prefix of another.
const LOG_RULES = [
  // actions (the log line is the proof that the action ran, not just that a button was pressed)
  ['act.prospect', '📞 Blitz'], ['act.cadence', '✉️ Cadence'], ['act.discovery', '🔎 Discovery'], ['act.demo', '🖥️ Demos'],
  ['act.propose', '📑 Proposals'], ['act.network', '🧑‍🤝‍🧑 Referrals'], ['act.conference', '🏟️ Conference'],
  ['act.recharge', '🧘 Recharged'], ['act.recharge.again', '⏱️ Already recharged'], ['act.coffee', '☕ Shot'], ['act.coffee', '🚀 Shot'],
  ['act.politics', '🏛️ Politics'], ['act.crm', '🧹 CRM cleanup'], ['act.crm.nuke', '🗑️'],
  ['act.close', '🤝 Close push'], ['act.hail', '🧪 Hail-Mary: “last chance”'], ['act.hail', '🧪 Hail-Mary: leaning'],
  ['hail.miracle.win', '🌪️'], ['hail.miracle.fail', '🤕'], ['hail.torched', '📛'], ['hail.ink', '😬'],
  ['recharge.trip', '🏝️'], ['achievement.whale', '🏅'],
  // week
  ['week.friday', '🕘 Friday closes'], ['week.rent', '🏠 Rent'], ['week.ghost', '👻'], ['week.fullfunnel', '🧩'], ['week.neglected', '🪫'],
  ['week.stale', '🍂'], ['week.backlog', '🕑'], ['week.crash', '🥴'], ['week.cadence-penalty', '📵'], ['week.next', '📆 Week'],
  ['stress.warned', '🫀'], ['cash.warned', '⚠️ Cash under'], ['deals.killed', '💀 Lost'],
  // events
  ['evt.marketing', '📣'], ['evt.fumble', '🛠️'], ['evt.saved', '🧙'], ['evt.outage', '🌩️'], ['evt.champion', '🪜'], ['evt.casestudy', '📘'],
  ['evt.meme', '🐦'], ['evt.freeze', '🥶'], ['evt.crud', '🤒'], ['evt.rebalance', '📉 Territory'],
  ['evt.favors.shred', '🛡️ Manager shredded'], ['evt.favors.intros', '🛡️ Manager called'],
  ['evt.competitor.match', '💸 Matched'], ['evt.competitor.hold', '🧱 Held'], ['evt.security.own', '🔦 Came clean'], ['evt.security.spin', '🌀 Spun it'],
  // mid-quarter reviews
  ['mid.warn1', '👀'], ['mid.warn2', '📋'], ['mid.warn3', '🧊'], ['mid.recurring', '📆 Recurring'],
  // QBR
  ['qbr.nods', '🗣️ QBR: nods'], ['qbr.softpip', '🗣️ QBR: soft PIP'], ['qbr.pip-tightens', '🗣️ QBR: PIP tightens'], ['qbr.macro', '🗣️ QBR: manager blames'],
  ['qbr.passive', '🗣️ QBR: passive-aggressive'], ['qbr.dodged', '📄 Dodged the axe'], ['qbr.barely', '📄 Barely kept'],
  ['qbr.reassigned', '📉 Manager “reassigned”'], ['qbr.pip-vanishes', '🪄'],
  // clAInk
  ['ck.install', '🤖 clAInk seat live'], ['ck.dismissed', '🙅'], ['ck.expired', '⏳'], ['ck.miracle', '✨'],
  // (the baseline builds these two from a template, `${hurt?"💥":"⚖️"} Strike`; the third entry is what to look
  // for in its source when checking that this table is still in step with it)
  ['ck.strike.clean', '⚖️ Strike', '"⚖️"} Strike'], ['ck.strike.hurt', '💥 Strike', '?"💥":'], ['ck.revoked', '🔒 Strike 3/3'], ['ck.farewell', '💔'],
  ['ck.cancelled', '🔌'], ['ck.invoice', '🧾 clAInk invoice'], ['ck.mgr.yoink', '👔 Boss took'], ['ck.mgr.circleback', "👔 'ChatGDP again?'"], ['ck.mgr.warning', '👔']
];

// Emoji with and without the variation selector are the same emoji.
const plain = t => String(t).replace(/\uFE0F/g, '');

const INCIDENT_BY_WHO = { 'Marketing Ops': 'slop', Legal: 'discount', 'IT Security': 'leak', 'Customer Success': 'churn' };
const isOver = s => !!(s && (s.fired || s.burnedOut || s.win || s.missed || s.repo));

/*
 * Floors. Every key must be counted at least this many times in a --full run set (and, for the keys the scripted
 * scenarios guarantee, in a default run set too: see run.cjs). The list is the task's list plus the branches
 * that sit next to them.
 */
const FLOORS = {
  // every action
  'act.prospect': 1, 'act.cadence': 1, 'act.discovery': 1, 'act.demo': 1, 'act.propose': 1, 'act.close': 1, 'act.network': 1,
  'act.conference': 1, 'act.recharge': 1, 'act.coffee': 1, 'act.politics': 1, 'act.crm': 1, 'act.hail': 1, 'move.end': 1,
  // both modal events, both options of each
  'dialog.evt:competitor': 1, 'evt.competitor.match': 1, 'evt.competitor.hold': 1,
  'dialog.evt:security': 1, 'evt.security.own': 1, 'evt.security.spin': 1,
  // the other eleven events
  'evt.marketing': 1, 'evt.fumble': 1, 'evt.saved': 1, 'evt.outage': 1, 'evt.champion': 1, 'evt.casestudy': 1, 'evt.meme': 1,
  'evt.freeze': 1, 'evt.crud': 1, 'evt.rebalance': 1, 'evt.favors.shred': 1, 'evt.favors.intros': 1,
  // clAInk
  'ck.install': 1, 'ck.miracle': 1, 'ck.strike.clean': 1,
  'ck.incident.slop': 1, 'ck.incident.discount': 1, 'ck.incident.leak': 1, 'ck.incident.churn': 1,
  'ck.revoked': 1, 'ck.cancelled': 1, 'ck.dismissed': 1, 'ck.expired': 1,
  'ck.mgr.warning': 1, 'dialog.ck:warning': 1, 'ck.mgr.yoink': 1, 'dialog.ck:lesson': 1, 'ck.mgr.circleback': 1,
  'ck.invoice': 1, 'ck.invoice.idle': 1, 'ck.invoice.overage': 1, 'ck.card.hidden': 1,
  // every ending, by cause
  'end.club': 1, 'end.missed': 1, 'end.qbr': 1, 'end.qbr.roll': 1, 'end.qbr.under70': 1, 'end.review': 1, 'end.org': 1, 'end.politics': 1,
  'end.stress.instant': 1, 'end.stress.weekend': 1, 'end.caffeine': 1, 'end.repo.rent': 1, 'end.repo.spend': 1, 'end.claink': 1,
  'dialog.end:club': 1, 'dialog.end:missed': 1, 'dialog.end:fired': 1, 'dialog.end:meltdown': 1, 'dialog.end:ascension': 1, 'dialog.end:repo': 1,
  // mid-quarter ladder, QBR side branches, weekly side effects
  'mid.warn1': 1, 'mid.warn2': 1, 'mid.warn3': 1, 'mid.recurring': 1,
  'qbr.nods': 1, 'qbr.softpip': 1, 'qbr.pip-tightens': 1, 'qbr.macro': 1, 'qbr.passive': 1, 'qbr.dodged': 1, 'qbr.barely': 1,
  'qbr.reassigned': 1, 'qbr.pip-vanishes': 1,
  'hail.miracle.win': 1, 'hail.miracle.fail': 1, 'hail.torched': 1, 'hail.ink': 1,
  'week.friday': 1, 'week.rent': 1, 'week.ghost': 1, 'week.fullfunnel': 1, 'week.neglected': 1, 'week.stale': 1, 'week.backlog': 1,
  'week.crash': 1, 'week.cadence-penalty': 1, 'stress.warned': 1, 'cash.warned': 1, 'deals.killed': 1,
  'recharge.trip': 1, 'act.recharge.again': 1, 'act.crm.nuke': 1, 'achievement.whale': 1,
  // save, load, reload, new run (and the rest of the harness-level moves)
  'move.save': 1, 'move.load': 1, 'move.reload': 1, 'move.newrun': 1, 'move.newgame': 1,
  'move.ck:cta': 1, 'move.ck:accept': 1, 'move.ck:notnow': 1, 'move.ck:run': 1, 'move.ck:cancel': 1, 'move.ck:cancel-confirm': 1,
  'move.ck:keep': 1, 'move.ck:dismiss': 1, 'move.ck:hide': 1, 'move.ck:minimize': 1, 'move.ck:expand': 1, 'move.ck:ad-min': 1,
  'move.ck:ad-expand': 1, 'move.ui:rules': 1, 'dialog.help': 1, 'move.dlg:0': 1, 'move.dlg:1': 1,
  'reload.at-ending': 1, 'reload.with-seat': 1
};

class Census {
  constructor() { this.counts = Object.create(null); }
  hit(key, n) { this.counts[key] = (this.counts[key] || 0) + (n === undefined ? 1 : n); }
  merge(other) { for (const k of Object.keys(other.counts || other)) this.hit(k, (other.counts || other)[k]); }

  /*
   * One step of the baseline.
   *   move      the canonical move (inject:<fixture> counts as a load)
   *   prev/cur  the baseline's raw state before and after
   *   snap      the baseline's snapshot after the step (logs, logsSwapped, dialog)
   *   prevDialog  the dialog that was open before the step
   * Returns the keys this step hit, for scenario expectations.
   */
  step({ move, prev, cur, snap, prevDialog }) {
    const hits = [];
    const hit = k => { this.hit(k); hits.push(k); };
    hit('move.' + (move.indexOf('inject:') === 0 ? 'inject' : move));
    if (move.indexOf('inject:') === 0) hit('move.load');
    if (snap.dialog && (!prevDialog || prevDialog.id !== snap.dialog.id || /^(reload|inject:)/.test(move))) hit('dialog.' + snap.dialog.id);
    if (move === 'reload') {
      if (snap.dialog && /^end:/.test(snap.dialog.id)) hit('reload.at-ending');
      if (cur && cur.claink && cur.claink.status === 'active') hit('reload.with-seat');
    }
    // A swapped log (load, new run, new game, reload) is history, not something this step did.
    const lines = snap.logsSwapped ? [] : snap.logs.map(l => plain(l.msg));
    for (const msg of lines) {
      for (const [key, prefix] of LOG_RULES) { if (msg.indexOf(plain(prefix)) === 0) { hit(key); break; } }
      if (msg.indexOf('🧾 clAInk invoice') === 0) {
        if (/Idle agents/.test(msg)) hit('ck.invoice.idle');
        if (/looped all weekend/.test(msg)) hit('ck.invoice.overage');
      }
      if (msg.indexOf('💥 Strike') === 0) {
        const who = cur && cur.claink && cur.claink.last && cur.claink.last.strike && cur.claink.last.strike.who;
        hit('ck.incident.' + (INCIDENT_BY_WHO[who] || 'unknown'));
      }
    }
    if (move === 'ck:hide' && cur && cur.claink && cur.claink.hidden) hit('ck.card.hidden');
    // An ending that this step caused.
    if (cur && isOver(cur) && prev && !isOver(prev) && !/^(inject:|load$|reload$|newgame$|newrun$)/.test(move)) {
      const cause = cur.endCause || 'unknown';
      const has = t => lines.some(m => m.indexOf(plain(t)) >= 0);
      if (cause === 'stress') hit(has('☢️ Stress 100') ? 'end.stress.instant' : has('Weekend didn’t help') ? 'end.stress.weekend' : 'end.stress.other');
      else if (cause === 'repo') hit(move === 'end' && has('🏠 Rent') ? 'end.repo.rent' : 'end.repo.spend');
      else if (cause === 'qbr') { hit('end.qbr'); hit(has('exit interview') ? 'end.qbr.roll' : has('under 70%') ? 'end.qbr.under70' : 'end.qbr.other'); }
      else hit('end.' + cause);
    }
    return hits;
  }

  // The baseline's sound intents for one step ("play:<name>", "play:<name>!drop", "say:<key>", "say:<key>!drop")
  // and the lines it actually spoke. Kept under snd.* so the mechanical table stays readable.
  // snd.play.<name> / snd.say.<key> count every intent, dropped or not; snd.dropped.* count the dropped ones.
  sound(intents, speech) {
    for (const e of intents || []) {
      const dropped = /!drop$/.test(e), id = e.replace(/!drop$/, '').replace(':', '.');
      this.hit('snd.' + id);
      if (dropped) this.hit('snd.dropped.' + id.split('.')[0]);
    }
    if (speech && speech.length) this.hit('snd.spoken', speech.length);
  }

  // Floors that were not met: [{key, need, got}].
  unmet(floors) {
    const out = [];
    for (const k of Object.keys(floors)) { const got = this.counts[k] || 0; if (got < floors[k]) out.push({ key: k, need: floors[k], got }); }
    return out;
  }

  // which: 'game' (default) for the mechanical census, 'sound' for the snd.* tallies
  table(which) {
    const keys = Object.keys(this.counts).filter(k => (which === 'sound') === (k.indexOf('snd.') === 0)).sort();
    if (!keys.length) return '  (nothing)';
    const cells = keys.map(k => `${k} ${this.counts[k]}`);
    const width = Math.max(...cells.map(c => c.length), 10) + 2;
    const perRow = Math.max(1, Math.floor(118 / width));
    const rows = [];
    for (let i = 0; i < cells.length; i += perRow) rows.push('  ' + cells.slice(i, i + perRow).map(c => c.padEnd(width)).join(''));
    return rows.join('\n');
  }
}

/*
 * Floors for the policy sessions alone, enforced in --full: what weighted random play has to reach WITHOUT the
 * scripted scenarios. If these drop, the policies have stopped going where they used to (or the game changed
 * under them), and the seeds are no longer exploring. Set at roughly a third of what a --full run counts.
 */
const ORGANIC_FLOORS = {};

/*
 * Floors for --sound: the sound engine's decisions that must have been exercised for the trace to mean anything.
 */
const SOUND_PRESETS = [
  'achievement airport alarm bad beep beeper bowl bsod busy cash ceiling chime chirp clank',
  'click coffee coin crack crm demo dial discount doors drop elevator engine fanfareS fire',
  'fumble fwip geiger ghost glitch hailmary heartbeat honk hr hrSoft ice ignition key leads',
  'liftoff load lost magic meltdown modal newgame nope pa ping plane pop powerdown poweroff',
  'printer puzzle rent rise rumble sadHorn save screech seatbelt shield shing sick slag sneaky',
  'sonar sparkle stamp step stingerAscend stingerClub stingerFired stingerMelt stingerMissed stingerRepo suspicion thud thunder thwack',
  'tick ticktock typewriter umbrella warn week whoosh',
  // the boot screen's own cues
  'bootHum loadStart errBeep'
].join(' ').split(' ');
const SOUND_LINES = [
  'bigClose burnout burnoutCaffeine cash chatgdp claink clainkRevoked closeOut club competitor fired firedOrg',
  'firedReview freeze hr hydrate hygiene incident meetings missed newrun outage phones rebalance',
  'repo repoClaink sev1 sqlStorm strike viral week12 week13 week5 week7 welcome yoink',
  'boot filler'
].join(' ').split(' ');
const SOUND_FLOORS = { 'snd.dropped.play': 1, 'snd.dropped.say': 1, 'snd.spoken': 100 };
for (const n of SOUND_PRESETS) SOUND_FLOORS['snd.play.' + n] = 1;
for (const k of SOUND_LINES) SOUND_FLOORS['snd.say.' + k] = 1;
/*
 * Not on the list, because the baseline never produces them in play (checked against audio.js / scenes.js):
 *   presets  qbr            its log line is only ever written by the QBR, which ends the run, and the log director
 *                           is silent on a batch that ends the run (audio.js:527)
 *            denied, stingerBurnout, flatline    defined, never cued
 *   lines    whale          a whale always closes $65k+, so "bigClose" (same priority, earlier line) takes the PA
 */

module.exports = { Census, FLOORS, ORGANIC_FLOORS, SOUND_FLOORS, LOG_RULES, isOver, plain };
