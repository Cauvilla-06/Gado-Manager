import { NextResponse } from "next/server";
import { getCurrentFarm } from "@/lib/farm";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const { farm } = await getCurrentFarm();
    if (!farm) {
      return NextResponse.json({ error: "Nenhuma fazenda encontrada" }, { status: 404 });
    }

    const memberships = await db.farmMembership.findMany({
      where: { farmId: farm.id },
      include: {
        user: {
          select: { id: true, name: true, email: true, criadoEm: true },
        },
      },
      orderBy: { criadoEm: "asc" },
    });

    const members = memberships.map((m) => ({
      id: m.user.id,
      name: m.user.name,
      email: m.user.email,
      role: m.role,
      joinedAt: m.criadoEm,
    }));

    return NextResponse.json({ farm: { name: farm.name, code: farm.code }, members });
  } catch (error) {
    console.error("Error fetching members:", error);
    return NextResponse.json(
      { error: "Erro ao buscar membros" },
      { status: 500 }
    );
  }
}
