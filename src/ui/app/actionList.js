// The twelve actions as the interface lays them out: finding deals, moving them, closing, and looking after yourself.
// The costs here are what the buttons show; the rules that charge them live in src/game/actions.js.
import { actCadence, actClose, actCoffee, actConference, actCrm, actDemo, actDiscovery, actNetwork, actPolitics, actPropose, actProspect, actRecharge } from "../../game/actions.js";

export const ACTIONS = [
  { id: "prospect", icon: "phone", run: actProspect, energy: 30 },
  { id: "cadence", icon: "mail", run: actCadence, energy: 18 },
  { id: "network", icon: "users", run: actNetwork, energy: 16 },
  { id: "discovery", icon: "search", run: actDiscovery, energy: 22 },
  { id: "demo", icon: "presentation", run: actDemo, energy: 28 },
  { id: "propose", icon: "file-text", run: actPropose, energy: 25 },
  { id: "close", icon: "handshake", run: actClose, energy: 28 },
  { id: "conference", icon: "tickets", run: actConference, energy: 40, slots: 2 },
  { id: "crm", icon: "list-checks", run: actCrm, energy: 15 },
  { id: "recharge", icon: "battery-charging", run: actRecharge, energy: 0 },
  { id: "coffee", icon: "coffee", run: actCoffee, energy: 0 },
  { id: "politics", icon: "landmark", run: actPolitics, energy: 20 },
];
export const HAIL = { energy: 10 };
