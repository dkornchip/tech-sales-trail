import React from "react";
import { isRunOver } from "../../game/log.js";
import { hailBlock } from "../../game/run.js";
import { effectChips, fridayPreview, lateDeals, stageCount } from "../../game/selectors.js";
import { HAIL as HAIL_ODDS } from "../../game/rules.js";
import { CHIP, HINT, UI } from "../../copy/ui.js";
import { isPhone, noHover } from "../env.js";
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

// One chip per effect in force, each with its own clock (game/effects.js): what it does to the signing odds, and a
// second chip for a discount it carries.
const chips = s => {
  const out = [];
  for (const e of effectChips(s)) {
    if (e.conv) out.push({ id: "odds-" + e.src, icon: e.conv > 0 ? "trending-up" : "trending-down", kind: e.conv > 0 ? "good" : "warn", text: CHIP.closeOdds(e.conv, e.weeksLeft) });
    if (e.disc > 0) out.push({ id: "discount-" + e.src, icon: "receipt", kind: "warn", text: CHIP.discount(e.disc, e.weeksLeft) });
  }
  if (s.pip) out.push({ id: "pip", icon: "file-warning", kind: "warn", text: CHIP.pip(s.pipLevel || 1) });
  if (s.coffeesThisWeek > 0) out.push({ id: "shots", icon: "coffee", kind: "", text: CHIP.shots(s.coffeesThisWeek) });
  if (s.trip) out.push({ id: "trip", icon: "plane", kind: "", text: CHIP.trip(s.trip) });
  if (s.restedThisWeek) out.push({ id: "rested", icon: "battery-charging", kind: "", text: CHIP.rested });
  return out;
};

// The status chips share one line with the buttons. Whatever does not fit is folded into a "+N" chip, which
// names the rest when pointed at, focused or tapped; nothing is ever cut off mid-word. A phone gives the chips
// lines of their own, so there every chip is shown and nothing is folded.
const Chips = ({ list, onHint }) => {
  const box = React.useRef(null);
  const [width, setWidth] = React.useState(0);                  // the footer's width, as last observed
  const phone = isPhone();
  // what was measured, and for what: this set of chips, at this width
  const key = list.map(c => c.id + ":" + c.text).join("|") + "@" + width;
  const [fit, setFit] = React.useState({ key: "", n: list.length });
  const n = phone ? list.length : fit.key === key ? fit.n : list.length;   // a new set, or a new width, is measured afresh
  React.useLayoutEffect(() => {
    const el = box.current; if (!el || phone) return;
    const kids = Array.from(el.children).filter(k => k.hasAttribute("data-chip"));
    if (!kids.length) return;
    const top = kids[0].offsetTop;
    let ok = kids.findIndex(k => k.offsetTop > top);
    if (ok < 0) ok = kids.length;
    // fewer fit than are shown (the "+N" chip takes room too): show fewer, and look again. Otherwise it is settled.
    if (fit.key !== key || ok < fit.n) setFit({ key, n: fit.key === key ? Math.min(ok, fit.n) : ok });
  }, [key, n, phone]);
  // One observer for the life of the footer. It reports a width; only a change of width asks for a new measure.
  // (It used to be rebuilt by every measure, and each new one fired at once and asked for another: the chips were
  // re-rendered on every frame, and the "+N" chip could not keep the focus.)
  React.useEffect(() => {
    const el = box.current && box.current.parentElement;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(entries => { const w = Math.round(entries[entries.length - 1].contentRect.width); setWidth(v => (v === w ? v : w)); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const rest = list.slice(n), names = rest.map(c => c.text).join(" · ");
  const tell = () => onHint({ title: CHIP.more(rest.length), text: names });
  const leave = () => { if (!noHover()) onHint(null); };
  return (
    <>
      <div className="chips" ref={box}>{list.slice(0, n).map(c => <span key={c.id} className={"chip" + (c.kind ? " " + c.kind : "")} data-chip={c.id}><Icon name={c.icon} />{c.text}</span>)}</div>
      {rest.length ? <span className="chip more" tabIndex={0} title={names} aria-label={CHIP.more(rest.length) + ": " + names} onMouseEnter={tell} onFocus={tell} onClick={tell} onMouseLeave={leave} onBlur={leave}>+{rest.length}</span> : null}
    </>
  );
};

// Why the Hail Mary can't be thrown right now, or null: the rules' own answer (game/run.js).
export { hailBlock };

export const Foot = ({ s, onHail, onEndWeek, onHint, onBlocked }) => {
  const late = lateDeals(s).length;
  const hailBlocked = hailBlock(s);
  const hailText = hailBlocked && hailBlocked.why !== "none" ? HINT.blocked[hailBlocked.why](hailBlocked) : HINT.hail(late, HAIL_ODDS.blast, HAIL_ODDS.walk);
  const hailHint = () => onHint({ title: UI.hail, text: hailText, key: "H" });
  const endHint = () => onHint({ title: UI.endWeek, text: isRunOver(s) ? HINT.blocked.over() : HINT.endWeek(fridayPreview(s)), key: "E" });
  const over = isRunOver(s);
  // no pointer to follow (a touch screen): the hint stays until the next tap, so a blocked button can say why
  const leave = () => { if (!noHover()) onHint(null); };
  return (
    <div className="foot">
      <Chips list={chips(s)} onHint={onHint} />
      <button type="button" className="btn" data-ui="hail" aria-disabled={hailBlocked ? "true" : undefined} onClick={() => { if (hailBlocked) { hailHint(); if (onBlocked && noHover()) onBlocked({ title: UI.hail, text: hailText }); return; } onHail(); if (noHover()) onHint(null); }}
        onMouseEnter={hailHint} onFocus={hailHint} onMouseLeave={leave} onBlur={leave}><Icon name="dices" />{UI.hail}</button>
      <button type="button" className="btn primary" data-ui="end" aria-disabled={over ? "true" : undefined} onClick={() => { if (over) return; onEndWeek(); if (noHover()) onHint(null); }}
        onMouseEnter={endHint} onFocus={endHint} onMouseLeave={leave} onBlur={leave}>{UI.endWeek}<Icon name="arrow-right" /></button>
    </div>
  );
};
