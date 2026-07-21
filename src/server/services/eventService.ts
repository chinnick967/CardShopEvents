import { Op, type WhereOptions } from "sequelize";
import { Event, Signup } from "../models";
import type { EventDTO } from "../../lib/types";

export interface ListEventsFilters {
  /** Free-text match against title or location. */
  q?: string;
  /** Exact game-type match. */
  gameType?: string;
}

const MAX_EVENTS = 200;

export function toEventDTO(event: Event, viewerJoined = false): EventDTO {
  const seatsLeft = event.capacity - event.seatsTaken;
  return {
    id: event.id,
    title: event.title,
    gameType: event.gameType,
    startsAt: event.startsAt.toISOString(),
    location: event.location,
    capacity: event.capacity,
    seatsTaken: event.seatsTaken,
    seatsLeft,
    isFull: seatsLeft <= 0,
    viewerJoined,
  };
}

/**
 * Upcoming events, soonest first (P1). Reads the denormalized `seats_taken`
 * column directly — no COUNT(*)/JOIN per row — so this stays cheap on the
 * read-heavy hot path. When a viewer is provided, one extra indexed query marks
 * which events they've already joined.
 */
export async function listEvents(
  filters: ListEventsFilters = {},
  viewerId?: number,
): Promise<EventDTO[]> {
  const and: WhereOptions[] = [{ startsAt: { [Op.gte]: new Date() } }];

  if (filters.gameType) {
    and.push({ gameType: filters.gameType });
  }
  if (filters.q && filters.q.trim()) {
    const like = `%${filters.q.trim()}%`;
    and.push({ [Op.or]: [{ title: { [Op.iLike]: like } }, { location: { [Op.iLike]: like } }] });
  }

  const events = await Event.findAll({
    where: { [Op.and]: and },
    order: [["startsAt", "ASC"]],
    limit: MAX_EVENTS,
  });

  let joined = new Set<number>();
  if (viewerId && events.length > 0) {
    const mine = await Signup.findAll({
      where: { userId: viewerId, eventId: events.map((e) => e.id) },
      attributes: ["eventId"],
    });
    joined = new Set(mine.map((s) => s.eventId));
  }

  return events.map((e) => toEventDTO(e, joined.has(e.id)));
}

/** Distinct game types among upcoming events, for the filter control. */
export async function listGameTypes(): Promise<string[]> {
  const rows = await Event.findAll({
    where: { startsAt: { [Op.gte]: new Date() } },
    attributes: ["gameType"],
    group: ["gameType"],
    order: [["gameType", "ASC"]],
  });
  return rows.map((r) => r.gameType);
}
