import { jsonOk, jsonError } from "@/server/http";
import { HttpError } from "@/server/errors";
import { getEvent } from "@/server/services/eventService";
import { getSessionUser } from "@/server/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Full detail for one event — fetched when a dashboard row is expanded (P2).
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const eventId = Number(id);
    if (!Number.isInteger(eventId) || eventId <= 0) {
      throw new HttpError(400, "INVALID_ID", "Invalid event id.");
    }

    const user = await getSessionUser();
    const event = await getEvent(eventId, user?.id);
    return jsonOk({ event });
  } catch (err) {
    return jsonError(err);
  }
}
