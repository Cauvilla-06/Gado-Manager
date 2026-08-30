import { NextRequest, NextResponse } from "next/server";
import { getAllAnimalsSummary } from "@/services/animal-service";
import { getCurrentFarm } from "@/lib/farm";
import { apiHandler, NotFoundError } from "@/lib/api-errors";

export const GET = apiHandler(async (request: NextRequest) => {
  const { farm } = await getCurrentFarm();
  if (!farm) {
    throw new NotFoundError("Nenhuma fazenda encontrada");
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");
  const status = searchParams.get("status") || undefined;

  let animals;
  if (query) {
    const { searchAnimalsSummary } = await import("@/services/animal-service");
    animals = await searchAnimalsSummary(query, farm.id, { status });
  } else {
    animals = await getAllAnimalsSummary(farm.id, status);
  }

  return NextResponse.json(animals);
});
