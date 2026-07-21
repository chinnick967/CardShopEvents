import { jsonOk, jsonError } from "@/server/http";
import { HttpError } from "@/server/errors";
import { listMyEvents } from "@/server/services/eventService";
import { getSessionUser } from "@/server/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The signed-in user's upcoming RSVP'd events, soonest first (P5).
export async function GET(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      throw new HttpError(401, "UNAUTHENTICATED", "You must be signed in to view your events.");
    }
    const tz = new URL(req.url).searchParams.get("tz") ?? undefined;
    const events = await listMyEvents(user.id, tz);
    return jsonOk({ events });
  } catch (err) {
    return jsonError(err);
  }
}
