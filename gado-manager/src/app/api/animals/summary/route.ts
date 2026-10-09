import { NextRequest, NextResponse } from "next/server";
import { getAllAnimalsSummary } from "@/services/animal-service";
import { requireFarm } from "@/lib/farm";
import { animalStatusFilterSchema } from "@/lib/validations";
import { apiHandler } from "@/lib/api-errors";

export const GET = apiHandler(async (request: NextRequest) => {
  const { farm } = await requireFarm();

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");
  const status = animalStatusFilterSchema.parse(searchParams.get("status") || undefined);

  let animals;
  if (query) {
    const { searchAnimalsSummary } = await import("@/services/animal-service");
    animals = await searchAnimalsSummary(query, farm.id, { status });
  } else {
    animals = await getAllAnimalsSummary(farm.id, status);
  }

  return NextResponse.json(animals);
});
