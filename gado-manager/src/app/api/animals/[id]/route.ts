import { NextRequest, NextResponse } from "next/server";
import { getAnimalById, deleteAnimal } from "@/services/animal-service";
import { getCurrentFarm } from "@/lib/farm";
import { apiHandler, NotFoundError, ForbiddenError } from "@/lib/api-errors";
import { animalBelongsToFarm, userCanWriteToFarm } from "@/lib/ownership";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export const GET = apiHandler<RouteContext>(async (request: NextRequest, context) => {
  const { farm } = await getCurrentFarm();
  if (!farm) {
    throw new NotFoundError("Nenhuma fazenda encontrada");
  }

  const { id } = await context.params;

  const animal = await getAnimalById(id, farm.id);
  if (!animal) {
    throw new NotFoundError("Animal");
  }

  return NextResponse.json(animal);
});

export const DELETE = apiHandler<RouteContext>(async (request: NextRequest, context) => {
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
    throw new ForbiddenError("Seu nível de acesso não permite excluir animais");
  }

  await deleteAnimal(id, farm.id);
  return NextResponse.json({ ok: true, id });
});
