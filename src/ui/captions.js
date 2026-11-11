import React from "react";

// The announcer's latest line, for whoever draws it (the top bar, or the dialog that is open). One line at a time.
// The audio engine hands lines over through TST_AUDIO.onCaption; Game.jsx connects the two.
let current = null, seq = 0;
const subs = new Set();

export const pushCaption = c => {
  // `modal`: a dialog was already open when the line arrived, so the dialog shows it and the top bar stays quiet
  current = { ...c, id: ++seq, at: Date.now(), modal: !!document.querySelector("dialog[open]") };
  subs.forEach(fn => fn(current));
};
export const captionSeq = () => seq;
export const clearCaption = () => { current = null; subs.forEach(fn => fn(null)); };

export const useCaption = () => {
  const [c, setC] = React.useState(current);
  React.useEffect(() => { subs.add(setC); setC(current); return () => { subs.delete(setC); }; }, []);
  return c;
};

// How long a caption stays in the top bar: long enough to read twice, never long enough to become furniture.
export const captionMs = text => Math.max(4000, Math.min(9000, 1800 + 70 * String(text || "").length));
