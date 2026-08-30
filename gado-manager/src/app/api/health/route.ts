import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * Health check endpoint para monitoramento.
 * Verifica conectividade com o banco de dados.
 *
 * GET /api/health
 *
 * Response 200:
 * {
 *   "status": "healthy",
 *   "timestamp": "2026-08-23T10:00:00.000Z",
 *   "database": "connected",
 *   "uptime": 12345.678
 * }
 *
 * Response 503:
 * {
 *   "status": "unhealthy",
 *   "timestamp": "...",
 *   "database": "disconnected",
 *   "error": "..."
 * }
 */
export async function GET() {
  const startTime = Date.now();

  try {
    // Testar conexão com o banco
    await db.$queryRaw`SELECT 1`;

    const responseTime = Date.now() - startTime;

    return NextResponse.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      database: "connected",
      responseTime: `${responseTime}ms`,
      uptime: process.uptime(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        database: "disconnected",
        error: error instanceof Error ? error.message : "Erro desconhecido",
      },
      { status: 503 }
    );
  }
}
