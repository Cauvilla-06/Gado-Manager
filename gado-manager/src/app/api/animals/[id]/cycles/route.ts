import { NextRequest, NextResponse } from "next/server";
import { getCyclesByAnimal, startNewCycle } from "@/services/cycle-service";
import { apiHandler, ForbiddenError } from "@/lib/api-errors";
import { requireFarm } from "@/lib/farm";
import { animalBelongsToFarm, canManageHerd } from "@/lib/ownership";
import { cycleSchema } from "@/lib/validations";

const newCycleSchema = cycleSchema.pick({ observacoes: true });

interface RouteContext {
  params: Promise<{ id: string }>;
}

export const GET = apiHandler<RouteContext>(async (request: NextRequest, context) => {
  const { id } = await context.params;
  const { farm } = await requireFarm();

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
  const { farm, membership } = await requireFarm();

  const belongs = await animalBelongsToFarm(id, farm.id);
  if (!belongs) {
    throw new ForbiddenError("Este animal não pertence a esta fazenda");
  }

  const canWrite = canManageHerd(membership.role);
  if (!canWrite) {
    throw new ForbiddenError("Seu nível de acesso não permite iniciar ciclos");
  }

  const { observacoes } = newCycleSchema.parse(body ?? {});
  const cycle = await startNewCycle(id, observacoes || undefined);
  return NextResponse.json(cycle, { status: 201 });
});
