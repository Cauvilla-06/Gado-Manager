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
 * GET /api/config/server-url
 * Returns the current server URL (used by Flutter app to auto-fill).
 */
export async function GET() {
  try {
    if (!existsSync(CONFIG_FILE)) {
      return NextResponse.json({ url: null });
    }
    const data = await readFile(CONFIG_FILE, "utf-8");
    const parsed = JSON.parse(data);
    return NextResponse.json({ url: parsed.url || null });
  } catch {
    return NextResponse.json({ url: null });
  }
}

/**
 * POST /api/config/server-url
 * Saves the tunnel URL. Called by the .bat script.
 * Body: { url: "https://xxxx.trycloudflare.com" }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url } = body;

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "URL é obrigatória" },
        { status: 400 }
      );
    }

    await ensureDir();
    await writeFile(
      CONFIG_FILE,
      JSON.stringify({ url: url.trim(), updatedAt: new Date().toISOString() }),
      "utf-8"
    );

    return NextResponse.json({ success: true, url: url.trim() });
  } catch (error) {
    console.error("Error saving server URL:", error);
    return NextResponse.json(
      { error: "Erro ao salvar URL" },
      { status: 500 }
    );
  }
}
