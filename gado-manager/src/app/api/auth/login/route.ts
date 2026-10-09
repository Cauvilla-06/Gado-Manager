import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { signJWT } from "@/lib/jwt";
import { rateLimitResponse, RATE_LIMITS } from "@/lib/ratelimit";
import { getClientIp } from "@/lib/client-ip";
import { normalizeEmail } from "@/lib/validations";
import { findUserByEmail } from "@/lib/users";

export async function POST(request: NextRequest) {
  // Rate limiting: 5 tentativas por minuto por IP real (anti-spoof)
  // + limite por conta (email) para atacar uma conta de vários IPs
  const ip = getClientIp(request.headers);
  const rateLimit = rateLimitResponse(`login:${ip}`, RATE_LIMITS.login);
  if (rateLimit.limited) {
    return rateLimit.response;
  }

  try {
    const body = await request.json().catch(() => null);
    const email: unknown = body?.email;
    const password: unknown = body?.password;

    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      !email.trim() ||
      !password
    ) {
      return NextResponse.json(
        { error: "Email e senha são obrigatórios" },
        { status: 400 }
      );
    }

    // Limita tentativas por CONTA também (brute force distribuído por IPs)
    const mailLimit = rateLimitResponse(
      `login-email:${normalizeEmail(email)}`,
      RATE_LIMITS.login
    );
    if (mailLimit.limited) {
      return mailLimit.response;
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return NextResponse.json(
        { error: "Email ou senha incorretos" },
        { status: 401 }
      );
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { error: "Email ou senha incorretos" },
        { status: 401 }
      );
    }

    // Create JWT
    const token = await signJWT({
      id: user.id,
      name: user.name,
      email: user.email,
      tokenVersion: user.tokenVersion,
    });

    // Set cookie
    const response = NextResponse.json({
      success: true,
      user: { id: user.id, name: user.name, email: user.email },
      token, // returned for mobile app (Bearer auth)
    });

    response.cookies.set("session-token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Erro ao fazer login" },
      { status: 500 }
    );
  }
}
