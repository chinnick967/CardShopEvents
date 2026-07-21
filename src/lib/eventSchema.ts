import { z } from "zod";

// Shared, isomorphic validation for creating an event. Used by the client
// (instant field errors) AND the server route (authoritative). zod only — no
// runtime deps — so it's safe to import from client components.

export const GAME_TYPES = [
  "Magic: The Gathering",
  "Yu-Gi-Oh!",
  "Pokémon TCG",
  "Disney Lorcana",
  "Flesh and Blood",
  "Dungeons & Dragons",
  "Board Games",
  "Warhammer 40,000",
] as const;

export const SKILL_LEVELS = ["All levels", "Beginner-friendly", "Casual", "Competitive"] as const;

export const LIMITS = {
  title: { min: 3, max: 100 },
  location: { min: 3, max: 120 },
  description: { min: 10, max: 2000 },
  format: { min: 2, max: 120 },
  prizes: { min: 2, max: 200 },
  capacity: { min: 1, max: 500 },
  entryFeeCents: { min: 0, max: 1_000_000 },
  durationMinutes: { min: 15, max: 1440 },
} as const;

const inGameTypes = (v: string): boolean => (GAME_TYPES as readonly string[]).includes(v);
const inSkillLevels = (v: string): boolean => (SKILL_LEVELS as readonly string[]).includes(v);

export const createEventSchema = z.object({
  title: z
    .string()
    .trim()
    .min(LIMITS.title.min, `Title must be at least ${LIMITS.title.min} characters.`)
    .max(LIMITS.title.max, `Title must be ${LIMITS.title.max} characters or fewer.`),
  gameType: z.string().refine(inGameTypes, "Choose a game."),
  startsAt: z
    .string()
    .refine((v) => !Number.isNaN(Date.parse(v)), "Choose a valid date and time.")
    // Require an explicit UTC offset (the client always sends `Z` via
    // toISOString). Without one, `new Date()` would interpret a crafted API
    // value in the *server's* timezone — a different instant than intended.
    .refine((v) => /(?:Z|[+-]\d{2}:?\d{2})$/.test(v), "Date must include a UTC offset.")
    .refine((v) => new Date(v).getTime() > Date.now(), "The event must be in the future.")
    .refine(
      (v) => new Date(v).getTime() < Date.now() + 2 * 365 * 24 * 3600 * 1000,
      "Events can be scheduled at most 2 years in advance.",
    ),
  location: z
    .string()
    .trim()
    .min(LIMITS.location.min, `Location must be at least ${LIMITS.location.min} characters.`)
    .max(LIMITS.location.max, `Location must be ${LIMITS.location.max} characters or fewer.`),
  capacity: z.coerce
    .number()
    .int("Capacity must be a whole number.")
    .min(LIMITS.capacity.min, `Capacity must be at least ${LIMITS.capacity.min}.`)
    .max(LIMITS.capacity.max, `Capacity must be ${LIMITS.capacity.max} or fewer.`),
  description: z
    .string()
    .trim()
    .min(LIMITS.description.min, `Description must be at least ${LIMITS.description.min} characters.`)
    .max(LIMITS.description.max, `Description must be ${LIMITS.description.max} characters or fewer.`),
  format: z
    .string()
    .trim()
    .min(LIMITS.format.min, `Format must be at least ${LIMITS.format.min} characters.`)
    .max(LIMITS.format.max, `Format must be ${LIMITS.format.max} characters or fewer.`),
  prizes: z
    .string()
    .trim()
    .min(LIMITS.prizes.min, `Prizes must be at least ${LIMITS.prizes.min} characters.`)
    .max(LIMITS.prizes.max, `Prizes must be ${LIMITS.prizes.max} characters or fewer.`),
  skillLevel: z.string().refine(inSkillLevels, "Choose a skill level."),
  entryFeeCents: z.coerce
    .number()
    .int("Entry fee must be a whole number of cents.")
    .min(LIMITS.entryFeeCents.min, "Entry fee can't be negative.")
    .max(LIMITS.entryFeeCents.max, "Entry fee is too high."),
  durationMinutes: z.coerce
    .number()
    .int("Duration must be a whole number.")
    .min(LIMITS.durationMinutes.min, `Duration must be at least ${LIMITS.durationMinutes.min} minutes.`)
    .max(LIMITS.durationMinutes.max, `Duration must be ${LIMITS.durationMinutes.max} minutes or fewer.`),
});

export type CreateEventPayload = z.infer<typeof createEventSchema>;
