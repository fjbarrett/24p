import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import {
  CHEAPCHARTS_API_BASE,
  CHEAPCHARTS_COUNTRIES,
  parseCheapChartsCustomLists,
  selectCheapChartsMovie,
  type CheapChartsCountry,
  type CheapChartsListIntegration,
  type CheapChartsSearchItem,
} from "@/lib/cheapcharts";
import { getPool } from "@/lib/server/db";
import { publicError } from "@/lib/server/http";
import { fetchTmdbMovie } from "@/lib/server/tmdb";

type CheapChartsAccountRow = {
  session_token_ciphertext: string;
  country: string;
};

type CheapChartsLinkRow = {
  cheapcharts_list_id: string;
  cheapcharts_list_name: string;
  last_synced_at: string | null;
  last_sync_error: string | null;
};

type CheapChartsSyncRow = CheapChartsAccountRow & CheapChartsLinkRow;

class CheapChartsUpstreamError extends Error {
  constructor(message = "CheapCharts request failed") {
    super(message);
    this.name = "CheapChartsUpstreamError";
  }
}

const COUNTRY_CODES = new Set<string>(CHEAPCHARTS_COUNTRIES.map((country) => country.value));
const MAX_SESSION_TOKEN_LENGTH = 2_048;

function normalizeCountry(value: unknown): CheapChartsCountry {
  const country = typeof value === "string" ? value.trim().toLowerCase() : "us";
  if (!COUNTRY_CODES.has(country)) publicError("Unsupported CheapCharts country", 400);
  return country as CheapChartsCountry;
}

function normalizeSessionToken(value: unknown) {
  const token = typeof value === "string" ? value.trim() : "";
  if (token.length < 8 || token.length > MAX_SESSION_TOKEN_LENGTH || /[\r\n]/.test(token)) {
    publicError("A valid CheapCharts session token is required", 400);
  }
  return token;
}

function encryptionKey() {
  const secret = process.env.NEXTAUTH_SECRET?.trim();
  if (!secret) throw new Error("NEXTAUTH_SECRET is required to protect CheapCharts sessions");
  return createHash("sha256").update(`24p:cheapcharts:v1:${secret}`).digest();
}

function encryptSessionToken(token: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(".");
}

