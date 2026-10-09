import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getAllAnimals,
  createAnimal,
  searchAnimals,
  deleteAnimalsBatch,
} from "@/services/animal-service";
import { requireFarm } from "@/lib/farm";
import { animalStatusFilterSchema } from "@/lib/validations";
import { apiHandler, ForbiddenError } from "@/lib/api-errors";
import { userCanWriteToFarm } from "@/lib/ownership";

const batchDeleteSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(1000),
});

export const GET = apiHandler(async (request: NextRequest) => {
  const { farm } = await requireFarm();

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");
  const status = animalStatusFilterSchema.parse(searchParams.get("status") || undefined);

  let animals;
  if (query) {
    animals = await searchAnimals(query, farm.id, { status });
  } else {
    animals = await getAllAnimals(farm.id, status);
  }

  return NextResponse.json(animals);
});

export const POST = apiHandler(async (request: NextRequest) => {
  const { user, farm } = await requireFarm();

  // Role validation: MEMBER é somente leitura
  const canWrite = await userCanWriteToFarm(user.id, farm.id);
  if (!canWrite) {
    throw new ForbiddenError("Seu nível de acesso não permite cadastrar animais");
  }

  const body = await request.json();
  const result = await createAnimal(body, farm.id);
  return NextResponse.json(result, { status: 201 });
});

/**
 * DELETE /api/animals
 * Exclui vários animais de uma vez (bot de exclusão).
 * Body: { ids: ["uuid1", "uuid2", ...] }
 */
export const DELETE = apiHandler(async (request: NextRequest) => {
  const { user, farm } = await requireFarm();

  const canWrite = await userCanWriteToFarm(user.id, farm.id);
  if (!canWrite) {
    throw new ForbiddenError("Seu nível de acesso não permite excluir animais");
  }

  const body = batchDeleteSchema.parse(await request.json());
  const result = await deleteAnimalsBatch(body.ids, farm.id);

  return NextResponse.json(result);
});
