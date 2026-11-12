import { fmtTok, money } from "../game/util.js";

// Everything clAInk says: its run reports, the strike cards Shitcorp's AI Governance Council files, what your manager
// says about it, and the lines read to a screen reader. The rules (odds, fees, what a strike costs) are in
// src/game/claink.js; these functions only turn the numbers it hands over into words.
//
// Two things in here are stored in a save exactly as written: the report lines and the strike cards (claink.last,
// claink.strikeLog), and the two deal notes. Rewording them changes new runs only.

// What a run that closes nothing reports (and bills). `a()` names one of your real deals. `n(lo, hi)` is a whole
// number from clAInk's joke stream: every call draws once, left to right, so adding or removing a call in a line
// changes the numbers that follow it in the same report (never a mechanical roll).
export const CK_OUTCOMES=[
  (a,n)=>`Drafted ${n(900,1900).toLocaleString("en-US")} emails. Sent 0.`,
  (a,n)=>`Booked ${n(2,5)} meetings with other agents`,
  (a,n)=>`Summarized ${n(120,260)} calls, then the summaries`,
  (a,n)=>`Enriched ${n(6,12)},000 CRM fields with “Unknown”`,
  (a,n)=>`Built a ${n(38,64)}-slide account plan for ${a()}`,
  (a,n)=>"Held a standup about the standup",
  (a,n)=>`Wrote ${a()} a haiku. Unprompted.`,
  (a,n)=>`Scored ${n(400,900)} leads. All “medium.”`,
  (a,n)=>`Researched ${a()}. Found its Wikipedia page.`,
  (a,n)=>`Generated ${n(24,60)} “insights”`,
  (a,n)=>`Translated your signature into ${n(9,14)} languages`,
  (a,n)=>`Spun up ${n(300,900)} sub-agents to agree on tone`,
  (a,n)=>`Opened ${n(9,19)} tickets about its own tickets`,
  (a,n)=>"Followed up on its own follow-up. Twice.",
  (a,n)=>`Marked ${a()} Closed Won. Finance disagrees.`,
  (a,n)=>`Moved ${a()}’s close date to “soon”`,
  (a,n)=>"Rescheduled your 1:1 with your manager",
  (a,n)=>`Debated “Hi” vs “Hey” for ${n(2,4)}.${n(1,9)}M tokens`,
  (a,n)=>"Flagged 0 risks. Confidence: 99%"
];
// Who files a strike for a run that only wasted money (t = that run's tokens), and the one-liner for the log.
export const CK_WASTE=[
  (t,n)=>({who:"Finance",why:`${t} tokens. $0 closed. Please explain, in fewer tokens.`,line:`${t} tokens, $0 closed. “Explain.”`}),
  (t,n)=>({who:"IT Security",why:`Your agent requested admin access to the CEO’s inbox. ${n(900,4000).toLocaleString("en-US")} times.`,line:"It kept asking for the CEO’s inbox."}),
  (t,n)=>({who:"RevOps",why:"Your agent built a dashboard that tracks its other dashboards. It’s now our most-viewed report.",line:"A dashboard of its own dashboards."}),
  (t,n)=>({who:"Procurement",why:"Your agent tried to buy a second clAInk seat. For itself. On your card.",line:"It tried to buy itself a seat."}),
  (t,n)=>({who:"HR",why:"Your agent nominated itself for Rep of the Month. It’s currently winning.",line:"It nominated itself Rep of the Month."}),
  (t,n)=>({who:"Facilities",why:"Your agents booked every conference room on the floor “for alignment.”",line:"Every conference room, “for alignment.”"}),
  (t,n)=>({who:"the CRO’s office",why:"Your agent put “Sync on synergies” on the CRO’s calendar. Daily. Recurring.",line:"A daily “synergy sync” with the CRO."}),
  (t,n)=>({who:"Legal",why:`Your agent added ${n(9,16)} disclaimers to your email signature. It wrote them itself.`,line:"It wrote itself legal disclaimers."})
];
export const CK_CLEAR=["No strike. The Council asked for a re-run.","No strike. Finance checked it twice.","No strike. The Council has no notes. Yet.","No strike. Legal is reading it anyway."];

// The report line that says how many more outcomes were billed (CK_RUN.more below), recognised in a stored report so
// the workspace can set it apart. Keep the two in step.
export const isMoreLine=(line)=>/^\d+ more outcome/.test(line);

// The first workspace card, right after the seat is bought.
export const CK_ONBOARD={
  lines:["Seat activated. Agents onboarded.","Alignment workshop: complete."],
  announce:"clAInk seat activated."
};

// The card left behind when you cancel the seat.
export const CK_CANCEL={
  lines:["Seat cancelled."],
  announce:(cost)=>`Seat cancelled. Paid ${money(cost)}.`
};

// Notes clAInk leaves on a deal card (stored on the deal as probNote).
export const CK_NOTES={
  touched:"AI-touched",
  discount:"agent-promised discount"
};

// A run that really closed something. d: {account, value, own, upsell} for each signature.
export const CK_MIRACLE={
  signed:(d)=>`Signed ${d.account} · ${money(d.value)}${!d.own?" (new logo)":d.upsell?" (upsold)":""}`,
  moved:(n)=>`Moved ${n} deal${n>1?"s":""} a stage`,
  announce:(n,total)=>`It actually worked: ${n} signed for ${money(total)}. No strike.`
};

// A run that closed nothing: the top of its report, and what is read out.
export const CK_RUN={
  influenced:(pipeline)=>pipeline>0 ? `Influenced ${money(pipeline)} of pipeline (all of it)` : "Influenced $0 of pipeline, strategically",
  more:(n)=>`${n-3} more outcome${n>4?"s":""}, also billed`,
  announce:(n,tokens)=>`${n} outcomes billed, ${fmtTok(tokens)} tokens, nothing closed.`,
  // prev: what has been announced for this run so far
  strikeAnnounce:(prev,n,of,who,line)=>`${prev} Strike ${n} of ${of}, filed by ${who}: ${line}`
};

