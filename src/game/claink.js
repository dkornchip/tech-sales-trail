import { PAY } from "./rules.js";
import { CK_CANCEL, CK_CLEAR, CK_COUNCIL, CK_INCIDENT, CK_MGR, CK_MIRACLE, CK_NOTES, CK_OLD_SAVE, CK_ONBOARD, CK_OUTCOMES, CK_REVOKE, CK_RUN, CK_WASTE } from "../copy/claink.js";
import { ACCOUNT_NAMES } from "../copy/names.js";
import { QUARTER_WEEKS } from "./constants.js";
import { checkRepo } from "./deals.js";
import { LEGACY_INCIDENT_WHO } from "./legacy.js";
import { isRunOver, log } from "./log.js";
import { clamp, fmtTok, getQuarterInfo, pct } from "./util.js";

// ---------- v1.20: clAInk, an enterprise agentic platform on pilot at Shitcorp ----------
// One seat per run: ad -> active -> cancelled | revoked, or ad -> dismissed (closed) | expired (offer ran out).
// Each weekly run: 20% it really closes (miracle). 80% it bills a pile of "outcomes", closes $0, and Shitcorp's AI
// Governance Council files a strike; 38% of strikes 1 and 2 come with real damage. Strike 3 revokes the seat and Finance
// runs the token true-up. Any use can catch the manager's eye (25%): the first time he only remarks, after that he
// yoinks deals. v1.20 rewrote the story, not the odds: every number below is v1.19's, tuned with the Monte Carlo sim.
// Mechanical draws come from CLAINK.rng (the sim swaps in its own stream), so a run that never installs draws exactly
// the same Math.random calls as v1.18. The jokes (which outcomes, who files the strike, token counts) come from
// CLAINK.flavor, a separate stream, so a punchline can never move a mechanical draw. The words themselves (reports,
// strike cards, what the manager says) are in src/copy/claink.js; this file hands them numbers and names.
export const ckMulberry=(seed)=>{ let a=seed>>>0; return()=>{ a=(a+0x6D2B79F5)>>>0; let t=a; t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return((t^(t>>>14))>>>0)/4294967296; }; };
export const CLAINK={
  rng:()=>Math.random(),
  flavor:ckMulberry(Date.now()^0x5eed1e55),
  INSTALL:500, CANCEL:250, REPO_AT:-1500,
  OFFER_LAST_WEEK:3,                  // "Pilot pricing ends Week 3": the activation deadline (v1.21: was week 10). End Week of
                                      // week 3 expires an unanswered ad, and the offer never comes back for the rest of the run
  MIRACLE_P:0.20,                     // first draw of every run
  MIRACLE:[12000,22000],              // real revenue a miracle closes (about 1-1.5 weeks of quota pace)
  MIRACLE_NUDGE:2,                    // other deals it moves one stage
  STRIKES:3,                          // strike 3 revokes the seat
  TRUEUP_OVER:[200,1800],             // the token true-up takes all your cash and then some: you end at -$200..-$1,800
  TRUEUP_MIN:0,                       // ...and it always takes at least the week's usage when there's nothing left to take
  REVOKE_MGR:8,                       // your name is on the Council's slide
  INCIDENT_P:0.38,                    // strikes 1 and 2: real damage
  INC:{
    slop:{w:0.20, rep:10, mgr:6},             // follow-up spam: your best deal flees
    discount:{w:0.15, cut:0.45, mgr:10, rep:4},// a negotiation sub-agent gives away 45%
    leak:{w:0.15, n:2, rep:12, mgr:8},         // "shared context" with Scheisskorp's agent
    churn:{w:0.50, frac:0.22, lo:1500, hi:45000} // auto-upgraded a customer to 3x, they churned: a slice of closed revenue and its commission come back
  },
  MGR_P:0.25,                         // manager notice (once per run), then yoink chance per run
  MGR_HIT:9,                          // relationship hit on every manager event
  RETAINER:249,                       // platform fee, every week you run
  PER_OUTCOME:[140,280],              // every billed outcome, real or not
  IDLE:[150,300],                     // an active week with no run: background agents keep "thinking"
  OVERAGE_P:0.10, OVERAGE:[200,600],  // an agent that loops all weekend
  OUTCOMES:[2,5],                     // outcomes billed by a run that closes nothing
  TOKENS_PER_DOLLAR:4000              // flavor only: how many tokens a dollar of invoice "was"
};
if(typeof window!=="undefined") window.TST_CLAINK=CLAINK; // debug/test hook: UI tests script outcomes through CLAINK.rng
export const CLAINK_STATUSES=["ad","dismissed","expired","active","cancelled","revoked"];
export const CLAINK_KINDS=["onboarded","miracle","strike","revoked","cancelled"];
export const ckUnit=(f)=>{ const v=Number(f()); return Number.isFinite(v) ? Math.min(0.999999,Math.max(0,v)) : 0; };
export const ckR=()=>ckUnit(CLAINK.rng);
export const ckInt=(a,b)=>a+Math.floor(ckR()*(b-a+1));
export const ckF=()=>ckUnit(CLAINK.flavor);
export const ckFi=(a,b)=>a+Math.floor(ckF()*(b-a+1));
export const ckFPick=(arr)=>arr[Math.floor(ckF()*arr.length)];
export const ckRank=(a,b)=>b.stage-a.stage || b.value-a.value;
export const ckFreshName=(s,also=[])=>{ const taken=new Set([...s.deals.map(d=>d.account),...also]); const free=ACCOUNT_NAMES.filter(n=>!taken.has(n)); return ckFPick(free.length?free:ACCOUNT_NAMES); };
export const ckPipe=(s)=>({...s,pipeline:s.deals.reduce((sum,d)=>sum+d.value,0)});
export const ckTok=(dollars)=>Math.max(0,Math.round(dollars*CLAINK.TOKENS_PER_DOLLAR*(0.88+0.24*ckF())));
export const ckLast=(o)=>({kind:"strike",week:0,run:0,tokens:0,revenue:0,lines:[],strike:null,clear:"",farewell:"",ping:"",yoink:false,warn:false,cashWarn:false,announce:"",...o});
export const newClaink=()=>({status:"ad",hidden:false,deployed:false,strikes:0,claims:0,due:0,weekTokens:0,mgr:{noticed:false,yoinks:0},
  last:null,strikeLog:[],deploys:0,miracles:0,fakes:0,incidents:0,claimed:0,delivered:0,billed:0,lastInvoice:0,tokens:0});

