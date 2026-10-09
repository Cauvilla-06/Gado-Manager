import { NextResponse } from "next/server";
import { readServerUrlConfig } from "@/lib/server-url-config";

/**
 * GET /api/config/tunnel
 * Returns the current tunnel URL and when it was last updated.
 * Público (sem auth): o app Flutter usa isso para auto-preencher o servidor.
 * Não vaza segredo — apenas o endereço público do túnel.
 *
 * Somente leitura: veja /api/config/server-url.
 */
export async function GET() {
  const config = await readServerUrlConfig();
  return NextResponse.json({
    url: config?.url ?? null,
    updatedAt: config?.updatedAt ?? null,
  });
}