// A strike that did real damage. Each returns the strike card {who, why, fx} and the one-liner for the log and the
// strike list (line). The numbers (rep, mgr, cut...) are the damage the rules already applied.
export const CK_INCIDENT={
  // follow-up spam. account: the deal that fled, or null when the CRM was empty. k: how many emails
  slop:({account,k,rep,mgr})=>({
    who:"Marketing Ops",
    why:account!==null ? `Your agent sent ${account} ${k} “quick follow-ups” in one hour. They blocked our whole domain.`
      : `Your agent emailed an empty CRM ${k} times. Our domain got blocklisted anyway.`,
    line:account!==null ? `${k} follow-ups in an hour. ${account} fled.` : `${k} emails to nobody. Domain blocklisted.`,
    fx:`${account!==null?`${account} walked · `:""}−${rep} reputation · −${mgr} manager`
  }),
  // a discount nobody approved. cut: percent off
  discount:({account,cut,mgr,rep})=>({
    who:"Legal",
    why:`Your agent’s negotiation sub-agent offered ${account} ${cut}% off “to accelerate the outcome.” In writing.`,
    line:`It offered ${account} ${cut}% off. In writing.`,
    fx:`${account} −${cut}% · −${mgr} manager · −${rep} reputation`
  }),
  // deals leaked to the competition. n: how many; value: what they were worth
  leak:({n,value,rep,mgr})=>{
    const k=`${n} deal${n===1?"":"s"}`;
    return{
      who:"IT Security",
      why:"Your agent “shared context” with a partner agent. The partner works for Scheisskorp.",
      line:`It shared ${k} (${money(value)}) with Scheisskorp.`,
      fx:`Lost ${k}, ${money(value)} · −${rep} reputation · −${mgr} manager`
    };
  },
  // a customer upgraded against their will. amt: closed revenue that came back; back: the commission clawed back
  churn:({account,amt,back})=>({
    who:"Customer Success",
    why:`Your agent auto-upgraded ${account} to the 3x tier “to drive outcomes.” They churned.`,
    line:`${account} was upgraded to 3x, then churned.`,
    fx:`−${money(amt)} closed · −${money(back)} commission clawed back`
  })
};

// Who files a strike when nobody else does.
export const CK_COUNCIL="AI Governance Council";

// Strike 3: the seat is revoked.
export const CK_REVOKE={
  who:CK_COUNCIL,
  why:"Three strikes. Your seat is revoked, effective immediately. Finance has the true-up.",
  fx:(charge,tokens,mgr)=>`Token true-up −${money(charge)} (${fmtTok(tokens)} “background” tokens) · −${mgr} manager`,
  line:(charge)=>`Seat revoked. True-up: −${money(charge)}.`,
  // prev: what has been announced for this run so far. farewell: the account its goodbye email lost you, or null
  announce:(prev,charge,farewell)=>`${prev} Strike 3 of 3: seat revoked, token true-up ${money(charge)}.${farewell!==null?` Its farewell email lost you ${farewell}.`:""}`
};

// Words for strikes found in saves from before v1.20, which kept less about them.
export const CK_OLD_SAVE={
  revoked:"Seat revoked.",                               // a revoked seat with no invoice on record
  trueUp:(charge)=>`Token true-up −${money(charge)}`,     // the old "rug pull", as a strike card's effect line
  incidentWho:"Incident review",                         // who filed a v1.19 incident
  plainStrike:"A run that closed $0."                    // a strike with nothing else on record
};

// Your manager notices ("Always on ChatGDP?"). The warning is the first time; after that he takes a deal, or has
// nothing to take. ping: what he says in the workspace. say: what is read out after the run's result.
// miracle: the run that caught his eye actually worked.
export const CK_WARNING="Improve your writing skills, or management will start intervening in your deals. Consider this your warning.";
export const CK_QUIP=(miracle)=>miracle?"Nice week. ChatGDP do that?":"Always on ChatGDP, huh?";
export const CK_MGR={
  warnPing:(miracle)=>`${CK_QUIP(miracle)} Work on your writing, or I step in on your deals.`,
  warnSay:`Your manager noticed. ${CK_WARNING}`,
  circlePing:"ChatGDP again? I’ll circle back.",
  circleSay:"Your manager will circle back.",
  yoinkPing:(account)=>`I’ll close ${account} myself. Work on your writing skills.`,
  yoinkSay:(account)=>`Your manager took ${account}.`
};

// For the copy lint: lines that take several arguments, or numbers that only make sense in the ranges the game uses.
const SAID = "4 outcomes billed, 4.4M tokens, nothing closed.";
export const lint = { params: {
  "CK_OUTCOMES[17]": [{ args: [() => "Pinecone Pizza", lo => lo] }],
  "CK_RUN.more": [5, 9],
  "CK_RUN.strikeAnnounce": [{ args: [SAID, 1, 3, "Procurement", "It tried to buy itself a seat."] }],
  "CK_REVOKE.announce": [{ args: [SAID, 1340, "Pinecone Pizza"] }, { args: [SAID, 1340, null] }],
  "CK_MIRACLE.signed": [{ account: "Pinecone Pizza", value: 18200, own: true, upsell: false }, { account: "Quasar Laundry", value: 14400, own: false, upsell: false }],
  "CK_INCIDENT.leak": [{ n: 2, value: 31400, rep: 5, mgr: 6 }, { n: 1, value: 12000, rep: 5, mgr: 6 }]
} };
