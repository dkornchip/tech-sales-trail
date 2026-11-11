import React from "react";
import { closeChance } from "../../game/selectors.js";
import { money } from "../../game/util.js";
import { MOOD, STAGE, UI } from "../../copy/ui.js";
import { useOverflowFade } from "./useOverflowFade.js";

// The pipeline as a table, furthest along first. The order is for reading only: the game's own list is untouched.
export const Deals = ({ s }) => {
  const rows = s.deals.map((d, i) => ({ d, i })).sort((a, b) => b.d.stage - a.d.stage || b.d.value - a.d.value || a.i - b.i);
  const ref = useOverflowFade([rows.length]);
  return (
    <div className="section deals">
      <div className="section-head"><h2>{UI.deals}</h2><span className="meta num">{UI.dealsMeta(s.deals.length, s.pipeline)}</span></div>
      {rows.length ? <>
        <div className="deal deal-cols" aria-hidden="true">{UI.dealCols.map(c => <span key={c}>{c}</span>)}</div>
        <ol className="scroll" ref={ref}>
          {rows.map(({ d }) => (
            <li key={d.id} className={"deal" + (d.stage >= 3 ? " late" : "")} data-deal-stage={d.stage}>
              <span className="acct">{d.account}</span>
              <span className="stage" title={STAGE[d.stage] || ""}><span className="pips" aria-hidden="true">{[0, 1, 2, 3, 4].map(k => <i key={k} className={k <= d.stage ? "on" : ""} />)}</span><span className="stage-name">{STAGE[d.stage] || ""}</span></span>
              <span className={"mood " + d.mood}>{MOOD[d.mood] || d.mood}</span>
              <span className="val num">{money(d.value)}</span>
              <span className="odds num">{d.stage >= 3 ? Math.round(closeChance(s, d, { trained: true }) * 100) + "%" : ""}</span>
            </li>
          ))}
        </ol>
      </> : <p className="empty">{UI.noDeals}</p>}
    </div>
  );
};
