import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import type { SessionUser, UserRole } from "../../lib/types";

const COOKIE_NAME = "gn_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

function secret(): Uint8Array {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 16) {
    throw new Error(
      "SESSION_SECRET is missing or too short (need >= 16 chars). Set a strong value in .env.",
    );
  }
  return new TextEncoder().encode(value);
}

/** Sign a stateless session JWT carrying the non-sensitive identity claims. */
export async function createSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({ name: user.name, email: user.email, role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(user.id))
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secret());
}

/** Issue the session cookie (httpOnly, so it is never readable from JS). */
export async function setSessionCookie(user: SessionUser): Promise<void> {
  const token = await createSessionToken(user);
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

/**
 * Resolve the current user from the session cookie, or null if signed out.
 * Stateless: verifies the JWT signature and reads claims — no DB round-trip,
 * which keeps it cheap to call on every render / request.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secret());
    const id = Number(payload.sub);
    if (!Number.isInteger(id)) return null;
    const role: UserRole = payload.role === "organizer" ? "organizer" : "player";
    return { id, name: String(payload.name ?? ""), email: String(payload.email ?? ""), role };
  } catch {
    // Invalid or expired token → treat as signed out.
    return null;
  }
}
