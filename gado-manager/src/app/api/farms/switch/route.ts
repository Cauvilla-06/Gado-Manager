import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/farm";
import { db } from "@/lib/db";
import { apiHandler, ForbiddenError } from "@/lib/api-errors";

const switchSchema = z.object({
  farmId: z.string().min(1, "farmId obrigatório").max(100),
});

export const POST = apiHandler(async (request: NextRequest) => {
  const user = await requireUser();

  const { farmId } = switchSchema.parse(await request.json());

  // Só deixa selecionar fazenda da qual o usuário é membro
  const membership = await db.farmMembership.findUnique({
    where: { userId_farmId: { userId: user.id, farmId } },
    select: { id: true },
  });
  if (!membership) {
    throw new ForbiddenError("Você não é membro desta fazenda");
  }

  const response = NextResponse.json({ ok: true });

  // Set cookie that expires in 30 days
  response.cookies.set("selected-farm-id", farmId, {
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    sameSite: "lax",
  });

  return response;
});
