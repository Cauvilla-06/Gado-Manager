import { NextRequest, NextResponse } from "next/server";
import { requireFarm } from "@/lib/farm";
import {
  createVitamin,
  getVitaminsByAnimal,
} from "@/services/vitamin-service";
import { apiHandler, ForbiddenError } from "@/lib/api-errors";
import { animalBelongsToFarm, canRecord } from "@/lib/ownership";

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

  const { searchParams } = new URL(request.url);
  const cicloId = searchParams.get("cicloId") || undefined;
  const vitamins = await getVitaminsByAnimal(id, cicloId);
  return NextResponse.json(vitamins);
});

export const POST = apiHandler<RouteContext>(async (request: NextRequest, context) => {
  const { id } = await context.params;
  const body = await request.json();
  const { user, farm, membership } = await requireFarm();

  // Ownership validation
  const belongs = await animalBelongsToFarm(id, farm.id);
  if (!belongs) {
    throw new ForbiddenError("Este animal não pertence a esta fazenda");
  }

  // OWNER, ADMIN e MEMBER podem lançar registros de manejo
  const allowed = canRecord(membership.role);
  if (!allowed) {
    throw new ForbiddenError("Seu nível de acesso não permite registrar vitaminas");
  }

  const record = await createVitamin({
    ...body,
    animalId: id,
    criadoPorId: user.id,
  });
  return NextResponse.json(record, { status: 201 });
});
