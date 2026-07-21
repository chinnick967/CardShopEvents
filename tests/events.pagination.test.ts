import { afterAll, describe, expect, it } from "vitest";
import { sequelize } from "../src/lib/db";
import { Event } from "../src/server/models";
import { listEvents } from "../src/server/services/eventService";

/**
 * Keyset (cursor) pagination over `(starts_at ASC, id ASC)`. Runs against the
 * real DB; rows are namespaced by a unique game type and cleaned up. Filtering by
 * that game type isolates this test's events from any seed / other-test rows so
 * the paging assertions are deterministic.
 */
describe("listEvents keyset pagination", () => {
  const stamp = Date.now();
  const gameType = `__pg__${stamp}`;
  const ids: number[] = [];
  const DAY = 24 * 3600 * 1000;

  afterAll(async () => {
    if (ids.length) await Event.destroy({ where: { id: ids } });
    await sequelize.close();
  });

  it("pages forward with a stable cursor, no overlap, honoring the id tiebreaker", async () => {
    const base = Date.now() + 2 * DAY; // comfortably in the future (past today's boundary)
    const at = (d: number) => new Date(base + d * DAY);
    // The 3rd and 4th events share a start time to exercise the id tiebreaker.
    const times = [at(1), at(2), at(3), at(3), at(4), at(5)];
    for (let i = 0; i < times.length; i++) {
      const e = await Event.create({
        title: `__pg__ event ${i} ${stamp}`,
        gameType,
        startsAt: times[i],
        location: "x",
        capacity: 10,
        seatsTaken: 0,
      });
      ids.push(e.id);
    }

    const seen: number[] = [];

    // Page 1
    const p1 = await listEvents({ gameType }, undefined, "UTC", { limit: 2 });
    expect(p1.events).toHaveLength(2);
    expect(p1.nextCursor).not.toBeNull();
    seen.push(...p1.events.map((e) => e.id));

    // Page 2 — the two same-time events, ordered by ascending id (tiebreaker).
    const p2 = await listEvents({ gameType }, undefined, "UTC", { limit: 2, cursor: p1.nextCursor });
    expect(p2.events).toHaveLength(2);
    expect(p2.nextCursor).not.toBeNull();
    expect(p2.events[0].id).toBeLessThan(p2.events[1].id);
    seen.push(...p2.events.map((e) => e.id));

    // Page 3 — exactly the last two; the cursor is now exhausted.
    const p3 = await listEvents({ gameType }, undefined, "UTC", { limit: 2, cursor: p2.nextCursor });
    expect(p3.events).toHaveLength(2);
    expect(p3.nextCursor).toBeNull();
    seen.push(...p3.events.map((e) => e.id));

    // Every event returned exactly once, in ascending (starts_at, id) order —
    // which, given ascending creation, equals ascending id order.
    expect(new Set(seen).size).toBe(6);
    expect(seen).toEqual([...seen].sort((a, b) => a - b));
  });
});
