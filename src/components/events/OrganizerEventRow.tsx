"use client";

import type { EventDTO } from "@/lib/types";
import EventTime from "./EventTime";
import AttendeePanel from "./AttendeePanel";
import { useAttendees } from "./useAttendees";
import styles from "./MyEventsModal.module.scss";

interface Props {
  event: EventDTO;
}

/**
 * One row of the organizer's My Events list: the event summary plus an
 * expandable attendee roster (O2). Owns its expand/fetch state via
 * useAttendees — the same row/hook/panel split as the dashboard's
 * EventRow / useExpandableEvent / EventDetails.
 */
export default function OrganizerEventRow({ event }: Props) {
  const { expanded, toggle, attendees, status, reload } = useAttendees(event.id);
  const panelId = `attendees-${event.id}`;

  return (
    <li className={`${styles.item} ${expanded ? styles.itemExpanded : ""}`}>
      <div className={`${styles.itemMain} ${styles.itemClickable}`} onClick={toggle}>
        <button
          type="button"
          className={styles.chevron}
          onClick={(e) => {
            e.stopPropagation();
            toggle();
          }}
          aria-expanded={expanded}
          // Only reference the panel while it exists — a dangling aria-controls
          // id is an ARIA authoring error.
          aria-controls={expanded ? panelId : undefined}
          aria-label={
            expanded ? `Hide attendees for ${event.title}` : `Show attendees for ${event.title}`
          }
        >
          ▸
        </button>

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
          <span className={styles.filled}>
            <span className={styles.filledCount}>
              {event.seatsTaken}/{event.capacity}
            </span>
            <span className={styles.filledLabel}>signed up</span>
          </span>
        </div>
      </div>

      {expanded ? (
        <div className={styles.panel} id={panelId}>
          <AttendeePanel attendees={attendees} status={status} onRetry={reload} />
        </div>
      ) : null}
    </li>
  );
}
