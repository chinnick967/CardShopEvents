import { jsonOk, jsonError } from "@/server/http";
import { HttpError } from "@/server/errors";
import { listEventAttendees } from "@/server/services/eventService";
import { getSessionUser } from "@/server/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The attendee roster for one event — organizers only, and only for events
// they created (ownership is enforced in the service) (O2).
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const eventId = Number(id);
    if (!Number.isInteger(eventId) || eventId <= 0) {
      throw new HttpError(400, "INVALID_ID", "Invalid event id.");
    }

    const user = await getSessionUser();
    if (!user) {
      throw new HttpError(401, "UNAUTHENTICATED", "You must be signed in to view attendees.");
    }
    if (user.role !== "organizer") {
      throw new HttpError(403, "FORBIDDEN", "Only organizers can view attendee lists.");
    }

    const attendees = await listEventAttendees(eventId, user.id);
    return jsonOk({ attendees });
  } catch (err) {
    return jsonError(err);
  }
}
