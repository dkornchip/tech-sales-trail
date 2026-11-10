import React from "react";
import { PROPOSE_CHANCE, blocked, crmPreview, demoChance, lateDeals, nextShot, qualifyChance, rechargeRange, stageCount } from "../../game/selectors.js";
import { ACTION, HINT } from "../../copy/ui.js";
import { ACTIONS } from "./actionList.js";
import { Icon } from "./Icon.jsx";

// What an action needs, what it would touch, and what the hint bar says about it right now.
export const describe = (a, s) => {
  const copy = ACTION[a.id];
  const used = a.id === "crm" ? !!(s.used && s.used.crm) : a.id === "recharge" ? !!s.restedThisWeek : false;
  const block = blocked(s, { energy: a.energy, slots: a.slots || 1, used });
  let count = null, hint = "", cost = copy.cost;
  if (a.id === "discovery") { count = stageCount(s, 0); hint = HINT.discovery(count, qualifyChance(s)); }
  else if (a.id === "demo") { count = stageCount(s, 1); hint = HINT.demo(count, demoChance(s)); }
  else if (a.id === "propose") { count = stageCount(s, 2); hint = HINT.propose(count, PROPOSE_CHANCE); }
  else if (a.id === "close") { count = lateDeals(s).length; hint = HINT.close(count); }
  else if (a.id === "crm") { const c = crmPreview(s); hint = HINT.crm(c.pruned, c.gain, c.nuke); }
  else if (a.id === "recharge") { const r = rechargeRange(s); hint = HINT.recharge(r.energy, r.relief); }
  else if (a.id === "coffee") { const shot = nextShot(s); hint = HINT.coffee(shot); cost = shot.risk > 0 ? copy.risk(shot.risk) : copy.cost(shot.stress, shot.crash); }
  else hint = HINT[a.id]();
  if (used && copy.used) cost = copy.used;
  return { title: copy.title, cost, count, block, hint: block ? HINT.blocked[block.why](block) : hint, risky: a.id === "coffee" && nextShot(s).risk > 0 };
};

export const ActionGrid = ({ s, onAct, onHint }) => (
  <div className="actions">
    {ACTIONS.map((a, i) => {
      const d = describe(a, s);
      const show = () => onHint({ title: d.title, text: d.hint, key: String((i + 1) % 10) });
      return (
        <button key={a.id} type="button" className={"action" + (d.block ? " off" : "")} data-act={a.id} aria-disabled={d.block ? "true" : undefined}
          onClick={() => { if (!d.block) onAct(a); }} onMouseEnter={show} onFocus={show} onMouseLeave={() => onHint(null)} onBlur={() => onHint(null)}>
          <Icon name={a.icon} />
          <span className="title">{d.title}</span>
          <span className="cost">{d.risky ? <span className="risk">{d.cost}</span> : d.cost}</span>
          {d.count ? <span className="count num">{d.count}</span> : null}
        </button>
      );
    })}
  </div>
);
