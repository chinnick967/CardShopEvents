import type { ZodError } from "zod";

/**
 * Transport-agnostic application error. Services throw these; the HTTP layer
 * (src/server/http.ts) maps them to responses. Kept free of any Next.js import
 * so the service layer can be unit-tested without the framework.
 */
export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fieldErrors?: Record<string, string>;

  constructor(
    status: number,
    code: string,
    message: string,
    fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

/** First zod issue per field, keyed by dotted path (`"_"` for issues with no path). */
export function fieldErrorsFromZod(error: ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!(key in fieldErrors)) fieldErrors[key] = issue.message;
  }
  return fieldErrors;
}
