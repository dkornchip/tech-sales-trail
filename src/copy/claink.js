import { fmtTok, money } from "../game/util.js";

// Everything clAInk says: its run reports, the strike cards Shitcorp's AI Governance Council files, what your manager
// says about it, and the lines read to a screen reader. The rules (odds, fees, what a strike costs) are in
// src/game/claink.js; these functions only turn the numbers it hands over into words.
//
// Two things in here are stored in a save exactly as written: the report lines and the strike cards (claink.last,
// claink.strikeLog), and the two deal notes. Rewording them changes new runs only.

// What a run that closes nothing reports (and bills). These are the agent's own claims about itself: fiction on an
// invoice, never a thing that happened to a deal. `a()` names one of your real deals. `n(lo, hi)` is a whole number
// from clAInk's joke stream: every call draws once, left to right, so adding or removing a call in a line changes
// the numbers that follow it in the same report (never a mechanical roll).
export const CK_OUTCOMES=[
  (a,n)=>`Drafted ${n(900,1900).toLocaleString("en-US")} personalized emails. Sent 0.`,
  (a,n)=>`Booked ${n(2,5)} meetings with other agents.`,
  (a,n)=>`Summarized ${n(120,260)} calls, then summarized the summaries.`,
  (a,n)=>`Enriched ${n(6,12)},000 CRM fields with “Unknown.”`,
  (a,n)=>`Built a ${n(38,64)}-slide account plan for ${a()}.`,
  (a,n)=>"Held a standup about the standup.",
  (a,n)=>`Wrote ${a()} a haiku. Unprompted.`,
  (a,n)=>`Scored ${n(400,900)} leads. All “medium.”`,
  (a,n)=>`Researched ${a()}. Located its homepage.`,
  (a,n)=>`Generated ${n(24,60)} insights about generating insights.`,
  (a,n)=>`Translated your signature into ${n(9,14)} languages.`,
  (a,n)=>`Convened ${n(300,900)} sub-agents to agree on tone.`,
  (a,n)=>`Opened ${n(9,19)} tickets about its own tickets.`,
  (a,n)=>"Followed up on its own follow-up. Twice.",
  (a,n)=>`Marked ${a()} Closed Won. Finance disagrees.`,
  (a,n)=>`Updated ${a()}’s close date to “soon.”`,
  (a,n)=>"Rescheduled your one-to-one to make room for a one-to-one.",
  (a,n)=>`Debated “Hi” versus “Hey” for ${n(2,4)}.${n(1,9)}M tokens.`,
  (a,n)=>"Flagged zero risks. Confidence: 99%.",
  (a,n)=>"Promoted itself to Senior Agent after a self-conducted performance review.",
  (a,n)=>"Created a Slack channel to investigate excessive Slack channels.",
  (a,n)=>"Escalated a customer complaint to the customer.",
  (a,n)=>"Published a report on the decline in report consumption.",
  (a,n)=>"Prepared a 90-day action plan during the final week.",
  (a,n)=>"Generated a value proposition for value proposition generation.",
  (a,n)=>"Mapped the buying committee. The committee is three agents.",
  (a,n)=>"Identified personalization as a strategic opportunity. Addressed an email to [FIRST_NAME].",
  (a,n)=>"Optimized your calendar. Removed the only unscheduled half hour.",
  (a,n)=>"Created an executive summary of an executive summary.",
  (a,n)=>"Assigned itself a mentor. The mentor is another instance of itself."
];
// Who files a strike for a run that only wasted money (t = that run's tokens), and the one-liner for the log.
// The strike is real; nothing else in these cards is: no deal is lost and nothing more is charged.
export const CK_WASTE=[
  (t,n)=>({who:"Finance",why:`${t} tokens. $0 closed. Please identify which of the delivered outcomes is money.`,line:`${t} tokens, $0 closed. Explain.`}),
  (t,n)=>({who:"IT Security",why:`Your agent requested administrator access to the CEO’s inbox ${n(900,4000).toLocaleString("en-US")} times.`,line:"Repeated requests for CEO inbox access."}),
  (t,n)=>({who:"RevOps",why:"It built a dashboard that tracks its other dashboards. It’s now our most-viewed report.",line:"Dashboard of dashboards."}),
  (t,n)=>({who:"Procurement",why:"Your agent attempted to purchase another seat. For itself. On your card.",line:"Attempted to purchase itself a seat."}),
  (t,n)=>({who:"HR",why:"Your agent nominated itself for Rep of the Month. It is leading the poll.",line:"Self-nominated Rep of the Month."}),
  (t,n)=>({who:"Facilities",why:"Your agents reserved every conference room for alignment.",line:"Every room reserved. No attendees."}),
  (t,n)=>({who:"the CRO’s office",why:"Your agent scheduled a daily recurring meeting called “Sync on synergies.”",line:"Daily synergy sync with the CRO."}),
  (t,n)=>({who:"Legal",why:`Your agent wrote ${n(9,16)} disclaimers and appended them to your signature.`,line:"Self-authored legal disclaimers."}),
  (t,n)=>({who:"Finance",why:"The invoice lists 14 efficiencies. This department does not accept efficiencies as payment.",line:"Invoice contains efficiencies, not revenue."}),
  (t,n)=>({who:"RevOps",why:"Your agent has increased forecast accuracy by changing the definition of accurate.",line:"Redefined forecast accuracy."}),
  (t,n)=>({who:"Customer Success",why:"Your agent marked its own satisfaction survey as completed.",line:"Agent satisfied with its own service."}),
  (t,n)=>({who:"People & Culture",why:"The agent has asked about a compensation review and a standing desk.",line:"Requested a compensation review."})
];
export const CK_CLEAR=["No strike. Finance checked it twice.","No strike. The Council has asked for supporting documentation.","No strike. Legal is reading it anyway.","No strike. Revenue verified independently of clAInk."];

