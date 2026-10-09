import { NextRequest, NextResponse } from "next/server";
import { getIndividualReport } from "@/services/report-service";
import { apiHandler, NotFoundError, ForbiddenError } from "@/lib/api-errors";
import { getCurrentFarm } from "@/lib/farm";
import { animalBelongsToFarm } from "@/lib/ownership";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export const GET = apiHandler<RouteContext>(async (request: NextRequest, context) => {
  const { id } = await context.params;
  const { farm } = await getCurrentFarm();
  if (!farm) {
    throw new NotFoundError("Nenhuma fazenda encontrada");
  }

  // IDOR: animal precisa pertencer à fazenda do usuário
  const belongs = await animalBelongsToFarm(id, farm.id);
  if (!belongs) {
    throw new ForbiddenError("Este animal não pertence a esta fazenda");
  }

  const { searchParams } = new URL(request.url);
  const cicloId = searchParams.get("cicloId") || undefined;
  const report = await getIndividualReport(id, cicloId);
  return NextResponse.json(report);
});
