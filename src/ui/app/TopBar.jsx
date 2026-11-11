import React from "react";
import { UI } from "../../copy/ui.js";
import { WHO } from "../../copy/pa.js";
import { captionMs, useCaption } from "../captions.js";
import { Icon } from "./Icon.jsx";

// The office PA, as a caption: what the announcer just said, in the empty middle of the top bar, then gone.
// A line that arrives while a dialog is open is shown by that dialog instead (primitives.jsx).
const PaLine = () => {
  const c = useCaption();
  const [shown, setShown] = React.useState(null);
  React.useEffect(() => {
    if (!c || c.modal) { setShown(null); return; }
    setShown(c);
    const id = setTimeout(() => setShown(null), captionMs(c.text));
    return () => clearTimeout(id);
  }, [c]);
  return (
    <div className="pa-line" role="status" aria-live="polite">
      {shown ? <span className="pa-cap" key={shown.id}><span className="pa-who">{WHO[shown.who] || WHO.pa}</span>{shown.text}</span> : null}
    </div>
  );
};

// Product, workspace, person. The asterisk is HR's.
export const TopBar = ({ onRules, soundOn, onSound, onSettings, settingsRef, menuOpen, children }) => (
  <header className="topbar">
    <div className="brand"><span className="mark"><Icon name="compass" /></span>{UI.product}</div>
    <div className="crumbs"><span className="sep">/</span><span>{UI.company}</span><span className="sep">/</span><strong className="keep">{UI.rep}</strong><span className="keep">{UI.title}</span></div>
    <PaLine />
    <button type="button" className="linkbtn" data-ui="rules" onClick={onRules}>{UI.rules}</button>
    <button type="button" className="iconbtn" data-ui="sound" aria-pressed={soundOn ? "true" : "false"} aria-label="Sound" title="Sound (M)" onClick={onSound}>{soundOn ? <Icon name="volume-2" /> : <Icon name="volume-x" />}</button>
    <button type="button" className="iconbtn" data-ui="settings" aria-label={UI.settings} aria-haspopup="dialog" aria-expanded={menuOpen ? "true" : "false"} ref={settingsRef} onClick={onSettings}><Icon name="settings" /></button>
    {children}
  </header>
);
