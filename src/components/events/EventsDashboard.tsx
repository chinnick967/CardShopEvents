"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { EventDTO } from "@/lib/types";
import { useAuth } from "@/components/auth/AuthProvider";
import { apiFetch, type ApiError } from "@/lib/apiClient";
import { useEvents } from "./EventsProvider";
import EventRow from "./EventRow";
import EventCard from "./EventCard";
import { SkeletonRows, SkeletonCards } from "./EventSkeleton";
import Select from "@/components/ui/Select";
import styles from "./EventsDashboard.module.scss";

interface Props {
  initialEvents: EventDTO[];
  /** Cursor for the batch after `initialEvents`, or null if that's the whole list. */
  initialCursor: string | null;
  gameTypes: string[];
}

type Status = "idle" | "loading" | "error";

interface EventsPageResponse {
  events: EventDTO[];
  nextCursor: string | null;
}

export default function EventsDashboard({ initialEvents, initialCursor, gameTypes }: Props) {
  const { user, openAuth } = useAuth();
  const { revision } = useEvents();
  const [events, setEvents] = useState<EventDTO[]>(initialEvents);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [q, setQ] = useState("");
  const [game, setGame] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState(false);
  // True while ANY first-batch fetch is in flight (including silent ones, which
  // never touch `status`) — pagination must pause until the list it would
  // append to is settled.
  const [baseLoading, setBaseLoading] = useState(false);
  // Last known sentinel visibility. Kept as STATE, not read in a callback:
  // IntersectionObserver only reports transitions, so "should we load more?"
  // must be re-evaluated whenever the data changes, not only when the sentinel
  // crosses the margin (see the driver effect below).
  const [sentinelVisible, setSentinelVisible] = useState(false);
  // The event with an RSVP/cancel request currently in flight.
  const [busyId, setBusyId] = useState<number | null>(null);
  const [rowError, setRowError] = useState<{ id: number; message: string } | null>(null);

  const reqSeq = useRef(0);
  const didMount = useRef(false);
  const lastUserId = useRef<number | null | undefined>(undefined);
  const lastRevision = useRef(revision);
  // Synchronous in-flight guard — defeats same-tick double-clicks before the
  // disabled/busy state has re-rendered.
  const actionInFlight = useRef(false);
  // Separate guard for pagination so a fast scroll can't fire overlapping fetches.
  const loadMoreInFlight = useRef(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const loadMoreRef = useRef<() => void>(() => {});

  const hasMore = cursor !== null;

  // The viewer's IANA timezone, sent so the server computes "today" in their zone.
  const tz = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return undefined;
    }
  }, []);

  // Fetch the FIRST batch for the current filters (replaces the list + resets the
  // cursor). `reqSeq` guards against out-of-order responses clobbering a newer
  // filter's result — and also invalidates any in-flight `loadMore`.
  const fetchEvents = useCallback(
    async (qv: string, gv: string, opts?: { silent?: boolean }) => {
      const seq = ++reqSeq.current;
      setBaseLoading(true);
      if (!opts?.silent) setStatus("loading");
      try {
        const params = new URLSearchParams();
        if (qv.trim()) params.set("q", qv.trim());
        if (gv) params.set("game", gv);
        if (tz) params.set("tz", tz);
        const { events, nextCursor } = await apiFetch<EventsPageResponse>(`/api/events?${params.toString()}`);
        // Ignore out-of-order responses (keep only the latest request's result).
        if (seq === reqSeq.current) {
          setEvents(events);
          setCursor(nextCursor);
          setLoadMoreError(false); // a fresh first page resets any stale batch error
          if (!opts?.silent) setStatus("idle");
        }
      } catch {
        if (seq === reqSeq.current && !opts?.silent) setStatus("error");
      } finally {
        // Only the latest request may clear the flag — a superseded fetch
        // finishing must not mark the newer one as settled.
        if (seq === reqSeq.current) setBaseLoading(false);
      }
    },
    [tz],
  );

  // Fetch the NEXT batch and append it. Tied to the current `reqSeq`: if a filter
  // change bumps the sequence while this is in flight, the result is discarded.
  const loadMore = useCallback(async () => {
    if (loadMoreInFlight.current || !cursor) return;
    loadMoreInFlight.current = true;
    const seq = reqSeq.current;
    setLoadingMore(true);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (game) params.set("game", game);
      if (tz) params.set("tz", tz);
      params.set("cursor", cursor);
      const { events: batch, nextCursor } = await apiFetch<EventsPageResponse>(`/api/events?${params.toString()}`);
      if (seq !== reqSeq.current) return; // a filter change superseded this batch
      // Dedupe by id as a safety net against an overlapping fire.
      setEvents((prev) => {
        const seen = new Set(prev.map((e) => e.id));
        return [...prev, ...batch.filter((e) => !seen.has(e.id))];
      });
      setCursor(nextCursor);
    } catch {
      // Cursor stays intact; surface a retry affordance instead of silently
      // re-firing (an auto-retry here could hot-loop on a persistent failure).
      if (seq === reqSeq.current) setLoadMoreError(true);
    } finally {
      // Unconditional: even a superseded batch must stop showing skeletons.
      setLoadingMore(false);
      loadMoreInFlight.current = false;
    }
  }, [cursor, q, game, tz]);

  // Keep the observer pointed at the latest `loadMore` without re-creating the
  // observer on every state change.
  useEffect(() => {
    loadMoreRef.current = loadMore;
  }, [loadMore]);

  // Infinite scroll, part 1 — the observer ONLY tracks whether the sentinel is
  // within 600px of the viewport. It deliberately doesn't fetch: observers fire
  // on visibility *transitions*, so a sentinel that stays inside the margin
  // across an append would never fire again and the list would stall.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => setSentinelVisible(entries[entries.length - 1]?.isIntersecting ?? false),
      { rootMargin: "600px 0px" },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      setSentinelVisible(false);
    };
  }, [hasMore, status]);

  // Infinite scroll, part 2 — the driver. Re-evaluated whenever visibility OR
  // the data changes, so it keeps paginating while the sentinel sits inside the
  // margin, and it can't fire against a half-settled list: a first-batch fetch
  // in flight (`baseLoading`) pauses it, and when that fetch lands with a new
  // cursor this effect re-runs with the fresh state. That ordering is what
  // prevents a stale-cursor batch from being appended onto a new filter's list.
  useEffect(() => {
    if (!sentinelVisible || !hasMore || baseLoading || loadMoreError) return;
    if (status !== "idle") return;
    loadMoreRef.current();
  }, [sentinelVisible, hasMore, baseLoading, loadMoreError, cursor, status]);

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

  // A cancel from the My Events modal bumps `revision` — resync the board so it
  // reflects the freed seat / no-longer-joined state.
  useEffect(() => {
    if (lastRevision.current === revision) return;
    lastRevision.current = revision;
    fetchEvents(q, game);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revision]);

  // On mount, silently re-fetch with the viewer's timezone so "today" is computed
  // in their zone (the SSR list used a UTC default). The setTimeout keeps the
  // state update out of the effect body; silent means no loading flash.
  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchEvents(q, game, { silent: true });
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSignUp = useCallback(
    async (event: EventDTO) => {
      if (!user) {
        openAuth("You need an account to RSVP for an event. Sign in or create one — it only takes a moment.", "signup");
        return;
      }
      if (event.isFull || event.viewerJoined || actionInFlight.current) return;
      actionInFlight.current = true;

      setRowError(null);
      setBusyId(event.id);
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
        actionInFlight.current = false;
        setBusyId(null);
      }
    },
    [user, openAuth, q, game, fetchEvents],
  );

  const onCancel = useCallback(
    async (event: EventDTO) => {
      if (!user || !event.viewerJoined || actionInFlight.current) return;
      actionInFlight.current = true;

      setRowError(null);
      setBusyId(event.id);
      try {
        const { event: updated } = await apiFetch<{ event: EventDTO }>(`/api/events/${event.id}/rsvp`, {
          method: "DELETE",
        });
        setEvents((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
      } catch (err) {
        const apiErr = err as ApiError;
        setRowError({ id: event.id, message: apiErr.message ?? "Could not cancel. Please try again." });
        fetchEvents(q, game);
      } finally {
        actionInFlight.current = false;
        setBusyId(null);
      }
    },
    [user, q, game, fetchEvents],
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
          <svg className={styles.searchIcon} viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" />
            <line x1="15.5" y1="15.5" x2="21" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            className={styles.searchInput}
            placeholder="Search by title or location…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search events"
          />
        </div>
        <div className={styles.filter}>
          <Select
            value={game}
            onChange={setGame}
            options={[{ value: "", label: "All games" }, ...gameTypes.map((g) => ({ value: g, label: g }))]}
            ariaLabel="Filter by game type"
            className={styles.select}
          />
        </div>
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
                    busy={busyId === event.id}
                    error={rowError?.id === event.id ? rowError.message : undefined}
                    onSignUp={() => onSignUp(event)}
                    onCancel={() => onCancel(event)}
                  />
                ))}
                {loadingMore && <SkeletonRows count={3} />}
              </tbody>
            </table>
          </div>

          <div className={styles.cards}>
            {events.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                busy={busyId === event.id}
                error={rowError?.id === event.id ? rowError.message : undefined}
                onSignUp={() => onSignUp(event)}
                onCancel={() => onCancel(event)}
              />
            ))}
            {loadingMore && <SkeletonCards count={3} />}
          </div>

          {/* Sentinel: when this scrolls near the viewport, load the next batch. */}
          {hasMore && <div ref={sentinelRef} className={styles.sentinel} aria-hidden="true" />}

          {loadingMore && (
            <p className={styles.loadingMore} role="status">
              <span className={styles.spinner} aria-hidden="true" />
              Loading more events…
            </p>
          )}

          {loadMoreError && !loadingMore && (
            <p className={styles.loadingMore} role="alert">
              Couldn’t load more events.
              <button className={styles.retry} onClick={() => setLoadMoreError(false)} type="button">
                Retry
              </button>
            </p>
          )}

          {!hasMore && events.length > 0 && (
            <p className={styles.endMarker}>✓ You’ve reached the end of the list</p>
          )}
        </>
      )}
    </section>
  );
}
