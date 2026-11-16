'use strict';
/*
 * The worst cases the layout test measures. Each is a state of the game, reached the way the parity scenarios
 * reach theirs: a save in storage before the page loads, then scripted moves (with scripted dice where a roll has
 * to land). `expect` is what must be on screen once it is reached; a fixture that does not get there is a broken
 * fixture and stops the test, it is never a layout result.
 */
const { save, D, CK, HI, LO } = require('../../parity/lib/scenarios.cjs');
const { KEYS, readRaw } = require('../../saves/lib/fixtures.cjs');

const his = n => Array(n).fill(HI);
const autosave = raw => ({ [KEYS.autosave]: raw });

// A clAInk workspace with as much in it as a save can hold: eight report lines, a strike card with damage, the
// manager's remark, two strikes on the board. (The sanitiser caps: 8 lines of 120, who 40, why 200, fx 160.)
const reportSave = () => save({
  week: 7, cash: 1900, closedQuarter: 64000, energy: 64, stress: 58, manager: 44,
  deals: [D(3, 21000, 'happy', 2), D(2, 14000, 'curious', 1, 'AI-touched'), D(4, 26000, 'happy', 3), D(1, 9000, 'neutral', 0, 'agent-promised discount'), D(0, 7000, 'skeptical', 5),
    D(2, 12500, 'neutral', 2), D(1, 8200, 'curious', 1), D(0, 5100, 'neutral', 0, 'referral peanut')],
  claink: { status: 'active', deployed: true, strikes: 2, claims: 5, due: 1649, weekTokens: 6596000, mgr: { noticed: true, yoinks: 1 }, deploys: 5, miracles: 1, fakes: 4, incidents: 2,
    claimed: 173000, delivered: 14000, billed: 5400, lastInvoice: 720, tokens: 28100000,
    strikeLog: [{ n: 1, who: 'Finance', line: '2.7M tokens, $0 closed. “Explain.”' }, { n: 2, who: 'the CRO\'s office', line: 'A daily “synergy sync” with the CRO.' }],
    last: { kind: 'strike', week: 7, run: 5, tokens: 6596000, revenue: 0,
      lines: ['Drafted 1,874 emails. Sent 0.', 'Booked 5 meetings with other agents', 'Summarized 258 calls, then the summaries', 'Enriched 12,000 CRM fields with “Unknown”',
        'Built a 64-slide account plan for Caffeine Cathedral', 'Spun up 899 sub-agents to agree on tone', 'Debated “Hi” vs “Hey” for 4.9M tokens', '3 more outcomes'],
      strike: { n: 2, who: 'the CRO\'s office', why: 'Your agent put “Sync on synergies” on the CRO\'s calendar. Daily. Recurring. It then accepted on the CRO\'s behalf and sent a follow-up about the follow-up.',
        fx: 'Velvet Switchboard walked · -8 manager · -10 reputation', hurt: true },
      ping: 'ChatGDP again? Work on your writing. I\'m taking Caffeine Cathedral.', yoink: true, warn: false, cashWarn: true, announce: '' } }
});

const mixed = () => [D(1, 10000), D(2, 12000), D(3, 15000), D(0, 8000)];
// Week 2 with the offer still open and ten deals on the board: the deal list, the log and clAInk's ad all want the
// same column. (The ad gives way to the list; it must still show all of what it shows.)
const adBoardSave = () => save({ week: 2, cash: 600, claink: CK({ status: 'ad' }),
  deals: [D(0, 6000), D(0, 7200), D(0, 5400), D(0, 9100), D(1, 11000), D(1, 8300), D(0, 4800), D(2, 14000), D(0, 6600), D(1, 9700)] });

const FIXTURES = [
  { id: 'fresh-ad', what: 'a fresh run with the clAInk ad up', storage: null, steps: [], expect: { dialog: null, dock: 'ad' }, mobile: true },
  { id: 'ad-board', what: 'the clAInk ad up beside a board of ten deals',
    storage: autosave(JSON.stringify(adBoardSave())), steps: [], expect: { dialog: null, dock: 'ad' } },
  { id: 'midrun', what: 'mid-run, eight deals, no clAInk window (the plain main screen)',
    storage: autosave(readRaw('fixtures/generated/midrun-seeded.json')), steps: [], expect: { dialog: null, dock: 'none' }, mobile: true },
  { id: 'board-24', what: '24 deals and every status badge, the clAInk workspace open',
    storage: autosave(readRaw('fixtures/generated/board-24-deals.json')), steps: [], expect: { dialog: null, dock: 'workspace' }, mobile: true },
  { id: 'ck-report', what: 'the clAInk workspace with a full run report, a strike card and the manager\'s remark',
    storage: autosave(JSON.stringify(reportSave())), steps: [], expect: { dialog: null, dock: 'workspace+report' } },
  { id: 'ck-early', what: 'the clAInk workspace with a run report and a strike card on an early board (three deals, a short log)',
    storage: autosave(readRaw('fixtures/generated/ck-report-strike-hurt.json')), steps: [], expect: { dialog: null, dock: 'workspace+report' } },
  { id: 'ck-cancel', what: 'the clAInk workspace asking whether to cancel the seat, at the foot of a full run report',
    storage: autosave(JSON.stringify(reportSave())), steps: [{ m: 'ck:cancel' }], expect: { dialog: null, dock: 'workspace+report' } },
  // End Week with the second event (the competitor's price cut) scripted to fire: a choice dialog
  { id: 'event-dialog', what: 'an event dialog (the competitor cuts prices)',
    storage: autosave(JSON.stringify(save({ deals: mixed() }))), steps: [{ m: 'end', q: [].concat(his(2), [LO], his(90)) }], expect: { dialog: 'evt:competitor' } },
  { id: 'rules', what: 'the Rules dialog', storage: null, steps: [{ m: 'ui:rules' }], expect: { dialog: 'help' } },
  // a finished run: the ending dialog with its cutscene played through
  { id: 'ending', what: 'an ending (President\'s Club), cutscene played',
    storage: autosave(readRaw('fixtures/generated/end-club.json')), steps: [], rounds: 6, expect: { dialog: 'end:club' } }
];

// (The last two are short windows: a 1366x768 laptop with the browser's toolbars showing, and the shortest window
// that still gets the two-column page. End week used to be off the bottom of both.)
const VIEWPORTS = ['1920x1080', '1920x950', '1536x864', '1366x768', '1280x720', '1280x800', '1200x800', '1366x657', '1280x620'];
const PHONE = '390x844';
const size = v => { const m = /^(\d+)x(\d+)$/.exec(v); if (!m) throw new Error(`bad viewport ${v}`); return { width: Number(m[1]), height: Number(m[2]) }; };

module.exports = { FIXTURES, VIEWPORTS, PHONE, size, reportSave };
