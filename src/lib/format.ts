const DATE_OPTS: Intl.DateTimeFormatOptions = {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
};

/**
 * Format an ISO timestamp for display. Pass `timeZone: "UTC"` for a
 * deterministic value that matches between the server render and the first
 * client render (avoiding hydration mismatches); omit it to use the viewer's
 * local zone once mounted. See EventTime.
 */
export function formatEventTime(iso: string, timeZone?: string): string {
  const opts = timeZone ? { ...DATE_OPTS, timeZone } : DATE_OPTS;
  return new Intl.DateTimeFormat("en-US", opts).format(new Date(iso));
}

/** Entry fee in cents → "Free" or "$5.00". */
export function formatFee(cents: number): string {
  if (!cents || cents <= 0) return "Free";
  return `$${(cents / 100).toFixed(2)}`;
}

/** Duration in minutes → "45 min" / "2 hr" / "2 hr 30 min" (null if unset). */
export function formatDuration(minutes: number | null | undefined): string | null {
  if (!minutes || minutes <= 0) return null;
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
}
