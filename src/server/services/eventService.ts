import { Op, type WhereOptions } from "sequelize";
import { Event, Signup, User } from "../models";
import { startOfDayInTimeZone } from "../time";
import { HttpError, fieldErrorsFromZod } from "../errors";
import { sanitizeText } from "../sanitize";
import { encodeCursor, decodeCursor } from "./cursor";
import { createEventSchema, type CreateEventPayload } from "../../lib/eventSchema";
import type { AttendeeDTO, EventDTO, EventDetailDTO } from "../../lib/types";

export interface ListEventsFilters {
  /** Free-text match against title or location. */
  q?: string;
  /** Exact game-type match. */
  gameType?: string;
}

export interface PageOptions {
  /** Max rows to return in this batch. */
  limit?: number;
  /** Opaque `nextCursor` from a prior page; omit/`null` for the first page. */
  cursor?: string | null;
}

export interface EventsPage {
  events: EventDTO[];
  /** Cursor for the next batch, or `null` when the list is exhausted. */
  nextCursor: string | null;
}

/** Default rows per batch. Small so the first paint + each scroll step stays cheap. */
export const PAGE_SIZE = 12;
/** Upper bound a client can request per batch (defends the query against abuse). */
export const MAX_PAGE_SIZE = 50;

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
 * A batch of upcoming events, soonest first (P1), for keyset (cursor) pagination.
 *
 * Ordered by `(starts_at ASC, id ASC)` and paged with a keyset predicate rather
 * than OFFSET: pages stay stable when events are inserted mid-scroll (no
 * duplicated or skipped rows) and each batch is an index range-scan. Reads the
 * denormalized `seats_taken` column directly — no COUNT(*)/JOIN per row — so this
 * stays cheap on the read-heavy hot path. When a viewer is provided, one extra
 * indexed query marks which events in the batch they've already joined.
 */
export async function listEvents(
  filters: ListEventsFilters = {},
  viewerId?: number,
  timeZone?: string,
  page: PageOptions = {},
): Promise<EventsPage> {
  const limit = Math.min(Math.max(page.limit ?? PAGE_SIZE, 1), MAX_PAGE_SIZE);

  // "Not passed" = starts on or after the start of today in the viewer's zone.
  const and: WhereOptions[] = [{ startsAt: { [Op.gte]: startOfDayInTimeZone(timeZone) } }];

  if (filters.gameType) {
    and.push({ gameType: filters.gameType });
  }
  if (filters.q && filters.q.trim()) {
    const like = `%${filters.q.trim()}%`;
    and.push({ [Op.or]: [{ title: { [Op.iLike]: like } }, { location: { [Op.iLike]: like } }] });
  }

  // Keyset seek: everything strictly after the cursor's (starts_at, id).
  const cursor = decodeCursor(page.cursor);
  if (cursor) {
    and.push({
      [Op.or]: [
        { startsAt: { [Op.gt]: cursor.startsAt } },
        { startsAt: cursor.startsAt, id: { [Op.gt]: cursor.id } },
      ],
    });
  }

  // Fetch one extra row to learn whether another page exists without a 2nd query.
  const rows = await Event.findAll({
    where: { [Op.and]: and },
    order: [
      ["startsAt", "ASC"],
      ["id", "ASC"],
    ],
    limit: limit + 1,
  });

  const hasMore = rows.length > limit;
  const events = hasMore ? rows.slice(0, limit) : rows;

  let joined = new Set<number>();
  if (viewerId && events.length > 0) {
    const mine = await Signup.findAll({
      where: { userId: viewerId, eventId: events.map((e) => e.id) },
      attributes: ["eventId"],
    });
    joined = new Set(mine.map((s) => s.eventId));
  }

  const last = events[events.length - 1];
  const nextCursor = hasMore && last ? encodeCursor(last.startsAt, last.id) : null;

  return { events: events.map((e) => toEventDTO(e, joined.has(e.id))), nextCursor };
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

/** Upcoming events created by the given organizer, soonest first (O1). */
export async function listOrganizerEvents(organizerId: number, timeZone?: string): Promise<EventDTO[]> {
  const events = await Event.findAll({
    where: { organizerId, startsAt: { [Op.gte]: startOfDayInTimeZone(timeZone) } },
    order: [["startsAt", "ASC"]],
  });
  return events.map((e) => toEventDTO(e, false));
}

/**
 * The attendee roster for one event, in signup order (O2). Only the event's
 * organizer may view it. Deliberately unfiltered by date — a past event's
 * roster is still the organizer's data (the UI only reaches upcoming events
 * via listOrganizerEvents, but the API shouldn't be narrower than the need).
 */
export async function listEventAttendees(
  eventId: number,
  organizerId: number,
): Promise<AttendeeDTO[]> {
  const event = await Event.findByPk(eventId, { attributes: ["id", "organizerId"] });
  if (!event) {
    throw new HttpError(404, "EVENT_NOT_FOUND", "That event doesn't exist.");
  }
  // 403 rather than 404: event existence is already public via GET
  // /api/events/[id], so admitting "not yours" leaks nothing. The strict
  // compare also locks everyone out when organizer_id is NULL (organizer
  // account deleted) — nobody inherits an orphaned event's roster.
  if (event.organizerId !== organizerId) {
    throw new HttpError(403, "FORBIDDEN", "Only the event's organizer can view its attendees.");
  }

  // INNER JOIN (required: true): a signup without its user can't exist (FK is
  // ON DELETE CASCADE), and the join makes that invariant explicit. Names only
  // — attendee emails are never exposed. Ordered by signup time with the id
  // tiebreaker, same convention as the event list's (starts_at, id) keyset.
  const signups = await Signup.findAll({
    where: { eventId },
    include: [{ model: User, as: "user", attributes: ["id", "name"], required: true }],
    order: [
      ["createdAt", "ASC"],
      ["id", "ASC"],
    ],
  });

  return signups.map((s) => ({
    userId: s.userId,
    name: s.user!.name,
    joinedAt: s.createdAt.toISOString(),
  }));
}

/**
 * Create an event owned by `organizerId` (O1). The route already validated the
 * raw body; here the strings are sanitized and then the schema is re-run on
 * the SANITIZED values — stripping invisible characters can shrink a field
 * below its minimum (e.g. a "title" of control characters), and what's stored
 * must satisfy the same invariants the API advertises. `organizerId` comes
 * from the session — never from the request body — so ownership can't be forged.
 */
export async function createEvent(organizerId: number, input: CreateEventPayload): Promise<EventDTO> {
  const sanitized = {
    ...input,
    title: sanitizeText(input.title),
    gameType: sanitizeText(input.gameType),
    location: sanitizeText(input.location),
    description: sanitizeText(input.description, { multiline: true }),
    format: sanitizeText(input.format),
    prizes: sanitizeText(input.prizes),
    skillLevel: sanitizeText(input.skillLevel),
  };
  const parsed = createEventSchema.safeParse(sanitized);
  if (!parsed.success) {
    throw new HttpError(
      400,
      "VALIDATION",
      "Please correct the highlighted fields.",
      fieldErrorsFromZod(parsed.error),
    );
  }

  const clean = parsed.data;
  const event = await Event.create({
    title: clean.title,
    gameType: clean.gameType,
    startsAt: new Date(clean.startsAt),
    location: clean.location,
    capacity: clean.capacity,
    seatsTaken: 0,
    organizerId,
    description: clean.description,
    format: clean.format,
    prizes: clean.prizes,
    skillLevel: clean.skillLevel,
    entryFeeCents: clean.entryFeeCents,
    durationMinutes: clean.durationMinutes,
  });
  return toEventDTO(event, false);
}
