-- Streaming availability notifications
-- Run once against production and dev databases.

-- Per-title provider snapshot: tracks the last-known set of streaming providers
-- for every title that appears in any list. Used to diff against current JustWatch
-- data so we can detect when a title lands on a new platform.
CREATE TABLE IF NOT EXISTS streaming_snapshots (
  tmdb_id       INTEGER     NOT NULL,
  media_type    TEXT        NOT NULL DEFAULT 'movie',
  title         TEXT        NOT NULL DEFAULT '',
  release_year  INTEGER,
  poster_url    TEXT,
  provider_short_names TEXT[] NOT NULL DEFAULT '{}',
  last_checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tmdb_id, media_type)
);

-- Opt-in flag stored alongside the existing profile row.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS streaming_notifications BOOLEAN NOT NULL DEFAULT FALSE;
