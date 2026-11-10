import React from "react";
import { MENU } from "../../copy/ui.js";
import { Icon } from "./Icon.jsx";

const { useEffect, useRef } = React;

const Switch = ({ id, label, on, onChange }) => (
  <button type="button" className="menu-row" role="switch" aria-checked={on ? "true" : "false"} data-ui={id} onClick={() => onChange(!on)}>
    <span>{label}</span><span className={"switch" + (on ? " on" : "")} aria-hidden="true"><i /></span>
  </button>
);

// Everything that used to be a row of header buttons: sound, the announcer, captions, volume, and the run itself.
export const SettingsMenu = ({ open, onClose, audio, captions, onCaptions, onSave, onLoad, onNewRun, anchorRef }) => {
  const box = useRef(null);
  useEffect(() => {
    if (!open) return;
    const first = box.current && box.current.querySelector("button, input"); if (first) first.focus();
    const onKey = e => { if (e.key === "Escape") { e.stopPropagation(); onClose(true); } };
    const onDown = e => { if (box.current && !box.current.contains(e.target) && !(anchorRef.current && anchorRef.current.contains(e.target))) onClose(false); };
    document.addEventListener("keydown", onKey, true); document.addEventListener("pointerdown", onDown, true);
    return () => { document.removeEventListener("keydown", onKey, true); document.removeEventListener("pointerdown", onDown, true); };
  }, [open]);
  if (!open) return null;
  const run = fn => () => { onClose(true); fn(); };
  return (
    <div className="menu" role="dialog" aria-label={MENU.title} ref={box} data-menu-open="">
      <Switch id="menu-sound" label={MENU.sound} on={audio.on} onChange={audio.setOn} />
      <Switch id="menu-voice" label={MENU.voice} on={audio.voice} onChange={audio.setVoice} />
      <Switch id="menu-captions" label={MENU.captions} on={captions} onChange={onCaptions} />
      <label className="menu-row"><span>{MENU.volume}</span>
        <input type="range" min="0" max="100" step="5" value={Math.round(audio.vol * 100)} aria-label={MENU.volume} onChange={e => audio.setVolume(Number(e.target.value) / 100)} /></label>
      <hr />
      <button type="button" className="menu-row" data-ui="save" onClick={run(onSave)}><span>{MENU.save}</span><Icon name="save" /></button>
      <button type="button" className="menu-row" data-ui="load" onClick={run(onLoad)}><span>{MENU.load}</span><Icon name="folder-open" /></button>
      <button type="button" className="menu-row" data-ui="newgame" onClick={run(onNewRun)}><span>{MENU.newRun}</span><Icon name="rotate-ccw" /></button>
    </div>
  );
};
