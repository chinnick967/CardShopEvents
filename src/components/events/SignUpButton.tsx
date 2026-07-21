import Button from "@/components/ui/Button";
import type { EventDTO } from "@/lib/types";

interface Props {
  event: EventDTO;
  loading: boolean;
  onSignUp: () => void;
}

/** RSVP control whose label/state reflects the event: Joined / Full / Sign Up. */
export default function SignUpButton({ event, loading, onSignUp }: Props) {
  if (event.viewerJoined) {
    return (
      <Button variant="outline" disabled aria-label="You are signed up for this event">
        Joined ✓
      </Button>
    );
  }
  if (event.isFull) {
    return (
      <Button variant="ghost" disabled>
        Full
      </Button>
    );
  }
  return (
    <Button variant="primary" loading={loading} onClick={onSignUp}>
      Sign Up
    </Button>
  );
}
