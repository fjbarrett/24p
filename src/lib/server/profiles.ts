import "server-only";

import { cache } from "react";
import type { PublicProfile, UserProfile } from "@/lib/profile-store";
import { getPool, isUniqueViolation } from "@/lib/server/db";
import { publicError } from "@/lib/server/http";

type ProfileRow = {
  user_email: string;
  username: string;
  is_public: boolean;
  created_at: string;
};

function mapProfile(row: ProfileRow): UserProfile {
  return {
    userEmail: row.user_email.trim().toLowerCase(),
    username: row.username,
    isPublic: row.is_public,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

// Public projection: never includes the owner's email. Used by the
// unauthenticated /api/profiles/public/[username] surface and the public
// profile pages so an anonymous caller can never resolve a username -> email.
function mapPublicProfile(row: ProfileRow): PublicProfile {
  return {
    username: row.username,
    isPublic: row.is_public,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function normalizeUsername(raw: string) {
  const value = raw.trim().toLowerCase();
  if (value.length < 3) {
    publicError("username must be at least 3 characters", 400);
  }
  if (!/^[a-z0-9]+$/.test(value)) {
    publicError("username must be alphanumeric only", 400);
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
    publicError("Username is already taken", 409);
  }

  try {
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
  } catch (error) {
    // The pre-check above is racy: two concurrent claims of the same free
    // username both pass it, and the loser hits the UNIQUE(username) index.
    if (isUniqueViolation(error)) publicError("Username is already taken", 409);
    throw error;
  }
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
    publicError("Profile not found", 404);
  }
  return mapProfile(result.rows[0]);
}

// Memoized per request: public profile + list pages resolve the same username
// in both generateMetadata and the page body.
export const getPublicProfileByUsername = cache(async (username: string) => {
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
  return result.rows[0] ? mapPublicProfile(result.rows[0]) : null;
});
