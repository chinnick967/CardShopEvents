-- Game Night schema. Isolated in its own `game_night` Postgres schema so it can
-- never collide with GameStats' tables in the shared `postgres` database.
-- Idempotent: safe to run repeatedly (CREATE ... IF NOT EXISTS throughout).

CREATE SCHEMA IF NOT EXISTS game_night;

CREATE TABLE IF NOT EXISTS game_night.users (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'player' CHECK (role IN ('player', 'organizer')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS game_night.events (
  id           SERIAL PRIMARY KEY,
  title        TEXT NOT NULL,
  game_type    TEXT NOT NULL,
  starts_at    TIMESTAMPTZ NOT NULL,
  location     TEXT NOT NULL,
  capacity     INTEGER NOT NULL CHECK (capacity > 0),
  -- Denormalized live attendee count. The CHECK is the last-resort backstop that
  -- makes overselling impossible at the database level (brief requirement S1).
  seats_taken  INTEGER NOT NULL DEFAULT 0 CHECK (seats_taken >= 0 AND seats_taken <= capacity),
  organizer_id INTEGER REFERENCES game_night.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS game_night.signups (
  id         SERIAL PRIMARY KEY,
  event_id   INTEGER NOT NULL REFERENCES game_night.events(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES game_night.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- At most one active RSVP per player per event (brief requirement S2).
  CONSTRAINT uq_signup_event_user UNIQUE (event_id, user_id)
);

-- Soonest-first listing + "upcoming" filter.
CREATE INDEX IF NOT EXISTS idx_events_starts_at ON game_night.events (starts_at);
-- "My events" lookups (future slice) and the per-viewer "joined?" check.
CREATE INDEX IF NOT EXISTS idx_signups_user_id ON game_night.signups (user_id);
CREATE INDEX IF NOT EXISTS idx_signups_event_id ON game_night.signups (event_id);
