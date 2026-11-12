import React from "react";
import { weekOf } from "../../game/selectors.js";
import { money } from "../../game/util.js";
import { UI } from "../../copy/ui.js";
import { Icon } from "./Icon.jsx";

const usd = v => money(v).replace("-", "−");

// On a phone the numbers you act on scroll away above the buttons. Once the stat cards have left the top of the
// screen this strip takes their place: the week, the slots, energy, stress and cash, in one line. It repeats what
// the cards say, so it is hidden from a screen reader, and the stylesheet shows it on a phone only (either way up).
export const StatusStrip = ({ s }) => {
  const [on, setOn] = React.useState(false);
  React.useEffect(() => {
    const cards = document.querySelector(".kpis");
    if (!cards || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(entries => { const e = entries[entries.length - 1]; setOn(!e.isIntersecting && e.boundingClientRect.bottom <= 0); }, { threshold: 0 });
    io.observe(cards);
    return () => io.disconnect();
  }, []);
  const spent = s.maxSlots - s.slots;
  const energy = s.energy > 50 ? "" : s.energy > 25 ? " warn" : " bad", stress = s.stress < 40 ? "" : s.stress < 70 ? " warn" : " bad";
  return (
    <div className={"strip" + (on ? " on" : "")} aria-hidden="true">
      <span className="strip-week">{UI.week(weekOf(s))}</span>
      <span className="pips">{Array.from({ length: s.maxSlots }, (_, i) => <i key={i} className={i < spent ? "spent" : ""} />)}</span>
      <span className={"strip-n num" + energy}><Icon name="zap" />{Math.round(s.energy)}</span>
      <span className={"strip-n num" + stress}><Icon name="heart-pulse" />{Math.round(s.stress)}</span>
      <span className={"strip-n strip-cash num" + (s.cash < 0 ? " bad" : "")}>{usd(s.cash)}</span>
    </div>
  );
};
