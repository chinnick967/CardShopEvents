import bcrypt from "bcryptjs";
import { sequelize } from "../lib/db";
import { User, Event, Signup } from "../server/models";

const DEMO_PASSWORD = "password123";
const POOL_SIZE = 60; // synthetic players used to back realistic attendee counts

interface EventSeed {
  title: string;
  gameType: string;
  daysFromNow: number;
  hour: number;
  location: string;
  capacity: number;
  fill: number; // number of signups to create (must be <= capacity)
}

// A realistic spread: one FULL event, a few near-full, some with room, one empty.
const EVENT_SEEDS: EventSeed[] = [
  { title: "Friday Night Magic — Standard", gameType: "Magic: The Gathering", daysFromNow: 2, hour: 19, location: "The Deckmaster · 214 Elm St", capacity: 32, fill: 32 },
  { title: "Commander Pod Night", gameType: "Magic: The Gathering", daysFromNow: 3, hour: 18, location: "Mana Vault Games · 88 Oak Ave", capacity: 16, fill: 15 },
  { title: "Yu-Gi-Oh! Locals", gameType: "Yu-Gi-Oh!", daysFromNow: 4, hour: 17, location: "Duelist HQ · 5 Market Sq", capacity: 24, fill: 22 },
  { title: "Pokémon TCG League Cup", gameType: "Pokémon TCG", daysFromNow: 5, hour: 12, location: "Pallet Town Cards · 12 Pine Rd", capacity: 40, fill: 18 },
  { title: "Board Game Meetup — Heavy Euros", gameType: "Board Games", daysFromNow: 6, hour: 14, location: "Meeple & Co · 340 Birch Blvd", capacity: 30, fill: 9 },
  { title: "D&D Adventurers League", gameType: "Dungeons & Dragons", daysFromNow: 7, hour: 18, location: "The Rolling Dice · 77 Cedar Ln", capacity: 6, fill: 5 },
  { title: "Draft Night — New Set Prerelease", gameType: "Magic: The Gathering", daysFromNow: 9, hour: 19, location: "The Deckmaster · 214 Elm St", capacity: 16, fill: 8 },
  { title: "Flesh and Blood Armory", gameType: "Flesh and Blood", daysFromNow: 10, hour: 18, location: "Blade & Buckler · 19 Willow Way", capacity: 20, fill: 4 },
  { title: "Lorcana Set Championship", gameType: "Disney Lorcana", daysFromNow: 12, hour: 11, location: "Inkwell Gaming · 501 Maple Dr", capacity: 48, fill: 31 },
  { title: "Pauper Night", gameType: "Magic: The Gathering", daysFromNow: 14, hour: 19, location: "Mana Vault Games · 88 Oak Ave", capacity: 24, fill: 0 },
];

function startsAt(daysFromNow: number, hour: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, 0, 0, 0);
  return d;
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
          startsAt: startsAt(s.daysFromNow, s.hour),
          location: s.location,
          capacity: s.capacity,
          seatsTaken: s.fill,
          organizerId: organizer.id,
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
