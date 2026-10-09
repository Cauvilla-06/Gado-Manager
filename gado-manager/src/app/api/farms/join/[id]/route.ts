import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/farm";
import { db } from "@/lib/db";
import {
  apiHandler,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  } from "@/lib/api-errors";
import { handleJoinRequestSchema } from "@/lib/validations";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// Aprovar ou rejeitar um pedido de entrada (PATCH /api/farms/join/:id)
export const PATCH = apiHandler<RouteContext>(async (request: NextRequest, context) => {
  const user = await requireUser();

  const { id: requestId } = await context.params;
  const { action } = handleJoinRequestSchema.parse(await request.json());

  await db.$transaction(async (tx) => {
    const joinRequest = await tx.farmRequest.findUnique({ where: { id: requestId } });
    if (!joinRequest) {
      throw new NotFoundError("Pedido");
    }

    // Só OWNER/ADMIN da fazenda do pedido podem decidir
    const membership = await tx.farmMembership.findUnique({
      where: { userId_farmId: { userId: user.id, farmId: joinRequest.farmId } },
    });
    if (!membership || !["OWNER", "ADMIN"].includes(membership.role)) {
      throw new ForbiddenError("Sem permissão para gerenciar pedidos");
    }

    // Pedido já decidido não pode ser decidido de novo (evita 500 por membership duplicada)
    if (joinRequest.status !== "PENDENTE") {
      throw new ConflictError("Este pedido já foi respondido");
    }

    await tx.farmRequest.update({
      where: { id: requestId },
      data: { status: action },
    });

    if (action === "APROVADO") {
      // upsert: se a pessoa já virou membro por outro caminho, não quebra
      await tx.farmMembership.upsert({
        where: { userId_farmId: { userId: joinRequest.userId, farmId: joinRequest.farmId } },
        update: {},
        create: { userId: joinRequest.userId, farmId: joinRequest.farmId, role: "MEMBER" },
      });
    }
  });

  return NextResponse.json({ success: true });
});
