"use client";

import { useEffect, useState, useCallback, useRef } from "react";

/**
 * Cache de dados em memória (stale-while-revalidate).
 *
 * Ao navegar entre páginas, o dado que já foi carregado antes é exibido
 * instantaneamente do cache enquanto uma atualização silenciosa roda em
 * background. Assim o usuário não vê mais skeleton/loading a cada troca
 * de página.
 *
 * Em caso de ERRO na busca, há backoff: não fica retrying em loop —
 * nova tentativa só após ERROR_BACKOFF_MS (ou se o usuário pedir refresh).
 */

interface CacheEntry {
  data: unknown;
  error: Error | null;
  timestamp: number;
  lastAttempt: number;
  promise: Promise<unknown> | null; // dedup: requisições em andamento
}

const cache = new Map<string, CacheEntry>();

// TTL padrão: 30s. Dentro desse prazo, nem revalida em background.
const DEFAULT_TTL_MS = 30_000;

// Após um erro, espera este tempo antes de tentar de novo (evita loop).
const ERROR_BACKOFF_MS = 30_000;

// Timeout por requisição: se o servidor não responder, falha em vez de
// deixar a página em skeleton para sempre.
const FETCH_TIMEOUT_MS = 15_000;

/** Envolve a fetcher com timeout, para requisições penduradas não travarem a UI. */
function withTimeout<T>(fetcher: () => Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Tempo esgotado ao carregar dados (servidor não respondeu).")),
      ms
    );
    fetcher()
      .then((v) => {
        clearTimeout(timer);
        resolve(v);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

function getEntry(key: string): CacheEntry {
  let entry = cache.get(key);
  if (!entry) {
    entry = {
      data: undefined,
      error: null,
      timestamp: 0,
      lastAttempt: 0,
      promise: null,
    };
    cache.set(key, entry);
  }
  return entry;
}

/** Inicia (ou reaproveita) a busca para a chave. Dedup de requisições. */
function revalidate<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const entry = getEntry(key);
  if (entry.promise) return entry.promise as Promise<T>;

  entry.lastAttempt = Date.now();

  const promise = withTimeout(fetcher, FETCH_TIMEOUT_MS)
    .then((data) => {
      entry.data = data;
      entry.error = null;
      entry.timestamp = Date.now();
      entry.promise = null;
      return data;
    })
    .catch((err) => {
      entry.promise = null;
      entry.error = err instanceof Error ? err : new Error(String(err));
      throw err;
    });

  entry.promise = promise;
  return promise;
}

/** Decide se a chave precisa de (re)busca agora. */
function needsFetch(entry: CacheEntry, ttlMs: number): boolean {
  const now = Date.now();
  // Sem dado: busca (a menos que estejamos em backoff de erro).
  if (entry.data === undefined) {
    if (entry.error && now - entry.lastAttempt < ERROR_BACKOFF_MS) return false;
    return true;
  }
  // Com dado: só revalida se passou do TTL.
  return now - entry.timestamp >= ttlMs;
}

export interface CachedDataResult<T> {
  data: T | null;
  /** true apenas na PRIMEIRA carga (sem nada em cache). Depois vira false. */
  loading: boolean;
  /** true quando há revalidação em background com dado velho exibido. */
  refreshing: boolean;
  error: Error | null;
  /** Força uma nova busca (ex: após criar/editar/excluir um registro). */
  refresh: () => Promise<void>;
  /** Atualiza o cache localmente (mutação otimista) sem refazer request. */
  mutate: (updater: T | ((current: T | null) => T)) => void;
}

/**
 * Hook de busca com cache SWR-like.
 *
 * @param key chave única do cache (ex: `animal:${id}`). null = não buscar.
 * @param fetcher função que busca os dados.
 * @param ttlMs tempo (ms) durante o qual o cache é considerado fresco.
 */
export function useCachedData<T>(
  key: string | null,
  fetcher: () => Promise<T>,
  ttlMs: number = DEFAULT_TTL_MS
): CachedDataResult<T> {
  // Versão é incrementada quando o cache muda, para re-ler os dados dele.
  const [version, setVersion] = useState(0);

  // Mantém a fetcher mais recente sem re-disparar o efeito.
  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  // Estado DERIVADO do cache (sem setState em efeitos):
  const entry = key ? getEntry(key) : null;
  const hasData = entry !== null && entry.data !== undefined;
  const data = hasData ? (entry.data as T) : null;
  const isInFlight = entry !== null && entry.promise !== null;
  const loading = key !== null && !hasData; // primeira carga (sem cache)
  const refreshing = hasData && isInFlight; // revalidando em background
  const error = entry !== null ? entry.error : null;

  useEffect(() => {
    if (!key) return;

    const e = getEntry(key);
    if (!needsFetch(e, ttlMs)) return;

    let cancelled = false;
    revalidate(key, () => fetcherRef.current())
      .then(() => {
        if (!cancelled) setVersion((v) => v + 1);
      })
      .catch(() => {
        // Com backoff, erro não re-dispara o efeito em loop:
        // só atualiza a versão para exibir a mensagem de erro.
        if (!cancelled) setVersion((v) => v + 1);
      });

    return () => {
      cancelled = true;
    };
  }, [key, ttlMs, version]);

  const refresh = useCallback(async () => {
    if (!key) return;
    // Limpa erro e força a busca mesmo com cache "fresco".
    const e = getEntry(key);
    e.error = null;
    e.timestamp = 0;
    e.lastAttempt = 0;
    setVersion((v) => v + 1);
    try {
      await revalidate(key, () => fetcherRef.current());
    } finally {
      setVersion((v) => v + 1);
    }
  }, [key]);

  const mutate = useCallback(
    (updater: T | ((current: T | null) => T)) => {
      if (!key) return;
      const e = getEntry(key);
      const current = (e.data !== undefined ? e.data : null) as T | null;
      const next =
        typeof updater === "function"
          ? (updater as (c: T | null) => T)(current)
          : updater;
      e.data = next;
      e.error = null;
      e.timestamp = Date.now();
      e.lastAttempt = Date.now();
      setVersion((v) => v + 1);
    },
    [key]
  );

  return { data, loading, refreshing, error, refresh, mutate };
}

/**
 * Limpa todo o cache (ou apenas as chaves que começam com um prefixo).
 * Útil ao trocar de fazenda ou fazer logout.
 */
export function clearDataCache(prefix?: string) {
  if (!prefix) {
    cache.clear();
    return;
  }
  for (const k of cache.keys()) {
    if (k.startsWith(prefix)) cache.delete(k);
  }
}
