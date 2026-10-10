"use client";

import { useEffect } from "react";
import { primeDataCache, useCachedData } from "@/lib/use-cached-data";

export interface SessionFarm {
  id: string;
  name: string;
  code: string;
  role: string;
  animalCount: number;
}

export interface SessionData {
  user: { id: string; name: string; email: string } | null;
  farm: { id: string; name: string; code: string } | null;
  role: string | null;
  farms: SessionFarm[];
  pendingRequests: number;
}

export const SESSION_KEY = "session";
const STORAGE_KEY = "gm:session";

function readStored(): SessionData | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SessionData) : null;
  } catch {
    return null;
  }
}

function store(data: SessionData) {
  try {
    if (data.user) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // sessionStorage indisponível (aba anônima restrita etc.): segue sem
  }
}

/** Apaga a sessão guardada no navegador (logout / troca de fazenda). */
export function clearStoredSession() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

async function fetchSession(): Promise<SessionData> {
  const res = await fetch("/api/auth/me", { credentials: "include" });
  const data = (await res.json()) as Partial<SessionData>;
  const session: SessionData = {
    user: data.user ?? null,
    farm: data.farm ?? null,
    role: data.role ?? null,
    farms: data.farms ?? [],
    pendingRequests: data.pendingRequests ?? 0,
  };
  store(session);
  return session;
}

/**
 * Sessão do site (usuário, fazenda ativa, nível, fazendas, pedidos pendentes)
 * em UMA chamada, compartilhada entre o menu e as páginas.
 * Mostra na hora o que ficou salvo no sessionStorage e confirma com o servidor
 * em segundo plano. `enabled = false` não busca nada (telas de login/cadastro).
 */
export function useSession(enabled = true) {
  const result = useCachedData<SessionData>(enabled ? SESSION_KEY : null, fetchSession, 60_000);

  // Lê o sessionStorage só DEPOIS de montar: ler durante o render deixaria o
  // HTML do servidor diferente do navegador (erro de hidratação / tela piscando).
  useEffect(() => {
    if (!enabled) return;
    const stored = readStored();
    if (stored) primeDataCache(SESSION_KEY, stored);
  }, [enabled]);

  return result;
}