// saves are user data: coerce every field. v1.19 saves say "rugged", "scam"/"rug" and flags; the v1.16 prototype's
// shape ({active, usedThisWeek, runs, totalBilled, ...}) still maps too. `week` lets an ad from a save made before
// clAInk existed respect the Week 3 deadline. Names are matched exactly (a save is user data: "constructor" is not a status).
export const sanitizeClaink=(raw,week)=>{
  const pastOffer=getQuarterInfo(Number.isFinite(week)&&week>0?week:1).weekInQuarter>CLAINK.OFFER_LAST_WEEK;
  const b=newClaink();
  if(pastOffer) b.status="expired";
  if(!raw || typeof raw!=="object" || Array.isArray(raw))return b;
  const n=(v,lo=0,hi=1e9)=>Number.isFinite(v)?Math.max(lo,Math.min(hi,Math.round(v))):lo;
  const str=(v,max=160)=>typeof v==="string"?v.slice(0,max):"";
  let status=CLAINK_STATUSES.includes(raw.status) ? raw.status : raw.status==="rugged" ? "revoked" : null;
  const legacy=!status;
  if(legacy){
    // prototype buy/cancel never touched runs/totalBilled, but they always wrote lastReport (and invoices wrote lastInvoice)
    const history=n(raw.runs)>0 || n(raw.totalBilled)>0 || n(raw.incidents)>0 || n(raw.lastInvoice)>0 || (typeof raw.lastReport==="string" && raw.lastReport!=="");
    status=raw.active===true ? "active" : history ? "cancelled" : "ad";
  }
  if(status==="ad" && pastOffer) status="expired";
  const ended=status==="cancelled" || status==="revoked";
  const mgr=raw.mgr && typeof raw.mgr==="object" ? raw.mgr : {};
  const L=raw.last && typeof raw.last==="object" ? raw.last : null;
  const S=L && L.strike && typeof L.strike==="object" ? L.strike : null;
  const strikes=n(raw.strikes!==undefined ? raw.strikes : raw.flags,0,status==="active"?CLAINK.STRIKES-1:CLAINK.STRIKES);
  // a prototype save made after that week's run kept no usage total: bill it like a light run
  const due=raw.due!==undefined || !(legacy && status==="active" && raw.usedThisWeek) ? n(raw.due,0,1e6)
    : CLAINK.RETAINER+n(raw.outcomesThisWeek,0,99)*CLAINK.PER_OUTCOME[0];
  const billed=n(raw.billed!==undefined ? raw.billed : raw.totalBilled);
  const lastInvoice=n(raw.lastInvoice);
  const deploys=n(raw.deploys!==undefined ? raw.deploys : raw.runs);
  // a v1.19 report: its rug-pull lines go (the revoked card tells that story now), its incident becomes its strike card
  const oldKind=L && (L.kind==="scam" || L.kind==="rug") ? L.kind : null;
  const kind=L ? (CLAINK_KINDS.includes(L.kind) ? L.kind : L.kind==="rug" ? "revoked" : "strike") : null;
  const revokedNote=lastInvoice>0 ? CK_REVOKE.line(lastInvoice) : CK_OLD_SAVE.revoked;
  // a v1.19 incident becomes a strike card (fromIncident), and its line goes on the strike list below
  const fromIncident=!S && oldKind!=="rug" && !!(L && typeof L.incident==="string" && L.incident);
  const strike=S ? {n:n(S.n,1,CLAINK.STRIKES),who:str(S.who,40),why:str(S.why,200),fx:str(S.fx,160),hurt:!!S.hurt}
    : oldKind==="rug" ? {n:CLAINK.STRIKES,who:CK_REVOKE.who,why:CK_REVOKE.why,
        fx:lastInvoice>0 ? CK_OLD_SAVE.trueUp(lastInvoice) : "",hurt:false}
    : fromIncident ? {n:n(L.flags,1,CLAINK.STRIKES),who:CK_OLD_SAVE.incidentWho,why:str(L.incident,200),fx:"",hurt:true} : null;
  // the strike log matches the strike count: one entry per strike, in order; strikes filed before v1.20 get a plain one
  const filed=new Map();
  (Array.isArray(raw.strikeLog) ? raw.strikeLog : []).forEach(x=>{
    if(!x || typeof x!=="object" || !Number.isFinite(x.n))return;
    const k=Math.round(x.n);
    if(k>=1 && k<=strikes) filed.set(k,{n:k,who:str(x.who,40),line:str(x.line,120)});
  });
  // ...also for a save that already holds that card (made by an earlier load): only its stored name says what it was
  if(strike && (fromIncident || strike.who===LEGACY_INCIDENT_WHO) && strike.n<=strikes && !filed.has(strike.n)) filed.set(strike.n,{n:strike.n,who:strike.who,line:str(L.incident,120)});
  for(let k=1;k<=strikes;k++) if(!filed.has(k)) filed.set(k,{n:k,who:CK_COUNCIL,
    line:k===CLAINK.STRIKES && status==="revoked" ? revokedNote : CK_OLD_SAVE.plainStrike});
  return{
    status,
    hidden:ended && !!raw.hidden,
    deployed:!!(raw.deployed!==undefined ? raw.deployed : raw.usedThisWeek),
    strikes,
    claims:n(raw.claims!==undefined ? raw.claims : raw.outcomesThisWeek,0,999),
    due,
    weekTokens:raw.weekTokens!==undefined ? n(raw.weekTokens,0,1e12) : due*CLAINK.TOKENS_PER_DOLLAR,
    mgr:{noticed:!!mgr.noticed, yoinks:n(mgr.yoinks,0,999)},
    last:L ? ckLast({kind, week:n(L.week,0,999),
      run:L.run!==undefined ? n(L.run,0,999) : (kind==="onboarded" || kind==="cancelled" ? 0 : deploys),
      tokens:n(L.tokens,0,1e12), revenue:n(L.revenue),
      lines:oldKind==="rug" || !Array.isArray(L.lines) ? [] : L.lines.filter(x=>typeof x==="string" && !(kind==="miracle" && /^Closed \(Q\) \+\$/.test(x))).slice(0,8).map(x=>x.slice(0,120)),
      strike, clear:str(L.clear,120), farewell:str(L.farewell,60), ping:str(L.ping), yoink:!!L.yoink, warn:!!L.warn, cashWarn:!!L.cashWarn,
      announce:oldKind ? "" : str(L.announce,320)}) : null,
    strikeLog:[...filed.values()].sort((x,y)=>x.n-y.n),
    deploys, miracles:n(raw.miracles), fakes:n(raw.fakes), incidents:n(raw.incidents),
    claimed:n(raw.claimed,0,1e12), delivered:n(raw.delivered), billed, lastInvoice,
    tokens:raw.tokens!==undefined ? n(raw.tokens,0,1e13) : billed*CLAINK.TOKENS_PER_DOLLAR
  };
};

