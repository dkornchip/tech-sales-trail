import React from "react";
import { QUARTER_WEEKS } from "../../game/constants.js";
import { RENT_WEEKS, weekOf } from "../../game/selectors.js";
import { UI, chapterOf } from "../../copy/ui.js";

// The quarter at a glance: thirteen weeks, the ones that cost rent, the one that ends it, and this week's slots.
export const Quarter = ({ s }) => {
  const week = weekOf(s), spent = s.maxSlots - s.slots;
  return (
    <div className="quarter">
      <div className="quarter-head">
        <h2 key={week} className="week-in">{UI.week(week)}</h2><span className="of">{UI.ofWeeks(QUARTER_WEEKS)}</span>
        {/* the chapter of the quarter, beside the heading (not part of it), where there is room for it */}
        <span className="chapter" data-chapter={chapterOf(week)}>{chapterOf(week)}</span>
        <span className="slots" data-slots={s.slots} data-tour="slots">{UI.slots}
          <span className="pips" aria-hidden="true">{Array.from({ length: s.maxSlots }, (_, i) => <i key={i} className={i < spent ? "spent" : ""} />)}</span>
          <span className="num">{UI.slotsLeft(s.slots)}</span>
        </span>
      </div>
      <ol className="weeks">
        {Array.from({ length: QUARTER_WEEKS }, (_, i) => {
          const w = i + 1;
          return (
            <li key={w} className={w < week ? "past" : w === week ? "now" : ""} aria-current={w === week ? "step" : undefined}>
              <span className="tick" /><span className="n num">{w}</span>
              <span className="tag">{w === QUARTER_WEEKS ? UI.qbr : RENT_WEEKS.includes(w) ? UI.rent : ""}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
};
