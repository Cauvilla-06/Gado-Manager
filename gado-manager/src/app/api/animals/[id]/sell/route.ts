import { NextRequest, NextResponse } from "next/server";
import { sellAnimal } from "@/services/cycle-service";
import { apiHandler, ForbiddenError } from "@/lib/api-errors";
import { getCurrentFarm } from "@/lib/farm";
import { animalBelongsToFarm } from "@/lib/ownership";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export const POST = apiHandler<RouteContext>(async (request: NextRequest, context) => {
  const { id } = await context.params;
  const { farm } = await getCurrentFarm();

  // Ownership validation
  if (farm) {
    const belongs = await animalBelongsToFarm(id, farm.id);
    if (!belongs) {
      throw new ForbiddenError("Este animal não pertence a esta fazenda");
    }
  }

  const result = await sellAnimal(id);
  return NextResponse.json(result);
});
