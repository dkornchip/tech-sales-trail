// A preview page for the new main screen: renders the board from a canned state so it can be looked at and
// screenshotted before it is wired into the game. Pick a state with the URL hash: #fresh, #mid, #worst, #over.
import React from "react";
import ReactDOM from "react-dom/client";
import { hailMary } from "../../src/game/actions.js";
import { endWeek } from "../../src/game/week.js";
import { checkBurnout } from "../../src/game/stress.js";
import { newGame } from "../../src/game/state.js";
import { Board } from "../../src/ui/app/Board.jsx";
import { TopBar } from "../../src/ui/app/TopBar.jsx";

const deal = (id, account, stage, mood, value, age) => ({ id: "d" + id, account, stage, mood, value, age, probNote: "" });
const line = (id, wk, tag, msg, kind, dl) => ({ id: "l" + id, t: "", wk, tag, msg, kind: kind || "info", dl });
const mid = () => ({
  ...newGame(), week: 6, energy: 58, stress: 46, cash: 2840, closedQuarter: 61400, closedWon: 61400, manager: 44.2, reputation: 47, product: 54, slots: 2,
  skills: { prospect: 52, discovery: 44, demo: 41, negotiate: 33 }, modifiers: { conversion: 0.06, discount: 0, expiresIn: 1 }, restedThisWeek: true, trip: "Japan",
  deals: [deal(1, "Quasar Laundry", 0, "neutral", 22700, 0), deal(2, "Pinecone Pizza", 4, "happy", 34200, 3), deal(3, "Spicy API", 1, "neutral", 12300, 1), deal(4, "Feral Unicorn", 3, "curious", 28600, 2),
    deal(5, "Velvet Glacier", 2, "skeptical", 19800, 4), deal(6, "Neon Narwhal", 3, "neutral", 21900, 2), deal(7, "Static Llama", 1, "curious", 9400, 1), deal(8, "Cronut Cloud", 2, "curious", 17400, 2), deal(9, "Midnight Otter", 0, "skeptical", 8100, 0)],
  pipeline: 174400,
  logs: [
    line(1, 6, "ck.strike", "Strike 1 of 3, filed by Procurement. Your agent tried to buy itself a seat.", "bad"),
    line(2, 6, "ck.run", "clAInk ran. 4 outcomes delivered, 4.4M tokens used, $0 closed."),
    line(3, 6, "close.won", "Close push: Cobalt Circus signed for $18,200.", "info", "+$2,184"),
    line(4, 6, "act.propose", "2 proposals sent.", "info", "−25 energy"),
    line(5, 6, "act.demo", "Demo marathon. 2 of 3 buyers stayed awake.", "info", "−28 energy"),
    line(6, 5, "ck.invoice", "clAInk invoice. Outcomes are billed whether or not they occurred.", "warn", "−$1,089"),
    line(7, 5, "pay.salary", "Payroll ran.", "info", "+$1,000"),
    line(8, 5, "evt.marketing", "Marketing delivered 4 leads it describes as warm."),
    line(9, 5, "week.fullfunnel", "A full-funnel week. Somebody upstairs noticed.", "info", "+6% close odds"),
    line(10, 5, "act.discovery", "Discovery. 3 leads admitted to having a budget.", "info", "−22 energy"),
    line(11, 5, "deal.ghost", "Orbit Orchard has stopped replying.", "warn"),
    { id: "old1", t: "09:01 AM", msg: "📞 Blitz: +3 lead(s). -30 energy.", kind: "info" },
  ],
});
const NAMES = ["Acme Quantum", "NebulaSoft", "DataRamen", "ByteBazaar", "Nimbus Forge", "YakStack", "HyperLobster", "Mojo Metrics", "Slothly AI", "Cobalt Circus", "Orbit Orchard", "Cosmic Bagel", "Tesseract Tea", "GigaGarden", "Caffeine Cathedral"];
const worst = () => {
  const s = mid();
  s.deals = s.deals.concat(NAMES.map((a, i) => deal(20 + i, a, i % 5, ["skeptical", "neutral", "curious", "happy"][i % 4], 5000 + i * 4321, i % 7)));
  s.pipeline = s.deals.reduce((t, d) => t + d.value, 0);
  s.week = 12; s.cash = -1180; s.stress = 84; s.energy = 12; s.slots = 1; s.coffeesThisWeek = 3; s.pip = true; s.pipLevel = 2; s.closedQuarter = 148500;
  s.modifiers = { conversion: -0.12, discount: 0.2, expiresIn: 2 };
  return s;
};
const STATES = { fresh: newGame, mid, worst, over: () => ({ ...mid(), fired: true, endCause: "review" }) };

function Preview() {
  const [s, setS] = React.useState(() => (STATES[location.hash.slice(1)] || mid)());
  const [sound, setSound] = React.useState(true);
  return (
    <Board s={s}
      top={<TopBar soundOn={sound} onSound={() => setSound(v => !v)} onRules={() => {}} onSettings={() => {}} />}
      dock={null}
      onAct={a => { const ns = a.run(s); if (ns) setS(checkBurnout(ns)); }}
      onHail={() => { const ns = hailMary(s); if (ns) setS(ns); }}
      onEndWeek={() => { const r = endWeek(s, () => {}); if (r) setS(r.state); }} />
  );
}
ReactDOM.createRoot(document.getElementById("root")).render(<Preview />);
