import React from "react";
import { STAT, UI } from "../../copy/ui.js";

const Stat = ({ id, value }) => (
  <div className="stat" data-stat={id} role="meter" aria-label={STAT[id]} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value)}>
    <span className="name">{STAT[id]}</span><span className="val num">{Math.round(value)}</span>
    <div className="meter"><i style={{ width: Math.max(0, Math.min(100, value)) + "%" }} /></div>
  </div>
);

// Where you stand with other people, and what you are getting better at.
export const Stats = ({ s }) => (
  <div className="stats">
    <div className="statrow" role="group" aria-label={UI.standing}><span className="group" aria-hidden="true">{UI.standing}</span>
      <Stat id="manager" value={s.manager} /><Stat id="reputation" value={s.reputation} /><Stat id="product" value={s.product} /><div />
    </div>
    <div className="statrow" role="group" aria-label={UI.skills}><span className="group" aria-hidden="true">{UI.skills}</span>
      <Stat id="prospect" value={s.skills.prospect} /><Stat id="discovery" value={s.skills.discovery} /><Stat id="demo" value={s.skills.demo} /><Stat id="negotiate" value={s.skills.negotiate} />
    </div>
  </div>
);
