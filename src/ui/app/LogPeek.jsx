import React from "react";
import { UI } from "../../copy/ui.js";
import { isPhone } from "../env.js";
import { Icon } from "./Icon.jsx";
import { iconFor, legacyText } from "./logLook.js";

const { useState, useEffect, useLayoutEffect, useRef } = React;
const showFor = lines => 2600 + 600 * lines;   // long enough to read: 3.2 s for one line

// When a step writes more lines than fit (End week does), the ones that matter come first: what was signed, lost
// or decided, then warnings, then the rest; payday and rent are every week's news and go last.
const ROUTINE = { "pay.salary": true, "pay.rent": true };
const BIG = /^(close\.signed|ck\.signed|ck\.strike|ck\.revoked|qbr\.|end\.)/;
const weight = e => (ROUTINE[e.tag] ? 3 : e.kind === "bad" || BIG.test(e.tag || "") ? 0 : e.kind === "warn" ? 1 : 2);
const onScreen = (el, top) => { if (!el) return false; const r = el.getBoundingClientRect(); return r.top < window.innerHeight - 48 && r.bottom > (top || 0) + 48; };
const stripHeight = () => (document.querySelector(".strip.on") ? 40 : 0);

// What just happened, where you are looking. On a phone the page is one long column and the log is a scroll away
// from the button you pressed, so the lines an action writes are shown for a moment at the bottom of the screen.
//   - Only when the log itself is off the screen (so never on the one-screen desktop layout).
//   - Not under a dialog: lines written while one is open (End week that opens an event) wait until it closes and
//     are then shown together with what the choice wrote. An ending never closes, so its lines are never shown.
//   - It is a notice and not a control: taps go through it, and it moves up if it would sit on End week.
//   - A screen reader already hears the log and the hint bar, so it is hidden from one.
// note: {id, title, text}, the reason a blocked button gave when it was tapped; shown here when the hint bar that
// carries it is off the screen.
export const LogPeek = ({ s, note }) => {
  const [peek, setPeek] = useState(null);
  const seen = useRef(null), timer = useRef(0), wait = useRef(0), held = useRef([]), box = useRef(null);
  const top = s.logs.length ? s.logs[0].id : null;
  const raise = useRef(null);
  raise.current = next => {
    setPeek(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setPeek(null), next.ms);
  };
  const flush = useRef(null);
  flush.current = () => {
    if (document.querySelector("dialog[open]")) return;            // its close event brings us back here
    const fresh = held.current; held.current = [];
    if (!fresh.length || onScreen(document.querySelector(".activity"), stripHeight())) return;
    const max = isPhone() && fresh.length > 2 ? 2 : 3;             // a small screen has less to spare
    const list = fresh.map((e, i) => ({ e, i })).sort((a, b) => weight(a.e) - weight(b.e) || a.i - b.i).slice(0, max)
      .sort((a, b) => a.i - b.i).map(x => x.e);
    const more = Math.max(0, fresh.length - list.length);
    raise.current({ key: "l" + fresh[fresh.length - 1].id, list, more, ms: showFor(list.length + (more ? 1 : 0)) });
  };
  useEffect(() => {
    const was = seen.current;
    seen.current = { runId: s.runId, top };
    if (!was) return;                                               // the first look
    if (was.runId !== s.runId) {                                    // another run: nothing of the last one stays up
      held.current = []; clearTimeout(timer.current); clearTimeout(wait.current); setPeek(null);
      return;
    }
    if (was.top === top) return;
    const fresh = [];
    let found = was.top === null;
    for (const e of s.logs) { if (e.id === was.top) { found = true; break; } if (!e.tag || e.msg) fresh.push(e); }
    if (!found || !fresh.length) return;                            // a loaded save is not news
    fresh.reverse();                                                // in the order they happened
    held.current = held.current.concat(fresh);
    // a moment later: by then a dialog this step opens is open, and the page has moved if the week turned
    clearTimeout(wait.current);
    wait.current = setTimeout(() => flush.current(), 90);
  }, [top, s.runId]);
  useEffect(() => {
    // close does not bubble, but it can be caught on the way down
    const onClose = () => { clearTimeout(wait.current); wait.current = setTimeout(() => flush.current(), 140); };
    document.addEventListener("close", onClose, true);
    return () => { document.removeEventListener("close", onClose, true); clearTimeout(timer.current); clearTimeout(wait.current); };
  }, []);
  useEffect(() => {
    if (!note) return;
    const hint = document.querySelector(".hint");
    if (hint) { const r = hint.getBoundingClientRect(); if (r.top >= stripHeight() && r.bottom <= window.innerHeight) return; }   // it can be read where it is
    raise.current({ key: "n" + note.id, note, list: [], more: 0, ms: showFor(1) + 400 });
  }, [note && note.id]);
  // If the notice would sit on End week (or the Hail Mary beside it), it goes above them instead.
  useLayoutEffect(() => {
    const el = box.current; if (!el) return;
    el.style.setProperty("--peek-lift", "0px");
    const foot = document.querySelector(".foot"); if (!foot) return;
    const r = el.getBoundingClientRect(), f = foot.getBoundingClientRect();
    if (f.bottom <= r.top || f.top >= r.bottom) return;
    const lift = Math.ceil(r.bottom - (f.top - 8));
    if (r.top - lift >= stripHeight() + 8) el.style.setProperty("--peek-lift", lift + "px");
  }, [peek && peek.key]);
  if (!peek) return null;
  return (
    <div className="peek" ref={box} aria-hidden="true" key={peek.key} style={{ "--peek-ms": peek.ms + "ms" }}>
      <ul>
        {peek.note ? (
          <li className="line warn"><Icon name="info" /><div className="body"><p><strong>{peek.note.title}.</strong> {peek.note.text}</p></div></li>
        ) : peek.list.map(e => {
          const kind = e.kind === "bad" || e.kind === "warn" ? " " + e.kind : "";
          return (
            <li className={"line" + kind} key={e.id}>
              <Icon name={iconFor(e)} />
              <div className="body"><p>{e.tag ? e.msg : legacyText(e.msg)}</p>{e.dl ? <span className="deltas">{e.dl}</span> : null}</div>
            </li>
          );
        })}
      </ul>
      {peek.more > 0 && <p className="peek-more">{UI.peekMore(peek.more)}</p>}
    </div>
  );
};
