import { NextResponse } from "next/server";
import {
  getCheapChartsIntegrationForList,
  linkCheapChartsList,
  unlinkCheapChartsList,
} from "@/lib/server/cheapcharts";
import { errorResponse, readJsonObject, routeError } from "@/lib/server/http";
import { getBrowserSessionUserEmail } from "@/lib/server/session";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const userEmail = await getBrowserSessionUserEmail();
  if (!userEmail) return errorResponse("Unauthorized", 401);

  try {
    const { id } = await context.params;
    const integration = await getCheapChartsIntegrationForList(id, userEmail);
    return NextResponse.json({ integration });
  } catch (error) {
    return routeError("api/lists/cheapcharts:get", error, "Unable to load CheapCharts settings");
  }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const userEmail = await getBrowserSessionUserEmail();
  if (!userEmail) return errorResponse("Unauthorized", 401);

  try {
    const { id } = await context.params;
    const payload = await readJsonObject<{ cheapChartsListId?: unknown }>(request);
    await linkCheapChartsList(id, userEmail, payload.cheapChartsListId);
    const integration = await getCheapChartsIntegrationForList(id, userEmail);
    return NextResponse.json({ integration });
  } catch (error) {
    return routeError("api/lists/cheapcharts:put", error, "Unable to link CheapCharts list");
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const userEmail = await getBrowserSessionUserEmail();
  if (!userEmail) return errorResponse("Unauthorized", 401);

  try {
    const { id } = await context.params;
    await unlinkCheapChartsList(id, userEmail);
    const integration = await getCheapChartsIntegrationForList(id, userEmail);
    return NextResponse.json({ integration });
  } catch (error) {
    return routeError("api/lists/cheapcharts:delete", error, "Unable to unlink CheapCharts list");
  }
}
