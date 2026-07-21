"use client";

import type { EventDTO } from "@/lib/types";
import EventTime from "./EventTime";
import SeatBadge from "./SeatBadge";
import SignUpButton from "./SignUpButton";
import styles from "./EventRow.module.scss";

interface Props {
  event: EventDTO;
  rsvping: boolean;
  error?: string;
  onSignUp: () => void;
}

export default function EventRow({ event, rsvping, error, onSignUp }: Props) {
  return (
    <tr className={`${styles.row} ${event.isFull ? styles.full : ""}`}>
      <td className={styles.titleCell}>
        <span className={styles.title}>{event.title}</span>
        {error ? <span className={styles.error}>{error}</span> : null}
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
      <td className={styles.action}>
        <SignUpButton event={event} loading={rsvping} onSignUp={onSignUp} />
      </td>
    </tr>
  );
}
