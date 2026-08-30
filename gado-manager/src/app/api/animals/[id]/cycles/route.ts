import { NextRequest, NextResponse } from "next/server";
import { getCyclesByAnimal, startNewCycle } from "@/services/cycle-service";
import { apiHandler } from "@/lib/api-errors";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export const GET = apiHandler<RouteContext>(async (request: NextRequest, context) => {
  const { id } = await context.params;
  const cycles = await getCyclesByAnimal(id);
  return NextResponse.json(cycles);
});

export const POST = apiHandler<RouteContext>(async (request: NextRequest, context) => {
  const { id } = await context.params;
  const body = await request.json();
  const cycle = await startNewCycle(id, body.observacoes);
  return NextResponse.json(cycle, { status: 201 });
});
