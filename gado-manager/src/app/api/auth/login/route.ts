import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { signJWT } from "@/lib/jwt";
import { rateLimitResponse, RATE_LIMITS } from "@/lib/ratelimit";

export async function POST(request: NextRequest) {
  // Rate limiting: 5 tentativas por minuto por IP
  const ip = request.headers.get("x-forwarded-for") ?? "127.0.0.1";
  const rateLimit = rateLimitResponse(`login:${ip}`, RATE_LIMITS.login);
  if (rateLimit.limited) {
    return rateLimit.response;
  }

  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email e senha são obrigatórios" },
        { status: 400 }
      );
    }

    const user = await db.user.findUnique({ where: { email } });
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
    const token = await signJWT({ id: user.id, name: user.name, email: user.email });

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
