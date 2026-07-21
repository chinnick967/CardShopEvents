# Game Night

> **Live demo:** https://gamenight.35-87-97-8.sslip.io — playable immediately with seeded events; demo logins are in [Quick start](#quick-start) below.

A tabletop-event board for a local card shop. Players browse upcoming events, see how full each one is, and RSVP first-come-first-served against a **hard seating capacity**. Organizers create events, track their own, and see each event's attendee roster. Built with Next.js 16 (App Router) + Sequelize on PostgreSQL.

The interesting problem here isn't the CRUD — it's staying **correct under concurrency**: never selling more seats than exist, even when two players grab the last one at the same instant, and never double-counting a retried request. That is the spine of the design, and everything below is organized around proving it.

---

## Quick start

**Prerequisites:** Node 20+, a reachable PostgreSQL database (RDS or local).

1. **Configure environment.** Create `.env` in the project root:

   ```bash
   # Required — database connection
   DB_HOST=your-db-host
   DB_USER=your-db-user
   DB_PWD=your-db-password

   # Optional (defaults shown)
   DB_NAME=postgres
   DB_PORT=5432

   # Required — signs the httpOnly session JWT (use a long random string)
   SESSION_SECRET=replace-with-a-long-random-secret
   ```

   All app tables live in a dedicated **`game_night` Postgres schema**, so this can safely share a database with other applications without colliding.

2. **Install + create schema + seed demo data:**

   ```bash
   npm install
   npm run db:setup     # runs migrations (idempotent) then seeds demo data
   ```

3. **Run:**

   ```bash
   npm run dev          # http://localhost:3000
   ```

4. **Demo logins** (password `password123` for both):

   | Role | Name | Email |
   |------|------|-------|
   | Organizer | Alex Rivera | `organizer@gamenight.test` |
   | Player | Sam Chen | `player@gamenight.test` |

   The seed creates a realistic spread — one **full** event, several near-full, some with room, and one empty — so all the UI states are visible immediately. It also creates 60 synthetic players so the seat counts are backed by **real signup rows**, not a hand-set number.

### Database commands

| Command | Effect |
|---------|--------|
| `npm run db:migrate` | Create the `game_night` schema + tables (idempotent — safe to re-run) |
| `npm run db:seed`    | Populate demo data **only if the events table is empty** |
| `npm run db:setup`   | `migrate` + `seed` |
| `npm run db:reset`   | Truncate events + signups and re-seed pristine demo data (keeps user accounts) |
| `npm test`           | Run the test suite, including the concurrency proof (needs DB connectivity) |

---

## How the required system behaviors are satisfied

The brief lists four required behaviors. Each is enforced **server-side** (the client only ever mirrors state the server owns), and the two correctness-critical ones are backed by database constraints so they hold even if the application code has a bug.

### S1 — An event never exceeds capacity, including the simultaneous last-seat race

**Where:** [`src/server/services/rsvpService.ts`](src/server/services/rsvpService.ts) · backstop in [`src/db/migrations/001_init.sql`](src/db/migrations/001_init.sql)

Taking a seat is a **single atomic conditional UPDATE**, not a read-then-write:

```sql
UPDATE game_night.events
   SET seats_taken = seats_taken + 1
 WHERE id = :eventId AND seats_taken < capacity
 RETURNING seats_taken;
```

Why this is correct under a race:

- The `UPDATE` takes a **row lock** on the event. Concurrent RSVPs for the same event are therefore **serialized** by Postgres — they queue on that lock rather than interleaving.
- Each waiter re-evaluates `seats_taken < capacity` against the *latest committed* row version after it acquires the lock. At most `capacity` updates can ever satisfy that predicate, so **exactly one transaction wins the final seat**; the rest match **zero rows**.
- Zero rows returned ⇒ the event is full ⇒ the service throws `409 EVENT_FULL`, which **rolls back the whole transaction** (including the signup insert from step 1), so a losing racer leaks no seat and no orphan signup.

There is no "read the count, check it in JavaScript, then write" window anywhere in the path — that TOCTOU gap is exactly what oversells events, and it doesn't exist here.

