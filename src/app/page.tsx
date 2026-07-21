import { listEvents, listGameTypes } from "@/server/services/eventService";
import { getSessionUser } from "@/server/auth/session";
import EventsDashboard from "@/components/events/EventsDashboard";

// Live seat counts must never be statically cached.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getSessionUser();

  // Server-render the initial list directly from the service (fast first paint
  // on the read-heavy hot path). Client-side search/filter re-fetch via the API.
  const [events, gameTypes] = await Promise.all([listEvents({}, user?.id), listGameTypes()]);

  return <EventsDashboard initialEvents={events} gameTypes={gameTypes} />;
}
