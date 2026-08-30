/**
 * Rate limiter simples baseado em memória.
 * Para produção, usar @upstash/ratelimit com Redis.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Limpar entradas expiradas a cada 5 minutos
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.resetAt < now) {
      store.delete(key);
    }
  }
}, 5 * 60 * 1000);

export interface RateLimitConfig {
  /** Janela de tempo em milissegundos */
  windowMs: number;
  /** Máximo de requisições na janela */
  maxRequests: number;
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Verifica e aplica rate limiting para uma chave (ex: IP + rota).
 *
 * @param key - Chave única (ex: "192.168.1.1:/api/auth/login")
 * @param config - Configuração do rate limit
 * @returns Resultado com success, remaining e resetAt
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const entry = store.get(key);

  // Se não existe ou expirou, criar nova entrada
  if (!entry || entry.resetAt < now) {
    const newEntry: RateLimitEntry = {
      count: 1,
      resetAt: now + config.windowMs,
    };
    store.set(key, newEntry);
    return {
      success: true,
      remaining: config.maxRequests - 1,
      resetAt: newEntry.resetAt,
    };
  }

  // Incrementar contador
  entry.count++;

  if (entry.count > config.maxRequests) {
    return {
      success: false,
      remaining: 0,
      resetAt: entry.resetAt,
    };
  }

  return {
    success: true,
    remaining: config.maxRequests - entry.count,
    resetAt: entry.resetAt,
  };
}

/**
 * Configurações pré-definidas para diferentes cenários.
 */
export const RATE_LIMITS = {
  /** Login: 5 tentativas por minuto */
  login: { windowMs: 60 * 1000, maxRequests: 5 },
  /** Registro: 3 contas por 5 minutos */
  register: { windowMs: 5 * 60 * 1000, maxRequests: 3 },
  /** API geral: 100 requisições por minuto */
  api: { windowMs: 60 * 1000, maxRequests: 100 },
  /** Sync: 10 payloads por minuto */
  sync: { windowMs: 60 * 1000, maxRequests: 10 },
} as const;

/**
 * Middleware de rate limiting para API routes.
 * Retorna NextResponse 429 se exceder o limite.
 */
export function rateLimitResponse(
  key: string,
  config: RateLimitConfig
): { limited: true; response: Response } | { limited: false } {
  const result = checkRateLimit(key, config);

  if (!result.success) {
    const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);
    return {
      limited: true,
      response: new Response(
        JSON.stringify({
          error: "Muitas requisições. Tente novamente em breve.",
          code: "RATE_LIMIT_EXCEEDED",
          retryAfter,
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(retryAfter),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
          },
        }
      ),
    };
  }

  return { limited: false };
}
