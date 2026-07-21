import type { EventDTO } from "@/lib/types";
import styles from "./SeatBadge.module.scss";

/** Compact seat meter: taken/capacity, a fill bar, and a status tag. */
export default function SeatBadge({ event }: { event: EventDTO }) {
  const pct = event.capacity > 0 ? Math.min(100, Math.round((event.seatsTaken / event.capacity) * 100)) : 0;
  const lowThreshold = Math.max(2, Math.ceil(event.capacity * 0.15));
  const status = event.isFull ? "full" : event.seatsLeft <= lowThreshold ? "low" : "open";

  return (
    <div className={styles.wrap}>
      <div className={styles.counts}>
        <span className={styles.taken}>{event.seatsTaken}</span>
        <span className={styles.sep}>/</span>
        <span className={styles.cap}>{event.capacity}</span>
      </div>
      <div className={styles.track} aria-hidden="true">
        <div className={`${styles.fill} ${styles[status]}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`${styles.tag} ${styles[status]}`}>
        {event.isFull ? "Full" : `${event.seatsLeft} left`}
      </span>
    </div>
  );
}
