import { NextRequest, NextResponse } from "next/server";
import { getAnimalById } from "@/services/animal-service";
import { getCurrentFarm } from "@/lib/farm";
import { apiHandler, NotFoundError } from "@/lib/api-errors";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export const GET = apiHandler<RouteContext>(async (request: NextRequest, context) => {
  const { farm } = await getCurrentFarm();
  const { id } = await context.params;

  const animal = await getAnimalById(id, farm?.id);
  if (!animal) {
    throw new NotFoundError("Animal");
  }

  return NextResponse.json(animal);
});
