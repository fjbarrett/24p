import "server-only";

import { getPool } from "@/lib/server/db";

export type AdminOverview = {
  user_count: string;
  list_count: string;
  public_list_count: string;
  item_count: string;
  rating_count: string;
  favorite_count: string;
  share_count: string;
};

export type AdminUser = {
  username: string | null;
  user_email: string;
  is_public: boolean;
  created_at: string;
  list_count: string;
  rating_count: string;
};

export type AdminList = {
  title: string;
  slug: string;
  username: string | null;
  visibility: string;
  item_count: string;
  created_at: string;
};

export type AdminTopList = {
  title: string;
  slug: string;
  username: string | null;
  item_count: string;
  favorite_count: string;
};

export type AdminWeek = {
  signups: number;
  lists: number;
  ratings: number;
};

export async function getAdminStats() {
  const pool = getPool();

  const [overview, users, recentLists, topLists, week] = await Promise.all([
    pool.query<AdminOverview>(`
      SELECT
        (SELECT COUNT(*) FROM profiles)::text                                 AS user_count,
        (SELECT COUNT(*) FROM lists)::text                                    AS list_count,
        (SELECT COUNT(*) FROM lists WHERE visibility = 'public')::text        AS public_list_count,
        (SELECT COUNT(*) FROM list_items)::text                               AS item_count,
        (SELECT COUNT(*) FROM user_ratings)::text                             AS rating_count,
        (SELECT COUNT(*) FROM user_favorites)::text                           AS favorite_count,
        (SELECT COUNT(*) FROM list_shares)::text                              AS share_count
    `),

    pool.query<AdminUser>(`
      SELECT
        p.username,
        p.user_email,
        p.is_public,
        p.created_at,
        COUNT(DISTINCT l.id)::text       AS list_count,
        COUNT(DISTINCT ur.tmdb_id)::text AS rating_count
      FROM profiles p
      LEFT JOIN lists         l  ON l.user_email  = p.user_email
      LEFT JOIN user_ratings  ur ON ur.user_email = p.user_email
      GROUP BY p.username, p.user_email, p.is_public, p.created_at
      ORDER BY p.created_at DESC
    `),

    pool.query<AdminList>(`
      SELECT
        l.title,
        l.slug,
        p.username,
        l.visibility,
        l.created_at,
        (SELECT COUNT(*) FROM list_items li WHERE li.list_id = l.id)::text AS item_count
      FROM lists l
      LEFT JOIN profiles p ON p.user_email = l.user_email
      ORDER BY l.created_at DESC
      LIMIT 12
    `),

    pool.query<AdminTopList>(`
      SELECT
        l.title,
        l.slug,
        p.username,
        (SELECT COUNT(*) FROM list_items li WHERE li.list_id = l.id)::text AS item_count,
        COUNT(uf.list_id)::text AS favorite_count
      FROM lists l
      LEFT JOIN user_favorites uf ON uf.list_id = l.id
      LEFT JOIN profiles       p  ON p.user_email = l.user_email
      WHERE l.visibility = 'public'
      GROUP BY l.id, l.title, l.slug, p.username
      ORDER BY COUNT(uf.list_id) DESC, l.created_at DESC
      LIMIT 12
    `),

    Promise.all([
      pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM profiles WHERE created_at > NOW() - INTERVAL '7 days'`,
      ),
      pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM lists WHERE created_at > NOW() - INTERVAL '7 days'`,
      ),
      pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM user_ratings WHERE updated_at > NOW() - INTERVAL '7 days'`,
      ),
    ]).then(([signups, lists, ratings]) => ({
      signups: Number(signups.rows[0]?.count ?? 0),
      lists: Number(lists.rows[0]?.count ?? 0),
      ratings: Number(ratings.rows[0]?.count ?? 0),
    })),
  ]);

  return {
    overview: overview.rows[0],
    users: users.rows,
    recentLists: recentLists.rows,
    topLists: topLists.rows,
    week: week as AdminWeek,
  };
}
