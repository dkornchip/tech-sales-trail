import React from "react";
import { UI } from "../../copy/ui.js";
import { Icon } from "./Icon.jsx";

// Product, workspace, person. The asterisk is HR's.
export const TopBar = ({ onRules, soundOn, onSound, onSettings, children }) => (
  <header className="topbar">
    <div className="brand"><span className="mark"><Icon name="compass" /></span>{UI.product}</div>
    <div className="crumbs"><span className="sep">/</span><span>{UI.company}</span><span className="sep">/</span><strong className="keep">{UI.rep}</strong><span className="keep">{UI.title}</span></div>
    <span className="spacer" />
    <button type="button" className="linkbtn" data-ui="rules" onClick={onRules}>{UI.rules}</button>
    <button type="button" className="iconbtn" data-ui="sound" aria-pressed={soundOn ? "true" : "false"} aria-label="Sound" title="Sound (M)" onClick={onSound}>{soundOn ? <Icon name="volume-2" /> : <Icon name="volume-x" />}</button>
    <button type="button" className="iconbtn" data-ui="settings" aria-label={UI.settings} aria-haspopup="menu" onClick={onSettings}><Icon name="settings" /></button>
    {children}
  </header>
);