// a clAInk charge that sends you to Collections is clAInk's fault, and the ending says so
export const ckRepo=(before,s)=>{ const r=checkRepo(s); return (r.repo && !before.repo) ? {...r,endCause:"claink"} : r; };
export const clainkCharge=(state,amount,tag,params,kind="warn")=>{
  const amt=Math.max(0,Math.round(amount));
  const s=log({...state,cash:state.cash-amt,claink:{...state.claink,billed:state.claink.billed+amt}},tag,params,kind);
  return ckRepo(state,s);
};

export const clainkCanInstall=(s)=>!!s.claink && s.claink.status==="ad" && !isRunOver(s) &&
  getQuarterInfo(s.week).weekInQuarter<=CLAINK.OFFER_LAST_WEEK && s.cash-CLAINK.INSTALL>CLAINK.REPO_AT;
// week 13 is the quarter-end freeze: the QBR ends every run, so a final-week run could never be invoiced
export const clainkFrozen=(s)=>getQuarterInfo(s.week).weekInQuarter>=QUARTER_WEEKS;
export const clainkCanDeploy=(s)=>!!s.claink && s.claink.status==="active" && !s.claink.deployed && !isRunOver(s) && !clainkFrozen(s);
export const clainkCancelCost=(s)=>CLAINK.CANCEL+((s.claink && s.claink.due)||0);
export const clainkCanCancel=(s)=>!!s.claink && s.claink.status==="active" && !isRunOver(s) && s.cash-clainkCancelCost(s)>CLAINK.REPO_AT;

