import { listEvents, listGameTypes, PAGE_SIZE } from "@/server/services/eventService";
import { getSessionUser } from "@/server/auth/session";
import EventsDashboard from "@/components/events/EventsDashboard";

// Live seat counts must never be statically cached.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getSessionUser();

  // Server-render the first batch directly from the service (fast first paint on
  // the read-heavy hot path). The client fetches later batches — and re-pages on
  // search/filter — via the API.
  const [{ events, nextCursor }, gameTypes] = await Promise.all([
    listEvents({}, user?.id, undefined, { limit: PAGE_SIZE }),
    listGameTypes(),
  ]);

  return <EventsDashboard initialEvents={events} initialCursor={nextCursor} gameTypes={gameTypes} />;
}
