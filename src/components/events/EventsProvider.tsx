"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { apiFetch, type ApiError } from "@/lib/apiClient";
import type { EventDTO } from "@/lib/types";
import type { CreateEventPayload } from "@/lib/eventSchema";
import MyEventsModal from "./MyEventsModal";
import CreateEventModal from "./CreateEventModal";

interface EventsContextValue {
  openMyEvents: () => void;
  openCreateEvent: () => void;
  /** Bumped when events change (cancel or create) so the dashboard can resync. */
  revision: number;
}

const EventsContext = createContext<EventsContextValue | null>(null);

export function useEvents(): EventsContextValue {
  const ctx = useContext(EventsContext);
  if (!ctx) throw new Error("useEvents must be used within <EventsProvider>");
  return ctx;
}

type ModalKind = "none" | "myEvents" | "create";
type Status = "loading" | "idle" | "error";

export function EventsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const isOrganizer = user?.role === "organizer";

  const [modal, setModal] = useState<ModalKind>("none");
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

  // "My Events" data: RSVP'd events for players, organized events for organizers.
  const load = useCallback(async () => {
    setStatus("loading");
    setRowError(null);
    try {
      const base = isOrganizer ? "/api/me/organized-events" : "/api/me/events";
      const query = tz ? `?tz=${encodeURIComponent(tz)}` : "";
      const { events } = await apiFetch<{ events: EventDTO[] }>(`${base}${query}`);
      setEvents(events);
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }, [isOrganizer, tz]);

  const openMyEvents = useCallback(() => {
    setModal("myEvents");
    void load();
  }, [load]);

  const openCreateEvent = useCallback(() => setModal("create"), []);
  const closeModal = useCallback(() => setModal("none"), []);

  const cancel = useCallback(async (event: EventDTO) => {
    if (cancelInFlight.current) return; // ignore double-clicks
    cancelInFlight.current = true;
    setRowError(null);
    setCancelingId(event.id);
    try {
      await apiFetch<{ event: EventDTO }>(`/api/events/${event.id}/rsvp`, { method: "DELETE" });
      setEvents((prev) => prev.filter((e) => e.id !== event.id));
      setRevision((r) => r + 1);
    } catch (err) {
      const apiErr = err as ApiError;
      setRowError({ id: event.id, message: apiErr.message ?? "Could not cancel. Please try again." });
    } finally {
      cancelInFlight.current = false;
      setCancelingId(null);
    }
  }, []);

  // Throws (with per-field errors) on validation failure so the form can show
  // them; on success bumps revision so the dashboard shows the new event.
  const createEvent = useCallback(async (payload: CreateEventPayload) => {
    await apiFetch<{ event: EventDTO }>("/api/events", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    setRevision((r) => r + 1);
  }, []);

  return (
    <EventsContext.Provider value={{ openMyEvents, openCreateEvent, revision }}>
      {children}
      {modal === "myEvents" && (
        <MyEventsModal
          variant={isOrganizer ? "organizer" : "player"}
          events={events}
          status={status}
          cancelingId={cancelingId}
          rowError={rowError}
          onClose={closeModal}
          onReload={load}
          onCancel={cancel}
        />
      )}
      {modal === "create" && <CreateEventModal onClose={closeModal} onCreate={createEvent} />}
    </EventsContext.Provider>
  );
}
