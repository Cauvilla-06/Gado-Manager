import { NextRequest, NextResponse } from "next/server";
import { sellAnimal } from "@/services/cycle-service";
import { apiHandler, ForbiddenError } from "@/lib/api-errors";
import { requireFarm } from "@/lib/farm";
import { animalBelongsToFarm, canManageHerd } from "@/lib/ownership";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export const POST = apiHandler<RouteContext>(async (request: NextRequest, context) => {
  const { id } = await context.params;
  const { farm, membership } = await requireFarm();

  // Ownership validation
  const belongs = await animalBelongsToFarm(id, farm.id);
  if (!belongs) {
    throw new ForbiddenError("Este animal não pertence a esta fazenda");
  }

  // Role validation: MEMBER é somente leitura
  const canWrite = canManageHerd(membership.role);
  if (!canWrite) {
    throw new ForbiddenError("Seu nível de acesso não permite vender animais");
  }

  const result = await sellAnimal(id);
  return NextResponse.json(result);
});
