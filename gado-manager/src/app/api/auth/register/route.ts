import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { rateLimitResponse, RATE_LIMITS } from "@/lib/ratelimit";
import { getClientIp } from "@/lib/client-ip";
import { sanitizeText } from "@/lib/sanitize";
import { normalizeEmail } from "@/lib/validations";
import { findUserByEmail } from "@/lib/users";

const emailSchema = z.string().email().max(254);

export async function POST(request: NextRequest) {
  // Rate limiting: 3 contas por 5 minutos por IP real (anti-spoof)
  const ip = getClientIp(request.headers);
  const rateLimit = rateLimitResponse(`register:${ip}`, RATE_LIMITS.register);
  if (rateLimit.limited) {
    return rateLimit.response;
  }

  try {
    const body = await request.json().catch(() => null);
    const { name, email, password, farmName, farmCode } = body ?? {};

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Nome, email e senha são obrigatórios" },
        { status: 400 }
      );
    }

    if (
      typeof name !== "string" ||
      typeof email !== "string" ||
      typeof password !== "string" ||
      (farmName !== undefined && farmName !== null && typeof farmName !== "string") ||
      (farmCode !== undefined && farmCode !== null && typeof farmCode !== "string")
    ) {
      return NextResponse.json(
        { error: "Dados inválidos" },
        { status: 400 }
      );
    }

    const cleanEmail = normalizeEmail(email);
    if (!emailSchema.safeParse(cleanEmail).success) {
      return NextResponse.json(
        { error: "Email inválido" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "A senha deve ter pelo menos 8 caracteres" },
        { status: 400 }
      );
    }

    // bcrypt só considera os primeiros 72 bytes; acima disso a senha é truncada
    if (password.length > 72) {
      return NextResponse.json(
        { error: "A senha deve ter no máximo 72 caracteres" },
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

    const cleanName = sanitizeText(name, 100);
    if (!cleanName) {
      return NextResponse.json(
        { error: "Nome inválido" },
        { status: 400 }
      );
    }

    // Check if user already exists (sem diferenciar maiúsculas/minúsculas)
    const existing = await findUserByEmail(cleanEmail);
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
        data: { name: cleanName, email: cleanEmail, passwordHash },
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
        await tx.farmRequest.create({
          data: { userId: user.id, farmId: farm.id, status: "PENDENTE" },
        });
      } else {
        // Create a new farm for the user (código aleatório criptográfico, difícil de adivinhar)
        const newFarmCode = `fazenda-${randomUUID().replace(/-/g, "").slice(0, 10)}`;
        farm = await tx.farm.create({
          data: {
            name: (farmName && sanitizeText(farmName, 120)) || `${cleanName} - Fazenda`,
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

    // Corrida: outro cadastro com o mesmo e-mail entrou entre a checagem e o create
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return NextResponse.json(
        { error: "Já existe uma conta com este email" },
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
