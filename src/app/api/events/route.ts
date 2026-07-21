import { jsonOk, jsonError, parseJson } from "@/server/http";
import { HttpError } from "@/server/errors";
import { listEvents, createEvent, PAGE_SIZE } from "@/server/services/eventService";
import { getSessionUser } from "@/server/auth/session";
import { createEventSchema } from "@/lib/eventSchema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // live seat counts must never be cached

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") ?? undefined;
    const gameType = searchParams.get("game") ?? undefined;
    const tz = searchParams.get("tz") ?? undefined;
    const cursor = searchParams.get("cursor") ?? undefined;
    const limitParam = Number(searchParams.get("limit"));
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : PAGE_SIZE;

    const user = await getSessionUser();
    const { events, nextCursor } = await listEvents({ q, gameType }, user?.id, tz, { limit, cursor });
    return jsonOk({ events, nextCursor });
  } catch (err) {
    return jsonError(err);
  }
}

// Create an event — organizers only (O1). The organizer id comes from the
// session, never the request body, so ownership can't be forged.
export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      throw new HttpError(401, "UNAUTHENTICATED", "You must be signed in to create an event.");
    }
    if (user.role !== "organizer") {
      throw new HttpError(403, "FORBIDDEN", "Only organizers can create events.");
    }

    const input = await parseJson(req, createEventSchema);
    const event = await createEvent(user.id, input);
    return jsonOk({ event }, 201);
  } catch (err) {
    return jsonError(err);
  }
}