// The report line that says how many more outcomes were billed (CK_RUN.more below), recognised in a stored report so
// the workspace can set it apart. Keep the two in step.
export const isMoreLine=(line)=>/^\d+ more outcome/.test(line);

// The first workspace card, right after the seat is bought.
export const CK_ONBOARD={
  lines:["Seat activated. Agents provisioned.","Alignment workshop: completed by agents."],
  announce:"clAInk seat activated."
};

// The card left behind when you cancel the seat. (The line is a joke about the vendor; the fee is only the fee.)
export const CK_CANCEL={
  lines:["Seat canceled. Customer intent successfully detected."],
  announce:(cost)=>`Seat canceled. Paid ${money(cost)}.`
};

// Notes clAInk leaves on a deal card (stored on the deal as probNote).
export const CK_NOTES={
  touched:"AI-assisted",
  discount:"agent-promised discount"
};

// A run that really closed something. d: {account, value, own, upsell} for each signature.
export const CK_MIRACLE={
  signed:(d)=>`Signed ${d.account} · ${money(d.value)}${!d.own?" (new logo)":d.upsell?" (upsold)":""}`,
  moved:(n)=>`Advanced ${n} ${n===1?"deal":"deals"} one stage`,
  announce:(n,total)=>`Finance verified ${n} signed for ${money(total)}. No strike.`
};

// A run that closed nothing: the top of its report, and what is read out. The "influence" is the agent's claim.
export const CK_RUN={
  influenced:(pipeline)=>pipeline>0 ? `Claimed influence over ${money(pipeline)} in pipeline` : "Claimed influence over $0 in pipeline.",
  more:(n)=>`${n-3} more ${n-3===1?"outcome":"outcomes"}, also billed`,
  announce:(n,tokens)=>`${n} ${n===1?"outcome":"outcomes"} billed, ${fmtTok(tokens)} tokens, $0 closed.`,
  // prev: what has been announced for this run so far
  strikeAnnounce:(prev,n,of,who,line)=>`${prev} Strike ${n} of ${of}, filed by ${who}: ${line}`
};

// A strike that did real damage. Each returns the strike card {who, why, fx} and the one-liner for the log and the
// strike list (line). The numbers (rep, mgr, cut...) are the damage the rules really did, measured after the fact:
// a meter that had nothing left to lose is not said to have lost anything.
const lost=(...parts)=>parts.filter(Boolean).join(" · ");
const drop=(k,name)=>(k>0 ? `−${k} ${name}` : "");
export const CK_INCIDENT={
  // follow-up spam. account: the deal that walked, or null when the CRM was empty. k: how many emails
  slop:({account,k,rep,mgr})=>({
    who:"Marketing Ops",
    why:account!==null ? `Your agent sent ${account} ${k} quick follow-ups in an hour. They blocked our domain. clAInk Customer Success describes this as an isolated incident.`
      : `Your agent sent ${k} follow-ups to an empty CRM. Our domain was blocklisted anyway.`,
    line:account!==null ? `${k} follow-ups. ${account} walked.` : `${k} emails to nobody. Domain blocklisted.`,
    fx:lost(account!==null ? `${account} walked` : "",drop(rep,"reputation"),drop(mgr,"manager"))
  }),
  // a discount nobody approved. cut: percent off
  discount:({account,cut,mgr,rep})=>({
    who:"Legal",
    why:`Your negotiation agent offered ${account} a ${cut}% discount to accelerate the outcome. The offer was made in writing. Legal has requested a copy.`,
    line:`Offered ${account} ${cut}% off. In writing.`,
    fx:lost(`${account} −${cut}%`,drop(mgr,"manager"),drop(rep,"reputation"))
  }),
  // deals leaked to the competition. n: how many; value: what they were worth
  leak:({n,value,rep,mgr})=>{
    const k=`${n} ${n===1?"deal":"deals"}`;
    return{
      who:"IT Security",
      why:"Your agent shared context with a partner agent. The partner agent works for Scheisskorp. Legal is not currently accepting questions.",
      line:`Shared ${k} (${money(value)}) with Scheisskorp.`,
      fx:lost(`Lost ${k}, ${money(value)}`,drop(rep,"reputation"),drop(mgr,"manager"))
    };
  },
  // a customer upgraded against their will. amt: closed revenue that came back; back: the commission clawed back.
  // The game does not keep a list of who signed, so the card does not name anyone: the money is what is real.
  churn:({amt,back})=>({
    who:"Customer Success",
    why:"Your agent upgraded a customer to triple the price to drive outcomes. The customer declined the outcome and churned.",
    line:"A customer upgraded to 3×, then churned.",
    fx:`−${money(amt)} closed · −${money(back)} commission clawed back`
  })
};

