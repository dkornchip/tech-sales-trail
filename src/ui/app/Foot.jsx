import React from "react";
import { isRunOver } from "../../game/log.js";
import { blocked, fridayPreview, lateDeals, stageCount } from "../../game/selectors.js";
import { CHIP, HINT, UI } from "../../copy/ui.js";
import { HAIL } from "./actionList.js";
import { Icon } from "./Icon.jsx";

// The one thing worth doing next, for when nothing is under the pointer.
export const idleHint = s => {
  if (isRunOver(s)) return HINT.idle.over();
  if (s.slots <= 0) return HINT.idle.noSlots();
  const late = lateDeals(s).length, demoed = stageCount(s, 2), qualified = stageCount(s, 1), leads = stageCount(s, 0);
  if (late) return HINT.idle.close(late);
  if (demoed) return HINT.idle.propose(demoed);
  if (qualified) return HINT.idle.demo(qualified);
  if (leads) return HINT.idle.discovery(leads);
  return HINT.idle.start();
};

export const HintBar = ({ hint, s }) => (
  <div className="hint" role="status" aria-live="polite">
    <Icon name="info" className="sm" />
    <span>{hint ? <><strong>{hint.title}.</strong> {hint.text}</> : idleHint(s)}</span>
    {hint && hint.key ? <kbd>{hint.key}</kbd> : null}
  </div>
);

const chips = s => {
  const out = [], m = s.modifiers || {};
  if (m.conversion) out.push({ id: "odds", icon: m.conversion > 0 ? "trending-up" : "trending-down", kind: m.conversion > 0 ? "good" : "warn", text: CHIP.closeOdds(m.conversion, m.expiresIn || 1) });
  if (m.discount > 0) out.push({ id: "discount", icon: "receipt", kind: "warn", text: CHIP.discount(m.discount) });
  if (s.pip) out.push({ id: "pip", icon: "file-warning", kind: "warn", text: CHIP.pip(s.pipLevel || 1) });
  if (s.coffeesThisWeek > 0) out.push({ id: "shots", icon: "coffee", kind: "", text: CHIP.shots(s.coffeesThisWeek) });
  if (s.trip) out.push({ id: "trip", icon: "plane", kind: "", text: CHIP.trip(s.trip) });
  if (s.restedThisWeek) out.push({ id: "rested", icon: "battery-charging", kind: "", text: CHIP.rested });
  return out;
};

// Why the Hail Mary can't be thrown right now, or null.
export const hailBlock = s => blocked(s, { energy: HAIL.energy, slots: 1 }) || (lateDeals(s).length ? null : { why: "none" });

export const Foot = ({ s, onHail, onEndWeek, onHint }) => {
  const late = lateDeals(s).length;
  const hailBlocked = hailBlock(s);
  const hailHint = () => onHint({ title: UI.hail, text: hailBlocked && hailBlocked.why !== "none" ? HINT.blocked[hailBlocked.why](hailBlocked) : HINT.hail(late), key: "H" });
  const endHint = () => onHint({ title: UI.endWeek, text: isRunOver(s) ? HINT.blocked.over() : HINT.endWeek(fridayPreview(s)), key: "E" });
  const over = isRunOver(s);
  return (
    <div className="foot">
      <div className="chips">{chips(s).map(c => <span key={c.id} className={"chip" + (c.kind ? " " + c.kind : "")} data-chip={c.id}><Icon name={c.icon} />{c.text}</span>)}</div>
      <button type="button" className="btn" data-ui="hail" aria-disabled={hailBlocked ? "true" : undefined} onClick={() => { if (!hailBlocked) onHail(); }}
        onMouseEnter={hailHint} onFocus={hailHint} onMouseLeave={() => onHint(null)} onBlur={() => onHint(null)}><Icon name="dices" />{UI.hail}</button>
      <button type="button" className="btn primary" data-ui="end" aria-disabled={over ? "true" : undefined} onClick={() => { if (!over) onEndWeek(); }}
        onMouseEnter={endHint} onFocus={endHint} onMouseLeave={() => onHint(null)} onBlur={() => onHint(null)}>{UI.endWeek}<Icon name="arrow-right" /></button>
    </div>
  );
};
