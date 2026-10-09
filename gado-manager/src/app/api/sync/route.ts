import { NextRequest, NextResponse } from "next/server";
import { processSync } from "@/services/sync-service";
import { requireFarm } from "@/lib/farm";
import { apiHandler, ForbiddenError } from "@/lib/api-errors";
import { userCanRecordInFarm } from "@/lib/ownership";
import { rateLimitResponse, RATE_LIMITS } from "@/lib/ratelimit";

export const POST = apiHandler(async (request: NextRequest) => {
  const { user, farm } = await requireFarm();

  const rateLimit = rateLimitResponse(`sync:${user.id}`, RATE_LIMITS.sync);
  if (rateLimit.limited) {
    return rateLimit.response as NextResponse;
  }

  // OWNER, ADMIN e MEMBER podem lançar registros de manejo pelo app
  const canRecord = await userCanRecordInFarm(user.id, farm.id);
  if (!canRecord) {
    throw new ForbiddenError("Seu nível de acesso não permite lançar registros");
  }

  const body = await request.json();
  const result = await processSync(body, farm.id, user.id);
  return NextResponse.json(result);
});