function decryptSessionToken(value: string) {
  const [version, ivValue, tagValue, ciphertextValue] = value.split(".");
  if (version !== "v1" || !ivValue || !tagValue || !ciphertextValue) {
    throw new Error("Stored CheapCharts session is invalid");
  }
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

async function cheapChartsRequest(
  endpoint: "CustomList.php" | "SearchForItems.php",
  query: Record<string, string>,
  sessionToken?: string,
) {
  const url = new URL(`${CHEAPCHARTS_API_BASE}/${endpoint}`);
  Object.entries(query).forEach(([key, value]) => url.searchParams.set(key, value));
  const response = await fetch(url, {
    method: sessionToken ? "POST" : "GET",
    headers: sessionToken
      ? { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "24p/1.0" }
      : { Accept: "application/json", "User-Agent": "24p/1.0" },
    body: sessionToken ? new URLSearchParams({ sessionToken }) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new CheapChartsUpstreamError();
  const payload = (await response.json()) as { status?: unknown; message?: unknown };
  if (payload.status === "error") {
    const message = typeof payload.message === "string" ? payload.message : "CheapCharts rejected the request";
    throw new CheapChartsUpstreamError(message.slice(0, 240));
  }
  return payload;
}

async function loadCustomLists(sessionToken: string, country: CheapChartsCountry) {
  const payload = await cheapChartsRequest(
    "CustomList.php",
    {
      action: "getCustomLists",
      country,
      store: "itunes",
      mediaType: "movies",
      origin: "website",
    },
    sessionToken,
  );
  return parseCheapChartsCustomLists(payload);
}

async function requireOwnedList(listId: string, userEmail: string) {
  const result = await getPool().query("SELECT 1 FROM lists WHERE id = $1 AND user_email = $2", [listId, userEmail]);
  if (result.rowCount === 0) publicError("List not found", 404);
}

async function getAccount(userEmail: string) {
  const result = await getPool().query<CheapChartsAccountRow>(
    "SELECT session_token_ciphertext, country FROM cheapcharts_accounts WHERE user_email = $1",
    [userEmail],
  );
  return result.rows[0] ?? null;
}

export async function connectCheapChartsForUser(userEmail: string, rawSessionToken: unknown, rawCountry: unknown) {
  const sessionToken = normalizeSessionToken(rawSessionToken);
  const country = normalizeCountry(rawCountry);
  try {
    await loadCustomLists(sessionToken, country);
  } catch (error) {
    if (error instanceof CheapChartsUpstreamError) {
      publicError("CheapCharts sign-in could not be verified", 400);
    }
    throw error;
  }

  await getPool().query(
    `INSERT INTO cheapcharts_accounts (user_email, session_token_ciphertext, country, connected_at, updated_at)
     VALUES ($1, $2, $3, NOW(), NOW())
     ON CONFLICT (user_email)
     DO UPDATE SET session_token_ciphertext = EXCLUDED.session_token_ciphertext,
                   country = EXCLUDED.country,
                   connected_at = NOW(),
                   updated_at = NOW()`,
    [userEmail, encryptSessionToken(sessionToken), country],
  );
}

export async function disconnectCheapChartsForUser(userEmail: string) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM cheapcharts_list_links WHERE user_email = $1", [userEmail]);
    await client.query("DELETE FROM cheapcharts_accounts WHERE user_email = $1", [userEmail]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getCheapChartsIntegrationForList(
  listId: string,
  userEmail: string,
): Promise<CheapChartsListIntegration> {
  await requireOwnedList(listId, userEmail);
  const account = await getAccount(userEmail);
  const country = normalizeCountry(account?.country ?? "us");
  const linkResult = await getPool().query<CheapChartsLinkRow>(
    `SELECT cheapcharts_list_id, cheapcharts_list_name, last_synced_at, last_sync_error
     FROM cheapcharts_list_links
     WHERE list_id = $1 AND user_email = $2`,
    [listId, userEmail],
  );
  const row = linkResult.rows[0];
  const link = row
    ? {
        id: row.cheapcharts_list_id,
        title: row.cheapcharts_list_name,
        lastSyncedAt: row.last_synced_at ? new Date(row.last_synced_at).toISOString() : null,
        lastSyncError: row.last_sync_error,
      }
    : null;

  if (!account) {
    return { connected: false, country, availableLists: [], link: null, loadError: null };
  }

  try {
    const availableLists = await loadCustomLists(decryptSessionToken(account.session_token_ciphertext), country);
    return { connected: true, country, availableLists, link, loadError: null };
  } catch (error) {
    console.error(`[cheapcharts] unable to load lists for ${userEmail}`, error instanceof Error ? error.message : error);
    return {
      connected: true,
      country,
      availableLists: [],
      link,
      loadError: "Unable to load CheapCharts lists. Reconnect your account if this continues.",
    };
  }
}

export async function linkCheapChartsList(listId: string, userEmail: string, rawCheapChartsListId: unknown) {
  await requireOwnedList(listId, userEmail);
  const cheapChartsListId = typeof rawCheapChartsListId === "string" ? rawCheapChartsListId.trim() : "";
  if (!cheapChartsListId || cheapChartsListId.length > 200) publicError("Select a CheapCharts list", 400);
  const account = await getAccount(userEmail);
  if (!account) publicError("Connect CheapCharts first", 409);
  const country = normalizeCountry(account.country);

  let availableLists;
  try {
    availableLists = await loadCustomLists(decryptSessionToken(account.session_token_ciphertext), country);
  } catch (error) {
    if (error instanceof CheapChartsUpstreamError) publicError("Unable to verify that CheapCharts list", 502);
    throw error;
  }
  const target = availableLists.find((list) => list.id === cheapChartsListId);
  if (!target) publicError("CheapCharts list not found", 404);

  await getPool().query(
    `INSERT INTO cheapcharts_list_links
       (list_id, user_email, cheapcharts_list_id, cheapcharts_list_name, country, store, media_type, updated_at)
     VALUES ($1, $2, $3, $4, $5, 'itunes', 'movies', NOW())
     ON CONFLICT (list_id)
     DO UPDATE SET user_email = EXCLUDED.user_email,
                   cheapcharts_list_id = EXCLUDED.cheapcharts_list_id,
                   cheapcharts_list_name = EXCLUDED.cheapcharts_list_name,
                   country = EXCLUDED.country,
                   store = EXCLUDED.store,
                   media_type = EXCLUDED.media_type,
                   last_sync_error = NULL,
                   updated_at = NOW()`,
    [listId, userEmail, target.id, target.title, country],
  );
}

export async function unlinkCheapChartsList(listId: string, userEmail: string) {
  await requireOwnedList(listId, userEmail);
  await getPool().query("DELETE FROM cheapcharts_list_links WHERE list_id = $1 AND user_email = $2", [listId, userEmail]);
}

function flattenSearchItems(payload: unknown) {
  const items: CheapChartsSearchItem[] = [];
  const queue: unknown[] = [payload];
  let visited = 0;
  while (queue.length > 0 && visited < 5_000) {
    const value = queue.shift();
    visited += 1;
    if (Array.isArray(value)) {
      queue.push(...value);
      continue;
    }
    if (typeof value !== "object" || value === null) continue;
    const record = value as Record<string, unknown>;
    if (record.idInStore !== undefined && typeof record.title === "string") {
      items.push(record as CheapChartsSearchItem);
    }
    queue.push(...Object.values(record));
  }
  return items;
}

async function findCheapChartsMovie(country: CheapChartsCountry, tmdbId: number) {
  const movie = await fetchTmdbMovie(tmdbId, true);
  const payload = await cheapChartsRequest("SearchForItems.php", {
    action: "search2",
    store: "itunes",
    country,
    itemType: "all",
    searchTerm: movie.title,
    offset: "0",
    limit: "100",
  });
  return selectCheapChartsMovie(flattenSearchItems(payload), movie);
}

function syncErrorMessage(error: unknown) {
  if (error instanceof CheapChartsUpstreamError) return "CheapCharts rejected the sync. Reconnect the account and try again.";
  if (error instanceof Error && /match/i.test(error.message)) return error.message.slice(0, 300);
  return "CheapCharts sync failed. Try adding the film again after reconnecting.";
}

export async function syncMovieAdditionToCheapCharts(listId: string, tmdbId: number) {
  try {
    const result = await getPool().query<CheapChartsSyncRow>(
      `SELECT a.session_token_ciphertext,
              link.country,
              link.cheapcharts_list_id,
              link.cheapcharts_list_name,
              link.last_synced_at,
              link.last_sync_error
       FROM cheapcharts_list_links link
       JOIN cheapcharts_accounts a ON a.user_email = link.user_email
       JOIN lists ON lists.id = link.list_id AND lists.user_email = link.user_email
       WHERE link.list_id = $1 AND link.media_type = 'movies'`,
      [listId],
    );
    const link = result.rows[0];
    if (!link) return;

    const country = normalizeCountry(link.country);
    const item = await findCheapChartsMovie(country, tmdbId);
    if (!item?.idInStore) throw new Error("No exact CheapCharts match was found for this film.");
    await cheapChartsRequest(
      "CustomList.php",
      {
        action: "addItemToLists",
        country,
        store: "itunes",
        mediaType: "movies",
        itemId: String(item.idInStore),
        itemType: "movie",
        listIds: link.cheapcharts_list_id,
        origin: "website",
      },
      decryptSessionToken(link.session_token_ciphertext),
    );
    await getPool().query(
      "UPDATE cheapcharts_list_links SET last_synced_at = NOW(), last_sync_error = NULL, updated_at = NOW() WHERE list_id = $1",
      [listId],
    );
  } catch (error) {
    const message = syncErrorMessage(error);
    console.error(`[cheapcharts] sync failed for list ${listId}: ${message}`);
    try {
      await getPool().query(
        "UPDATE cheapcharts_list_links SET last_sync_error = $2, updated_at = NOW() WHERE list_id = $1",
        [listId, message],
      );
    } catch (recordError) {
      // The 24p list insert has already committed. Even a second database
      // failure while recording diagnostics must not turn that successful
      // canonical mutation into an API error that invites a misleading retry.
      console.error(
        `[cheapcharts] unable to record sync failure for list ${listId}`,
        recordError instanceof Error ? recordError.message : recordError,
      );
    }
  }
}
