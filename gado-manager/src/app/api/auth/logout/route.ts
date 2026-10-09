import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/jwt";
import { db } from "@/lib/db";

/**
 * POST /api/auth/logout
 * - Padrão: encerra a sessão deste navegador (apaga os cookies).
 * - Body { "todosDispositivos": true }: também invalida TODOS os tokens do
 *   usuário (celular, bots, outros navegadores) incrementando tokenVersion.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  if (body?.todosDispositivos === true) {
    const authHeader = request.headers.get("authorization");
    const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    const token = bearer || (await cookies()).get("session-token")?.value;
    const user = token ? await verifyJWT(token) : null;

    if (user?.id) {
      try {
        // Só revoga se o token ainda for da versão atual (token revogado não revoga de novo)
        await db.user.updateMany({
          where: { id: user.id, tokenVersion: user.tokenVersion ?? 0 },
          data: { tokenVersion: { increment: 1 } },
        });
      } catch (error) {
        console.error("Logout (todos os dispositivos) error:", error);
        return NextResponse.json(
          { error: "Erro ao encerrar as sessões" },
          { status: 500 }
        );
      }
    }
  }

  const response = NextResponse.json({ success: true });
  const expired = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
  };
  response.cookies.set("session-token", "", expired);
  response.cookies.set("selected-farm-id", "", { ...expired, httpOnly: false });
  return response;
}
