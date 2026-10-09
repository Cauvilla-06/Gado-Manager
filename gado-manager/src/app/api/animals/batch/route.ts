import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAnimalsBatch } from "@/services/animal-service";
import { getCurrentFarm } from "@/lib/farm";
import { apiHandler, NotFoundError, ForbiddenError } from "@/lib/api-errors";
import { userCanWriteToFarm } from "@/lib/ownership";

const batchSchema = z.object({
  numeros: z.array(z.string().min(1).max(50)).min(1).max(1000),
});

/**
 * POST /api/animals/batch
 * Cria vários animais de uma vez (bot de cadastro).
 * Body: { numeros: ["003", "004", ...] }
 */
export const POST = apiHandler(async (request: NextRequest) => {
  const { user, farm } = await getCurrentFarm();
  if (!farm || !user) {
    throw new NotFoundError("Nenhuma fazenda encontrada");
  }

  const canWrite = await userCanWriteToFarm(user.id, farm.id);
  if (!canWrite) {
    throw new ForbiddenError("Seu nível de acesso não permite cadastrar animais");
  }

  const body = batchSchema.parse(await request.json());
  const result = await createAnimalsBatch(body.numeros, farm.id);

  return NextResponse.json(result, { status: 201 });
});
