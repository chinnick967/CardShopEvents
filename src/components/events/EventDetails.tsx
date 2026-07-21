"use client";

import type { EventDetailDTO } from "@/lib/types";
import { formatDuration, formatFee } from "@/lib/format";
import type { DetailStatus } from "./useExpandableEvent";
import styles from "./EventDetails.module.scss";

interface Props {
  detail: EventDetailDTO | null;
  status: DetailStatus;
  onRetry: () => void;
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.item}>
      <dt className={styles.label}>{label}</dt>
      <dd className={styles.value}>{value}</dd>
    </div>
  );
}

/** Presentational — detail data + fetch status are owned by useExpandableEvent. */
export default function EventDetails({ detail, status, onRetry }: Props) {
  if (status === "loading" && !detail) {
    return (
      <div className={styles.state}>
        <span className={styles.spinner} aria-hidden="true" />
        <span>Loading details…</span>
      </div>
    );
  }

  if (status === "error" && !detail) {
    return (
      <div className={styles.state} role="alert">
        <span>Couldn’t load details.</span>
        <button className={styles.retry} onClick={onRetry} type="button">
          Retry
        </button>
      </div>
    );
  }

  if (!detail) return null;

  const duration = formatDuration(detail.durationMinutes);

  return (
    <div className={styles.details}>
      {detail.description ? <p className={styles.description}>{detail.description}</p> : null}
      <dl className={styles.grid}>
        {detail.format ? <Item label="Format" value={detail.format} /> : null}
        <Item label="Entry" value={formatFee(detail.entryFeeCents)} />
        {detail.prizes ? <Item label="Prizes" value={detail.prizes} /> : null}
        {detail.skillLevel ? <Item label="Skill level" value={detail.skillLevel} /> : null}
        {duration ? <Item label="Duration" value={duration} /> : null}
        <Item
          label="Seats left"
          value={detail.isFull ? "Full" : `${detail.seatsLeft} of ${detail.capacity}`}
        />
      </dl>
    </div>
  );
}