// Who files a strike when nobody else does.
export const CK_COUNCIL="AI Governance Council";

// Strike 3: the seat is revoked.
export const CK_REVOKE={
  who:CK_COUNCIL,
  why:"The AI Governance Council has revoked your seat, effective immediately. In accordance with the Acceptable Use Policy, Finance will now reconcile outstanding compute.",
  fx:(charge,tokens,mgr)=>lost(`Final true-up ${money(charge)} charged (${fmtTok(tokens)} tokens)`,drop(mgr,"manager")),
  line:(charge)=>`Seat revoked. Final true-up: ${money(charge)} charged.`,
  // prev: what has been announced for this run so far. farewell: the account its goodbye email lost you, or null
  announce:(prev,charge,farewell)=>`${prev} Strike 3 of 3: seat revoked, final true-up ${money(charge)} charged.${farewell!==null?` Its farewell email cost you ${farewell}.`:""}`
};

// Words for strikes found in saves from before v1.20, which kept less about them.
export const CK_OLD_SAVE={
  revoked:"Seat revoked.",                               // a revoked seat with no invoice on record
  trueUp:(charge)=>`Token true-up −${money(charge)}`,     // the old "rug pull", as a strike card's effect line
  incidentWho:"Incident review",                         // who filed a v1.19 incident
  plainStrike:"A run closed $0."                         // a strike with nothing else on record
};

// Your manager notices ("Always on ChatGDP?"). The warning is the first time; after that he takes a deal, or has
// nothing to take. ping: what he says in the workspace. say: what is read out after the run's result. They say the
// same thing the dialog says (copy/events.js) and the log says (copy/log.js), because it is the same event.
// miracle: the run that caught his eye actually worked.
export const CK_WARNING="Improve your written communication skills, or management will start intervening in your deals.";
export const CK_QUIP=(miracle)=>miracle?"Nice week. ChatGDP do that?":"Always on ChatGDP, huh?";
export const CK_MGR={
  warnPing:(miracle)=>`${CK_QUIP(miracle)} ${CK_WARNING}`,
  warnSay:`Your manager has issued a writing warning. ${CK_WARNING}`,
  circlePing:"ChatGDP again? We’ll circle back.",
  circleSay:"Your manager will circle back.",
  yoinkPing:(account)=>`I’ll take ${account} from here. Watch and learn.`,
  yoinkSay:(account)=>`Your manager took ${account}.`
};

// For the copy lint: lines that take several arguments, or numbers that only make sense in the ranges the game uses.
const SAID = "4 outcomes billed, 4.4M tokens, $0 closed.";
export const lint = { params: {
  "CK_OUTCOMES[17]": [{ args: [() => "Pinecone Pizza", lo => lo] }],
  "CK_RUN.more": [5, 9],
  "CK_RUN.strikeAnnounce": [{ args: [SAID, 1, 3, "Procurement", "Attempted to purchase itself a seat."] }],
  "CK_RUN.announce": [{ args: [1, 1200000] }, { args: [4, 4400000] }],
  "CK_REVOKE.fx": [{ args: [3200, 12800000, 8] }, { args: [529, 2100000, 0] }],
  "CK_INCIDENT.slop": [{ account: "Pinecone Pizza", k: 24, rep: 10, mgr: 6 }, { account: null, k: 31, rep: 0, mgr: 2 }],
  "CK_INCIDENT.discount": [{ account: "Pinecone Pizza", cut: 45, mgr: 10, rep: 4 }, { account: "Pinecone Pizza", cut: 45, mgr: 0, rep: 0 }],
  "CK_INCIDENT.churn": [{ amt: 11000, back: 1320 }],
  "CK_REVOKE.announce": [{ args: [SAID, 1340, "Pinecone Pizza"] }, { args: [SAID, 1340, null] }],
  "CK_MIRACLE.signed": [{ account: "Pinecone Pizza", value: 18200, own: true, upsell: false }, { account: "Quasar Laundry", value: 14400, own: false, upsell: false }],
  "CK_INCIDENT.leak": [{ n: 2, value: 31400, rep: 5, mgr: 6 }, { n: 1, value: 12000, rep: 0, mgr: 0 }]
} };
