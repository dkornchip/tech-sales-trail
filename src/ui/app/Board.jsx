import React from "react";
import { NAMES } from "../../copy/ui.js";
import { ActionGrid } from "./ActionGrid.jsx";
import { Activity } from "./Activity.jsx";
import { Deals } from "./Deals.jsx";
import { Foot, HintBar } from "./Foot.jsx";
import { Kpis } from "./Kpis.jsx";
import { LogPeek } from "./LogPeek.jsx";
import { Quarter } from "./Quarter.jsx";
import { Stats } from "./Stats.jsx";

// The main screen. Left: your week (where you are, how you are, what you can do). Right: your deals, what happened,
// and whatever the vendor has parked in the corner.
export const Board = ({ s, top, dock, onAct, onHail, onEndWeek }) => {
  const [hint, setHint] = React.useState(null);
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
      <LogPeek s={s} />
    </div>
  );
};