export const buyClaink=(state)=>{
  if(!clainkCanInstall(state))return state;
  const s={...state,claink:{...state.claink,status:"active",deployed:false,strikes:0,claims:0,due:0,weekTokens:0,strikeLog:[],
    last:ckLast({kind:"onboarded",week:state.week,lines:CK_ONBOARD.lines.slice(),announce:CK_ONBOARD.announce})}};
  return clainkCharge(s,CLAINK.INSTALL,"ck.install",{cost:CLAINK.INSTALL});
};

export const dismissClaink=(state)=>{
  if(!state.claink || state.claink.status!=="ad")return state;
  return log({...state,claink:{...state.claink,status:"dismissed"}},"ck.dismiss",null,"muted");
};

// End Week of the deadline week: an ad nobody answered disappears
export const expireClaink=(state)=>{
  if(!state.claink || state.claink.status!=="ad" || getQuarterInfo(state.week).weekInQuarter<CLAINK.OFFER_LAST_WEEK)return state;
  return log({...state,claink:{...state.claink,status:"expired"}},"ck.expired",null,"muted");
};

export const hideClainkCard=(state)=>{
  const c=state.claink;
  if(!c || (c.status!=="cancelled" && c.status!=="revoked") || c.hidden)return state;
  return {...state,claink:{...c,hidden:true}};
};