**Defense in depth:** the `events` table carries `CHECK (seats_taken >= 0 AND seats_taken <= capacity)`. Even if a future code path tried to over-increment, the database rejects the write. The application logic is the primary guard; the constraint is the last line that makes overselling *impossible*, not merely *unlikely*.

**Proven, not asserted:** `tests/rsvp.concurrency.test.ts` fires **12 players at a capacity-1 event simultaneously** (`Promise.allSettled`) against a real Postgres and asserts exactly one success, eleven `EVENT_FULL`, `seats_taken === 1`, and one signup row.

### S2 — At most one active RSVP per player; a retried/double-submitted request never duplicates or double-counts

**Where:** [`src/server/services/rsvpService.ts`](src/server/services/rsvpService.ts) · UNIQUE constraint in [`001_init.sql`](src/db/migrations/001_init.sql)

The signup is claimed **idempotently** before any seat is taken:

```sql
INSERT INTO game_night.signups (event_id, user_id, created_at)
VALUES (:eventId, :userId, now())
ON CONFLICT (event_id, user_id) DO NOTHING
RETURNING id;
```

- A `UNIQUE (event_id, user_id)` constraint makes "one active RSVP per player per event" a **database invariant**, not a convention.
- `ON CONFLICT DO NOTHING ... RETURNING id` means a repeat request returns **zero rows**. The service reads that as "already joined," returns the current state with `alreadyJoined: true`, and **skips the seat increment entirely** — so a double-submit or a network retry can never take a second seat.
- Because the idempotent insert happens *first*, the seat increment is only ever reached on the transition from "not joined" to "joined." One player, one seat, no matter how many times the request arrives.

**Defense in depth on the client:** `EventsDashboard` and the My-Events flow use a synchronous `useRef` in-flight guard, so even a same-tick double-click is dropped *before* it becomes a second network call. This is a UX nicety; correctness does not depend on it — the server is authoritative.

**Proven:** the same test file fires one player's RSVP followed by three concurrent retries and asserts all three report `alreadyJoined`, with `seats_taken === 1` and a single signup row.

### S3 — Attendee counts in lists reflect reality

**Freshness choice (stated explicitly, as the brief asks): exact counts via a transactionally-maintained denormalized counter.**

`events.seats_taken` is a denormalized live counter, incremented/decremented **in the same transaction** as the signup insert/delete that changes it. It is never computed by a background job, so it can't drift. This choice trades a tiny amount of write-time work (one extra `UPDATE` per RSVP) for two wins that matter for this app:

1. **Correctness comes for free.** The counter is the same value the last-seat `UPDATE` guards against, so the number shown to users *is* the number the capacity check enforces. There's no separate "displayed count" that can disagree with the "real count."
2. **Reads stay cheap on the hot path.** Listing events is `SELECT ... seats_taken ...` with **no `COUNT(*)` and no per-row JOIN** ([`eventService.ts`](src/server/services/eventService.ts) `listEvents`). Browsing is the most frequent action; keeping it a single indexed scan is the right call for a read-heavy board.

The alternative — `COUNT(*)` the signups on every list render — is always exact but pays a join/aggregate on the hottest query; a cached/materialized count is cheap to read but *can* go stale. The denormalized-counter approach gives exact-and-cheap, at the cost of a little transactional discipline in the one place that writes it (which is centralized in `rsvpService`).

**The one genuine staleness window** is cosmetic and bounded: the server-rendered initial list is a snapshot from render time, so it could be a few seconds old by the time it hydrates in the browser. `EventsDashboard` closes it by silently re-fetching on mount, and every RSVP/cancel updates the affected row from the server's authoritative response. The events API is also `dynamic = "force-dynamic"` so seat counts are **never served from a cache**. Net effect: counts are effectively live, and a stale read can never let someone over-RSVP because the capacity check is re-run server-side at write time regardless of what the browser was showing.

### S4 — Invalid input is rejected server-side with clear errors; the UI shows loading / empty / error states

**Server-side validation** ([`src/server/http.ts`](src/server/http.ts), [`src/lib/eventSchema.ts`](src/lib/eventSchema.ts), [`src/server/validation/schemas.ts`](src/server/validation/schemas.ts)):

