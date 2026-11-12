import React from "react";
import { weekOf } from "../../game/selectors.js";
import { NAMES } from "../../copy/ui.js";
import { isPhone } from "../env.js";
import { ActionGrid } from "./ActionGrid.jsx";
import { Activity } from "./Activity.jsx";
import { Deals } from "./Deals.jsx";
import { Foot, HintBar } from "./Foot.jsx";
import { Kpis } from "./Kpis.jsx";
import { LogPeek } from "./LogPeek.jsx";
import { Quarter } from "./Quarter.jsx";
import { Stats } from "./Stats.jsx";
import { StatusStrip } from "./StatusStrip.jsx";

// The main screen. Left: your week (where you are, how you are, what you can do). Right: your deals, what happened,
// and whatever the vendor has parked in the corner.
export const Board = ({ s, top, dock, onAct, onHail, onEndWeek }) => {
  const [hint, setHint] = React.useState(null);
  // On a phone End week is pressed a long way down the page. When the week turns, the page goes back to the top,
  // where the new week, its numbers and what changed in them are.
  const week = weekOf(s), turn = React.useRef({ runId: s.runId, week });
  React.useEffect(() => {
    const was = turn.current; turn.current = { runId: s.runId, week };
    if (was.runId !== s.runId) { window.scrollTo(0, 0); return; }                       // another run starts at the top
    if (week === was.week + 1 && isPhone()) window.scrollTo(0, 0);                      // (at once: a dialog may be about to lock the page)
  }, [week, s.runId]);
  return (
    <div className="app">
      {top}
      <main className="main">
        <section className="panel left" aria-label={NAMES.week}>
          <Quarter s={s} />
          <Kpis s={s} />
          <Stats s={s} />
          <ActionGrid s={s} onAct={onAct} onHint={setHint} />
          <HintBar hint={hint} s={s} />
          <Foot s={s} onHail={onHail} onEndWeek={onEndWeek} onHint={setHint} />
        </section>
        <section className="panel right" aria-label={NAMES.desk}>
          <Deals s={s} />
          <Activity s={s} />
          {dock}
        </section>
      </main>
      <StatusStrip s={s} />
      <LogPeek s={s} />
    </div>
  );
};
