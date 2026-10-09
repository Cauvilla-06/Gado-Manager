import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * Health check endpoint mínimo para monitoramento.
 *
 * Segurança (audit 4.2): não expõe uptime, responseTime, nem status do banco.
 * Um atacante não precisa saber se o banco está conectado nem há quanto tempo
 * o servidor está de pé. Apenas 200 (vivo) ou 503 (problema).
 */
export async function GET() {
  try {
    // Testar conexão com o banco sem expor detalhes
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "healthy" });
  } catch {
    return NextResponse.json({ status: "unhealthy" }, { status: 503 });
  }
}
