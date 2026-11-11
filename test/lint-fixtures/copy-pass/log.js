// Fixture for scripts/lint-copy.mjs: log lines (90 characters at most) built from params. Must produce no violation
// for any of the synthetic params the lint tries: 0, 1, 2 and a large count, negative money, the longest account name.
const money = n => (n < 0 ? "−$" : "$") + Math.abs(Math.round(n)).toLocaleString("en-US");
const count = (n, one, many) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;

export const blitz = ({ n }) => (n === 0 ? "Blitz complete. Nobody picked up." : `Blitz complete. ${count(n, "lead", "leads")} added.`);
export const rent = ({ cash }) => `Rent paid. Cash is now ${money(cash)}.`;
export const signed = ({ account, value }) => `${account} signed for ${money(value)}.`;
export const lost = ({ account }) => `${account} went with Scheisskorp.`;
// a list is capped in the sentence, so a long one cannot push the line past its limit
export const ghosted = ({ names }) => {
  if(names.length === 0) return "Nobody ghosted this week.";
  const shown = names.slice(0, 2).join(", ");
  return names.length > 2 ? `Ghosted: ${shown} and ${names.length - 2} more.` : `Ghosted: ${shown}.`;
};
// variants by week band and by how often the line has been seen
export const weekStart = {
  early: ["Quota assigned. Good morning.", "New week. Same quota."],
  late: ["One week left. Panic quietly."],
  nth: [["First coffee logged."], ["Second coffee logged."], ({ n }) => `Coffee ${n} logged. Facilities has been told.`]
};
// a function whose params the lint cannot guess: it is given them
export const board = ({ deals }) => `On the board: ${deals.map(d => d.account).join(", ")}.`;
// a helper, not copy: left out by name
export const formatMoney = money;

export const lint = {
  skip: ["formatMoney"],
  params: { board: [{ deals: [{ account: "Feral Unicorn" }, { account: "Pinecone Pizza" }] }, { deals: [{ account: "Velvet Switchboard" }] }] }
};
