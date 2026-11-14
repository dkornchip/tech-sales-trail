import { money } from "../game/util.js";

// The employee handbook ("How it works"): its title, its button, and one paragraph per row. A paragraph is a term
// (shown bold) followed by its body; the body starts with the space that separates the two.
//
// The handbook is the one place in the game that is not allowed a joke that could be misread as a rule. Every
// number in it comes from the game (v: src/game/selectors.js, handbookFacts), so it cannot disagree with what the
// buttons do; when a rule is retuned the handbook follows, and when a rule is switched off (v.relief) so is its
// sentence.
// (the word joiners keep a minus sign with its amount and a range in one piece when a line wraps)
const usd = v => money(v).replace("-", "−⁠");
const range = (lo, hi) => `${lo}⁠–⁠${hi}`;
const pc = v => `${Math.round(v * 100)}%`;
const pts = v => `${v > 0 ? "+" : "−⁠"}${Math.abs(Math.round(v * 100))}`;
const WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen"];
const word = k => WORDS[k] || String(k);
const cap = t => t.charAt(0).toUpperCase() + t.slice(1);
// "four times in five" for 0.8; a plain percentage for anything that is not a neat fifth
const often = p => { const k = Math.round(p * 5); return Math.abs(p * 5 - k) < 1e-9 && k > 0 && k < 5 ? `${word(k)} ${k === 1 ? "time" : "times"} in five` : `${pc(p)} of the time`; };
const list = ws => (ws.length > 1 ? ws.slice(0, -1).join(", ") + " and " + ws[ws.length - 1] : String(ws[0]));

