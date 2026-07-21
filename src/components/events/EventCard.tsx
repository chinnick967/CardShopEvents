"use client";

import type { EventDTO } from "@/lib/types";
import EventTime from "./EventTime";
import SeatBadge from "./SeatBadge";
import SignUpButton from "./SignUpButton";
import styles from "./EventCard.module.scss";

interface Props {
  event: EventDTO;
  rsvping: boolean;
  error?: string;
  onSignUp: () => void;
}

export default function EventCard({ event, rsvping, error, onSignUp }: Props) {
  return (
    <article className={`${styles.card} ${event.isFull ? styles.full : ""}`}>
      <div className={styles.top}>
        <span className={styles.game}>{event.gameType}</span>
        <span className={styles.when}>
          <EventTime iso={event.startsAt} />
        </span>
      </div>

      <h3 className={styles.title}>{event.title}</h3>
      <p className={styles.location}>{event.location}</p>

      <div className={styles.bottom}>
        <SeatBadge event={event} />
        <SignUpButton event={event} loading={rsvping} onSignUp={onSignUp} />
      </div>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </article>
  );
}
