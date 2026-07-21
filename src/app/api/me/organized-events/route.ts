import { jsonOk, jsonError } from "@/server/http";
import { HttpError } from "@/server/errors";
import { listOrganizerEvents } from "@/server/services/eventService";
import { getSessionUser } from "@/server/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The signed-in organizer's upcoming events, soonest first (O1).
export async function GET(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      throw new HttpError(401, "UNAUTHENTICATED", "You must be signed in to view your events.");
    }
    if (user.role !== "organizer") {
      throw new HttpError(403, "FORBIDDEN", "Only organizers have organized events.");
    }

    const tz = new URL(req.url).searchParams.get("tz") ?? undefined;
    const events = await listOrganizerEvents(user.id, tz);
    return jsonOk({ events });
  } catch (err) {
    return jsonError(err);
  }
}
