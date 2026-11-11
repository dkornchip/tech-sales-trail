// Names the game shows: accounts, trips, achievements, deal stages, buyer moods, and the notes on a deal card.
// What a save STORES for a stage (its index) or a mood (its value in MOODS) lives in src/game/constants.js;
// these are only the words a player reads.

// A save stores the account's name itself, and the name is picked by a mechanical draw: the ORDER of this list is the
// draw table. Renaming an entry is safe; reordering, adding or removing one changes which account a roll picks.
export const ACCOUNT_NAMES=[
  "Acme Quantum","NebulaSoft","Feral Unicorn","DataRamen","ByteBazaar","Nimbus Forge",
  "YakStack","HyperLobster","Pinecone Pizza","Mojo Metrics","Slothly AI","Cobalt Circus",
  "Orbit Orchard","Cosmic Bagel","Spicy API","Tesseract Tea","GigaGarden","Marmot Systems",
  "Cronut Cloud","Obsidian Harbor","Parallax Donuts","Velvet Glacier","Ghost Pepper Labs",
  "Mythic Compass","Obelisk Systems","Carbon Jellyfish","Mirrorwave Media","Static Llama",
  "Caffeine Cathedral","Infinite Wasabi","Aurora Churros","Neon Narwhal","Quasar Laundry",
  "Monolith Karaoke","Origami Fortress","Ruby Iguana","Saffron Nebula","Lottery Lagoon",
  "Circuit Sashimi","Helix Orchard","Glacier Lantern","Paper Tiger Rail","Mosaic Marmot",
  "Golem Bistro","Vespertine Motel","Polaris Tacos","Kintsugi Metrics","Chimera Hardware",
  "Murmur Harbor","Lantern Algebra","Cryptic Custard","Midnight Otter","Velvet Switchboard",
  "Oracle Dumpling","Oblique Wombat","Cerulean Vineyard","Signal Pagoda"
];

// Where a lucky Recharge sends you. Same rule as the accounts: a save stores the name, the order is the draw table.
export const TRIPS=["Japan","Whistler","Cancun","Thailand","Dubai"];

// Achievement labels, by key. A save stores the label next to the key.
export const ACHIEVEMENTS={
  whale:"🐋 Whale Hunter"
};

// Deal stages, by the index a save stores (0-4), and the name shown for an index that is not a stage.
export const STAGE_NAMES=["Lead","Qualified","Demoed","Proposal","Closing"];
export const STAGE_UNKNOWN="Unknown";

// Buyer moods, by the value a save stores (MOODS in src/game/constants.js).
export const MOOD_NAMES={
  skeptical:"skeptical",
  neutral:"neutral",
  curious:"curious",
  happy:"happy"
};

// The note in brackets on a deal card. A save stores the note's text (deal.probNote).
export const DEAL_NOTES={
  peanut:"referral peanut",
  big:"referral big",
  whale:"referral whale",
  // a close attempt that missed: the roll and the chance it needed, in percent
  roll:(roll,chance)=>`roll ${roll}% vs ${chance}%`
};
