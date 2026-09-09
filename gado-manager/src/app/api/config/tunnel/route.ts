import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";

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

/**
 * POST /api/config/tunnel
 * Saves a new tunnel URL. Called by start-server.bat or manually.
 * Body: { url: "https://xxxx.trycloudflare.com" }
 */
export async function POST(request: NextRequest) {
  try {
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
