import React from "react";

// Fades the bottom edge of a scrolling list while there is more below, so a row is never cut off mid-word.
export const useOverflowFade = deps => {
  const ref = React.useRef(null);
  React.useEffect(() => {
    const el = ref.current; if (!el) return;
    const update = () => el.classList.toggle("more", el.scrollHeight - el.scrollTop - el.clientHeight > 4);
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    if (ro) ro.observe(el);
    return () => { el.removeEventListener("scroll", update); if (ro) ro.disconnect(); };
  }, deps);
  return ref;
};
