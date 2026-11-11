import React from "react";
import { ACTIONS } from "./actionList.js";

// The number row runs along the action grid, left to right, top to bottom. E ends the week, H is the Hail Mary,
// ? opens the rules. (M mutes; the shell owns that one.)
export const ACTION_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "-", "="];

const typing = el => !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
// Nothing fires behind a dialog, behind the boot screen, or from a key that is being held down.
const blockedNow = () => !!document.querySelector("dialog[open]") || !!document.querySelector("#boot:not(.off)") || !!document.querySelector("[data-menu-open]");

export const useShortcuts = handlers => {
  const ref = React.useRef(handlers); ref.current = handlers;
  React.useEffect(() => {
    const onKey = e => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented || typing(e.target) || blockedNow()) return;
      const h = ref.current, k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const i = ACTION_KEYS.indexOf(k);
      if (i >= 0 && ACTIONS[i]) { e.preventDefault(); h.onActKey(ACTIONS[i]); }
      else if (k === "e") { e.preventDefault(); h.onEndWeek(); }
      else if (k === "h") { e.preventDefault(); h.onHail(); }
      else if (k === "?") { e.preventDefault(); h.onRules(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
};
