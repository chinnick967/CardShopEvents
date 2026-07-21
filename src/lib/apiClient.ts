// Small typed fetch wrapper for client components. Unwraps the `{ data }`
// envelope on success and throws a rich Error carrying the API `{ error }`
// details (code, per-field messages, status) on failure.

export interface ApiError extends Error {
  code?: string;
  fieldErrors?: Record<string, string>;
  status?: number;
}

export async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // non-JSON response; handled below
  }

  const payload = body as { data?: T; error?: { code?: string; message?: string; fieldErrors?: Record<string, string> } } | null;

  if (!res.ok || payload?.error) {
    const err = new Error(payload?.error?.message ?? "Request failed. Please try again.") as ApiError;
    err.code = payload?.error?.code;
    err.fieldErrors = payload?.error?.fieldErrors;
    err.status = res.status;
    throw err;
  }

  return payload!.data as T;
}
