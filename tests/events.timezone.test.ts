import { afterAll, describe, expect, it } from "vitest";
import { sequelize } from "../src/lib/db";
import { Event } from "../src/server/models";
import { listEvents } from "../src/server/services/eventService";

/**
 * "Date has not already passed" is a day boundary in the viewer's zone, so an
 * event earlier *today* still shows while yesterday's is gone. Runs against the
 * real DB; rows are namespaced and cleaned up.
 */
describe("listEvents timezone day-boundary filtering", () => {
  const stamp = Date.now();
  const ids: number[] = [];

  afterAll(async () => {
    if (ids.length) await Event.destroy({ where: { id: ids } });
    await sequelize.close();
  });

  it("keeps earlier-today events (UTC) but drops yesterday's", async () => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 3600 * 1000);
    // Today at 00:30 UTC — its time may be in the past, but its date is today.
    const earlyToday = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 30, 0),
    );

    const past = await Event.create({
      title: `__tz__ yesterday ${stamp}`,
      gameType: "Test",
      startsAt: yesterday,
      location: "x",
      capacity: 10,
      seatsTaken: 0,
    });
    const early = await Event.create({
      title: `__tz__ earlytoday ${stamp}`,
      gameType: "Test",
      startsAt: earlyToday,
      location: "x",
      capacity: 10,
      seatsTaken: 0,
    });
    ids.push(past.id, early.id);

    const { events } = await listEvents({}, undefined, "UTC", { limit: 50 });
    const titles = new Set(events.map((e) => e.title));

    expect(titles.has(`__tz__ yesterday ${stamp}`)).toBe(false);
    expect(titles.has(`__tz__ earlytoday ${stamp}`)).toBe(true);
  });
});
