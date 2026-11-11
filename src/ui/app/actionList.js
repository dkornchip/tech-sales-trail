// The twelve actions as the interface lays them out: finding deals, moving them, closing, and looking after yourself.
// What each one costs comes from the rules (src/game/rules.js), so a button can never quote a different price.
import { actCadence, actClose, actCoffee, actConference, actCrm, actDemo, actDiscovery, actNetwork, actPolitics, actPropose, actProspect, actRecharge } from "../../game/actions.js";
import { COST } from "../../game/rules.js";

export const ACTIONS = [
  { id: "prospect", icon: "phone", run: actProspect, ...COST.prospect },
  { id: "cadence", icon: "mail", run: actCadence, ...COST.cadence },
  { id: "network", icon: "users", run: actNetwork, ...COST.network },
  { id: "discovery", icon: "search", run: actDiscovery, ...COST.discovery },
  { id: "demo", icon: "presentation", run: actDemo, ...COST.demo },
  { id: "propose", icon: "file-text", run: actPropose, ...COST.propose },
  { id: "close", icon: "handshake", run: actClose, ...COST.close },
  { id: "conference", icon: "tickets", run: actConference, ...COST.conference },
  { id: "crm", icon: "list-checks", run: actCrm, ...COST.crm },
  { id: "recharge", icon: "battery-charging", run: actRecharge, ...COST.recharge },
  { id: "coffee", icon: "coffee", run: actCoffee, ...COST.coffee },
  { id: "politics", icon: "landmark", run: actPolitics, ...COST.politics },
];
export const HAIL = COST.hail;
