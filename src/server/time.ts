// Timezone-aware day math. `starts_at` is stored as an absolute instant
// (timestamptz), so "has this event's date passed?" must be decided against the
// start of *today in the viewer's timezone* — not the server's. The client
// sends its IANA zone; these helpers turn "now" into that zone's midnight.

function isValidTimeZone(timeZone: string | undefined): timeZone is string {
  if (!timeZone) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

interface WallClock {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/** The wall-clock date/time in `timeZone` at the given instant. */
function wallClock(timeZone: string, at: Date): WallClock {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);

  const map: Record<string, number> = {};
  for (const p of parts) if (p.type !== "literal") map[p.type] = Number(p.value);
  return {
    year: map.year,
    month: map.month,
    day: map.day,
    hour: map.hour,
    minute: map.minute,
    second: map.second,
  };
}

/** The zone's UTC offset (ms, east-positive) at the given instant. */
function offsetMs(timeZone: string, at: Date): number {
  const w = wallClock(timeZone, at);
  const asUTC = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  return asUTC - at.getTime();
}

/**
 * The instant of the most recent midnight in `timeZone` (defaults to UTC when
 * the zone is missing or invalid). DST-correct: the offset is sampled at the
 * candidate midnight, so it holds across daylight-saving transitions.
 */
export function startOfDayInTimeZone(timeZone?: string, now: Date = new Date()): Date {
  const zone = isValidTimeZone(timeZone) ? timeZone : "UTC";
  const today = wallClock(zone, now);
  // Treat today's Y-M-D as if it were UTC midnight, then correct by the zone's
  // offset at that candidate instant.
  const guess = Date.UTC(today.year, today.month - 1, today.day, 0, 0, 0);
  return new Date(guess - offsetMs(zone, new Date(guess)));
}
