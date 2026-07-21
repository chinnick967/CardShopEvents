import styles from "./EventSkeleton.module.scss";

/** A shimmer bar of a given width (any CSS length). */
function Bar({ width }: { width: string }) {
  return <span className={styles.bar} style={{ width, display: "block" }} />;
}

/**
 * Skeleton table rows for the desktop layout. Rendered inside `<tbody>` while the
 * next batch loads, so they must be `<tr>` elements matching the 6-column shape.
 */
export function SkeletonRows({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <tr key={`sk-${i}`} className={styles.row} aria-hidden="true">
          <td>
            <Bar width="70%" />
          </td>
          <td>
            <Bar width="60%" />
          </td>
          <td>
            <Bar width="80%" />
          </td>
          <td>
            <Bar width="65%" />
          </td>
          <td>
            <span className={`${styles.bar} ${styles.pill}`} />
          </td>
          <td>
            <span className={`${styles.bar} ${styles.btn}`} />
          </td>
        </tr>
      ))}
    </>
  );
}

/** Skeleton cards for the mobile layout. Rendered inside the `.cards` container. */
export function SkeletonCards({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <article key={`sk-${i}`} className={styles.card} aria-hidden="true">
          <div className={styles.cardTop}>
            <Bar width="34%" />
            <Bar width="28%" />
          </div>
          <Bar width="75%" />
          <Bar width="50%" />
          <div className={styles.cardBottom}>
            <span className={`${styles.bar} ${styles.pill}`} />
            <span className={`${styles.bar} ${styles.btn}`} />
          </div>
        </article>
      ))}
    </>
  );
}
