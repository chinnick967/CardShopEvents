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
