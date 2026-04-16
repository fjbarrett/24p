import "server-only";

import type { UserProfile } from "@/lib/profile-store";
import { getPool } from "@/lib/server/db";

type ProfileRow = {
  user_email: string;
  username: string;
  is_public: boolean;
  streaming_notifications: boolean;
  price_notifications: boolean;
  created_at: string;
};

function mapProfile(row: ProfileRow): UserProfile {
  return {
    userEmail: row.user_email.trim().toLowerCase(),
    username: row.username,
    isPublic: row.is_public,
    streamingNotifications: row.streaming_notifications ?? false,
    priceNotifications: row.price_notifications ?? false,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function normalizeUsername(raw: string) {
  const value = raw.trim().toLowerCase();
  if (value.length < 3) {
    throw new Error("username must be at least 3 characters");
  }
  if (!/^[a-z0-9]+$/.test(value)) {
    throw new Error("username must be alphanumeric only");
  }
  return value;
}

export async function getProfileForUser(userEmail: string) {
  const pool = getPool();
  const result = await pool.query<ProfileRow>("SELECT * FROM profiles WHERE user_email = $1", [userEmail]);
  return result.rows[0] ? mapProfile(result.rows[0]) : null;
}

export async function setUsernameForUser(userEmail: string, username: string) {
  const pool = getPool();
  const normalized = normalizeUsername(username);
  const existing = await pool.query<{ user_email: string }>("SELECT user_email FROM profiles WHERE username = $1", [
    normalized,
  ]);
  const owner = existing.rows[0]?.user_email?.trim().toLowerCase();
  if (owner && owner !== userEmail) {
    throw new Error("Username is already taken");
  }

  const result = await pool.query<ProfileRow>(
    `
      INSERT INTO profiles (user_email, username)
      VALUES ($1, $2)
      ON CONFLICT (user_email)
      DO UPDATE SET username = EXCLUDED.username
      RETURNING *
    `,
    [userEmail, normalized],
  );
  return mapProfile(result.rows[0]);
}

export async function setStreamingNotificationsForUser(userEmail: string, enabled: boolean) {
  const pool = getPool();
  const result = await pool.query<ProfileRow>(
    `UPDATE profiles SET streaming_notifications = $1 WHERE user_email = $2 RETURNING *`,
    [enabled, userEmail],
  );
  if (!result.rows[0]) {
    throw new Error("Profile not found");
  }
  return mapProfile(result.rows[0]);
}

export async function setPriceNotificationsForUser(userEmail: string, enabled: boolean) {
  const pool = getPool();
  const result = await pool.query<ProfileRow>(
    `UPDATE profiles SET price_notifications = $1 WHERE user_email = $2 RETURNING *`,
    [enabled, userEmail],
  );
  if (!result.rows[0]) {
    throw new Error("Profile not found");
  }
  return mapProfile(result.rows[0]);
}

export async function setProfileVisibilityForUser(userEmail: string, isPublic: boolean) {
  const pool = getPool();
  const result = await pool.query<ProfileRow>(
    `
      UPDATE profiles
      SET is_public = $1
      WHERE user_email = $2
      RETURNING *
    `,
    [isPublic, userEmail],
  );
  if (!result.rows[0]) {
    throw new Error("Profile not found");
  }
  return mapProfile(result.rows[0]);
}

export async function getPublicProfileByUsername(username: string) {
  const pool = getPool();
  let normalized: string;
  try {
    normalized = normalizeUsername(username);
  } catch {
    return null;
  }
  const result = await pool.query<ProfileRow>(
    "SELECT * FROM profiles WHERE username = $1 AND is_public = true",
    [normalized],
  );
  return result.rows[0] ? mapProfile(result.rows[0]) : null;
}
