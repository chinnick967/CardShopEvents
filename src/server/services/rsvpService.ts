import { QueryTypes, Transaction } from "sequelize";
import { sequelize } from "../../lib/db";
import { Event } from "../models";
import { HttpError } from "../errors";
import { toEventDTO } from "./eventService";
import type { EventDTO } from "../../lib/types";

export interface RsvpResult {
  event: EventDTO;
  /** True when the player already held an active RSVP (idempotent retry). */
  alreadyJoined: boolean;
}

/**
 * RSVP a player to an event — the correctness core of the app.
 *
 * Guarantees, all enforced server-side:
 *  - S1: an event never exceeds capacity, even if two players race for the last
 *        seat. The conditional UPDATE takes a row lock on the event, serializing
 *        concurrent RSVPs; at most `capacity` increments can satisfy
 *        `seats_taken < capacity`, so exactly one wins the final seat. The
 *        `seats_taken <= capacity` CHECK constraint is the last-resort backstop.
 *  - S2: at most one active RSVP per player per event. `ON CONFLICT DO NOTHING`
 *        against the UNIQUE(event_id, user_id) constraint makes a retried or
 *        double-submitted request a no-op that never double-counts.
 */
export async function rsvp(userId: number, eventId: number): Promise<RsvpResult> {
  return sequelize.transaction(
    { isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED },
    async (t) => {
      const event = await Event.findByPk(eventId, { transaction: t });
      if (!event) {
        throw new HttpError(404, "EVENT_NOT_FOUND", "That event no longer exists.");
      }

      // 1) Idempotently claim the (event, user) pair. RETURNING is empty when the
      //    row already existed → this is a retry, so we return current state (S2).
      const inserted = await sequelize.query<{ id: number }>(
        `INSERT INTO game_night.signups (event_id, user_id, created_at)
         VALUES (:eventId, :userId, now())
         ON CONFLICT (event_id, user_id) DO NOTHING
         RETURNING id`,
        { replacements: { eventId, userId }, transaction: t, type: QueryTypes.SELECT },
      );

      if (inserted.length === 0) {
        await event.reload({ transaction: t });
        return { event: toEventDTO(event, true), alreadyJoined: true };
      }

      // 2) Atomically take a seat only if one is free. Zero rows → full: throwing
      //    rolls back the signup insert from step 1, so no seat is leaked (S1).
      const claimed = await sequelize.query<{ seats_taken: number }>(
        `UPDATE game_night.events
            SET seats_taken = seats_taken + 1, updated_at = now()
          WHERE id = :eventId AND seats_taken < capacity
          RETURNING seats_taken`,
        { replacements: { eventId }, transaction: t, type: QueryTypes.SELECT },
      );

      if (claimed.length === 0) {
        throw new HttpError(409, "EVENT_FULL", "This event is full.");
      }

      await event.reload({ transaction: t });
      return { event: toEventDTO(event, true), alreadyJoined: false };
    },
  );
}

/**
 * Cancel a player's RSVP, freeing the seat (P4). Idempotent: cancelling a
 * non-existent RSVP is a no-op. (Service built now; UI wired in a later slice.)
 */
export async function cancelRsvp(userId: number, eventId: number): Promise<EventDTO> {
  return sequelize.transaction(async (t) => {
    const event = await Event.findByPk(eventId, { transaction: t });
    if (!event) {
      throw new HttpError(404, "EVENT_NOT_FOUND", "That event no longer exists.");
    }

    const deleted = await sequelize.query<{ id: number }>(
      `DELETE FROM game_night.signups
        WHERE event_id = :eventId AND user_id = :userId
        RETURNING id`,
      { replacements: { eventId, userId }, transaction: t, type: QueryTypes.SELECT },
    );

    if (deleted.length > 0) {
      await sequelize.query(
        `UPDATE game_night.events
            SET seats_taken = GREATEST(seats_taken - 1, 0), updated_at = now()
          WHERE id = :eventId`,
        { replacements: { eventId }, transaction: t, type: QueryTypes.UPDATE },
      );
    }

    await event.reload({ transaction: t });
    return toEventDTO(event, false);
  });
}
