import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/farm";
import { db } from "@/lib/db";
import { apiHandler, AppError, ConflictError } from "@/lib/api-errors";
import { rateLimitResponse, RATE_LIMITS } from "@/lib/ratelimit";
import { joinRequestSchema } from "@/lib/validations";

// Send a join request to a farm
export const POST = apiHandler(async (request: NextRequest) => {
  const user = await requireUser();

  // Anti-spam / anti-enumeração de códigos de fazenda
  const rateLimit = rateLimitResponse(`farm-join:${user.id}`, RATE_LIMITS.farmJoin);
  if (rateLimit.limited) {
    return rateLimit.response as NextResponse;
  }

  const { farmCode, message } = joinRequestSchema.parse(await request.json());

  // Find farm by code
  const farm = await db.farm.findUnique({ where: { code: farmCode } });
  if (!farm) {
    throw new AppError("Fazenda não encontrada com este código", 404, "NOT_FOUND");
  }

  // Check if already a member
  const existingMembership = await db.farmMembership.findUnique({
    where: { userId_farmId: { userId: user.id, farmId: farm.id } },
  });
  if (existingMembership) {
    throw new ConflictError("Você já é membro desta fazenda");
  }

  // Check if there's already a pending request
  const existingRequest = await db.farmRequest.findFirst({
    where: {
      userId: user.id,
      farmId: farm.id,
      status: "PENDENTE",
    },
  });
  if (existingRequest) {
    throw new ConflictError("Você já tem um pedido pendente para esta fazenda");
  }

  // Create the request
  const joinRequest = await db.farmRequest.create({
    data: {
      userId: user.id,
      farmId: farm.id,
      message: message || null,
    },
  });

  return NextResponse.json({
    success: true,
    request: joinRequest,
    farm: { id: farm.id, name: farm.name },
  });
});

// Get pending requests for current user's farms
export const GET = apiHandler(async () => {
  const user = await requireUser();

  // Get farms where user is OWNER or ADMIN
  const memberships = await db.farmMembership.findMany({
    where: {
      userId: user.id,
      role: { in: ["OWNER", "ADMIN"] },
    },
    select: { farmId: true },
  });

  const farmIds = memberships.map((m) => m.farmId);

  // Get pending requests for those farms
  const pendingRequests = await db.farmRequest.findMany({
    where: {
      farmId: { in: farmIds },
      status: "PENDENTE",
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
      farm: { select: { id: true, name: true } },
    },
    orderBy: { criadoEm: "desc" },
  });

  return NextResponse.json(pendingRequests);
});
