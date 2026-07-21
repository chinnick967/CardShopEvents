"use client";

import { useSyncExternalStore } from "react";
import { formatEventTime } from "@/lib/format";

// The time value never changes reactively; we only need the server→client
// transition, so the store has no real subscription.
const noopSubscribe = () => () => {};

/**
 * Renders an event time. `useSyncExternalStore` returns the deterministic UTC
 * format during SSR and the first client render (getServerSnapshot), then the
 * viewer's local-timezone format after hydration — hydration-safe with no
 * setState-in-effect.
 */
export default function EventTime({ iso }: { iso: string }) {
  const text = useSyncExternalStore(
    noopSubscribe,
    () => formatEventTime(iso), // client: local timezone
    () => formatEventTime(iso, "UTC"), // server + first client render: deterministic
  );

  return <time dateTime={iso}>{text}</time>;
}
