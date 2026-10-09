import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { isTunnelRequest } from "@/lib/client-ip";

const CONFIG_DIR = join(process.cwd(), ".runtime-config");
const CONFIG_FILE = join(CONFIG_DIR, "server-url.json");

async function ensureDir() {
  if (!existsSync(CONFIG_DIR)) {
    await mkdir(CONFIG_DIR, { recursive: true });
  }
}

/**
 * GET /api/config/tunnel
 * Returns the current tunnel URL and when it was last updated.
 * Público (sem auth): o app Flutter usa isso para auto-preencher o servidor.
 * Não vaza segredo — apenas o endereço público do túnel.
 */
export async function GET() {
  try {
    if (!existsSync(CONFIG_FILE)) {
      return NextResponse.json({ url: null, updatedAt: null });
    }
    const data = await readFile(CONFIG_FILE, "utf-8");
    const parsed = JSON.parse(data);
    return NextResponse.json({
      url: parsed.url || null,
      updatedAt: parsed.updatedAt || null,
    });
  } catch {
    return NextResponse.json({ url: null, updatedAt: null });
  }
}

function isLocalRequest(request: NextRequest): boolean {
  // Bloqueia qualquer requisicao que veio pelo tunel/proxy (headers cf-* nao
  // forjaveis definidos pelo edge do Cloudflare). O cloudflared repassa tudo
  // como 127.0.0.1, entao IP nunca basta para dizer que e local.
  return !isTunnelRequest(request);
}

/**
 * POST /api/config/tunnel — PROTEGIDO (audit 1.6).
 * Só aceita alteração vinda da própria máquina/rede local.
 * Um atacante pela internet (via túnel) recebe 403.
 */
export async function POST(request: NextRequest) {
  try {
    if (!isLocalRequest(request)) {
      return NextResponse.json(
        { error: "Alteração de configuração permitida apenas localmente" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { url } = body;

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "URL e obrigatoria" },
        { status: 400 }
      );
    }

    // Valida que é uma URL válida
    let hostname: string;
    try {
      const parsed = new URL(url.trim());
      hostname = parsed.hostname;
    } catch {
      return NextResponse.json(
        { error: "URL invalida" },
        { status: 400 }
      );
    }

    // Só aceita HTTPS em host que não seja o próprio servidor
    if (!url.trim().startsWith("https://")) {
      return NextResponse.json(
        { error: "A URL do túnel deve usar https://" },
        { status: 400 }
      );
    }

    await ensureDir();
    await writeFile(
      CONFIG_FILE,
      JSON.stringify(
        { url: url.trim(), updatedAt: new Date().toISOString() },
        null,
        2
      ),
      "utf-8"
    );

    return NextResponse.json({
      success: true,
      url: url.trim(),
      hostname,
    });
  } catch (error) {
    console.error("Error saving tunnel URL:", error);
    return NextResponse.json(
      { error: "Erro ao salvar URL do tunnel" },
      { status: 500 }
    );
  }
}
