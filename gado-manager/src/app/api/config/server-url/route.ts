import { NextResponse } from "next/server";
import { readServerUrlConfig } from "@/lib/server-url-config";

/**
 * GET /api/config/server-url
 * Returns the current server URL (used by Flutter app to auto-fill).
 * Público: apenas endereço, sem segredo.
 *
 * Não existe mais POST: a URL do túnel é gravada direto no arquivo
 * .runtime-config/server-url.json pelos scripts locais (start-*.bat e
 * scripts/*.ps1). Assim ninguém na rede ou na internet consegue trocá-la.
 */
export async function GET() {
  const config = await readServerUrlConfig();
  return NextResponse.json({ url: config?.url ?? null });
}
