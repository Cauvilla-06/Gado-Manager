import { NextRequest, NextResponse } from "next/server";
import { sellAnimal } from "@/services/cycle-service";
import { apiHandler, NotFoundError, ForbiddenError } from "@/lib/api-errors";
import { getCurrentFarm } from "@/lib/farm";
import { animalBelongsToFarm, userCanWriteToFarm } from "@/lib/ownership";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export const POST = apiHandler<RouteContext>(async (request: NextRequest, context) => {
  const { id } = await context.params;
  const { user, farm } = await getCurrentFarm();
  if (!farm || !user) {
    throw new NotFoundError("Nenhuma fazenda encontrada");
  }

  // Ownership validation
  const belongs = await animalBelongsToFarm(id, farm.id);
  if (!belongs) {
    throw new ForbiddenError("Este animal não pertence a esta fazenda");
  }

  // Role validation: MEMBER é somente leitura
  const canWrite = await userCanWriteToFarm(user.id, farm.id);
  if (!canWrite) {
    throw new ForbiddenError("Seu nível de acesso não permite vender animais");
  }

  const result = await sellAnimal(id);
  return NextResponse.json(result);
});
