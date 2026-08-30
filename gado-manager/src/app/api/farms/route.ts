import { NextRequest, NextResponse } from "next/server";
import { getCurrentFarm } from "@/lib/farm";
import { db } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";

export async function GET() {
  try {
    const { user } = await getCurrentFarm();
    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const memberships = await db.farmMembership.findMany({
      where: { userId: user.id },
      include: {
        farm: {
          include: {
            _count: { select: { animals: true, memberships: true } },
          },
        },
      },
      orderBy: { criadoEm: "asc" },
    });

    const farms = memberships.map((m) => ({
      ...m.farm,
      role: m.role,
      animalCount: m.farm._count.animals,
      memberCount: m.farm._count.memberships,
    }));

    return NextResponse.json(farms);
  } catch (error) {
    console.error("Get farms error:", error);
    return NextResponse.json({ error: "Erro ao buscar fazendas" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await getCurrentFarm();
    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Nome da fazenda é obrigatório" },
        { status: 400 }
      );
    }

    // Generate a unique code for the farm
    const shortId = uuidv4().replace(/-/g, "").substring(0, 8);
    const code = `farm-${shortId}`;

    // Create farm and add user as OWNER in a transaction
    const farm = await db.$transaction(async (tx) => {
      const newFarm = await tx.farm.create({
        data: {
          name: name.trim(),
          code,
        },
      });

      await tx.farmMembership.create({
        data: {
          userId: user.id,
          farmId: newFarm.id,
          role: "OWNER",
        },
      });

      return newFarm;
    });

    return NextResponse.json({ success: true, farm }, { status: 201 });
  } catch (error) {
    console.error("Create farm error:", error);
    return NextResponse.json(
      { error: "Erro ao criar fazenda" },
      { status: 500 }
    );
  }
}
