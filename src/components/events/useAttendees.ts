"use client";

import { useCallback, useState } from "react";
import { apiFetch } from "@/lib/apiClient";
import type { AttendeeDTO } from "@/lib/types";
import type { DetailStatus } from "./useExpandableEvent";

/**
 * Expand/collapse state for an organizer's event row + its attendee roster
 * (O2). Same shape as useExpandableEvent: the roster is fetched lazily on the
 * first expand (imperatively, from the toggle click handler — not an effect)
 * and cached on the component instance, so re-expanding is instant.
 */
export function useAttendees(eventId: number) {
  const [expanded, setExpanded] = useState(false);
  const [attendees, setAttendees] = useState<AttendeeDTO[] | null>(null);
  const [status, setStatus] = useState<DetailStatus>("idle");

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const res = await apiFetch<{ attendees: AttendeeDTO[] }>(`/api/events/${eventId}/attendees`);
      setAttendees(res.attendees);
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }, [eventId]);

  const toggle = useCallback(() => {
    if (!expanded && !attendees && status !== "loading") void load();
    setExpanded((prev) => !prev);
  }, [expanded, attendees, status, load]);

  return { expanded, toggle, attendees, status, reload: load };
}
