import { NextRequest, NextResponse } from "next/server";
import { getCurrentFarm } from "@/lib/farm";
import { db } from "@/lib/db";

// Approve or reject a join request
export async function PATCH(request: NextRequest) {
  try {
    const { user } = await getCurrentFarm();
    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const { requestId, action } = await request.json();

    if (!requestId || !["APROVADO", "REJEITADO"].includes(action)) {
      return NextResponse.json(
        { error: "Dados inválidos" },
        { status: 400 }
      );
    }

    // Get the request
    const joinRequest = await db.farmRequest.findUnique({
      where: { id: requestId },
      include: { farm: true },
    });

    if (!joinRequest) {
      return NextResponse.json(
        { error: "Pedido não encontrado" },
        { status: 404 }
      );
    }

    // Verify user is OWNER or ADMIN of this farm
    const membership = await db.farmMembership.findUnique({
      where: { userId_farmId: { userId: user.id, farmId: joinRequest.farmId } },
    });

    if (!membership || !["OWNER", "ADMIN"].includes(membership.role)) {
      return NextResponse.json(
        { error: "Sem permissão para gerenciar pedidos" },
        { status: 403 }
      );
    }

    // Update request status
    await db.farmRequest.update({
      where: { id: requestId },
      data: { status: action },
    });

    // If approved, create membership
    if (action === "APROVADO") {
      await db.farmMembership.create({
        data: {
          userId: joinRequest.userId,
          farmId: joinRequest.farmId,
          role: "MEMBER",
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Handle request error:", error);
    return NextResponse.json(
      { error: "Erro ao processar pedido" },
      { status: 500 }
    );
  }
}
