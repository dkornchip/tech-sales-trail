// The onboarding memo at the top of the Rules dialog (src/ui/WelcomeMemo.jsx lays it out and plays the gag).
// The spaces at the ends of `greeting` and `role.before` are part of the text: something follows on the same line.
export const MEMO = {
  // the letterhead: left and right
  head: ["Shitcorp • People & Culture", "Internal • Do not forward"],
  // the headline, and the confetti cannon that fizzles after it
  greeting: "Welcome to Shitcorp, Matt! ",
  cannon: "🎉",
  paragraphs: [
    "The next disruptor in SaaS. (Our PE owners say we’re on track to overtake Scheisskorp in market cap by the end of the decade!)",
    "Here, our culture is our glue. Your fair and killer comp plan rewards builders, not takers. You could become a gorillionaire!"
  ],
  // the job title paragraph: `title` is what the memo promises, `stamp` is what HR stamps over it
  role: {
    before: "And since you close deals, internally you’ll be known as an ",
    title: "Associate Account Executive",
    stamp: "SDR*",
    after: ". How cool is that, for a young man of your tenure!"
  },
  footnote: "*HR will classify you as an SDR… for… ahem… admin and streamlining purposes."
};
