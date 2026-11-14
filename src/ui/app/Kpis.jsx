import React from "react";
import { STRESS_DANGER } from "../../game/stress.js";
import { CASH, FIRING_FROM } from "../../game/rules.js";
import { REVIEWS_FROM, fridayPreview, nextRentWeek, pace, rentDueThisWeek, weekOf } from "../../game/selectors.js";
import { money } from "../../game/util.js";
import { KPI } from "../../copy/ui.js";
import { useTween } from "../primitives.jsx";

const { useEffect, useRef, useState } = React;
const usd = v => money(v).replace("-", "−");

// A change in a number shows once as a small chip, then goes. A new run (or a loaded one) shows nothing.
const useDelta = (value, runId) => {
  const prev = useRef({ value, runId }), seq = useRef(0);
  const [delta, setDelta] = useState(null);
  useEffect(() => {
    const was = prev.current; prev.current = { value, runId };
    if (was.runId !== runId) { setDelta(null); return; }
    const diff = Math.round(value - was.value);
    if (!diff) return;
    setDelta({ diff, key: ++seq.current });
    const t = setTimeout(() => setDelta(null), 1700);
    return () => clearTimeout(t);
  }, [value, runId]);
  return delta;
};

const Kpi = ({ id, label, value, runId, format, small, meter, sub, subKind, note, goodUp = true, children }) => {
  const shown = useTween(value), delta = useDelta(value, runId);
  const up = delta && delta.diff > 0;
  return (
    <div className="kpi" data-kpi={id} role="group" aria-label={label}>
      <div className="label" aria-hidden="true">{label}</div>
      <div className="value num">{format(shown)}{small && <><span className="sr-only">, </span><small>{small}</small></>}</div>
      {meter}{children}
      <div className={"sub" + (subKind ? " " + subKind : "")}>{sub}</div>
      {note ? <div className="sub note">{note}</div> : null}
      {delta && <span key={delta.key} aria-hidden="true" className={"delta " + (up === goodUp ? "up" : "down")}>{(up ? "+" : "−") + format(Math.abs(delta.diff)).replace(/^−/, "")}</span>}
    </div>
  );
};
const Meter = ({ value, kind }) => <div aria-hidden="true" className={"meter" + (kind ? " " + kind : "")}><i style={{ width: Math.max(0, Math.min(100, value)) + "%" }} /></div>;

export const Kpis = ({ s }) => {
  const friday = fridayPreview(s), p = pace(s), points = Math.round(Math.abs(p.gap) * 100);
  const rentWeek = nextRentWeek(s);
  const stressSub = s.stress >= STRESS_DANGER ? [KPI.stressDanger, "bad"] : friday.stress > 0 ? [KPI.stressCrash(friday.stress), "warn"] : [KPI.stressEases(-friday.stress), ""];
  const cashSub = s.cash < 0 ? [KPI.collections(CASH.repoAt), s.cash <= CASH.warnAt ? "bad" : "warn"]
    : rentDueThisWeek(s) ? [KPI.rentThisWeek(friday.rent), "warn"]
    : rentWeek ? [KPI.rentLater(rentWeek), ""] : [KPI.rentDone, ""];
  // where the run stands against what this Friday expects: the words say it, the colour only repeats it. Before
  // reviews start, behind pace costs nothing yet, and the line says when that changes.
  const paceSub = p.behind && !p.reviewed ? [KPI.reviewsSoon(REVIEWS_FROM), ""]
    : p.behind ? [KPI.behind(points), weekOf(s) >= FIRING_FROM ? "bad" : "warn"]
    : p.ahead ? [KPI.ahead(points), "good"] : [KPI.onPace, ""];
  const n = v => String(Math.round(v));
  return (
    <div className="kpis">
      <Kpi id="energy" label={KPI.energy} value={s.energy} runId={s.runId} format={n} small={KPI.outOf}
        meter={<Meter value={s.energy} kind={s.energy > 50 ? "good" : s.energy > 25 ? "warn" : "bad"} />} sub={KPI.energyFriday(friday.energy)} />
      <Kpi id="stress" label={KPI.stress} value={s.stress} runId={s.runId} format={n} small={KPI.outOf} goodUp={false}
        meter={<Meter value={s.stress} kind={s.stress < 40 ? "good" : s.stress < 70 ? "warn" : "bad"} />} sub={stressSub[0]} subKind={stressSub[1]} />
      <Kpi id="cash" label={KPI.cash} value={s.cash} runId={s.runId} format={usd} sub={cashSub[0]} subKind={cashSub[1]} />
      <Kpi id="closed" label={KPI.closed} value={s.closedQuarter} runId={s.runId} format={usd} small={KPI.ofQuota(p.done)} sub={paceSub[0]} subKind={paceSub[1]} note={KPI.expected(p.target)}
        meter={<div className="meter" aria-hidden="true" title={KPI.expectedMark(p.target)}><i style={{ width: Math.min(100, p.done * 100) + "%" }} /><span className="pace" data-pace={Math.round(p.target * 100)} style={{ left: Math.min(100, p.target * 100) + "%" }} /></div>} />
    </div>
  );
};
