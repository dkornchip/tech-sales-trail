// The onboarding memo at the top of the handbook (src/ui/WelcomeMemo.jsx lays it out and plays the gag).
// It is an HR document: warm, legally reviewed and entirely sincere. The company does not know it is funny.
// The spaces at the ends of `greeting` and `role.before` are part of the text: something follows on the same line.
export const MEMO = {
  // the letterhead: left and right
  head: ["Shitcorp · People & Culture", "INTERNAL MEMORANDUM · PLEASE DO NOT REPLY ALL"],
  // the headline; a confetti cannon fizzles after it
  greeting: "Welcome to Shitcorp, Matt! ",
  paragraphs: [
    "Since 1998, Shitcorp has been at the forefront of whatever our customers were buying. Our new ownership believes we can overtake Scheisskorp by the end of the decade. This is a very exciting slide.",
    "Our culture is our glue. Our compensation plan rewards people who take ownership. Please do not confuse this with actual ownership."
  ],
  // the job title paragraph: `title` is what the memo promises, `stamp` is what HR stamps over it
  role: {
    before: "As you’ll be responsible for the entire sales cycle, your internal title will be ",
    title: "Associate Account Executive",
    stamp: "SDR*",
    after: ". Congratulations on your expanded responsibilities!"
  },
  footnote: "*For payroll, headcount and organizational simplicity, HR has classified this position as SDR. Responsibilities are unaffected."
};

// For the copy lint: the footnote starts with HR's asterisk; the letterhead's right half is printed in capitals.
export const lint = { exempt: { "sentence-case": ["MEMO.footnote", "MEMO.head"] } };
