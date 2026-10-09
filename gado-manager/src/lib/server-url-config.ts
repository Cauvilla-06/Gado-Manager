import { readFile } from "fs/promises";
import { join } from "path";

const CONFIG_FILE = join(process.cwd(), ".runtime-config", "server-url.json");

export interface ServerUrlConfig {
  url: string;
  updatedAt: string | null;
}

/**
 * Lê .runtime-config/server-url.json (gravado pelos scripts locais).
 * Só devolve URLs https:// — qualquer outra coisa no arquivo é ignorada.
 */
export async function readServerUrlConfig(): Promise<ServerUrlConfig | null> {
  try {
    // Remove BOM: o PowerShell antigo grava UTF-8 com BOM e quebra o JSON.parse
    const raw = (await readFile(CONFIG_FILE, "utf-8")).replace(/^﻿/, "");
    const parsed = JSON.parse(raw);
    const url = typeof parsed.url === "string" ? parsed.url.trim() : "";
    if (!url.startsWith("https://")) return null;
    new URL(url); // lança se inválida
    return {
      url,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : null,
    };
  } catch {
    // Arquivo ausente ou inválido: sem URL de túnel
    return null;
  }
}
