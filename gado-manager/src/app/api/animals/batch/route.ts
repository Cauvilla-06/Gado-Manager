import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAnimalsBatch } from "@/services/animal-service";
import { requireFarm } from "@/lib/farm";
import { apiHandler, ForbiddenError } from "@/lib/api-errors";
import { canManageHerd } from "@/lib/ownership";

const batchSchema = z.object({
  numeros: z.array(z.string().min(1).max(50)).min(1).max(1000),
});

/**
 * POST /api/animals/batch
 * Cria vários animais de uma vez (bot de cadastro).
 * Body: { numeros: ["003", "004", ...] }
 */
export const POST = apiHandler(async (request: NextRequest) => {
  const { farm, membership } = await requireFarm();

  const canWrite = canManageHerd(membership.role);
  if (!canWrite) {
    throw new ForbiddenError("Seu nível de acesso não permite cadastrar animais");
  }

  const body = batchSchema.parse(await request.json());
  const result = await createAnimalsBatch(body.numeros, farm.id);

  return NextResponse.json(result, { status: 201 });
});
