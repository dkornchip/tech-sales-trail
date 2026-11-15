// Reading old saves by their wording. Nothing else in src/game may look at the words of a log line or a stored label:
// current runs carry tags, causes and ids for that. The strings below are frozen: they are what OLD saves contain,
// so they must not follow a rewrite of the copy.

// Saves from before v1.15 have no endCause. For a firing, the reason is read from the last "bad" line of the log.
// type: the ending (repo, burnout, club, missed, fired). logs: the save's log, newest first.
export const legacyCause=(type,logs)=>{
  if(type!=="fired")return type==="burnout" ? "stress" : type;
  const lastBad=logs.find(e=>e.kind==="bad");
  return !lastBad ? "qbr" : lastBad.msg.indexOf("🪓")===0 ? "org" : lastBad.msg.indexOf("📉 Mid-quarter")===0 ? "review" : "qbr";
};

// Why a run ended. A run says so itself (endCause, since v1.15). A save without one is asked for the tag of the
// line that ended it (v2.0 on), and only then for the wording of its last bad line.
const CAUSE_OF_TAG={"end.club":"club","end.missed":"missed","end.fired.qbr":"qbr","end.fired.under70":"qbr","end.fired.politics":"politics",
  "end.fired.review":"review","end.fired.org":"org","end.meltdown.stress":"stress","end.meltdown.weekend":"stress","end.ascension":"caffeine","end.repo":"repo"};
export const causeOf=(type,s)=>{
  if(typeof s.endCause==="string" && s.endCause) return s.endCause;
  const logs=Array.isArray(s.logs) ? s.logs : [];
  const ending=logs.find(e=>e && typeof e.tag==="string" && Object.prototype.hasOwnProperty.call(CAUSE_OF_TAG,e.tag));
  if(ending){ const c=CAUSE_OF_TAG[ending.tag]; if(type!=="burnout" || c==="stress" || c==="caffeine") return c; }
  return legacyCause(type,logs);
};

// A v1.19 clAInk incident, turned into a strike card by an earlier load, is recognisable only by who "filed" it.
export const LEGACY_INCIDENT_WHO="Incident review";
