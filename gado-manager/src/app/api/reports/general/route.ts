import { NextRequest, NextResponse } from "next/server";
import { getGeneralReport } from "@/services/report-service";
import { requireFarm } from "@/lib/farm";
import { apiHandler } from "@/lib/api-errors";
import { animalStatusFilterSchema } from "@/lib/validations";

export const GET = apiHandler(async (request: NextRequest) => {
  const { farm } = await requireFarm();

  const { searchParams } = new URL(request.url);
  const status = animalStatusFilterSchema.parse(searchParams.get("status") || undefined);
  const periodParam = searchParams.get("periodDays");
  const periodDays = periodParam ? parseInt(periodParam, 10) : undefined;

  const report = await getGeneralReport(farm.id, {
    status,
    periodDays: Number.isFinite(periodDays) ? periodDays : undefined,
  });
  return NextResponse.json(report);
});
