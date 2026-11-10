/* ---------- which sound a log line makes, by its tag ---------- */
// Every log entry carries a tag (the keys of LOG in src/copy/log.js) and its params. The director never reads the
// words: rewording a line cannot change what it sounds like. An entry without a tag (a line from an old save) makes
// no sound, and neither does a tag that is not listed here (the QBR verdicts and the endings, whose sound is the
// cutscene's).
//
// tag: [sound preset, priority, announcer line (a key of LINES in src/copy/pa.js; optional)]
export var TAG_SOUND = {
  /* the actions */
  "act.prospect":["dial",3], "act.cadence":["whoosh",3], "act.discovery":["typewriter",3], "act.demo":["demo",3],
  "act.propose":["printer",3], "act.conference":["airport",3], "act.politics":["sneaky",3],
  "act.recharge":["bowl",3], "act.recharge.flat":["bowl",3], "act.recharge.already":["nope",3], "act.recharge.trip":["airport",3],
  "act.crm":["crm",3,"hygiene"], "act.crm.clean":["crm",3,"hygiene"], "act.crm.nuked":["lost",4,"closeOut"],
  "act.hail.none":["nope",3], "act.hail.blast":["hailmary",3], "act.hail.lean":["hailmary",3],
  "act.hail.chaosWon":["fanfareS",3], "act.hail.chaosLost":["bad",3], "act.hail.torched":["bad",3], "act.hail.cooked":["warn",3],
  /* coffee and stress */
  "coffee.shot":["coffee",3], "coffee.crash":["sick",2], "stress.warn":["heartbeat",2],
  /* closing and deals */
  "close.nobody":["thud",3], "close.none":["nope",3], "close.lost":["lost",4],
  "deal.ghost":["ghost",2], "deal.lost":["lost",4],
  "ach.unlocked":["achievement",4,"whale"],
  /* random events */
  "evt.marketing":["leads",2,"sqlStorm"], "evt.competitor.match":["discount",2], "evt.competitor.hold":["thud",2],
  "evt.seFumble":["fumble",2], "evt.seSave":["magic",2], "evt.security.own":["warn",2], "evt.security.spin":["warn",2],
  "evt.outage":["thunder",2,"outage"], "evt.champion":["rise",2], "evt.caseStudy":["ping",2], "evt.meme":["chirp",2,"viral"],
  "evt.freeze":["ice",2,"freeze"], "evt.crud":["sick",2], "evt.rebalance":["bad",3,"rebalance"],
  "evt.pipShred":["shield",2], "evt.favors":["shield",2],
  /* End Week */
  "week.fullFunnel":["puzzle",2], "week.neglected":["powerdown",2], "week.stale":["ice",2], "week.backlog":["ticktock",2],
  "week.next":["week",1],
  "pay.rent":["rent",2], "pay.salary":["coin",1], "pay.repoWarn":["alarm",4,"cash"],
  "mgr.emails":["busy",2,"phones"],
  "risk.audit":["suspicion",3,"meetings"], "risk.hygiene":["suspicion",3,"hygiene"], "risk.hr":["hr",4,"hr"], "risk.recurring":["hrSoft",2],
  "qbr.final":["qbr",1],
  /* the two endings that sound in the log (the rest are scored by their cutscene) */
  "end.ascension":["ignition",4], "end.meltdown.stress":["crack",4], "end.meltdown.weekend":["crack",4],
  /* clAInk. A strike is stamped; one with real damage glitches; strike 3 blue-screens and HR offboards the agent */
  "ck.install":["chime",3], "ck.dismiss":["whoosh",2], "ck.expired":["nope",2], "ck.cancel":["poweroff",3],
  "ck.invoice":["printer",2], "ck.invoice.idle":["printer",2],
  "ck.run":["beep",2], "ck.miracle":["sparkle",4,"claink"], "ck.strike":["stamp",3,"strike"], "ck.strike.hurt":["glitch",4,"sev1"],
  "ck.revoked":["bsod",5,"clainkRevoked"], "ck.farewell":["lost",4],
  "ck.mgr.yoink":["lost",4], "ck.mgr.warning":["suspicion",3,"chatgdp"], "ck.mgr.circle":["suspicion",3,"chatgdp"]
};

// Deals signing is cash, whoever closed them. `close` marks the rule so the director can check the amount (below).
export var CLOSE_TAGS = { "close.signed":1, "ck.signed":1 };
// a batch of closes worth this much or more gets the "big close" announcer line
export var BIG_CLOSE = 45000;

// The log lines a clAInk run writes. The agent workspace voices a run itself, beat by beat (see ClainkConsole), so the
// director leaves these alone; and a run owns its whole batch (see onLogs). ruleFor still maps them (tests).
export var RUN_TAGS = { "ck.run":1, "ck.signed":1, "ck.miracle":1, "ck.strike":1, "ck.strike.hurt":1, "ck.revoked":1, "ck.farewell":1,
  "ck.mgr.warning":1, "ck.mgr.circle":1, "ck.mgr.yoink":1 };
export var CASH_WARN_TAG = "pay.repoWarn";

// The announcer line for an event dialog, by the dialog's id.
export var MODAL_SAY = { "evt:competitor":"competitor", "evt:security":"incident", "ck:warning":"chatgdp", "ck:lesson":"yoink" }; // v1.21: the warning; v1.19: the Writing Lesson

function has(o,k){ return typeof k === "string" && Object.prototype.hasOwnProperty.call(o,k); }
export function isRunTag(tag){ return has(RUN_TAGS,tag); }
export function modalSay(id){ return has(MODAL_SAY,id) ? MODAL_SAY[id] : null; }

// {sfx, prio, say} for a tag and its params, or null. A fresh object every call: the director adds to it.
export function ruleFor(tag,params){
  if(has(CLOSE_TAGS,tag)) return {sfx:"cash", prio:4, close:true};
  if(tag === "act.network") return {sfx:params && params.size === "whale" ? "sonar" : "ping", prio:3};
  if(!has(TAG_SOUND,tag)) return null;
  var r = TAG_SOUND[tag];
  return {sfx:r[0], prio:r[1], say:r[2]};
}
