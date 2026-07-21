"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { apiFetch, type ApiError } from "@/lib/apiClient";
import type { EventDTO } from "@/lib/types";
import MyEventsModal from "./MyEventsModal";

interface MyEventsContextValue {
  openModal: () => void;
  /** Bumped whenever a cancel happens in the modal, so the dashboard can resync. */
  revision: number;
}

const MyEventsContext = createContext<MyEventsContextValue | null>(null);

export function useMyEvents(): MyEventsContextValue {
  const ctx = useContext(MyEventsContext);
  if (!ctx) throw new Error("useMyEvents must be used within <MyEventsProvider>");
  return ctx;
}

type Status = "loading" | "idle" | "error";

export function MyEventsProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState<EventDTO[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [cancelingId, setCancelingId] = useState<number | null>(null);
  const [rowError, setRowError] = useState<{ id: number; message: string } | null>(null);
  const [revision, setRevision] = useState(0);
  const cancelInFlight = useRef(false);

  // The viewer's IANA timezone, sent so the server computes "today" in their zone.
  const tz = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return undefined;
    }
  }, []);

  // Fetching happens in response to opening the modal (a user action), not in an
  // effect — the list is always fresh without a fetch-in-effect.
  const load = useCallback(async () => {
    setStatus("loading");
    setRowError(null);
    try {
      const query = tz ? `?tz=${encodeURIComponent(tz)}` : "";
      const { events } = await apiFetch<{ events: EventDTO[] }>(`/api/me/events${query}`);
      setEvents(events);
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }, [tz]);

  const openModal = useCallback(() => {
    setOpen(true);
    void load();
  }, [load]);

  const closeModal = useCallback(() => setOpen(false), []);

  const cancel = useCallback(async (event: EventDTO) => {
    if (cancelInFlight.current) return; // ignore double-clicks
    cancelInFlight.current = true;
    setRowError(null);
    setCancelingId(event.id);
    try {
      await apiFetch<{ event: EventDTO }>(`/api/events/${event.id}/rsvp`, { method: "DELETE" });
      setEvents((prev) => prev.filter((e) => e.id !== event.id));
      setRevision((r) => r + 1); // let the dashboard resync (freed seat / no longer "Joined")
    } catch (err) {
      const apiErr = err as ApiError;
      setRowError({ id: event.id, message: apiErr.message ?? "Could not cancel. Please try again." });
    } finally {
      cancelInFlight.current = false;
      setCancelingId(null);
    }
  }, []);

  return (
    <MyEventsContext.Provider value={{ openModal, revision }}>
      {children}
      {open && (
        <MyEventsModal
          events={events}
          status={status}
          cancelingId={cancelingId}
          rowError={rowError}
          onClose={closeModal}
          onReload={load}
          onCancel={cancel}
        />
      )}
    </MyEventsContext.Provider>
  );
}
