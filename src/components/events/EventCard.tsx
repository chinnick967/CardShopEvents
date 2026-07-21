"use client";

import type { EventDTO } from "@/lib/types";
import EventTime from "./EventTime";
import SeatBadge from "./SeatBadge";
import SignUpButton from "./SignUpButton";
import EventDetails from "./EventDetails";
import { useExpandableEvent } from "./useExpandableEvent";
import styles from "./EventCard.module.scss";

interface Props {
  event: EventDTO;
  busy: boolean;
  error?: string;
  onSignUp: () => void;
  onCancel: () => void;
}

export default function EventCard({ event, busy, error, onSignUp, onCancel }: Props) {
  const { expanded, toggle, detail, status, reload } = useExpandableEvent(event.id);
  const detailId = `event-card-detail-${event.id}`;

  return (
    <article
      className={`${styles.card} ${event.isFull ? styles.full : ""} ${expanded ? styles.expanded : ""}`}
      onClick={toggle}
    >
      <div className={styles.top}>
        <span className={styles.game}>{event.gameType}</span>
        <span className={styles.when}>
          <EventTime iso={event.startsAt} />
        </span>
      </div>

      <h3 className={styles.title}>
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
        <span>{event.title}</span>
      </h3>
      <p className={styles.location}>{event.location}</p>

      <div className={styles.bottom} onClick={(e) => e.stopPropagation()}>
        <SeatBadge event={event} />
        <SignUpButton event={event} busy={busy} onSignUp={onSignUp} onCancel={onCancel} />
      </div>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      {expanded ? (
        <div className={styles.detail} id={detailId} onClick={(e) => e.stopPropagation()}>
          <EventDetails detail={detail} status={status} onRetry={reload} />
        </div>
      ) : null}
    </article>
  );
}
