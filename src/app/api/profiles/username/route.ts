import { NextResponse } from "next/server";
import { setUsernameForUser } from "@/lib/server/profiles";
import { errorResponse, readJsonObject, routeError } from "@/lib/server/http";
import { consumeDurable } from "@/lib/server/rate-limit";
import { getBrowserSessionUserEmail } from "@/lib/server/session";

// The username is the account's public handle: changing it rewrites every
// /<username> URL the owner has shared. That is an account-settings action, so
// it requires the browser session and not the long-lived Apple TV bearer.
export async function POST(request: Request) {
  const userEmail = await getBrowserSessionUserEmail();
  if (!userEmail) {
    return errorResponse("Unauthorized", 401);
  }

  try {
    // Each attempt probes whether a username is taken, so cap it per account the
    // way share creation does — otherwise this is a free enumeration oracle.
    const limit = await consumeDurable(`profile-username:${userEmail}`, 30, 60 * 60 * 1000);
    if (!limit.ok) {
      return NextResponse.json(
        { error: "Too many username changes. Try again later." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
      );
    }
    const payload = (await readJsonObject(request)) as { username?: string };
    const profile = await setUsernameForUser(userEmail, payload.username ?? "");
    return NextResponse.json({ profile });
  } catch (error) {
    return routeError("api/profiles/username:post", error, "Unable to update username");
  }
}
