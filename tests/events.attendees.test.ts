import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sequelize } from "../src/lib/db";
import { Event, Signup, User } from "../src/server/models";
import { listEventAttendees } from "../src/server/services/eventService";

/**
 * Organizer attendee roster (O2). Runs against the real DB; rows are
 * timestamp-namespaced and cleaned up (destroying the events cascades their
 * signups via the FK). Signups are created with explicit created_at values —
 * deliberately out of insertion order — so the ordering assertion is
 * deterministic and actually proves the ORDER BY.
 */
describe("listEventAttendees (O2)", () => {
  const stamp = Date.now();
  const eventIds: number[] = [];
  const userIds: number[] = [];

  let organizerA: User;
  let organizerB: User;
  let playerOne: User;
  let playerTwo: User;
  let rosterEvent: Event;
  let emptyEvent: Event;
  let orphanEvent: Event;

  const makeUser = async (name: string, slug: string, role: "player" | "organizer") => {
    const user = await User.create({
      name: `__test__ ${name} ${stamp}`,
      email: `${slug}-${stamp}@test.gamenight`,
      passwordHash: "not-a-real-hash",
      role,
    });
    userIds.push(user.id);
    return user;
  };

  const makeEvent = async (title: string, organizerId: number | undefined) => {
    const event = await Event.create({
      title: `__test__ ${title} ${stamp}`,
      gameType: `__att__${stamp}`,
      startsAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
      location: "x",
      capacity: 10,
      seatsTaken: 0,
      organizerId,
    });
    eventIds.push(event.id);
    return event;
  };

  beforeAll(async () => {
    await sequelize.authenticate();

    organizerA = await makeUser("Organizer A", "att-org-a", "organizer");
    organizerB = await makeUser("Organizer B", "att-org-b", "organizer");
    playerOne = await makeUser("Player One", "att-p1", "player");
    playerTwo = await makeUser("Player Two", "att-p2", "player");

    rosterEvent = await makeEvent("roster", organizerA.id);
    emptyEvent = await makeEvent("empty", organizerA.id);
    orphanEvent = await makeEvent("orphan", undefined); // organizer_id NULL

    // playerOne inserted first but joined LATER — signup order ≠ insertion order.
    await Signup.create({
      eventId: rosterEvent.id,
      userId: playerOne.id,
      createdAt: new Date("2026-01-02T10:00:00Z"),
    });
    await Signup.create({
      eventId: rosterEvent.id,
      userId: playerTwo.id,
      createdAt: new Date("2026-01-01T10:00:00Z"),
    });
    await rosterEvent.update({ seatsTaken: 2 });
  });

  afterAll(async () => {
    if (eventIds.length) await Event.destroy({ where: { id: eventIds } });
    if (userIds.length) await User.destroy({ where: { id: userIds } });
    await sequelize.close();
  });

  it("returns the roster in signup order with real names", async () => {
    const attendees = await listEventAttendees(rosterEvent.id, organizerA.id);
    expect(attendees).toHaveLength(2);
    // playerTwo joined first, so they lead despite being inserted second.
    expect(attendees[0].userId).toBe(playerTwo.id);
    expect(attendees[0].name).toBe(playerTwo.name);
    expect(attendees[1].userId).toBe(playerOne.id);
    expect(attendees[1].name).toBe(playerOne.name);
    expect(new Date(attendees[0].joinedAt).getTime()).toBeLessThan(
      new Date(attendees[1].joinedAt).getTime(),
    );
  });

  it("exposes exactly {userId, name, joinedAt} — never emails", async () => {
    const attendees = await listEventAttendees(rosterEvent.id, organizerA.id);
    for (const attendee of attendees) {
      expect(Object.keys(attendee).sort()).toEqual(["joinedAt", "name", "userId"]);
    }
  });

  it("rejects an organizer who doesn't own the event with 403", async () => {
    await expect(listEventAttendees(rosterEvent.id, organizerB.id)).rejects.toMatchObject({
      status: 403,
      code: "FORBIDDEN",
    });
  });

  it("404s an event that doesn't exist", async () => {
    await expect(listEventAttendees(2147483647, organizerA.id)).rejects.toMatchObject({
      status: 404,
      code: "EVENT_NOT_FOUND",
    });
  });

  it("returns an empty roster for an event with no signups", async () => {
    await expect(listEventAttendees(emptyEvent.id, organizerA.id)).resolves.toEqual([]);
  });

  it("locks everyone out of an orphaned event (organizer_id NULL)", async () => {
    await expect(listEventAttendees(orphanEvent.id, organizerA.id)).rejects.toMatchObject({
      status: 403,
      code: "FORBIDDEN",
    });
  });
});
