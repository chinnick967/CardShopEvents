import { jsonOk, jsonError } from "@/server/http";
import { listEvents } from "@/server/services/eventService";
import { getSessionUser } from "@/server/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // live seat counts must never be cached

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") ?? undefined;
    const gameType = searchParams.get("game") ?? undefined;
    const tz = searchParams.get("tz") ?? undefined;

    const user = await getSessionUser();
    const events = await listEvents({ q, gameType }, user?.id, tz);
    return jsonOk({ events });
  } catch (err) {
    return jsonError(err);
  }
}