- Every write route parses its body through a **Zod schema** via `parseJson`, which returns `400` with **per-field messages** on failure. The client schema is the *same* module (`eventSchema.ts`) for instant field errors, but the server re-validates — the client copy is a convenience, never the gate.
- Event creation additionally **re-runs the schema on the sanitized values**: stripping control/invisible characters can shrink a field below its minimum, so validation of the raw body alone would let a title of control characters store as an empty string. Order matters; the tests pin it.
- The specific cases the brief calls out:
  - **Bad capacity** → schema requires an integer `1–500`; the DB also enforces `CHECK (capacity > 0)`.
  - **Past dates** → `createEventSchema` rejects any `startsAt` that isn't a valid, future timestamp.
  - **Unknown IDs** → route handlers reject non-positive/non-integer ids with `400 INVALID_ID`; the service returns `404 EVENT_NOT_FOUND` when the row doesn't exist.
  - **Authorization** is enforced server-side too: creating an event is organizer-only (`403` for players, `401` for signed-out), and the organizer id is taken **from the session, never the request body**, so ownership can't be forged.
- Errors travel in a consistent envelope — `{ error: { code, message, fieldErrors? } }` — and internal exceptions are logged server-side and returned as a generic `500` so **no internals leak** to the client.

**UI states** ([`EventsDashboard.tsx`](src/components/events/EventsDashboard.tsx), [`apiClient.ts`](src/lib/apiClient.ts)):

- **Loading** — a status bar while a fetch is in flight; RSVP buttons show a per-row spinner and disable while their request runs.
- **Empty** — a distinct "no events" panel, with copy that changes depending on whether a search/filter is active.
- **Error** — a load failure renders a retry panel (not a broken page); a failed RSVP shows an inline row-level message *and* reconciles with the server (e.g. it re-fetches in case the event filled while the user waited). Out-of-order responses are ignored via a request-sequence guard, so a slow earlier response can't clobber a newer list.

---

## Architecture at a glance

```
src/
  app/api/…                REST routes (thin: auth-check → validate → call service → envelope)
  server/
    services/              business logic; the ONLY place that writes seats/signups
      rsvpService.ts       ← S1/S2 correctness core
      eventService.ts      ← reads + create + attendee roster
    models/                Sequelize models (all pinned to schema: "game_night")
    validation/, http.ts   Zod schemas + request parsing + error envelope
    auth/session.ts        stateless jose HS256 JWT in an httpOnly cookie
  db/
    migrations/*.sql       idempotent DDL, applied in filename order
    seed.ts, run.ts        demo data + CLI
  components/              client UI (dashboard, modals, header)
  lib/                     db handle, typed fetch client, shared types
tests/                     Vitest: concurrency proof, pagination, timezone, attendee roster
```

**Layering rationale:** routes are deliberately thin and the service layer holds all state-changing logic, so the correctness rules live in exactly one place and are unit-testable **without booting Next.js** (`HttpError` is transport-agnostic; the concurrency test imports `rsvp()` directly). Backend modules use relative imports so `tsx`/Vitest resolve them the same way the app does.

**A note on time zones:** "upcoming" is a day boundary in the *viewer's* zone, not the server's. The client sends its IANA timezone; the server computes start-of-today in that zone (DST-correct, UTC fallback) and filters `starts_at >= cutoff`. `timestamptz` columns keep the comparison absolute. Covered by `tests/time.test.ts` and `tests/events.timezone.test.ts`.

---

## Testing

```bash
npm test
```

