"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { EventDTO } from "@/lib/types";
import { useAuth } from "@/components/auth/AuthProvider";
import { apiFetch, type ApiError } from "@/lib/apiClient";
import EventRow from "./EventRow";
import EventCard from "./EventCard";
import styles from "./EventsDashboard.module.scss";

interface Props {
  initialEvents: EventDTO[];
  gameTypes: string[];
}

type Status = "idle" | "loading" | "error";

export default function EventsDashboard({ initialEvents, gameTypes }: Props) {
  const { user, openAuth } = useAuth();
  const [events, setEvents] = useState<EventDTO[]>(initialEvents);
  const [q, setQ] = useState("");
  const [game, setGame] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [rsvpingId, setRsvpingId] = useState<number | null>(null);
  const [rowError, setRowError] = useState<{ id: number; message: string } | null>(null);

  const reqSeq = useRef(0);
  const didMount = useRef(false);
  const lastUserId = useRef<number | null | undefined>(undefined);

  const fetchEvents = useCallback(async (qv: string, gv: string) => {
    const seq = ++reqSeq.current;
    setStatus("loading");
    try {
      const params = new URLSearchParams();
      if (qv.trim()) params.set("q", qv.trim());
      if (gv) params.set("game", gv);
      const { events } = await apiFetch<{ events: EventDTO[] }>(`/api/events?${params.toString()}`);
      // Ignore out-of-order responses (keep only the latest request's result).
      if (seq === reqSeq.current) {
        setEvents(events);
        setStatus("idle");
      }
    } catch {
      if (seq === reqSeq.current) setStatus("error");
    }
  }, []);

  // Debounced refetch when filters change. Skip the first mount — SSR data is fresh.
  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      return;
    }
    const timer = setTimeout(() => fetchEvents(q, game), 250);
    return () => clearTimeout(timer);
  }, [q, game, fetchEvents]);

  // Refetch when the signed-in user changes so `viewerJoined` reflects them.
  useEffect(() => {
    const id = user?.id ?? null;
    if (lastUserId.current === undefined) {
      lastUserId.current = id; // sync to SSR state; no fetch on mount
      return;
    }
    if (lastUserId.current === id) return;
    lastUserId.current = id;
    fetchEvents(q, game);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const onSignUp = useCallback(
    async (event: EventDTO) => {
      if (!user) {
        openAuth("You need an account to RSVP for an event. Sign in or create one — it only takes a moment.", "signup");
        return;
      }
      if (event.isFull || event.viewerJoined || rsvpingId !== null) return;

      setRowError(null);
      setRsvpingId(event.id);
      try {
        const { event: updated } = await apiFetch<{ event: EventDTO; alreadyJoined: boolean }>(
          `/api/events/${event.id}/rsvp`,
          { method: "POST" },
        );
        setEvents((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
      } catch (err) {
        const apiErr = err as ApiError;
        setRowError({ id: event.id, message: apiErr.message ?? "Could not RSVP. Please try again." });
        // Reconcile with the server (e.g. it filled up while we waited).
        fetchEvents(q, game);
      } finally {
        setRsvpingId(null);
      }
    },
    [user, openAuth, rsvpingId, q, game, fetchEvents],
  );

  const showEmpty = status !== "loading" && events.length === 0;

  return (
    <section className={styles.dashboard}>
      <header className={styles.intro}>
        <h1 className={styles.title}>
          Game <span className={styles.accent}>Night</span>
        </h1>
        <p className={styles.subtitle}>Find local tabletop events, see how full they are, and grab a seat.</p>
      </header>

      <div className={styles.toolbar}>
        <div className={styles.search}>
          <span className={styles.searchIcon} aria-hidden="true">
            ⌕
          </span>
          <input
            type="search"
            className={styles.searchInput}
            placeholder="Search by title or location…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search events"
          />
        </div>
        <label className={styles.filter}>
          <span className="sr-only">Filter by game type</span>
          <select
            value={game}
            onChange={(e) => setGame(e.target.value)}
            className={styles.select}
            aria-label="Filter by game type"
          >
            <option value="">All games</option>
            {gameTypes.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </label>
      </div>

      {status === "loading" && <div className={styles.loadingBar} role="status" aria-label="Loading events" />}

      {status === "error" ? (
        <div className={styles.stateBox} role="alert">
          <p className={styles.emptyTitle}>We couldn’t load events</p>
          <button className={styles.retry} onClick={() => fetchEvents(q, game)} type="button">
            Retry
          </button>
        </div>
      ) : showEmpty ? (
        <div className={styles.stateBox}>
          <p className={styles.emptyTitle}>No events found</p>
          <p className={styles.emptyHint}>
            {q || game
              ? "Try clearing your search or filter."
              : "Check back soon — new game nights are added often."}
          </p>
        </div>
      ) : (
        <>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Event</th>
                  <th scope="col">Game</th>
                  <th scope="col">When</th>
                  <th scope="col">Location</th>
                  <th scope="col">Seats</th>
                  <th scope="col">
                    <span className="sr-only">RSVP</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <EventRow
                    key={event.id}
                    event={event}
                    rsvping={rsvpingId === event.id}
                    error={rowError?.id === event.id ? rowError.message : undefined}
                    onSignUp={() => onSignUp(event)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.cards}>
            {events.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                rsvping={rsvpingId === event.id}
                error={rowError?.id === event.id ? rowError.message : undefined}
                onSignUp={() => onSignUp(event)}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
