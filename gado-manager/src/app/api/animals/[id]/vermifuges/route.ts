import { NextRequest, NextResponse } from "next/server";
import { getCurrentFarm } from "@/lib/farm";
import {
  createVermifuge,
  getVermifugesByAnimal,
} from "@/services/vermifuge-service";
import { apiHandler, ForbiddenError, NotFoundError } from "@/lib/api-errors";
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

  const { searchParams } = new URL(request.url);
  const cicloId = searchParams.get("cicloId") || undefined;
  const vermifuges = await getVermifugesByAnimal(id, cicloId);
  return NextResponse.json(vermifuges);
});

export const POST = apiHandler<RouteContext>(async (request: NextRequest, context) => {
  const { id } = await context.params;
  const body = await request.json();
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
    throw new ForbiddenError("Seu nível de acesso não permite registrar vermífugos");
  }

  const record = await createVermifuge({
    ...body,
    animalId: id,
    criadoPorId: user.id,
  });
  return NextResponse.json(record, { status: 201 });
});
