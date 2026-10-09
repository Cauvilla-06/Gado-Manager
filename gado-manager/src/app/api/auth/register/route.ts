import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { rateLimitResponse, RATE_LIMITS } from "@/lib/ratelimit";
import { getClientIp } from "@/lib/client-ip";
import { sanitizeText } from "@/lib/sanitize";

export async function POST(request: NextRequest) {
  // Rate limiting: 3 contas por 5 minutos por IP real (anti-spoof)
  const ip = getClientIp(request.headers);
  const rateLimit = rateLimitResponse(`register:${ip}`, RATE_LIMITS.register);
  if (rateLimit.limited) {
    return rateLimit.response;
  }

  try {
    const { name, email, password, farmName, farmCode } = await request.json();

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Nome, email e senha são obrigatórios" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "A senha deve ter pelo menos 8 caracteres" },
        { status: 400 }
      );
    }

    // Política de senha: exige letra e número (bloqueia "123456", "aaaaaa"...)
    if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      return NextResponse.json(
        { error: "A senha deve conter letras e números" },
        { status: 400 }
      );
    }

    if (typeof name !== "string" || typeof email !== "string") {
      return NextResponse.json(
        { error: "Dados inválidos" },
        { status: 400 }
      );
    }

    const cleanName = sanitizeText(name, 100);
    if (!cleanName) {
      return NextResponse.json(
        { error: "Nome inválido" },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "Já existe uma conta com este email" },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // Criar usuário e fazenda em uma transação atômica
    const result = await db.$transaction(async (tx) => {
      // Create user
      const user = await tx.user.create({
        data: { name: cleanName, email, passwordHash },
      });

      let farm;

      if (farmCode && farmCode.trim()) {
        // Join existing farm by code
        farm = await tx.farm.findUnique({ where: { code: farmCode.trim() } });
        if (!farm) {
          throw new Error("FarmNotFound");
        }
        // Segurança: entrada na fazenda exige APROVAÇÃO do dono.
        // Cria um pedido PENDENTE em vez de membership direto (fecha bypass via farmCode).
        const alreadyPending = await tx.farmRequest.findFirst({
          where: { userId: user.id, farmId: farm.id, status: "PENDENTE" },
        });
        if (!alreadyPending) {
          await tx.farmRequest.create({
            data: { userId: user.id, farmId: farm.id, status: "PENDENTE" },
          });
        }
      } else {
        // Create a new farm for the user
        const newFarmCode = `fazenda-${Math.random().toString(36).substring(2, 8)}`;
        farm = await tx.farm.create({
          data: {
            name: farmName ? sanitizeText(farmName, 120) || `${cleanName} - Fazenda` : `${cleanName} - Fazenda`,
            code: newFarmCode,
          },
        });
        await tx.farmMembership.create({
          data: { userId: user.id, farmId: farm.id, role: "OWNER" },
        });
      }

      return { user, farm };
    });

    return NextResponse.json({
      success: true,
      user: { id: result.user.id, name: result.user.name, email: result.user.email },
      farm: { id: result.farm.id, name: result.farm.name, code: result.farm.code },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "FarmNotFound") {
      return NextResponse.json(
        { error: "Fazenda não encontrada com este código" },
        { status: 400 }
      );
    }

    console.error("Register error:", error);
    return NextResponse.json(
      { error: "Erro ao criar conta" },
      { status: 500 }
    );
  }
}
