import React from "react";
import { UI } from "../../copy/ui.js";
import { Icon } from "./Icon.jsx";
import { iconFor, legacyText } from "./logLook.js";
import { useOverflowFade } from "./useOverflowFade.js";

const Line = ({ e }) => {
  const kind = e.kind === "bad" || e.kind === "warn" ? e.kind : "";
  return (
    <li className={"line" + (kind ? " " + kind : "")} data-tag={e.tag || undefined}>
      <Icon name={iconFor(e)} />
      <p>{e.tag ? e.msg : legacyText(e.msg)}</p>
      <span className="deltas">{e.dl || ""}</span>
    </li>
  );
};

// The log, newest first, under a divider for each week. Lines from older saves carry no week: they sit under "Earlier".
export const Activity = ({ s }) => {
  const ref = useOverflowFade([s.logs.length]);
  const out = []; let last;
  s.logs.forEach(e => {
    const wk = typeof e.wk === "number" ? e.wk : null;
    if (wk !== last) { out.push(<li key={"w" + e.id} className="week-div">{wk === null ? UI.earlier : UI.weekDivider(wk)}</li>); last = wk; }
    out.push(<Line key={e.id} e={e} />);
  });
  return (
    <div className="section activity">
      <div className="section-head"><h2>{UI.activity}</h2></div>
      {s.logs.length ? <ol className="scroll" ref={ref} aria-live="polite" aria-relevant="additions">{out}</ol> : <p className="empty">{UI.noActivity}</p>}
    </div>
  );
};
