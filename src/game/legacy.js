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

// A v1.19 clAInk incident, turned into a strike card by an earlier load, is recognisable only by who "filed" it.
export const LEGACY_INCIDENT_WHO="Incident review";
