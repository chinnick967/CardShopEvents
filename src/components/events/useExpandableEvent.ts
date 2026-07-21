"use client";

import { useCallback, useState } from "react";
import { apiFetch } from "@/lib/apiClient";
import type { EventDetailDTO } from "@/lib/types";

export type DetailStatus = "idle" | "loading" | "error";

/**
 * Expand/collapse state for an event row + its detail. The detail is fetched
 * lazily on the first expand (imperatively, from the toggle click handler — not
 * an effect) and cached on the component instance, so re-expanding is instant.
 */
export function useExpandableEvent(eventId: number) {
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState<EventDetailDTO | null>(null);
  const [status, setStatus] = useState<DetailStatus>("idle");

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const { event } = await apiFetch<{ event: EventDetailDTO }>(`/api/events/${eventId}`);
      setDetail(event);
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }, [eventId]);

  const toggle = useCallback(() => {
    if (!expanded && !detail && status !== "loading") void load();
    setExpanded((prev) => !prev);
  }, [expanded, detail, status, load]);

  return { expanded, toggle, detail, status, reload: load };
}
