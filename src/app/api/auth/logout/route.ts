import { jsonOk } from "@/server/http";
import { clearSessionCookie } from "@/server/auth/session";

export const runtime = "nodejs";

export async function POST() {
  await clearSessionCookie();
  return jsonOk({ ok: true });
}
