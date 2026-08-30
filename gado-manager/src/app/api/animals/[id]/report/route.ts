import { NextRequest, NextResponse } from "next/server";
import { getIndividualReport } from "@/services/report-service";
import { apiHandler } from "@/lib/api-errors";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export const GET = apiHandler<RouteContext>(async (request: NextRequest, context) => {
  const { id } = await context.params;
  const { searchParams } = new URL(request.url);
  const cicloId = searchParams.get("cicloId") || undefined;
  const report = await getIndividualReport(id, cicloId);
  return NextResponse.json(report);
});
