import Button from "@/components/ui/Button";
import type { EventDTO } from "@/lib/types";
import styles from "./SignUpButton.module.scss";

interface Props {
  event: EventDTO;
  busy: boolean;
  onSignUp: () => void;
  onCancel: () => void;
}

/**
 * RSVP control reflecting the event + the viewer's state:
 *  - joined → a green "✓ Joined" indicator that becomes a red "✕ Cancel" button
 *            on hover/focus (a "✕" remove hint on touch), cancelling on click.
 *  - full   → disabled "Full".
 *  - open   → "Sign Up".
 *
 * Every state renders inside a single fixed-width slot (and the joined labels +
 * spinner overlap in one grid cell), so all states are the same width — the
 * table column never reflows when signing up, cancelling, or hovering.
 */
export default function SignUpButton({ event, busy, onSignUp, onCancel }: Props) {
  let control;

  if (event.viewerJoined) {
    control = (
      <button
        type="button"
        className={styles.joined}
        onClick={onCancel}
        disabled={busy}
        data-busy={busy || undefined}
        aria-label="You're joined — click to cancel your RSVP"
        title="Cancel your RSVP"
      >
        <span className={styles.joinedLabel}>✓ Joined</span>
        <span className={styles.cancelLabel}>✕ Cancel</span>
        <span className={styles.spinner} aria-hidden="true" />
      </button>
    );
  } else if (event.isFull) {
    control = (
      <Button variant="ghost" className={styles.fill} disabled>
        Full
      </Button>
    );
  } else {
    control = (
      <Button variant="primary" className={styles.fill} loading={busy} onClick={onSignUp}>
        Sign Up
      </Button>
    );
  }

  return <span className={styles.slot}>{control}</span>;
}