// 20%: it actually works. Signs your most advanced stage 2+ deal that fits the budget, finds a buyer nobody met for the rest.
export const clainkMiracle=(state)=>{
  let s={...state};
  const target=ckInt(CLAINK.MIRACLE[0],CLAINK.MIRACLE[1]);
  const own=[...s.deals].filter(d=>d.stage>=2 && d.value<=target).sort(ckRank)[0]||null;
  const signed=[];
  if(own){ s.deals=s.deals.filter(d=>d.id!==own.id); signed.push({account:own.account,value:own.value,own:true}); }
  const rest=target-(own?own.value:0);
  // a miracle always lands the full target: a real new logo for the rest, or an upsell on your deal when the rest is small
  if(own && rest>0 && rest<2500){ signed[0].value+=rest; signed[0].upsell=rest; }
  else if(rest>0) signed.push({account:ckFreshName(s,own?[own.account]:[]),value:rest,own:false});
  const order=s.deals.filter(d=>d.stage<4).map(d=>({id:d.id,k:ckR()})).sort((a,b)=>a.k-b.k);
  const nudged=new Set(order.slice(0,CLAINK.MIRACLE_NUDGE).map(x=>x.id));
  if(nudged.size) s.deals=s.deals.map(d=>nudged.has(d.id)?{...d,stage:d.stage+1,mood:d.mood==="skeptical"?"neutral":d.mood,probNote:CK_NOTES.touched}:d);
  const total=signed.reduce((t,d)=>t+d.value,0);
  const keep=Math.round(total*PAY.commission);
  s.closedWon+=total; s.closedQuarter+=total; s.cash+=keep;
  s=ckPipe(s);
  let fees=0; for(let i=0;i<signed.length;i++) fees+=ckInt(CLAINK.PER_OUTCOME[0],CLAINK.PER_OUTCOME[1]);
  const c=s.claink;
  const tokens=ckTok(CLAINK.RETAINER+fees);
  s.claink={...c,miracles:c.miracles+1,delivered:c.delivered+total,claims:c.claims+signed.length,due:c.due+fees,
    tokens:c.tokens+tokens,weekTokens:c.weekTokens+tokens,
    last:ckLast({kind:"miracle",week:s.week,run:c.deploys,tokens,revenue:total,
      lines:[...signed.map(d=>CK_MIRACLE.signed(d)),
        ...(nudged.size?[CK_MIRACLE.moved(nudged.size)]:[])],
      clear:ckFPick(CK_CLEAR),
      announce:CK_MIRACLE.announce(signed.length,total)})};
  s=log(s,"ck.miracle");
  const top=signed.reduce((a,d)=>(!a || d.value>a.value ? {account:d.account,value:d.value} : a),null);
  return log(s,"ck.signed",{n:signed.length,won:total,keep,top});
};

