-- Descriptive detail columns for events (P2 — expandable event details).
-- Idempotent: safe to run repeatedly. Nullable so existing rows are unaffected.

ALTER TABLE game_night.events ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE game_night.events ADD COLUMN IF NOT EXISTS format TEXT;
ALTER TABLE game_night.events ADD COLUMN IF NOT EXISTS prizes TEXT;
ALTER TABLE game_night.events ADD COLUMN IF NOT EXISTS skill_level TEXT;
ALTER TABLE game_night.events ADD COLUMN IF NOT EXISTS entry_fee_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE game_night.events ADD COLUMN IF NOT EXISTS duration_minutes INTEGER;
