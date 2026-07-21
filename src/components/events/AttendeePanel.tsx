"use client";

import type { AttendeeDTO } from "@/lib/types";
import type { DetailStatus } from "./useExpandableEvent";
import styles from "./MyEventsModal.module.scss";

interface Props {
  attendees: AttendeeDTO[] | null;
  status: DetailStatus;
  onRetry: () => void;
}

// Only ever rendered after a client-side expand, so locale-dependent output
// can't cause a hydration mismatch.
const joinedFormat = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });

/** Presentational — roster data + fetch status are owned by useAttendees (O2). */
export default function AttendeePanel({ attendees, status, onRetry }: Props) {
  if (status === "loading" && !attendees) {
    return (
      <div className={styles.state}>
        <span className={styles.spinner} aria-hidden="true" />
        <span>Loading attendees…</span>
      </div>
    );
  }

  if (status === "error" && !attendees) {
    return (
      <div className={styles.state} role="alert">
        <span>Couldn’t load attendees.</span>
        <button className={styles.retry} onClick={onRetry} type="button">
          Retry
        </button>
      </div>
    );
  }

  if (!attendees) return null;

  if (attendees.length === 0) {
    return (
      <div className={styles.state}>
        <p className={styles.stateHint}>No sign-ups yet.</p>
      </div>
    );
  }

  return (
    <div className={styles.roster}>
      <p className={styles.panelHead}>
        {attendees.length} attending
      </p>
      <ul className={styles.attendeeList}>
        {attendees.map((attendee) => (
          <li key={attendee.userId} className={styles.attendeeRow}>
            <span className={styles.attendeeName}>{attendee.name}</span>
            <span className={styles.joined}>
              Joined {joinedFormat.format(new Date(attendee.joinedAt))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
