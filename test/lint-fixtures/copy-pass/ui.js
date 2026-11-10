// Fixture for scripts/lint-copy.mjs: labels and titles that follow the house style. Must produce no violation.
export const actions = {
  prospect: { title: "Prospect blitz", desc: "Find new leads." },
  close: { title: "Close deals", desc: "Push late-stage deals over the line." },
  coffee: { title: "Quad shot", desc: "Borrow from tomorrow." }
};
export const buttons = { endWeek: "End week", hailMary: "Hail Mary", rules: "Rules", newRun: "New run", save: "Save", load: "Load" };
export const titles = { rules: "How it works", club: "President’s Club", fired: "Position eliminated" };
export const stats = ["Energy", "Stress", "Cash", "Pipeline", "Closed this quarter", "Manager"];
// labels with numbers in them: "Week 7" is a label, so the capital is where sentence case puts it
export const week = ({ week, of }) => `Week ${week} of ${of}`;
export const slots = ({ n }) => (n === 1 ? "1 slot left" : `${n.toLocaleString("en-US")} slots left`);
export const pip = ({ level }) => `PIP level ${level}`;
export const rules = [
  "Energy fuels actions. A little comes back each Friday.",
  "The QBR is in week 13. Under 70% of quota, HR joins the call.",
  "Shitcorp, Inc. is an equal opportunity employer.",
  "Your manager calls it “macro.” You live.",
  "Rent is $1,600 in weeks 1, 5 and 9. At −$1,500 the jacket goes back."
];
