import { parseJson, jsonOk, jsonError } from "@/server/http";
import { loginSchema } from "@/server/validation/schemas";
import { login } from "@/server/services/authService";
import { setSessionCookie } from "@/server/auth/session";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const input = await parseJson(req, loginSchema);
    const user = await login(input);
    await setSessionCookie(user);
    return jsonOk({ user });
  } catch (err) {
    return jsonError(err);
  }
}
