"use client";

import Modal from "@/components/ui/Modal";
import type { EventDTO } from "@/lib/types";
import EventTime from "./EventTime";
import styles from "./MyEventsModal.module.scss";

interface Props {
  events: EventDTO[];
  status: "loading" | "idle" | "error";
  cancelingId: number | null;
  rowError: { id: number; message: string } | null;
  onClose: () => void;
  onReload: () => void;
  onCancel: (event: EventDTO) => void;
}

/** Presentational — all state + fetching lives in MyEventsProvider. */
export default function MyEventsModal({
  events,
  status,
  cancelingId,
  rowError,
  onClose,
  onReload,
  onCancel,
}: Props) {
  return (
    <Modal open onClose={onClose} labelledBy="myevents-title">
      <div className={styles.head}>
        <h2 id="myevents-title" className={styles.title}>
          My Events
        </h2>
        <button className={styles.close} onClick={onClose} aria-label="Close" type="button">
          ×
        </button>
      </div>

      {status === "loading" ? (
        <div className={styles.state}>
          <span className={styles.spinner} aria-hidden="true" />
          <span>Loading your events…</span>
        </div>
      ) : status === "error" ? (
        <div className={styles.state} role="alert">
          <p className={styles.stateTitle}>We couldn’t load your events</p>
          <button className={styles.retry} onClick={onReload} type="button">
            Retry
          </button>
        </div>
      ) : events.length === 0 ? (
        <div className={styles.state}>
          <p className={styles.stateTitle}>No upcoming events</p>
          <p className={styles.stateHint}>
            You haven’t signed up for any upcoming events yet. Browse the board and grab a seat!
          </p>
        </div>
      ) : (
        <ul className={styles.list}>
          {events.map((event) => (
            <li key={event.id} className={styles.item}>
              <div className={styles.itemMain}>
                <div className={styles.info}>
                  <span className={styles.eventTitle}>{event.title}</span>
                  <span className={styles.meta}>
                    <span className={styles.game}>{event.gameType}</span>
                    <span className={styles.dot} aria-hidden="true">
                      ·
                    </span>
                    <EventTime iso={event.startsAt} />
                  </span>
                  <span className={styles.location}>{event.location}</span>
                </div>
                <div className={styles.actions}>
                  <span className={styles.seats}>
                    {event.seatsTaken}/{event.capacity}
                  </span>
                  <button
                    className={styles.cancel}
                    onClick={() => onCancel(event)}
                    disabled={cancelingId === event.id}
                    data-busy={cancelingId === event.id || undefined}
                    type="button"
                    aria-label={`Cancel your RSVP for ${event.title}`}
                  >
                    {cancelingId === event.id ? (
                      <span className={styles.spinnerSm} aria-hidden="true" />
                    ) : (
                      "✕ Cancel"
                    )}
                  </button>
                </div>
              </div>
              {rowError?.id === event.id ? (
                <p className={styles.rowError} role="alert">
                  {rowError.message}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