// a strike with real damage, picked by weight; it falls back to what it can actually hit. Returns the state and the story.
export const clainkIncident=(state,rKind)=>{
  let s={...state};
  const I=CLAINK.INC;
  const ranked=[...s.deals].sort(ckRank);
  let kind=rKind<I.slop.w ? "slop" : rKind<I.slop.w+I.discount.w ? "discount" : rKind<I.slop.w+I.discount.w+I.leak.w ? "leak" : "churn";
  if(kind==="churn" && s.closedQuarter<=0) kind="slop";
  if(kind!=="churn" && kind!=="slop" && !ranked.length) kind=s.closedQuarter>0 ? "churn" : "slop";
  let card; // the strike card and its one-liner: {who, why, fx, line}
  if(kind==="slop"){
    const v=ranked[0], k=ckFi(18,40);
    if(v) s.deals=s.deals.filter(d=>d.id!==v.id);
    s.reputation=clamp(s.reputation-I.slop.rep,0,100);
    s.manager=clamp(s.manager-I.slop.mgr,0,100);
    card=CK_INCIDENT.slop({account:v?v.account:null,k,rep:I.slop.rep,mgr:I.slop.mgr});
  }else if(kind==="discount"){
    const v=ranked.find(d=>d.stage>=2)||ranked[0];
    s.deals=s.deals.map(d=>d.id===v.id?{...d,value:Math.round(d.value*(1-I.discount.cut)),mood:"skeptical",probNote:CK_NOTES.discount}:d);
    s.manager=clamp(s.manager-I.discount.mgr,0,100);
    s.reputation=clamp(s.reputation-I.discount.rep,0,100);
    card=CK_INCIDENT.discount({account:v.account,cut:pct(I.discount.cut),mgr:I.discount.mgr,rep:I.discount.rep});
  }else if(kind==="leak"){
    const lost=ranked.slice(0,I.leak.n);
    const ids=new Set(lost.map(d=>d.id));
    const val=lost.reduce((t,d)=>t+d.value,0);
    s.deals=s.deals.filter(d=>!ids.has(d.id));
    s.reputation=clamp(s.reputation-I.leak.rep,0,100);
    s.manager=clamp(s.manager-I.leak.mgr,0,100);
    card=CK_INCIDENT.leak({n:lost.length,value:val,rep:I.leak.rep,mgr:I.leak.mgr});
  }else{
    const amt=Math.min(s.closedQuarter,Math.max(I.churn.lo,Math.min(I.churn.hi,Math.round(s.closedQuarter*I.churn.frac))));
    const back=Math.round(amt*PAY.commission);
    s.closedWon-=amt; s.closedQuarter-=amt; s.cash-=back;
    const a=ckFreshName(s);
    card=CK_INCIDENT.churn({account:a,amt,back});
  }
  return {s:ckPipe(s),who:card.who,why:card.why,fx:card.fx,line:card.line};
};

// strike 3: the AI Governance Council revokes the seat and Finance runs the token true-up. clAInk's billing agent works
// it out (the one agent with a perfect record): it comes to everything you have, plus a bit, so going broke is a real
// risk in week 9 as much as in week 3. On its way out, the agent emails your best deal a goodbye.
export const clainkRevoke=(state)=>{
  let s={...state};
  const c=s.claink;
  const charge=Math.max(CLAINK.TRUEUP_MIN+c.due,s.cash+ckInt(CLAINK.TRUEUP_OVER[0],CLAINK.TRUEUP_OVER[1]));
  const lost=[...s.deals].sort(ckRank)[0]||null;
  if(lost){ s.deals=s.deals.filter(d=>d.id!==lost.id); s=ckPipe(s); }
  s.manager=clamp(s.manager-CLAINK.REVOKE_MGR,0,100);
  const tt=ckTok(charge);
  const who=CK_REVOKE.who;
  const strike={n:CLAINK.STRIKES,who,why:CK_REVOKE.why,
    fx:CK_REVOKE.fx(charge,tt,CLAINK.REVOKE_MGR)};
  s.claink={...c,status:"revoked",due:0,claims:0,weekTokens:0,lastInvoice:charge,tokens:c.tokens+tt,
    strikeLog:[...c.strikeLog,{n:CLAINK.STRIKES,who,line:CK_REVOKE.line(charge)}].slice(-CLAINK.STRIKES),
    last:{...c.last,kind:"revoked",strike,farewell:lost?lost.account:"",
      announce:CK_REVOKE.announce(c.last.announce,charge,lost?lost.account:null)}};
  if(lost) s=log(s,"ck.farewell",{account:lost.account,mgr:CLAINK.REVOKE_MGR},"bad");
  return clainkCharge(s,charge,"ck.revoked",{cost:charge},"bad");
};

