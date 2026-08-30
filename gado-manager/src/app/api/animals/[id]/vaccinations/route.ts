import { NextRequest, NextResponse } from "next/server";
import { getCurrentFarm } from "@/lib/farm";
import {
  createVaccination,
  getVaccinationsByAnimal,
} from "@/services/vaccination-service";
import { apiHandler, ForbiddenError } from "@/lib/api-errors";
import { animalBelongsToFarm } from "@/lib/ownership";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export const GET = apiHandler<RouteContext>(async (request: NextRequest, context) => {
  const { id } = await context.params;
  const { searchParams } = new URL(request.url);
  const cicloId = searchParams.get("cicloId") || undefined;
  const vaccinations = await getVaccinationsByAnimal(id, cicloId);
  return NextResponse.json(vaccinations);
});

export const POST = apiHandler<RouteContext>(async (request: NextRequest, context) => {
  const { id } = await context.params;
  const body = await request.json();
  const { user, farm } = await getCurrentFarm();

  // Ownership validation
  if (farm) {
    const belongs = await animalBelongsToFarm(id, farm.id);
    if (!belongs) {
      throw new ForbiddenError("Este animal não pertence a esta fazenda");
    }
  }

  const record = await createVaccination({
    ...body,
    animalId: id,
    criadoPorId: user?.id,
  });
  return NextResponse.json(record, { status: 201 });
});
