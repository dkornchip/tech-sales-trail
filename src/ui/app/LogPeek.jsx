import React from "react";
import { UI } from "../../copy/ui.js";
import { Icon } from "./Icon.jsx";
import { iconFor, legacyText } from "./logLook.js";

const { useState, useEffect, useRef } = React;
const MAX = 3;
const showFor = lines => 2600 + 600 * lines;   // long enough to read: 3.2 s for one line

// When a step writes more lines than fit (End week does), the ones that matter come first: what was signed, lost
// or decided, then warnings, then the rest; payday and rent are every week's news and go last.
const ROUTINE = { "pay.salary": true, "pay.rent": true };
const BIG = /^(close\.signed|ck\.signed|ck\.strike|ck\.revoked|qbr\.|end\.)/;
const weight = e => (ROUTINE[e.tag] ? 3 : e.kind === "bad" || BIG.test(e.tag || "") ? 0 : e.kind === "warn" ? 1 : 2);

// What just happened, where you are looking. On a phone the page is one long column and the log is a scroll away
// from the button you pressed, so the lines an action writes are shown for a moment at the bottom of the screen.
// It appears only when the log itself is off the screen (never on the one-screen desktop layout), it is a notice
// and not a control (taps go through it), and a screen reader already hears the log, so it is hidden from one.
export const LogPeek = ({ s }) => {
  const [peek, setPeek] = useState(null);
  const seen = useRef(null), timer = useRef(0);
  const top = s.logs.length ? s.logs[0].id : null;
  useEffect(() => {
    const was = seen.current;
    seen.current = { runId: s.runId, top };
    if (!was || was.runId !== s.runId || was.top === top) return;   // the first look, another run, or nothing new
    const fresh = [];
    let found = was.top === null;
    for (const e of s.logs) { if (e.id === was.top) { found = true; break; } if (!e.tag || e.msg) fresh.push(e); }
    if (!found || !fresh.length) return;                            // a loaded save is not news
    const log = document.querySelector(".activity");
    if (log) { const r = log.getBoundingClientRect(); if (r.top < window.innerHeight - 48 && r.bottom > 48) return; }
    fresh.reverse();                                                // in the order they happened
    const list = fresh.map((e, i) => ({ e, i })).sort((a, b) => weight(a.e) - weight(b.e) || a.i - b.i).slice(0, MAX)
      .sort((a, b) => a.i - b.i).map(x => x.e);
    const more = Math.max(0, fresh.length - MAX), ms = showFor(list.length + (more ? 1 : 0));
    setPeek({ key: top, list, more, ms });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setPeek(null), ms);
  }, [top, s.runId]);
  useEffect(() => () => clearTimeout(timer.current), []);
  if (!peek) return null;
  return (
    <div className="peek" aria-hidden="true" key={peek.key} style={{ "--peek-ms": peek.ms + "ms" }}>
      <ul>
        {peek.list.map(e => {
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
