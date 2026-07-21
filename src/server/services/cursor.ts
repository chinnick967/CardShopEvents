// Opaque keyset-pagination cursor for the event list.
//
// The list is ordered by (starts_at ASC, id ASC), so a cursor must carry both
// the timestamp and the id tiebreaker. We encode them as a single base64url
// token so the client treats it as opaque and can't hand-craft an offset.

export interface EventCursor {
  startsAt: Date;
  id: number;
}

/**
 * Encode the last row of a page into an opaque `nextCursor` token.
 *
 * Precision contract: the token carries millisecond precision (JS Date). Every
 * writer stores `starts_at` from a JS Date, so stored values never have sub-ms
 * digits and the keyset comparison is exact. A row written with SQL-side
 * `now()` (µs) would compare strictly greater than its own cursor and repeat
 * at a page boundary — the client's dedupe-by-id would absorb it.
 */
export function encodeCursor(startsAt: Date, id: number): string {
  return Buffer.from(`${startsAt.toISOString()}|${id}`, "utf8").toString("base64url");
}

/** Decode a client-supplied cursor. Returns null on anything malformed. */
export function decodeCursor(token: string | null | undefined): EventCursor | null {
  if (!token) return null;
  try {
    const raw = Buffer.from(token, "base64url").toString("utf8");
    const sep = raw.indexOf("|");
    if (sep === -1) return null;

    const iso = raw.slice(0, sep);
    const id = Number(raw.slice(sep + 1));
    const startsAt = new Date(iso);

    if (Number.isNaN(startsAt.getTime()) || !Number.isInteger(id) || id <= 0) {
      return null;
    }
    // JS Dates reach ±275760 CE but Postgres timestamps don't — a crafted
    // year-0 cursor would surface as a DB error (500) instead of "no rows".
    const year = startsAt.getUTCFullYear();
    if (year < 1 || year > 9999) return null;
    return { startsAt, id };
  } catch {
    return null;
  }
}
