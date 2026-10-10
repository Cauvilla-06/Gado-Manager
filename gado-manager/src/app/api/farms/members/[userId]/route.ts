import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireFarm } from "@/lib/farm";
import { apiHandler, ForbiddenError, NotFoundError, ValidationError } from "@/lib/api-errors";
import { canRemoveMember } from "@/lib/ownership";

interface RouteContext {
  params: Promise<{ userId: string }>;
}

/**
 * DELETE /api/farms/members/:userId — remove um membro da fazenda ATIVA.
 * - OWNER remove ADMIN e MEMBER; ADMIN remove só MEMBER; ninguém remove o OWNER.
 * - O acesso acaba na hora (toda requisição confere o vínculo com a fazenda).
 * - Os registros que a pessoa lançou continuam, com o nome dela em "criado por".
 */
export const DELETE = apiHandler<RouteContext>(async (_request: NextRequest, context) => {
  const { user, farm, membership } = await requireFarm();
  const { userId } = await context.params;

  if (userId === user.id) {
    throw new ValidationError("Você não pode remover a si mesmo da fazenda");
  }

  const target = await db.farmMembership.findUnique({
    where: { userId_farmId: { userId, farmId: farm.id } },
    select: { id: true, role: true },
  });
  if (!target) {
    throw new NotFoundError("Membro");
  }

  if (!canRemoveMember(membership.role, target.role)) {
    throw new ForbiddenError(
      target.role === "OWNER"
        ? "O dono da fazenda não pode ser removido"
        : "Seu nível de acesso não permite remover este membro"
    );
  }

  await db.farmMembership.delete({ where: { id: target.id } });

  return NextResponse.json({ ok: true, userId });
});