Runs against a **real Postgres** (the same locking semantics the app relies on — an in-memory fake wouldn't prove anything about the race). Current suite: **18 tests, all green.**

- `rsvp.concurrency.test.ts` — S1 (12-way last-seat race) and S2 (concurrent double-submit). Rows are timestamp-namespaced and cleaned up in `afterAll`.
- `events.pagination.test.ts` — keyset paging: stable cursor, no overlap, id tiebreaker.
- `events.attendees.test.ts` — O2: roster in signup order, ownership enforcement (403 for non-owners, even on orphaned events), and an exact-DTO-shape assertion proving attendee emails are never exposed.
- `events.create.test.ts` — S4: crafted input (control-character titles, bidi overrides, past dates) is rejected or stripped server-side, proving the sanitize-then-revalidate ordering.
- `time.test.ts`, `events.timezone.test.ts` — the viewer-timezone day-boundary logic.

`npm run lint` is clean.

---

## Design decisions & trade-offs

- **Denormalized `seats_taken` over `COUNT(*)`** — exact *and* cheap on the read-heavy path; the cost is transactional discipline in the single service that writes it. (See S3.)
- **DB constraints as backstops, not the primary mechanism** — the app logic is the guard; `CHECK`/`UNIQUE` make the invariants impossible to violate even under a future bug. Belt and suspenders on the two rules that must never break.
- **Conditional `UPDATE` + row lock instead of `SELECT … FOR UPDATE` then write** — one round-trip, no explicit lock management, and the predicate is evaluated atomically by the database.
- **`READ COMMITTED` isolation** is sufficient here because the seat guard is a conditional write that re-reads the row under lock; we don't rely on repeatable reads, so there's no reason to pay for a stricter level or risk serialization failures/retries.
- **Stateless JWT sessions** — no session table to read on every request; the trade-off (can't revoke a token before it expires) is acceptable at this scale and documented.
- **One isomorphic Zod schema** for event creation — the client gets instant feedback and the server stays authoritative, with zero drift between the two rule sets.
- **Keyset (cursor) pagination on the event list**, not OFFSET — pages stay stable when events are inserted mid-scroll (no duplicated/skipped rows) and every batch is an index range-scan on `(starts_at, id)`, which is what keeps the hot path flat as the event count grows toward the 12-month column.
- **Attendee rosters show names only, never emails** (O2) — an organizer needs to know who's coming, not harvest contact info; the test suite pins the DTO shape so this can't regress silently. The roster is also organizer-only *per event*: another organizer gets a 403, and players don't see other players' RSVPs at all — showing attendees to any signed-in player would be a materially different privacy exposure (anyone could enumerate who attends what), so it's deliberately not built rather than accidentally missing.

## What I'd do before real traffic

Honest list of what this deliberately doesn't have yet:

- **Rate-limit auth + RSVP endpoints** and add basic abuse protection (a determined client can still hammer the API even though it can't oversell).
- **Pin the RDS CA bundle** and set `rejectUnauthorized: true` (currently accepts the RDS-managed cert without bundling the CA — fine for the take-home, not for production).
- **A migration runner with a tracking table** (e.g. Umzug) instead of "apply every `.sql` each boot." The current DDL is idempotent so it's safe, but a real migration ledger gives ordering guarantees and down-migrations.
- **Observability** — structured logs, request tracing, and a metric/alert on `EVENT_FULL` rate and RSVP latency (the seat lock is the natural contention point to watch).
- **A waitlist** so a freed seat (cancellation) can auto-promote — the schema already models signups as rows, so this is an additive feature, not a rewrite.
- **Broaden automated coverage** — component/E2E tests for the loading/empty/error UI states and the auth flows, alongside the service-level correctness tests that exist today.
- **CSRF hardening** for the cookie-based session (SameSite is set; add token-based defense for state-changing routes if the surface grows).

## How this was built (and verified)

Built AI-assisted with **Claude Code**, used as a pair programmer: I set the architecture and the judgment calls (the conditional-UPDATE concurrency design, denormalized counts, keyset pagination, the privacy scope of attendee rosters), reviewed every diff, and kept the final say on what shipped. Since much of the code wasn't typed by hand, verification leaned on things that can't nod along:

- **The test suite** — S1/S2 are proven by concurrency tests against a real Postgres (a 12-way race for one seat; concurrent duplicate submissions), not by reading the code and agreeing with it. Pagination stability, ownership enforcement, and the no-emails DTO shape are asserted the same way.
- **Static gates** — `npm run lint` and `tsc --noEmit` clean, plus a production `next build`.
- **Manual end-to-end passes** — every user story exercised in the browser as both roles and signed-out: browse/search/scroll, RSVP against a full event, cancel and watch the seat free, create an event, expand an attendee roster, and the loading/empty/error states via network throttling.

## Time spent

Roughly **6–8 hours** across the concurrency core, the full RSVP/cancel + organizer create flows, the attendee roster, the UI states, and this write-up.
