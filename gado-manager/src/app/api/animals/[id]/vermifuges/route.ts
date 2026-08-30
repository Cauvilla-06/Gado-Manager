import { NextRequest, NextResponse } from "next/server";
import { getCurrentFarm } from "@/lib/farm";
import {
  createVermifuge,
  getVermifugesByAnimal,
} from "@/services/vermifuge-service";
import { apiHandler, ForbiddenError } from "@/lib/api-errors";
import { animalBelongsToFarm } from "@/lib/ownership";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export const GET = apiHandler<RouteContext>(async (request: NextRequest, context) => {
  const { id } = await context.params;
  const { searchParams } = new URL(request.url);
  const cicloId = searchParams.get("cicloId") || undefined;
  const vermifuges = await getVermifugesByAnimal(id, cicloId);
  return NextResponse.json(vermifuges);
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

  const record = await createVermifuge({
    ...body,
    animalId: id,
    criadoPorId: user?.id,
  });
  return NextResponse.json(record, { status: 201 });
});
