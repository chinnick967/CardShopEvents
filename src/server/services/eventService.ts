import { Op, type WhereOptions } from "sequelize";
import { Event, Signup } from "../models";
import { startOfDayInTimeZone } from "../time";
import { HttpError } from "../errors";
import type { EventDTO, EventDetailDTO } from "../../lib/types";

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
  timeZone?: string,
): Promise<EventDTO[]> {
  // "Not passed" = starts on or after the start of today in the viewer's zone.
  const and: WhereOptions[] = [{ startsAt: { [Op.gte]: startOfDayInTimeZone(timeZone) } }];

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

function toEventDetailDTO(event: Event, viewerJoined = false): EventDetailDTO {
  return {
    ...toEventDTO(event, viewerJoined),
    description: event.description ?? null,
    format: event.format ?? null,
    prizes: event.prizes ?? null,
    skillLevel: event.skillLevel ?? null,
    entryFeeCents: event.entryFeeCents ?? 0,
    durationMinutes: event.durationMinutes ?? null,
  };
}

/** Full detail for a single event (P2). 404s if it doesn't exist. */
export async function getEvent(id: number, viewerId?: number): Promise<EventDetailDTO> {
  const event = await Event.findByPk(id);
  if (!event) {
    throw new HttpError(404, "EVENT_NOT_FOUND", "That event doesn't exist.");
  }

  let viewerJoined = false;
  if (viewerId) {
    const signup = await Signup.findOne({
      where: { eventId: id, userId: viewerId },
      attributes: ["id"],
    });
    viewerJoined = signup !== null;
  }

  return toEventDetailDTO(event, viewerJoined);
}

/** Distinct game types among upcoming events, for the filter control. */
export async function listGameTypes(timeZone?: string): Promise<string[]> {
  const rows = await Event.findAll({
    where: { startsAt: { [Op.gte]: startOfDayInTimeZone(timeZone) } },
    attributes: ["gameType"],
    group: ["gameType"],
    order: [["gameType", "ASC"]],
  });
  return rows.map((r) => r.gameType);
}

/**
 * Upcoming events the given user holds an active RSVP for, soonest first (P5).
 * INNER JOIN on the viewer's signup — uses idx_signups_user_id + idx_events_starts_at.
 */
export async function listMyEvents(userId: number, timeZone?: string): Promise<EventDTO[]> {
  const events = await Event.findAll({
    where: { startsAt: { [Op.gte]: startOfDayInTimeZone(timeZone) } },
    include: [{ model: Signup, as: "signups", where: { userId }, required: true, attributes: [] }],
    order: [["startsAt", "ASC"]],
  });
  return events.map((e) => toEventDTO(e, true));
}
