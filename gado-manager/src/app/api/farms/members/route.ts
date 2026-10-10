import { NextResponse } from "next/server";
import { requireFarm } from "@/lib/farm";
import { db } from "@/lib/db";
import { apiHandler } from "@/lib/api-errors";

export const GET = apiHandler(async () => {
  const { user, farm, membership } = await requireFarm();

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

  return NextResponse.json({
    farm: { name: farm.name, code: farm.code },
    members,
    // Para a tela saber quem é "você" e quais botões de remover mostrar
    me: { id: user.id, role: membership.role },
  });
});
