// The onboarding memo at the top of the rules dialog (src/ui/WelcomeMemo.jsx lays it out and plays the gag).
// It is an HR document, so it is warm, legally reviewed and never specific. It gets the script's one exclamation mark.
// The spaces at the ends of `greeting` and `role.before` are part of the text: something follows on the same line.
export const MEMO = {
  // the letterhead: left and right
  head: ["Shitcorp · People & Culture", "Internal · Do not forward"],
  // the headline; a confetti cannon fizzles after it
  greeting: "Welcome to Shitcorp, Matt! ",
  paragraphs: [
    "Shitcorp is the next disruptor in SaaS. Our owners expect us to pass Scheisskorp in market capitalization by the end of the decade, and have said so in writing.",
    "Here, culture is our glue. Your compensation plan is competitive, uncapped in principle, and explained in a separate document that is being finalized."
  ],
  // the job title paragraph: `title` is what the memo promises, `stamp` is what HR stamps over it
  role: {
    before: "Because you will be closing deals, your title is ",
    title: "Associate Account Executive",
    stamp: "SDR*",
    after: ". We think that is a strong title for someone at this stage."
  },
  footnote: "*For administrative purposes, HR has classified this role as SDR."
};

// For the copy lint: the footnote starts with HR's asterisk.
export const lint = { exempt: { "sentence-case": ["MEMO.footnote"] } };