// 80%: a run that closes nothing. It bills its "outcomes" anyway and the AI Governance Council files a strike: strikes
// 1 and 2 sometimes with real damage (INCIDENT_P), strike 3 revokes the seat.
export const clainkStrikeRun=(state,rInc,rKind)=>{
  let s={...state};
  const c=s.claink;
  const n=ckInt(CLAINK.OUTCOMES[0],CLAINK.OUTCOMES[1]);
  let fees=0; for(let i=0;i<n;i++) fees+=ckInt(CLAINK.PER_OUTCOME[0],CLAINK.PER_OUTCOME[1]);
  // the report: the vanity metric first, then the busywork it billed for
  const accts=[...s.deals].sort(ckRank).slice(0,4).map(d=>d.account);
  const acct=()=>accts.length ? ckFPick(accts) : ckFPick(ACCOUNT_NAMES);
  const pool=CK_OUTCOMES.slice();
  const lines=[CK_RUN.influenced(s.pipeline)];
  for(let i=1;i<Math.min(n,3);i++) lines.push(pool.splice(Math.floor(ckF()*pool.length),1)[0](acct,ckFi));
  if(n>3) lines.push(CK_RUN.more(n));
  const tokens=ckTok(CLAINK.RETAINER+fees);
  const strikes=c.strikes+1;
  s.claink={...c,fakes:c.fakes+1,strikes,claims:c.claims+n,due:c.due+fees,claimed:c.claimed+Math.max(0,s.pipeline),
    tokens:c.tokens+tokens,weekTokens:c.weekTokens+tokens,
    last:ckLast({kind:"strike",week:s.week,run:c.deploys,tokens,lines,announce:CK_RUN.announce(n,tokens)})};
  s=log(s,"ck.run",{n,tokens});
  if(strikes>=CLAINK.STRIKES)return clainkRevoke(s);
  const hurt=rInc<CLAINK.INCIDENT_P;
  const r=hurt ? clainkIncident(s,rKind) : {s,...ckFPick(CK_WASTE)(fmtTok(tokens),ckFi)};
  s=r.s;
  const cc=s.claink;
  s.claink={...cc,incidents:cc.incidents+(hurt?1:0),
    strikeLog:[...cc.strikeLog,{n:strikes,who:r.who,line:r.line}].slice(-CLAINK.STRIKES),
    last:{...cc.last,strike:{n:strikes,who:r.who,why:r.why,fx:r.fx||"",hurt},
      announce:CK_RUN.strikeAnnounce(cc.last.announce,strikes,CLAINK.STRIKES,r.who,r.line)}};
  s=log(s,hurt?"ck.strike.hurt":"ck.strike",{n:strikes,of:CLAINK.STRIKES,who:r.who,line:r.line},hurt?"bad":"warn");
  return hurt ? ckRepo(state,s) : s;
};

