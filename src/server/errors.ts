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
