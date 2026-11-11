// Fixture for scripts/lint-copy.mjs: announcer lines as {say, show} pairs. `say` is spoken: six words at most, and
// plain ASCII (so a straight apostrophe is right there). `show` is the caption, typeset properly, any length.
export const lines = {
  week5: [{ say: "Mid-quarter reviews are in session.", show: "Mid-quarter reviews are in session. Attendance is being taken." }],
  hydrate: [{ say: "Hydrate. That's an order.", show: "Hydrate. That’s an order." }],
  club: [{ say: "Pack for Cabo.", show: "President’s Club. Pack for Cabo." }],
  rent: [{ say: "Rent is due.", show: "Rent is due: −$1,600." }]
};