// "Always on ChatGDP?" The first time the manager issues a warning (once per run): it opens as an event, like any other
// event, so you can't miss it: improve your writing, or management steps into your deals. After that, any use can get
// a deal yoinked. A relationship hit every time. Returns {state, event}; event is the acknowledgement dialog, as
// {id, params} (see EVENTS in events.js): "ck:warning" for the warning, "ck:lesson" (the Writing Lesson) for a yoink.
export const clainkManager=(state,rMgr)=>{
  if(rMgr>=CLAINK.MGR_P || isRunOver(state) || !state.claink)return {state,event:null};
  let s={...state};
  const hit=CLAINK.MGR_HIT;
  s.manager=clamp(s.manager-hit,0,100);
  const c=s.claink;
  const withLast=(ping,say,yoink=false,warn=false)=>c.last ? {...c.last,ping,yoink,warn,announce:`${c.last.announce} ${say}`} : c.last;
  if(!c.mgr.noticed){
    const miracle=!!(c.last && c.last.kind==="miracle");
    s.claink={...c,mgr:{...c.mgr,noticed:true},last:withLast(CK_MGR.warnPing(miracle),CK_MGR.warnSay,false,true)};
    return {state:log(s,"ck.mgr.warning",{miracle,hit},"warn"),event:{id:"ck:warning",params:{miracle}}};
  }
  const victim=[...s.deals].filter(d=>d.stage>=2).sort(ckRank)[0] || [...s.deals].sort((a,b)=>b.value-a.value)[0] || null;
  if(!victim){
    s.claink={...c,last:withLast(CK_MGR.circlePing,CK_MGR.circleSay)};
    return {state:log(s,"ck.mgr.circle",{hit},"warn"),event:null};
  }
  s.deals=s.deals.filter(d=>d.id!==victim.id);
  s=ckPipe(s);
  s.claink={...c,mgr:{...c.mgr,yoinks:c.mgr.yoinks+1},last:withLast(CK_MGR.yoinkPing(victim.account),CK_MGR.yoinkSay(victim.account),true)};
  s=log(s,"ck.mgr.yoink",{account:victim.account,hit},"bad");
  return {state:s,event:{id:"ck:lesson",params:{account:victim.account}}};
};

export const deployClaink=(state)=>{
  if(!clainkCanDeploy(state))return {state,event:null};
  // decision draws come first, so tuning a size never reshuffles which runs are miracles, incidents or yoinks
  const rMiracle=ckR(), rMgr=ckR(), rInc=ckR(), rKind=ckR();
  const c=state.claink;
  let s={...state,claink:{...c,deployed:true,deploys:c.deploys+1,due:c.due+CLAINK.RETAINER}};
  s=rMiracle<CLAINK.MIRACLE_P ? clainkMiracle(s) : clainkStrikeRun(s,rInc,rKind);
  const r=clainkManager(s,rMgr);
  // the workspace sounds the "Cash under -$1,000" alarm with the strike card, if this run is what tipped it
  if(!state.repoWarned && r.state.repoWarned && r.state.claink && r.state.claink.last)
    return {...r,state:{...r.state,claink:{...r.state.claink,last:{...r.state.claink.last,cashWarn:true}}}};
  return r;
};

export const cancelClaink=(state)=>{
  if(!clainkCanCancel(state))return state;
  const cost=clainkCancelCost(state);
  const s={...state,claink:{...state.claink,status:"cancelled",due:0,claims:0,weekTokens:0,lastInvoice:cost,
    last:ckLast({kind:"cancelled",week:state.week,lines:CK_CANCEL.lines.slice(),announce:CK_CANCEL.announce(cost)})}};
  return clainkCharge(s,cost,"ck.cancel",{cost});
};

// Friday invoice: the last step of End Week, only for a run that carries on
export const billClaink=(state)=>{
  const c=state.claink;
  if(!c || c.status!=="active" || isRunOver(state))return state;
  const base=c.deployed ? c.due : ckInt(CLAINK.IDLE[0],CLAINK.IDLE[1]);
  const over=ckR()<CLAINK.OVERAGE_P ? ckInt(CLAINK.OVERAGE[0],CLAINK.OVERAGE[1]) : 0;
  const total=base+over;
  const idleTok=c.deployed ? 0 : ckTok(base), overTok=over ? ckTok(over) : 0;
  const weekTok=(c.deployed ? c.weekTokens : idleTok)+overTok;
  const s={...state,claink:{...c,deployed:false,claims:0,due:0,weekTokens:0,lastInvoice:total,tokens:c.tokens+idleTok+overTok}};
  return clainkCharge(s,total,c.deployed ? "ck.invoice" : "ck.invoice.idle",
    c.deployed ? {total,tokens:weekTok,claims:c.claims,looped:!!over} : {total,tokens:weekTok,looped:!!over});
};
