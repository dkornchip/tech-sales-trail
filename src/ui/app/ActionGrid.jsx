import React from "react";
import { PROPOSE_CHANCE, crmPreview, proposeNothing, demoChance, fatalPress, lateDeals, nextShot, qualifyChance, rechargeRange, stageCount } from "../../game/selectors.js";
import { actBlock } from "../../game/run.js";
import { EFFECT } from "../../game/effects.js";
import { CONFERENCE_BUZZ, CONFERENCE_STRESS, REFERRAL, STRESS_COST } from "../../game/rules.js";
import { ACTION, CARD, HINT } from "../../copy/ui.js";
import { ACTIONS } from "./actionList.js";
import { noHover } from "../env.js";
import { Icon } from "./Icon.jsx";
import { ACTION_KEYS } from "./shortcuts.js";

// What an action needs, what it would touch, and what the hint bar says about it right now.
// `block` is the rules' own answer (game/run.js, actBlock), so a card is off exactly when the move would be refused.
// `count` is how many deals the action would work on. With none, the card says beside its cost what is left to
// buy: Discovery, Demo marathon and Close deals would only train their skill; Proposals trains nothing, so it says
// there are no deals, and it is off once it could not even count toward a full-funnel week.
// `fatal`: the press is certain to end the run (selectors.js, fatalPress), by stress or by cash.
export const describe = (a, s) => {
  const copy = ACTION[a.id], u = s.used || {};
  const used = a.id === "crm" ? !!u.crm : a.id === "recharge" ? !!s.restedThisWeek : false;
  const block = actBlock(s, a.id), fatal = block ? null : fatalPress(s, a.id);
  let count = null, hint = "", cost = a.id === "coffee" ? "" : copy.cost(a);
  if (a.id === "discovery") { count = stageCount(s, 0); hint = HINT.discovery(count, qualifyChance(s)); }
  else if (a.id === "demo") { count = stageCount(s, 1); hint = HINT.demo(count, demoChance(s)); }
  else if (a.id === "propose") { count = stageCount(s, 2); hint = HINT.propose(count, PROPOSE_CHANCE, count ? null : proposeNothing(s)); }
  else if (a.id === "close") { count = lateDeals(s).length; hint = HINT.close(count); }
  else if (a.id === "prospect") hint = HINT.prospect(a, STRESS_COST.prospect);
  else if (a.id === "crm") { const c = crmPreview(s); hint = HINT.crm(c.pruned, c.gain, c.nuke, c.value); }
  else if (a.id === "recharge") hint = HINT.recharge(rechargeRange(s));
  else if (a.id === "coffee") { const shot = nextShot(s); hint = HINT.coffee(shot); cost = shot.risk > 0 ? copy.risk(a, shot.risk) : copy.cost(a, shot.stress, shot.crash); }
  else if (a.id === "network") hint = HINT.network(a, REFERRAL.whale);
  else if (a.id === "conference") hint = HINT.conference(a, CONFERENCE_STRESS, CONFERENCE_BUZZ, EFFECT.conference.conv);
  else hint = HINT[a.id](a);
  if (used && copy.used) cost = copy.used;
  else if (block && block.why === "none") cost = copy.none;
  else if (count === 0) cost = `${cost} · ${a.id === "propose" ? CARD.none : CARD.skillOnly}`;
  const lethal = a.id === "coffee" && nextShot(s).lethal;      // the shot's own hint and card already say it ends the run
  if (fatal && !lethal) { hint = HINT.ends(fatal); cost = CARD.fatal; }
  return { title: copy.title, cost, count, block, fatal, hint: block ? (block.why === "once" && a.id === "recharge" ? HINT.blocked.rested() : HINT.blocked[block.why](block)) : hint,
    risky: !!fatal || (a.id === "coffee" && nextShot(s).risk > 0) };
};

export const ActionGrid = ({ s, onAct, onHint, onBlocked }) => (
  <div className="actions">
    {ACTIONS.map((a, i) => {
      const d = describe(a, s);
      const show = () => onHint({ act: a.id, key: ACTION_KEYS[i] });        // the bar reads the words from the run as it is (Foot.jsx, hintWords)
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
          {d.count ? <span className="count num" title={CARD.eligible(d.count)}><span aria-hidden="true">{d.count}</span><span className="sr-only">, {CARD.eligible(d.count)}</span></span> : null}
        </button>
      );
    })}
  </div>
);
