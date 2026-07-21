import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sequelize } from "../src/lib/db";
import { Event, User } from "../src/server/models";
import { createEvent } from "../src/server/services/eventService";

/**
 * Server-side create validation (O1/S4), including the sanitize-then-revalidate
 * ordering: sanitization can shrink a field below its schema minimum, so the
 * schema is re-run on the sanitized values and crafted input can't store data
 * that violates the advertised invariants.
 */
describe("createEvent validation hardening (S4)", () => {
  const stamp = Date.now();
  const eventIds: number[] = [];
  let organizer: User;

  const base = () => ({
    title: "Friday Night Magic",
    gameType: "Magic: The Gathering",
    startsAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
    location: "The Deckmaster - 214 Elm St",
    capacity: 16,
    description: "A welcoming weekly event for players of every stripe.",
    format: "Standard Constructed",
    prizes: "Booster packs",
    skillLevel: "All levels",
    entryFeeCents: 500,
    durationMinutes: 180,
  });

  beforeAll(async () => {
    await sequelize.authenticate();
    organizer = await User.create({
      name: `__test__ Create Org ${stamp}`,
      email: `create-org-${stamp}@test.gamenight`,
      passwordHash: "not-a-real-hash",
      role: "organizer",
    });
  });

  afterAll(async () => {
    if (eventIds.length) await Event.destroy({ where: { id: eventIds } });
    await User.destroy({ where: { id: organizer.id } });
    await sequelize.close();
  });

  it("creates a valid event owned by the organizer, starting empty", async () => {
    const dto = await createEvent(organizer.id, { ...base(), title: `__test__ ok ${stamp}` });
    eventIds.push(dto.id);
    expect(dto.title).toBe(`__test__ ok ${stamp}`);
    expect(dto.seatsTaken).toBe(0);
    expect(dto.isFull).toBe(false);
  });

  it("rejects a title made of control characters even though the raw string passed length checks", async () => {
    // JS trim() does not remove C0 controls, so "\u0001\u0001\u0001" sneaks
    // past validation of the RAW body; sanitization strips it to "" and the
    // re-validation must 400.
    await expect(
      createEvent(organizer.id, { ...base(), title: "\u0001\u0001\u0001" }),
    ).rejects.toMatchObject({ status: 400, code: "VALIDATION" });
  });

  it("rejects a past start date", async () => {
    await expect(
      createEvent(organizer.id, {
        ...base(),
        startsAt: new Date(Date.now() - 3600_000).toISOString(),
      }),
    ).rejects.toMatchObject({ status: 400, code: "VALIDATION" });
  });

  it("strips bidi-override characters from stored text", async () => {
    // U+202E (right-to-left override) renders surrounding text reversed.
    const dto = await createEvent(organizer.id, {
      ...base(),
      title: `__test__ \u202Eevil ${stamp}`,
    });
    eventIds.push(dto.id);
    expect(dto.title).toBe(`__test__ evil ${stamp}`);
  });
});
