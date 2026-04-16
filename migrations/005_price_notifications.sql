-- Price drop notifications via CheapCharts
-- Run once against production and dev databases.

-- Add imdb_id to streaming_snapshots so the price job can reuse cached metadata.
ALTER TABLE streaming_snapshots ADD COLUMN IF NOT EXISTS imdb_id TEXT;

-- Per-title price snapshot: tracks the last-known iTunes buy price for every
-- movie in any list. A price drop triggers a notification to opted-in users.
-- TV seasons are not supported by the CheapCharts Prices API.
CREATE TABLE IF NOT EXISTS price_snapshots (
  imdb_id         TEXT        NOT NULL,
  tmdb_id         INTEGER,
  title           TEXT        NOT NULL DEFAULT '',
  poster_url      TEXT,
  buy_price_usd   NUMERIC,
  last_checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (imdb_id)
);

-- Opt-in flag for price drop notifications.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS price_notifications BOOLEAN NOT NULL DEFAULT FALSE;
