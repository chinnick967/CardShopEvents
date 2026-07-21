import { jsonOk, jsonError } from "@/server/http";
import { HttpError } from "@/server/errors";
import { rsvp, cancelRsvp } from "@/server/services/rsvpService";
import { getSessionUser } from "@/server/auth/session";

export const runtime = "nodejs";

async function requireUserAndEvent(ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) {
    throw new HttpError(401, "UNAUTHENTICATED", "You must be signed in to manage your RSVP.");
  }
  const { id } = await ctx.params;
  const eventId = Number(id);
  if (!Number.isInteger(eventId) || eventId <= 0) {
    throw new HttpError(400, "INVALID_ID", "Invalid event id.");
  }
  return { userId: user.id, eventId };
}

// RSVP to an event — concurrency-safe and idempotent (S1/S2).
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { userId, eventId } = await requireUserAndEvent(ctx);
    const result = await rsvp(userId, eventId);
    return jsonOk(result);
  } catch (err) {
    return jsonError(err);
  }
}

// Cancel your RSVP, freeing the seat (idempotent).
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { userId, eventId } = await requireUserAndEvent(ctx);
    const event = await cancelRsvp(userId, eventId);
    return jsonOk({ event });
  } catch (err) {
    return jsonError(err);
  }
}
