import { NextResponse } from "next/server";
import {
  connectCheapChartsForUser,
  disconnectCheapChartsForUser,
} from "@/lib/server/cheapcharts";
import { errorResponse, readJsonObject, routeError } from "@/lib/server/http";
import { getBrowserSessionUserEmail } from "@/lib/server/session";

export async function PUT(request: Request) {
  const userEmail = await getBrowserSessionUserEmail();
  if (!userEmail) return errorResponse("Unauthorized", 401);

  try {
    const payload = await readJsonObject<{ sessionToken?: unknown; country?: unknown }>(request);
    await connectCheapChartsForUser(userEmail, payload.sessionToken, payload.country);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return routeError("api/integrations/cheapcharts:put", error, "Unable to connect CheapCharts");
  }
}

export async function DELETE() {
  const userEmail = await getBrowserSessionUserEmail();
  if (!userEmail) return errorResponse("Unauthorized", 401);

  try {
    await disconnectCheapChartsForUser(userEmail);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return routeError("api/integrations/cheapcharts:delete", error, "Unable to disconnect CheapCharts");
  }
}