export const HELP_TITLE = "How it works";
export const HELP_OK = "Got it";
export const HELP_MEMO = "Read the memo again";
// The handbook comes in sections; each section is a heading and its paragraphs.
export const HELP = [
  { title: "The quarter", rows: [
    { term: "The goal.", body: v => ` Close ${usd(v.quota)} in ${v.weeks} weeks. At QBR, ${pc(v.qbr.club)} earns President’s Club unless rare politics intervene. At ${range(Math.round(v.qbr.safe * 100), 99)}% you retain your job, potentially on a PIP. At ${range(Math.round(v.qbr.floor * 100), Math.round(v.qbr.safe * 100) - 1)}%, survival is conditional on the review; below ${pc(v.qbr.floor)} you are out.` },
    { term: "A week.", body: v => ` ${cap(word(v.slots))} slots and a separate energy budget. Most actions cost one slot; conferences cost ${word(v.conferenceSlots)}. Recharge and coffee can restore energy with a slot left. End Week advances the quarter.` },
    { term: "Closed (Q).", body: v => ` Closed revenue, net of clawbacks, not pipeline. Expectations rise throughout the quarter. Reviews start in week ${v.reviewsFrom}; dismissal risk starts in week ${v.firingFrom}.${v.relief ? " Healthy pipeline can soften early reviews but is not guaranteed revenue." : ""}` },
    { term: "Cash.", body: v => ` ${usd(v.salary)} salary on Friday; ${pc(v.commission)} commission on closed sales; rent ${usd(v.rent)} weeks ${list(v.rentWeeks)}. Collections take the jacket when cash reaches ${usd(v.repoAt)} or lower.` }
  ] },
  { title: "The funnel", rows: [
    { term: "Pipeline.", body: () => ` Total value of live deals. Move leads through discovery, demo, proposal and a signing attempt. Proposal and Closing deals are eligible for signing; mood, stats and modifiers affect odds. Late-stage deals can walk.` },
    { term: "Full-funnel week.", body: v => ` Work at least three of four categories (lead generation, discovery, demo, proposal or close) for ${pts(v.fullFunnel)} pp signing odds next week. One or none while holding pipeline gives ${pts(v.neglect)} pp next week.` },
    { term: "Skills.", body: () => ` Improve matching action and contribute to close odds where applicable. Some unsuccessful actions still develop skill.` },
    { term: "Reputation.", body: () => ` Influences deal sizes and close odds.` },
    { term: "Product.", body: () => ` Affects demo and close success. Outages and incidents can lower it.` },
    { term: "Hail Mary.", body: v => ` One desperate signing attempt. ${cap(often(1 - v.hailBlast))} each remaining late-stage deal has a ${pc(v.hailWalk)} chance to walk. Manager, reputation and stress can suffer.` }
  ] },
  { title: "You", rows: [
    { term: "Energy.", body: v => ` Actions cost energy. Recover ${v.fridayEnergy} on Friday.` },
    { term: "Recharge.", body: v => ` Once per week for one slot: ${range(v.rechargeEnergy[0], v.rechargeEnergy[1])} energy and ${range(v.rechargeRelief[0], v.rechargeRelief[1])} stress relief, capped by actual meters. A lucky nap may approve a trip. Coffee reduces relief.` },
    { term: "Stress.", body: v => ` High stress lowers close odds. At ${v.stressDanger}+ you risk a weekend meltdown; at 100 the run ends immediately (coffee can produce a different ending).` },
    { term: "Quad shot.", body: v => ` Costs cash and a slot, gives immediate energy and stress. Later shots give less energy and more stress; the third and later may cause ascension. Reaching 100 stress via coffee ends the run. Every shot adds ${v.crash} stress on Friday. The button shows the odds as they stand.` }
  ] },
  { title: "The office", rows: [
    { term: "Manager.", body: () => ` Approval influences close odds and firing. Email-only weeks cost approval.` },
    { term: "CRM cleanup.", body: () => ` Once a week, prune dead leads and gain manager approval; pause warning escalation and reduce dismissal risk for this week’s review. Your manager may delete a live deal.` },
    { term: "clAInk.", body: v => ` Optional in-game AI pilot, offered through week ${v.offerWeek}. Dismissing the offer removes it for this run. Pay ${usd(v.seat)} upfront, deploy once per eligible week with zero slots and zero energy, pay usage on Friday. A ${pc(v.miracle)} chance of genuine revenue per run; every $0 run earns a strike. Idle weeks still bill. Strike ${v.strikes} revokes the seat, may cost a live deal, and charges a true-up of all your cash plus ${range(usd(v.trueUpLo), usd(v.trueUpHi))}. Cancel early for ${usd(v.cancelFee)} plus any due charges if affordable. Week ${v.weeks} is frozen. Your manager may intervene.` }
  ] },
  // keys: shown only where there is a keyboard to press them on
  { title: "Keyboard", keys: true, rows: [
    { term: "Keys.", body: () => ` The number row runs the twelve actions in the order of the buttons: 1 to 9, then 0, − and =. E ends the week, H is the Hail Mary, M mutes, ? opens this handbook. Every action also has a button.` }
  ] }
];

// For the copy lint: the numbers a handbook row is given.
const V = { quota: 160000, weeks: 13, slots: 5, conferenceSlots: 2, qbr: { club: 1, safe: 0.8, floor: 0.7 }, reviewsFrom: 5, firingFrom: 6, relief: true, salary: 1000, commission: 0.12, rent: 1600, rentWeeks: [1, 5, 9],
  repoAt: -1500, fullFunnel: 0.06, neglect: -0.06, hailBlast: 0.2, hailWalk: 0.55, fridayEnergy: 15, rechargeEnergy: [35, 52], rechargeRelief: [12, 18], stressDanger: 80, crash: 13, offerWeek: 3, seat: 500, miracle: 0.2,
  strikes: 3, trueUpLo: 200, trueUpHi: 1800, cancelFee: 250 };
export const lint = { params: Object.fromEntries(HELP.flatMap((sec, i) => sec.rows.map((_, k) => [`HELP[${i}].rows[${k}].body`, [V, { ...V, relief: false }]]))) };
