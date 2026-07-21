import bcrypt from "bcryptjs";
import { sequelize } from "../lib/db";
import { User, Event, Signup } from "../server/models";

const DEMO_PASSWORD = "password123";
const POOL_SIZE = 60; // synthetic players used to back realistic attendee counts

interface EventSeed {
  title: string;
  gameType: string;
  date: string; // YYYY-MM-DD — all after the 2026-07-28 interview
  hour: number;
  location: string;
  capacity: number;
  fill: number; // number of signups to create (must be <= capacity)
  description: string;
  format: string;
  entryFeeCents: number; // 0 = free
  prizes: string | null;
  skillLevel: string;
  durationMinutes: number;
}

// A realistic spread: one FULL event, a few near-full, some with room, one empty.
// Every date is after the July 28 2026 interview.
const EVENT_SEEDS: EventSeed[] = [
  {
    title: "Friday Night Magic — Standard",
    gameType: "Magic: The Gathering",
    date: "2026-07-31",
    hour: 19,
    location: "The Deckmaster · 214 Elm St",
    capacity: 32,
    fill: 32,
    description:
      "The weekly staple. Standard-format constructed — bring a 60-card deck of currently-legal cards and battle four rounds of Swiss. Casual-friendly but competitive; new players are always welcome and we can lend a starter deck if you're just getting into it.",
    format: "Standard Constructed · 4 rounds Swiss",
    entryFeeCents: 500,
    prizes: "Booster packs scaled to record, plus a foil promo for every player",
    skillLevel: "All levels",
    durationMinutes: 180,
  },
  {
    title: "Commander Pod Night",
    gameType: "Magic: The Gathering",
    date: "2026-08-01",
    hour: 18,
    location: "Mana Vault Games · 88 Oak Ave",
    capacity: 16,
    fill: 15,
    description:
      "Relaxed multiplayer Commander (EDH). We seat you into pods of four by power level, so whether you're brewing your first 100-card deck or piloting a finely-tuned list you'll get a good game. Proxies welcome in casual pods.",
    format: "Commander / EDH · 4-player pods",
    entryFeeCents: 0,
    prizes: "Raffle for a Commander precon + tokens",
    skillLevel: "Casual",
    durationMinutes: 210,
  },
  {
    title: "Yu-Gi-Oh! Locals",
    gameType: "Yu-Gi-Oh!",
    date: "2026-08-02",
    hour: 17,
    location: "Duelist HQ · 5 Market Sq",
    capacity: 24,
    fill: 22,
    description:
      "Advanced-format locals tournament: Swiss rounds followed by a cut to Top 8, current banlist in effect. A great place to test your deck against the local meta before a regional.",
    format: "Advanced Constructed · Swiss + Top 8",
    entryFeeCents: 800,
    prizes: "Prize packs and store credit to top finishers",
    skillLevel: "Competitive",
    durationMinutes: 240,
  },
  {
    title: "Pokémon TCG League Cup",
    gameType: "Pokémon TCG",
    date: "2026-08-04",
    hour: 12,
    location: "Pallet Town Cards · 12 Pine Rd",
    capacity: 40,
    fill: 18,
    description:
      "A sanctioned League Cup earning Championship Points toward your Play! Pokémon standing. Standard format, best-of-one Swiss with rounds based on attendance. Bring a current-legal 60-card deck and your Player ID.",
    format: "Standard · Best-of-one Swiss",
    entryFeeCents: 1000,
    prizes: "Championship Points, prize packs, and promo cards",
    skillLevel: "All levels",
    durationMinutes: 240,
  },
  {
    title: "Board Game Meetup — Heavy Euros",
    gameType: "Board Games",
    date: "2026-08-05",
    hour: 14,
    location: "Meeple & Co · 340 Birch Blvd",
    capacity: 30,
    fill: 9,
    description:
      "An afternoon for the heavier end of the shelf — think Brass, Terraforming Mars, and Gaia Project. Come solo or with friends; we teach rules and form tables by weight and playtime. Library games available or bring your own.",
    format: "Open tables · teaching provided",
    entryFeeCents: 0,
    prizes: null,
    skillLevel: "All levels",
    durationMinutes: 240,
  },
  {
    title: "D&D Adventurers League",
    gameType: "Dungeons & Dragons",
    date: "2026-08-06",
    hour: 18,
    location: "The Rolling Dice · 77 Cedar Ln",
    capacity: 6,
    fill: 5,
    description:
      "Official Adventurers League play. Drop into the ongoing season with a pre-made or your own AL-legal character (a Tier 1, levels 1–4 table this week). Experienced DM provided — perfect if you want organized D&D without committing to a home campaign.",
    format: "D&D 5e · Adventurers League (Tier 1)",
    entryFeeCents: 0,
    prizes: null,
    skillLevel: "Beginner-friendly",
    durationMinutes: 240,
  },
  {
    title: "Draft Night — New Set Prerelease",
    gameType: "Magic: The Gathering",
    date: "2026-08-08",
    hour: 19,
    location: "The Deckmaster · 214 Elm St",
    capacity: 16,
    fill: 8,
    description:
      "Get your first crack at the new set. We open sealed packs, build a 40-card deck on the spot, and play. No prior collection needed — everything you use comes in the box, and you keep all your cards.",
    format: "Sealed Deck · 3 rounds",
    entryFeeCents: 3000,
    prizes: "Prize packs by record + a prerelease promo",
    skillLevel: "All levels",
    durationMinutes: 210,
  },
  {
    title: "Flesh and Blood Armory",
    gameType: "Flesh and Blood",
    date: "2026-08-09",
    hour: 18,
    location: "Blade & Buckler · 19 Willow Way",
    capacity: 20,
    fill: 4,
    description:
      "Weekly Armory event for Flesh and Blood. Classic Constructed — bring your hero and a legal deck. A low-key, welcoming crowd and a good on-ramp if you're still learning the game.",
    format: "Classic Constructed · Swiss",
    entryFeeCents: 500,
    prizes: "Exclusive Armory promos + XP tokens",
    skillLevel: "All levels",
    durationMinutes: 150,
  },
  {
    title: "Lorcana Set Championship",
    gameType: "Disney Lorcana",
    date: "2026-08-12",
    hour: 11,
    location: "Inkwell Gaming · 501 Maple Dr",
    capacity: 48,
    fill: 31,
    description:
      "Our biggest Lorcana event of the season. Core Constructed, Swiss into a Top cut, sleeves required. Expect a packed, competitive field and strong prize support.",
    format: "Core Constructed · Swiss + Top cut",
    entryFeeCents: 1500,
    prizes: "Championship promos, sealed product, and store credit",
    skillLevel: "Competitive",
    durationMinutes: 300,
  },
  {
    title: "Pauper Night",
    gameType: "Magic: The Gathering",
    date: "2026-08-15",
    hour: 19,
    location: "Mana Vault Games · 88 Oak Ave",
    capacity: 24,
    fill: 0,
    description:
      "Magic on a budget — Pauper is commons-only Constructed, so powerful decks stay cheap and the format is wonderfully deep. Brand-new brews and tuned lists are equally welcome; a friendly night to try something different.",
    format: "Pauper Constructed · 4 rounds Swiss",
    entryFeeCents: 200,
    prizes: "Booster packs + a foil common door prize",
    skillLevel: "All levels",
    durationMinutes: 180,
  },

  // ---- Extended catalog: a deeper board so the list pages as you scroll. -----
  // Dates run 2026-08-16 → 2026-09-27, continuing after the events above. Fill
  // levels span full / near-full / roomy / empty; every fill <= capacity <= 60.
  {
    title: "Pokémon TCG League Challenge",
    gameType: "Pokémon TCG",
    date: "2026-08-16",
    hour: 12,
    location: "Pallet Town Cards · 12 Pine Rd",
    capacity: 36,
    fill: 20,
    description:
      "A relaxed League Challenge — earn your first Championship Points of the season. Standard format, best-of-one Swiss sized to attendance. Bring a legal 60-card deck and your Player ID; loaner decks are on hand for newcomers.",
    format: "Standard · Best-of-one Swiss",
    entryFeeCents: 500,
    prizes: "Championship Points and prize packs to all finishers",
    skillLevel: "All levels",
    durationMinutes: 180,
  },
  {
    title: "Yu-Gi-Oh! Speed Duel Night",
    gameType: "Yu-Gi-Oh!",
    date: "2026-08-18",
    hour: 18,
    location: "Duelist HQ · 5 Market Sq",
    capacity: 16,
    fill: 7,
    description:
      "The fast, approachable side of Yu-Gi-Oh! — smaller decks, Skill cards, quicker games. A perfect on-ramp if the main game feels intimidating, and a fun change of pace for veterans.",
    format: "Speed Duel · Swiss",
    entryFeeCents: 300,
    prizes: "Speed Duel packs to the top tables",
    skillLevel: "Beginner-friendly",
    durationMinutes: 120,
  },
  {
    title: "Commander Night — Casual EDH",
    gameType: "Magic: The Gathering",
    date: "2026-08-19",
    hour: 18,
    location: "Mana Vault Games · 88 Oak Ave",
    capacity: 16,
    fill: 12,
    description:
      "Midweek multiplayer Commander. We seat pods of four by power level so games stay fun for brewers and grinders alike. Proxies welcome in casual pods — bring whatever you love to pilot.",
    format: "Commander / EDH · 4-player pods",
    entryFeeCents: 0,
    prizes: "Raffle for a Commander precon",
    skillLevel: "Casual",
    durationMinutes: 210,
  },
  {
    title: "Friday Night Magic — Modern",
    gameType: "Magic: The Gathering",
    date: "2026-08-21",
    hour: 19,
    location: "The Deckmaster · 214 Elm St",
    capacity: 32,
    fill: 30,
    description:
      "Modern-format FNM: powerful, high-speed Constructed spanning two decades of card pool. Four rounds of Swiss against a sharp local field. Bring your finely-tuned 60 and expect fast, decisive games.",
    format: "Modern Constructed · 4 rounds Swiss",
    entryFeeCents: 500,
    prizes: "Booster packs scaled to record + a foil promo",
    skillLevel: "Competitive",
    durationMinutes: 180,
  },
  {
    title: "Warhammer 40,000 — Combat Patrol",
    gameType: "Warhammer 40,000",
    date: "2026-08-22",
    hour: 11,
    location: "The Rolling Dice · 77 Cedar Ln",
    capacity: 12,
    fill: 8,
    description:
      "Small-format 40k using the Combat Patrol boxes — a friendly entry point with a fixed roster and quick games. Terrain and rules help provided; new generals genuinely welcome. Bring a painted (or in-progress) force.",
    format: "Combat Patrol · 3 rounds",
    entryFeeCents: 1000,
    prizes: "Best General and Best Painted trophies",
    skillLevel: "Beginner-friendly",
    durationMinutes: 240,
  },
  {
    title: "Board Game Day — Family & Gateway",
    gameType: "Board Games",
    date: "2026-08-23",
    hour: 13,
    location: "Meeple & Co · 340 Birch Blvd",
    capacity: 40,
    fill: 14,
    description:
      "An all-ages afternoon of lighter games — Ticket to Ride, Azul, Splendor and friends. Come solo or bring the family; staff teach rules and match you to a table. Our full library is open, or bring your own.",
    format: "Open tables · teaching provided",
    entryFeeCents: 0,
    prizes: null,
    skillLevel: "All levels",
    durationMinutes: 240,
  },
  {
    title: "Flesh and Blood Armory",
    gameType: "Flesh and Blood",
    date: "2026-08-25",
    hour: 18,
    location: "Blade & Buckler · 19 Willow Way",
    capacity: 20,
    fill: 6,
    description:
      "Weekly Armory night. Classic Constructed — bring your hero and a legal deck. Low-key and welcoming, with plenty of help if you're still learning your hero's lines.",
    format: "Classic Constructed · Swiss",
    entryFeeCents: 500,
    prizes: "Exclusive Armory promos + XP tokens",
    skillLevel: "All levels",
    durationMinutes: 150,
  },
  {
    title: "One Piece Card Game — Locals",
    gameType: "One Piece Card Game",
    date: "2026-08-26",
    hour: 17,
    location: "Duelist HQ · 5 Market Sq",
    capacity: 24,
    fill: 24,
    description:
      "Weekly locals for the One Piece Card Game. Standard format, Swiss rounds, current banlist. A fast-growing, friendly community — jump in with your favorite Leader and set sail.",
    format: "Standard Constructed · Swiss",
    entryFeeCents: 500,
    prizes: "Promo cards and prize packs to top finishers",
    skillLevel: "All levels",
    durationMinutes: 180,
  },
  {
    title: "Friday Night Magic — Standard",
    gameType: "Magic: The Gathering",
    date: "2026-08-28",
    hour: 19,
    location: "The Deckmaster · 214 Elm St",
    capacity: 32,
    fill: 26,
    description:
      "The weekly staple returns. Standard-format Constructed, four rounds of Swiss, casual-friendly but competitive. New players welcome — ask about a loaner deck if you're just starting out.",
    format: "Standard Constructed · 4 rounds Swiss",
    entryFeeCents: 500,
    prizes: "Booster packs scaled to record + a foil promo",
    skillLevel: "All levels",
    durationMinutes: 180,
  },
  {
    title: "Pokémon TCG Regional Prep",
    gameType: "Pokémon TCG",
    date: "2026-08-29",
    hour: 10,
    location: "Pallet Town Cards · 12 Pine Rd",
    capacity: 48,
    fill: 39,
    description:
      "Sharpen up before the upcoming Regional. A larger, more competitive Standard field with full Swiss rounds and a cut to Top 8 — the closest thing to the real thing without leaving town.",
    format: "Standard · Swiss + Top 8",
    entryFeeCents: 1500,
    prizes: "Prize packs, promos, and store credit to the Top 8",
    skillLevel: "Competitive",
    durationMinutes: 300,
  },
  {
    title: "Star Wars: Unlimited — Weekly Joust",
    gameType: "Star Wars: Unlimited",
    date: "2026-08-30",
    hour: 12,
    location: "Mana Vault Games · 88 Oak Ave",
    capacity: 20,
    fill: 9,
    description:
      "Weekly two-player Joust for Star Wars: Unlimited. Bring a legal deck and your favorite Leader-and-Base pairing. A welcoming crowd and a great place to test a new build.",
    format: "Premier Constructed · Swiss",
    entryFeeCents: 500,
    prizes: "Weekly Joust promos to the top tables",
    skillLevel: "All levels",
    durationMinutes: 180,
  },
  {
    title: "D&D Adventurers League — Tier 2",
    gameType: "Dungeons & Dragons",
    date: "2026-09-01",
    hour: 18,
    location: "The Rolling Dice · 77 Cedar Ln",
    capacity: 6,
    fill: 6,
    description:
      "Official Adventurers League continues into Tier 2 (levels 5–10). Bring an AL-legal character in range or ask about a pregen. Experienced DM provided — organized, drop-in D&D with no home-campaign commitment.",
    format: "D&D 5e · Adventurers League (Tier 2)",
    entryFeeCents: 0,
    prizes: null,
    skillLevel: "Intermediate",
    durationMinutes: 240,
  },
  {
    title: "Lorcana Locals",
    gameType: "Disney Lorcana",
    date: "2026-09-02",
    hour: 18,
    location: "Inkwell Gaming · 501 Maple Dr",
    capacity: 28,
    fill: 15,
    description:
      "Weekly Lorcana locals — Core Constructed, Swiss rounds, sleeves recommended. A friendly, fast-growing scene that's just as happy to teach a first game as to trade tech.",
    format: "Core Constructed · Swiss",
    entryFeeCents: 500,
    prizes: "Promo cards + a foil door prize",
    skillLevel: "All levels",
    durationMinutes: 180,
  },
  {
    title: "Friday Night Magic — Pioneer",
    gameType: "Magic: The Gathering",
    date: "2026-09-04",
    hour: 19,
    location: "The Deckmaster · 214 Elm St",
    capacity: 32,
    fill: 18,
    description:
      "Pioneer-format FNM — a non-rotating Constructed format with a deep, affordable card pool. Four rounds of Swiss; a great home if you want power without Modern's speed. All archetypes welcome.",
    format: "Pioneer Constructed · 4 rounds Swiss",
    entryFeeCents: 500,
    prizes: "Booster packs scaled to record + a foil promo",
    skillLevel: "All levels",
    durationMinutes: 180,
  },
  {
    title: "Commander 1v1 Duel Bracket",
    gameType: "Magic: The Gathering",
    date: "2026-09-05",
    hour: 11,
    location: "Mana Vault Games · 88 Oak Ave",
    capacity: 16,
    fill: 11,
    description:
      "A single-elimination take on Commander: 1v1 duels, 30-life, using the duel banlist. Bring a battle-ready 100-card deck and see how it holds up head-to-head. Prizes for the bracket winners.",
    format: "Commander 1v1 · Single elimination",
    entryFeeCents: 800,
    prizes: "Store credit and singles to the finalists",
    skillLevel: "Competitive",
    durationMinutes: 210,
  },
  {
    title: "Yu-Gi-Oh! Regional Qualifier Warm-Up",
    gameType: "Yu-Gi-Oh!",
    date: "2026-09-06",
    hour: 12,
    location: "Duelist HQ · 5 Market Sq",
    capacity: 32,
    fill: 28,
    description:
      "A high-turnout Advanced-format event tuned to mirror the upcoming Regional: full Swiss into a Top 8 cut, current banlist, deck lists required. Test your build against the sharpest local players.",
    format: "Advanced Constructed · Swiss + Top 8",
    entryFeeCents: 1000,
    prizes: "Prize packs, promos, and store credit to the Top 8",
    skillLevel: "Competitive",
    durationMinutes: 300,
  },
  {
    title: "Board Game Meetup — Social Deduction Night",
    gameType: "Board Games",
    date: "2026-09-08",
    hour: 18,
    location: "Meeple & Co · 340 Birch Blvd",
    capacity: 24,
    fill: 0,
    description:
      "An evening of bluffing and accusation — Blood on the Clocktower, Werewolf, Secret Hitler and the like. Big-group games run by a storyteller; no experience needed, just a willingness to lie to your friends.",
    format: "Large-group games · run by a host",
    entryFeeCents: 0,
    prizes: null,
    skillLevel: "All levels",
    durationMinutes: 180,
  },
  {
    title: "Digimon Card Game — Locals",
    gameType: "Digimon Card Game",
    date: "2026-09-09",
    hour: 18,
    location: "Duelist HQ · 5 Market Sq",
    capacity: 16,
    fill: 5,
    description:
      "Weekly Digimon locals. Bring a legal deck and digivolve your way through the Swiss rounds. A tight-knit, welcoming group that's glad to walk newcomers through their first few turns.",
    format: "Standard Constructed · Swiss",
    entryFeeCents: 300,
    prizes: "Tournament promos to the top tables",
    skillLevel: "Beginner-friendly",
    durationMinutes: 150,
  },
  {
    title: "Friday Night Magic — Draft",
    gameType: "Magic: The Gathering",
    date: "2026-09-11",
    hour: 19,
    location: "The Deckmaster · 214 Elm St",
    capacity: 16,
    fill: 14,
    description:
      "Booster draft FNM: crack three packs, draft a 40-card deck at the table, and battle three rounds. No prior collection needed — everything comes in the box and you keep all your cards.",
    format: "Booster Draft · 3 rounds",
    entryFeeCents: 1500,
    prizes: "Prize packs by record",
    skillLevel: "All levels",
    durationMinutes: 210,
  },
  {
    title: "Warhammer 40,000 — 'Ard Boyz Tournament",
    gameType: "Warhammer 40,000",
    date: "2026-09-12",
    hour: 10,
    location: "The Rolling Dice · 77 Cedar Ln",
    capacity: 16,
    fill: 12,
    description:
      "A full-day matched-play tournament at 2000 points. Three rounds, current mission pack, fully-painted armies encouraged. Bring three printed lists and your best generalship for a competitive day of 40k.",
    format: "Matched Play · 2000 pts · 3 rounds",
    entryFeeCents: 2000,
    prizes: "Overall, Best General, and Best Painted awards",
    skillLevel: "Competitive",
    durationMinutes: 480,
  },
  {
    title: "Pokémon TCG League Cup",
    gameType: "Pokémon TCG",
    date: "2026-09-13",
    hour: 12,
    location: "Pallet Town Cards · 12 Pine Rd",
    capacity: 40,
    fill: 33,
    description:
      "A sanctioned League Cup worth serious Championship Points. Standard format, best-of-one Swiss with rounds by attendance, cut to a Top 8. Bring a current-legal deck and your Player ID.",
    format: "Standard · Swiss + Top 8",
    entryFeeCents: 1000,
    prizes: "Championship Points, prize packs, and promos",
    skillLevel: "All levels",
    durationMinutes: 300,
  },
  {
    title: "Flesh and Blood Skirmish",
    gameType: "Flesh and Blood",
    date: "2026-09-15",
    hour: 18,
    location: "Blade & Buckler · 19 Willow Way",
    capacity: 24,
    fill: 10,
    description:
      "A seasonal Skirmish event — a step up from Armory with exclusive prizing. Classic Constructed, Swiss rounds; bring your best hero and deck. Competitive but still friendly.",
    format: "Classic Constructed · Swiss",
    entryFeeCents: 1000,
    prizes: "Skirmish season promos + XP tokens",
    skillLevel: "Competitive",
    durationMinutes: 210,
  },
  {
    title: "Star Wars: Unlimited — Store Showdown",
    gameType: "Star Wars: Unlimited",
    date: "2026-09-16",
    hour: 18,
    location: "Mana Vault Games · 88 Oak Ave",
    capacity: 24,
    fill: 17,
    description:
      "The monthly Store Showdown — a sanctioned event with premium prizing and a cut to the top. Premier Constructed, Swiss into a Top 8. Bring your sharpest deck and battle for the showcase promo.",
    format: "Premier Constructed · Swiss + Top 8",
    entryFeeCents: 1000,
    prizes: "Store Showdown promos, packs, and store credit",
    skillLevel: "Competitive",
    durationMinutes: 240,
  },
  {
    title: "Friday Night Magic — Commander",
    gameType: "Magic: The Gathering",
    date: "2026-09-18",
    hour: 19,
    location: "Mana Vault Games · 88 Oak Ave",
    capacity: 24,
    fill: 20,
    description:
      "FNM, multiplayer style. Relaxed Commander pods seated by power level — bring one deck or three. A social, welcoming way to close out the week; proxies fine in casual pods.",
    format: "Commander / EDH · 4-player pods",
    entryFeeCents: 0,
    prizes: "Raffle for a Commander precon + tokens",
    skillLevel: "Casual",
    durationMinutes: 210,
  },
  {
    title: "Lorcana Set Championship",
    gameType: "Disney Lorcana",
    date: "2026-09-19",
    hour: 11,
    location: "Inkwell Gaming · 501 Maple Dr",
    capacity: 48,
    fill: 41,
    description:
      "The season's marquee Lorcana event. Core Constructed, full Swiss into a Top cut, sleeves required. Expect a packed, competitive hall and the strongest prize support of the quarter.",
    format: "Core Constructed · Swiss + Top cut",
    entryFeeCents: 1500,
    prizes: "Championship promos, sealed product, and store credit",
    skillLevel: "Competitive",
    durationMinutes: 300,
  },
  {
    title: "Heavy Euro Board Game Afternoon",
    gameType: "Board Games",
    date: "2026-09-20",
    hour: 13,
    location: "Meeple & Co · 340 Birch Blvd",
    capacity: 30,
    fill: 7,
    description:
      "The heavier end of the shelf — Brass, Terraforming Mars, Gaia Project and kin. Come solo or with a group; we teach rules and form tables by weight and playtime. Library games available or bring your own.",
    format: "Open tables · teaching provided",
    entryFeeCents: 0,
    prizes: null,
    skillLevel: "All levels",
    durationMinutes: 300,
  },
  {
    title: "Yu-Gi-Oh! Locals",
    gameType: "Yu-Gi-Oh!",
    date: "2026-09-22",
    hour: 18,
    location: "Duelist HQ · 5 Market Sq",
    capacity: 24,
    fill: 19,
    description:
      "Advanced-format locals: Swiss rounds then a cut to Top 8, current banlist in effect. A great weekly gauge of the local meta before the next Regional.",
    format: "Advanced Constructed · Swiss + Top 8",
    entryFeeCents: 800,
    prizes: "Prize packs and store credit to top finishers",
    skillLevel: "Competitive",
    durationMinutes: 240,
  },
  {
    title: "D&D One-Shot Night",
    gameType: "Dungeons & Dragons",
    date: "2026-09-24",
    hour: 18,
    location: "The Rolling Dice · 77 Cedar Ln",
    capacity: 6,
    fill: 4,
    description:
      "A self-contained adventure in a single evening — level 5 pregenerated characters provided, no prep or prior session required. Perfect if you want a taste of D&D without joining an ongoing campaign.",
    format: "D&D 5e · One-shot (pregens provided)",
    entryFeeCents: 0,
    prizes: null,
    skillLevel: "Beginner-friendly",
    durationMinutes: 240,
  },
  {
    title: "Friday Night Magic — Pauper",
    gameType: "Magic: The Gathering",
    date: "2026-09-25",
    hour: 19,
    location: "The Deckmaster · 214 Elm St",
    capacity: 24,
    fill: 0,
    description:
      "Magic on a budget — Pauper is commons-only Constructed, so the decks stay cheap and the format runs deep. Fresh brews and tuned lists equally welcome; a friendly night to try something new.",
    format: "Pauper Constructed · 4 rounds Swiss",
    entryFeeCents: 200,
    prizes: "Booster packs + a foil common door prize",
    skillLevel: "All levels",
    durationMinutes: 180,
  },
  {
    title: "One Piece Card Game — Championship",
    gameType: "One Piece Card Game",
    date: "2026-09-27",
    hour: 11,
    location: "Duelist HQ · 5 Market Sq",
    capacity: 32,
    fill: 22,
    description:
      "Our biggest One Piece event yet — a store championship with a cut to the top and premium prizing. Standard Constructed, full Swiss into a Top 8. Bring your best Leader and crew.",
    format: "Standard Constructed · Swiss + Top 8",
    entryFeeCents: 1500,
    prizes: "Championship promo, sealed product, and store credit",
    skillLevel: "Competitive",
    durationMinutes: 300,
  },
];

