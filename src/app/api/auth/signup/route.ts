import { parseJson, jsonOk, jsonError } from "@/server/http";
import { signupSchema } from "@/server/validation/schemas";
import { signup } from "@/server/services/authService";
import { setSessionCookie } from "@/server/auth/session";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const input = await parseJson(req, signupSchema);
    const user = await signup(input);
    await setSessionCookie(user);
    return jsonOk({ user }, 201);
  } catch (err) {
    return jsonError(err);
  }
}
