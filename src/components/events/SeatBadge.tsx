import type { EventDTO } from "@/lib/types";
import styles from "./SeatBadge.module.scss";

/** Compact seat meter: taken/capacity, a fill bar, and a status tag. */
export default function SeatBadge({ event }: { event: EventDTO }) {
  const pct = event.capacity > 0 ? Math.min(100, Math.round((event.seatsTaken / event.capacity) * 100)) : 0;
  const lowThreshold = Math.max(2, Math.ceil(event.capacity * 0.15));
  const status = event.isFull ? "full" : event.seatsLeft <= lowThreshold ? "low" : "open";

  const label = event.isFull
    ? `Full — ${event.capacity} of ${event.capacity} seats taken`
    : `${event.seatsTaken} of ${event.capacity} seats taken, ${event.seatsLeft} left`;

  return (
    <div className={styles.wrap}>
      {/* One coherent announcement; the visual fragments below are decorative to AT. */}
      <span className="sr-only">{label}</span>
      <div className={styles.counts} aria-hidden="true">
        <span className={styles.taken}>{event.seatsTaken}</span>
        <span className={styles.sep}>/</span>
        <span className={styles.cap}>{event.capacity}</span>
      </div>
      <div className={styles.track} aria-hidden="true">
        <div className={`${styles.fill} ${styles[status]}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`${styles.tag} ${styles[status]}`} aria-hidden="true">
        {event.isFull ? "Full" : `${event.seatsLeft} left`}
      </span>
    </div>
  );
}