function startsAt(date: string, hour: number): Date {
  return new Date(`${date}T${String(hour).padStart(2, "0")}:00:00`);
}

/** Populate demo data. Idempotent: only runs when the events table is empty. */
export async function seed(): Promise<void> {
  const existing = await Event.count();
  if (existing > 0) {
    console.log(`↷ seed skipped: ${existing} events already present`);
    return;
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  await sequelize.transaction(async (t) => {
    // Named demo accounts (log in with these).
    const [organizer] = await User.findOrCreate({
      where: { email: "organizer@gamenight.test" },
      defaults: { name: "Alex Rivera", email: "organizer@gamenight.test", passwordHash, role: "organizer" },
      transaction: t,
    });
    await User.findOrCreate({
      where: { email: "player@gamenight.test" },
      defaults: { name: "Sam Chen", email: "player@gamenight.test", passwordHash, role: "player" },
      transaction: t,
    });

    // Synthetic player pool so seat counts are backed by real signup rows
    // (keeps the denormalized counter consistent and makes attendee lists real).
    const poolDefs = Array.from({ length: POOL_SIZE }, (_, i) => ({
      name: `Player ${i + 1}`,
      email: `player${i + 1}@seed.gamenight.test`,
      passwordHash,
      role: "player" as const,
    }));
    await User.bulkCreate(poolDefs, { ignoreDuplicates: true, transaction: t });
    const pool = await User.findAll({
      where: { email: poolDefs.map((d) => d.email) },
      order: [["id", "ASC"]],
      transaction: t,
    });

    for (const s of EVENT_SEEDS) {
      const event = await Event.create(
        {
          title: s.title,
          gameType: s.gameType,
          startsAt: startsAt(s.date, s.hour),
          location: s.location,
          capacity: s.capacity,
          seatsTaken: s.fill,
          organizerId: organizer.id,
          description: s.description,
          format: s.format,
          entryFeeCents: s.entryFeeCents,
          prizes: s.prizes,
          skillLevel: s.skillLevel,
          durationMinutes: s.durationMinutes,
        },
        { transaction: t },
      );

      if (s.fill > 0) {
        const rows = pool.slice(0, s.fill).map((u) => ({ eventId: event.id, userId: u.id }));
        await Signup.bulkCreate(rows, { transaction: t });
      }
    }
  });

  console.log(`✓ seed: ${EVENT_SEEDS.length} events created`);
  console.log("  demo logins (password: password123):");
  console.log("    organizer@gamenight.test  (organizer)");
  console.log("    player@gamenight.test     (player)");
}
