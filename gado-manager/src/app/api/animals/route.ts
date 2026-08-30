import { NextRequest, NextResponse } from "next/server";
import { getAllAnimals, createAnimal, searchAnimals } from "@/services/animal-service";
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
    animals = await searchAnimals(query, farm.id, { status });
  } else {
    animals = await getAllAnimals(farm.id, status);
  }

  return NextResponse.json(animals);
});

export const POST = apiHandler(async (request: NextRequest) => {
  const { farm } = await getCurrentFarm();
  if (!farm) {
    throw new NotFoundError("Nenhuma fazenda encontrada");
  }

  const body = await request.json();
  const result = await createAnimal(body, farm.id);
  return NextResponse.json(result, { status: 201 });
});
