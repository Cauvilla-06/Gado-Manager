import { NextRequest, NextResponse } from "next/server";
import { getCyclesByAnimal, startNewCycle } from "@/services/cycle-service";
import { apiHandler, NotFoundError, ForbiddenError } from "@/lib/api-errors";
import { getCurrentFarm } from "@/lib/farm";
import { animalBelongsToFarm, userCanWriteToFarm } from "@/lib/ownership";

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

  const cycles = await getCyclesByAnimal(id);
  return NextResponse.json(cycles);
});

export const POST = apiHandler<RouteContext>(async (request: NextRequest, context) => {
  const { id } = await context.params;
  const body = await request.json();
  const { user, farm } = await getCurrentFarm();
  if (!farm || !user) {
    throw new NotFoundError("Nenhuma fazenda encontrada");
  }

  const belongs = await animalBelongsToFarm(id, farm.id);
  if (!belongs) {
    throw new ForbiddenError("Este animal não pertence a esta fazenda");
  }

  const canWrite = await userCanWriteToFarm(user.id, farm.id);
  if (!canWrite) {
    throw new ForbiddenError("Seu nível de acesso não permite iniciar ciclos");
  }

  const cycle = await startNewCycle(id, body.observacoes);
  return NextResponse.json(cycle, { status: 201 });
});
