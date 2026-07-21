import { jsonOk, jsonError } from "@/server/http";
import { HttpError } from "@/server/errors";
import { rsvp } from "@/server/services/rsvpService";
import { getSessionUser } from "@/server/auth/session";

export const runtime = "nodejs";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser();
    if (!user) {
      throw new HttpError(401, "UNAUTHENTICATED", "You must be signed in to RSVP.");
    }

    const { id } = await ctx.params;
    const eventId = Number(id);
    if (!Number.isInteger(eventId) || eventId <= 0) {
      throw new HttpError(400, "INVALID_ID", "Invalid event id.");
    }

    const result = await rsvp(user.id, eventId);
    return jsonOk(result);
  } catch (err) {
    return jsonError(err);
  }
}
