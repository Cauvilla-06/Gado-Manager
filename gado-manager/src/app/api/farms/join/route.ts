import { NextRequest, NextResponse } from "next/server";
import { getCurrentFarm } from "@/lib/farm";
import { db } from "@/lib/db";

// Send a join request to a farm
export async function POST(request: NextRequest) {
  try {
    const { user } = await getCurrentFarm();
    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const { farmCode, message } = await request.json();

    if (!farmCode) {
      return NextResponse.json(
        { error: "Código da fazenda é obrigatório" },
        { status: 400 }
      );
    }

    // Find farm by code
    const farm = await db.farm.findUnique({ where: { code: farmCode } });
    if (!farm) {
      return NextResponse.json(
        { error: "Fazenda não encontrada com este código" },
        { status: 404 }
      );
    }

    // Check if already a member
    const existingMembership = await db.farmMembership.findUnique({
      where: { userId_farmId: { userId: user.id, farmId: farm.id } },
    });
    if (existingMembership) {
      return NextResponse.json(
        { error: "Você já é membro desta fazenda" },
        { status: 400 }
      );
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
      return NextResponse.json(
        { error: "Você já tem um pedido pendente para esta fazenda" },
        { status: 400 }
      );
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
  } catch (error) {
    console.error("Join request error:", error);
    return NextResponse.json(
      { error: "Erro ao enviar pedido" },
      { status: 500 }
    );
  }
}

// Get pending requests for current user's farms
export async function GET() {
  try {
    const { user } = await getCurrentFarm();
    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    // Get farms where user is OWNER or ADMIN
    const memberships = await db.farmMembership.findMany({
      where: {
        userId: user.id,
        role: { in: ["OWNER", "ADMIN"] },
      },
      include: { farm: true },
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
  } catch (error) {
    console.error("Get requests error:", error);
    return NextResponse.json(
      { error: "Erro ao buscar pedidos" },
      { status: 500 }
    );
  }
}
