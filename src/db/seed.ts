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
