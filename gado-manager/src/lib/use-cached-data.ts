"use client";

import { useEffect, useCallback, useRef, useSyncExternalStore } from "react";

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
  rev: number; // muda a cada alteração: é o "snapshot" lido pelo React
}

const cache = new Map<string, CacheEntry>();
let globalRev = 0;

// Componentes que usam a mesma chave são avisados quando o dado muda
// (ex.: aprovar um pedido atualiza o contador do menu na hora).
const listeners = new Map<string, Set<() => void>>();

function notify(key: string) {
  const e = cache.get(key);
  if (e) e.rev = ++globalRev;
  listeners.get(key)?.forEach((fn) => fn());
}

function subscribe(key: string, fn: () => void): () => void {
  let set = listeners.get(key);
  if (!set) {
    set = new Set();
    listeners.set(key, set);
  }
  set.add(fn);
  return () => {
    set!.delete(fn);
  };
}

// Snapshots especiais do useSyncExternalStore
const SERVER_SNAPSHOT = -2; // render no servidor e hidratação: "sem dados"
const NO_KEY = -1;

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
      rev: ++globalRev,
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
      notify(key);
      return data;
    })
    .catch((err) => {
      entry.promise = null;
      entry.error = err instanceof Error ? err : new Error(String(err));
      notify(key);
      throw err;
    });

  entry.promise = promise;
  notify(key); // mostra "atualizando" para quem estiver na tela
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
  // Mantém a fetcher mais recente sem re-disparar o efeito.
  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  // Lê o cache via useSyncExternalStore: na HIDRATAÇÃO o React usa o snapshot
  // do servidor (sem dados, igual ao HTML que veio pronto) e só depois aplica
  // o cache. Ler o cache direto no render fazia a página "acordar" diferente do
  // HTML do servidor quando outro componente (ex.: o menu) já tinha preenchido
  // o cache — o React descartava tudo e redesenhava (tela piscando/sumindo).
  const subscribeKey = useCallback(
    (onChange: () => void) => (key ? subscribe(key, onChange) : () => {}),
    [key]
  );
  const rev = useSyncExternalStore(
    subscribeKey,
    () => (key ? getEntry(key).rev : NO_KEY),
    () => SERVER_SNAPSHOT
  );

  // Estado DERIVADO do cache (sem setState em efeitos):
  const entry = key && rev !== SERVER_SNAPSHOT ? getEntry(key) : null;
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

    // Erros ficam registrados na entrada (com backoff) e chegam à tela via notify
    revalidate(key, () => fetcherRef.current()).catch(() => {});
  }, [key, ttlMs, rev]);

  const refresh = useCallback(async () => {
    if (!key) return;
    // Limpa erro e força a busca mesmo com cache "fresco".
    const e = getEntry(key);
    e.error = null;
    e.timestamp = 0;
    e.lastAttempt = 0;
    await revalidate(key, () => fetcherRef.current()).catch(() => {});
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
      notify(key);
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
  const keys = [...cache.keys()].filter((k) => !prefix || k.startsWith(prefix));
  for (const k of keys) cache.delete(k);
  // Quem está na tela com essas chaves busca de novo
  for (const k of keys) notify(k);
}

/**
 * Marca dados como VELHOS sem apagá-los (todo o cache ou só um prefixo).
 * A tela continua mostrando o que tem e atualiza em segundo plano — sem piscar
 * o esqueleto de carregamento. Use depois de criar/editar/excluir algo.
 * (clearDataCache apaga de vez: só para logout / troca de fazenda.)
 */
export function invalidateDataCache(prefix?: string) {
  const keys = [...cache.keys()].filter((k) => !prefix || k.startsWith(prefix));
  for (const k of keys) {
    const e = cache.get(k)!;
    e.timestamp = 0;
    e.error = null;
    e.lastAttempt = 0;
  }
  for (const k of keys) notify(k);
}

/**
 * Preenche o cache com um dado já conhecido (ex.: salvo no sessionStorage)
 * para a tela aparecer na hora. O dado é tratado como velho e revalidado.
 */
export function primeDataCache<T>(key: string, data: T) {
  const e = getEntry(key);
  if (e.data !== undefined) return;
  e.data = data;
  e.timestamp = 0;
  notify(key);
}
