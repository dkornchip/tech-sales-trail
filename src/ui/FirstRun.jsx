import React from "react";
import { TOUR, TOUR_UI, WELCOME } from "../copy/onboarding.js";
import { QUARTER_WEEKS } from "../game/constants.js";
import { Modal } from "./primitives.jsx";
import { WelcomeMemo } from "./WelcomeMemo.jsx";

const { useState, useEffect, useLayoutEffect, useRef } = React;

// A first day happens once per browser: after it (or once any run has been saved) the game opens on the desk.
export const ONBOARD_KEY = "tst-onboarded-v2";
export const isFirstDay = hasRun => {
  if (hasRun) return false;
  try { return localStorage.getItem(ONBOARD_KEY) !== "1"; } catch { return false; }
};
export const endFirstDay = () => { try { localStorage.setItem(ONBOARD_KEY, "1"); } catch {} };

// True while the boot screen is still up (the shell marks <html> for as long as it is).
export const useBooting = () => {
  const now = () => document.documentElement.classList.contains("tst-booting");
  const [booting, setBooting] = useState(now);
  useEffect(() => {
    let timer = 0;
    // the boot screen takes half a second to switch off; what waits for it waits for that too
    const check = () => { clearTimeout(timer); if (now()) setBooting(true); else timer = setTimeout(() => setBooting(false), 500); };
    const mo = new MutationObserver(check);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    if (!now()) setBooting(false);
    return () => { mo.disconnect(); clearTimeout(timer); };
  }, []);
  return booting;
};

// The opening: the memo HR sent, and under it the job in three lines. `again` is the memo reopened from the rules.
export const Welcome = ({ open, again, s, onClose }) => (
  <Modal open={open} title={WELCOME.title} dialogId="welcome" onDismiss={again ? onClose : undefined}
    actions={[{ label: again ? WELCOME.close : WELCOME.start, className: "primary", ui: "welcome-ok", onClick: onClose }]}>
    {open && <WelcomeMemo active />}
    {!again && (
      <ul className="welcome-lines">
        {WELCOME.lines.map((line, i) => <li key={i}>{line({ quota: s.quota, weeks: QUARTER_WEEKS, slots: s.maxSlots })}</li>)}
      </ul>
    )}
  </Modal>
);

// where each stop of the tour points
const TARGETS = { prospect: '[data-act="prospect"]', slots: '[data-tour="slots"]', end: '[data-ui="end"]' };
const CARD_W = 300, GAP = 12, EDGE = 12;

// Three stops, one at a time. It never blocks the game: press a game button and the tour is over.
// onEnd(true): the tour was closed from its own card, so the focus goes to where a first week starts.
export const Tour = ({ step, onStep, onEnd }) => {
  const stop = TOUR[step];
  const card = useRef(null);
  const [box, setBox] = useState(null);
  useLayoutEffect(() => {
    const place = () => {
      const el = document.querySelector(TARGETS[stop.at]);
      if (!el) { setBox(null); return; }
      const r = el.getBoundingClientRect(), h = card.current ? card.current.offsetHeight : 150;
      const w = Math.min(CARD_W, window.innerWidth - 2 * EDGE);
      const below = r.bottom + GAP + h <= window.innerHeight - EDGE || r.top - GAP - h < EDGE;
      const left = Math.max(EDGE, Math.min(r.left, window.innerWidth - w - EDGE));
      setBox({
        ring: { left: r.left - 4, top: r.top - 4, width: r.width + 8, height: r.height + 8 },
        // (kept on the screen even when there is room neither under nor over the thing it points at)
        card: { left, top: Math.max(EDGE, Math.min(below ? r.bottom + GAP : r.top - GAP - h, window.innerHeight - EDGE - h)), width: w },
        arrow: Math.max(16, Math.min(w - 16, r.left + Math.min(r.width / 2, 40) - left)),
        below
      });
    };
    const el = document.querySelector(TARGETS[stop.at]);
    // in a short window the thing goes to the top of the screen, which leaves the card room under it
    if (el && el.scrollIntoView) el.scrollIntoView({ block: window.innerHeight < 520 ? "start" : "center", inline: "nearest" });
    place();
    const raf = requestAnimationFrame(place); // again once the card has its real height
    window.addEventListener("resize", place); window.addEventListener("scroll", place, true);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [step]);
  useEffect(() => {
    const btn = card.current && card.current.querySelector("[data-tour-next]");
    if (btn) btn.focus({ preventScroll: true });
  }, [step, !!box]);
  useEffect(() => {
    const onKey = e => { if (e.key === "Escape") { e.stopPropagation(); onEnd(true); } };
    // a press on the game itself means the player has started: the tour steps aside and the press goes through
    const onDown = e => { if (card.current && card.current.contains(e.target)) return; if (e.target.closest && e.target.closest("button, [role=button], a, input")) onEnd(); };
    document.addEventListener("keydown", onKey, true); document.addEventListener("pointerdown", onDown, true);
    return () => { document.removeEventListener("keydown", onKey, true); document.removeEventListener("pointerdown", onDown, true); };
  }, []);
  const last = step === TOUR.length - 1;
  return (
    <>
      {box && <div className="coach-ring" style={box.ring} aria-hidden="true" />}
      <div className={"coach" + (box && !box.below ? " above" : "")} ref={card} role="dialog" aria-label={TOUR_UI.label} data-tour-step={step}
        style={box ? box.card : { visibility: "hidden" }}>
        {box && <i className="coach-arrow" style={{ left: box.arrow }} aria-hidden="true" />}
        <div className="coach-step">{TOUR_UI.step(step + 1, TOUR.length)}</div>
        <div className="coach-title">{stop.title}</div>
        <p className="coach-body">{stop.body}</p>
        <div className="coach-foot">
          {!last && <button type="button" className="linkbtn" data-tour-skip="" onClick={() => onEnd(true)}>{TOUR_UI.skip}</button>}
          <button type="button" className="btn primary" data-tour-next="" onClick={() => (last ? onEnd(true) : onStep(step + 1))}>{last ? TOUR_UI.done : TOUR_UI.next}</button>
        </div>
      </div>
    </>
  );
};
