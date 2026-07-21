import { NextResponse } from "next/server";
import type { ZodType } from "zod";
import { HttpError } from "./errors";

/** Standard success envelope: `{ data: ... }`. */
export function jsonOk(data: unknown, status = 200) {
  return NextResponse.json({ data }, { status });
}

/** Standard error envelope: `{ error: { code, message, fieldErrors? } }`. */
export function jsonError(err: unknown) {
  if (err instanceof HttpError) {
    return NextResponse.json(
      { error: { code: err.code, message: err.message, fieldErrors: err.fieldErrors } },
      { status: err.status },
    );
  }
  // Never leak internals to the client; log the real cause server-side.
  console.error("[api] unhandled error:", err);
  return NextResponse.json(
    { error: { code: "INTERNAL", message: "Something went wrong. Please try again." } },
    { status: 500 },
  );
}

/**
 * Parse + validate a JSON request body against a zod schema. Throws HttpError
 * 400 with per-field messages on failure — server-side validation on every
 * write (brief requirement S4).
 */
export async function parseJson<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new HttpError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const key = issue.path.join(".") || "_";
      if (!(key in fieldErrors)) fieldErrors[key] = issue.message; // keep the first error per field
    }
    throw new HttpError(400, "VALIDATION", "Please correct the highlighted fields.", fieldErrors);
  }
  return result.data;
}
