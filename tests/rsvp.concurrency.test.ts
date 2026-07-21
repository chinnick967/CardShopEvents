import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sequelize } from "../src/lib/db";
import { User, Event, Signup } from "../src/server/models";
import { rsvp } from "../src/server/services/rsvpService";
import { HttpError } from "../src/server/errors";

/**
 * The correctness core, proven against a real Postgres (the same locking
 * semantics the app relies on). Requires DB connectivity + `npm run db:setup`
 * to have created the game_night schema. All rows created here are namespaced
 * with a timestamp and cleaned up afterward.
 */
describe("RSVP concurrency & idempotency", () => {
  const stamp = Date.now();
  const RACERS = 12;
  let eventId: number;
  const racerIds: number[] = [];

  beforeAll(async () => {
    await sequelize.authenticate();

    const event = await Event.create({
      title: `__test__ last-seat ${stamp}`,
      gameType: "Test",
      startsAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
      location: "Test Hall",
      capacity: 1,
      seatsTaken: 0,
    });
    eventId = event.id;

    for (let i = 0; i < RACERS; i++) {
      const u = await User.create({
        name: `Racer ${i}`,
        email: `racer-${stamp}-${i}@test.gamenight`,
        passwordHash: "x",
        role: "player",
      });
      racerIds.push(u.id);
    }
  });

  afterAll(async () => {
    if (eventId) await Event.destroy({ where: { id: eventId } }); // cascades signups
    if (racerIds.length) await User.destroy({ where: { id: racerIds } });
    await sequelize.close();
  });

  it("S1: never oversells the last seat when everyone races at once", async () => {
    const results = await Promise.allSettled(racerIds.map((uid) => rsvp(uid, eventId)));

    const won = results.filter((r) => r.status === "fulfilled");
    const full = results.filter(
      (r) =>
        r.status === "rejected" &&
        r.reason instanceof HttpError &&
        r.reason.code === "EVENT_FULL",
    );

    expect(won).toHaveLength(1);
    expect(full).toHaveLength(RACERS - 1);

    const event = await Event.findByPk(eventId);
    expect(event?.seatsTaken).toBe(1);
    expect(await Signup.count({ where: { eventId } })).toBe(1);
  });

  it("S2: a repeated/double-submitted RSVP by one user never double-counts", async () => {
    const event = await Event.create({
      title: `__test__ idempotent ${stamp}`,
      gameType: "Test",
      startsAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
      location: "Test Hall",
      capacity: 5,
      seatsTaken: 0,
    });
    const user = await User.create({
      name: "Repeater",
      email: `repeat-${stamp}@test.gamenight`,
      passwordHash: "x",
      role: "player",
    });

    try {
      const first = await rsvp(user.id, event.id);
      expect(first.alreadyJoined).toBe(false);

      // Concurrent retries (double-submit).
      const retries = await Promise.all([
        rsvp(user.id, event.id),
        rsvp(user.id, event.id),
        rsvp(user.id, event.id),
      ]);
      for (const r of retries) expect(r.alreadyJoined).toBe(true);

      const fresh = await Event.findByPk(event.id);
      expect(fresh?.seatsTaken).toBe(1);
      expect(await Signup.count({ where: { eventId: event.id } })).toBe(1);
    } finally {
      await Event.destroy({ where: { id: event.id } });
      await User.destroy({ where: { id: user.id } });
    }
  });
});
