"use client";

import type { EventDTO } from "@/lib/types";
import EventTime from "./EventTime";
import SeatBadge from "./SeatBadge";
import SignUpButton from "./SignUpButton";
import EventDetails from "./EventDetails";
import { useExpandableEvent } from "./useExpandableEvent";
import styles from "./EventRow.module.scss";

interface Props {
  event: EventDTO;
  busy: boolean;
  error?: string;
  onSignUp: () => void;
  onCancel: () => void;
}

export default function EventRow({ event, busy, error, onSignUp, onCancel }: Props) {
  const { expanded, toggle, detail, status, reload } = useExpandableEvent(event.id);
  const detailId = `event-detail-${event.id}`;

  return (
    <>
      <tr
        className={`${styles.row} ${event.isFull ? styles.full : ""} ${expanded ? styles.expanded : ""}`}
        onClick={toggle}
      >
        <td className={styles.titleCell}>
          <button
            type="button"
            className={styles.chevron}
            onClick={(e) => {
              e.stopPropagation();
              toggle();
            }}
            aria-expanded={expanded}
            aria-controls={detailId}
            aria-label={expanded ? `Hide details for ${event.title}` : `Show details for ${event.title}`}
          >
            ▸
          </button>
          <span className={styles.titleText}>
            <span className={styles.title}>{event.title}</span>
            {error ? <span className={styles.error}>{error}</span> : null}
          </span>
        </td>
        <td>
          <span className={styles.game}>{event.gameType}</span>
        </td>
        <td className={styles.when}>
          <EventTime iso={event.startsAt} />
        </td>
        <td className={styles.location}>{event.location}</td>
        <td>
          <SeatBadge event={event} />
        </td>
        <td className={styles.action} onClick={(e) => e.stopPropagation()}>
          <SignUpButton event={event} busy={busy} onSignUp={onSignUp} onCancel={onCancel} />
        </td>
      </tr>

      {expanded ? (
        <tr className={styles.detailRow} id={detailId}>
          <td colSpan={6} className={styles.detailCell}>
            <EventDetails detail={detail} status={status} onRetry={reload} />
          </td>
        </tr>
      ) : null}
    </>
  );
}
