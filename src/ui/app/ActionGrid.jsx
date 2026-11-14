import React from "react";
import { PROPOSE_CHANCE, blocked, crmPreview, demoChance, lateDeals, nextShot, qualifyChance, rechargeRange, stageCount } from "../../game/selectors.js";
import { EFFECT } from "../../game/effects.js";
import { CONFERENCE_BUZZ, CONFERENCE_STRESS, REFERRAL } from "../../game/rules.js";
import { ACTION, HINT } from "../../copy/ui.js";
import { ACTIONS } from "./actionList.js";
import { noHover } from "../env.js";
import { Icon } from "./Icon.jsx";
import { ACTION_KEYS } from "./shortcuts.js";

// What an action needs, what it would touch, and what the hint bar says about it right now.
export const describe = (a, s) => {
  const copy = ACTION[a.id];
  const used = a.id === "crm" ? !!(s.used && s.used.crm) : a.id === "recharge" ? !!s.restedThisWeek : false;
  const block = blocked(s, { energy: a.energy, slots: a.slots || 1, used });
  let count = null, hint = "", cost = a.id === "coffee" ? "" : copy.cost(a);
  if (a.id === "discovery") { count = stageCount(s, 0); hint = HINT.discovery(count, qualifyChance(s)); }
  else if (a.id === "demo") { count = stageCount(s, 1); hint = HINT.demo(count, demoChance(s)); }
  else if (a.id === "propose") { count = stageCount(s, 2); hint = HINT.propose(count, PROPOSE_CHANCE); }
  else if (a.id === "close") { count = lateDeals(s).length; hint = HINT.close(count); }
  else if (a.id === "crm") { const c = crmPreview(s); hint = HINT.crm(c.pruned, c.gain, c.nuke); }
  else if (a.id === "recharge") hint = HINT.recharge(rechargeRange(s));
  else if (a.id === "coffee") { const shot = nextShot(s); hint = HINT.coffee(shot); cost = shot.risk > 0 ? copy.risk(a, shot.risk) : copy.cost(a, shot.stress, shot.crash); }
  else if (a.id === "network") hint = HINT.network(a, REFERRAL.whale);
  else if (a.id === "conference") hint = HINT.conference(a, CONFERENCE_STRESS, CONFERENCE_BUZZ, EFFECT.conference.conv);
  else hint = HINT[a.id](a);
  if (used && copy.used) cost = copy.used;
  return { title: copy.title, cost, count, block, hint: block ? (block.why === "once" && a.id === "recharge" ? HINT.blocked.rested() : HINT.blocked[block.why](block)) : hint, risky: a.id === "coffee" && nextShot(s).risk > 0 };
};

export const ActionGrid = ({ s, onAct, onHint, onBlocked }) => (
  <div className="actions">
    {ACTIONS.map((a, i) => {
      const d = describe(a, s);
      const show = () => onHint({ title: d.title, text: d.hint, key: ACTION_KEYS[i] });
      // With no pointer to follow (a touch screen) a hint stays until the next tap: a blocked action says why, and
      // after an action runs the bar goes back to what to do next.
      const leave = () => { if (!noHover()) onHint(null); };
      const press = () => { if (d.block) { show(); if (onBlocked && noHover()) onBlocked({ title: d.title, text: d.hint }); return; } onAct(a); if (noHover()) onHint(null); };
      const parts = String(d.cost).split(" · ");    // the dot stays with the part before it, so no line starts with one
      return (
        <button key={a.id} type="button" className={"action" + (d.block ? " off" : "")} data-act={a.id} aria-disabled={d.block ? "true" : undefined}
          onClick={press} onMouseEnter={show} onFocus={show} onMouseLeave={leave} onBlur={leave}>
          <Icon name={a.icon} />
          <span className="title">{d.title}</span>
          <span className="cost">{parts.map((p, k) => <React.Fragment key={k}><span className={"seg" + (d.risky ? " risk" : "")}>{p}{k < parts.length - 1 ? "\u00A0·" : ""}</span>{k < parts.length - 1 ? " " : ""}</React.Fragment>)}</span>
          {d.count ? <span className="count num">{d.count}</span> : null}
        </button>
      );
    })}
  </div>
);
