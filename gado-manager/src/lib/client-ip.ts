/**
 * Resolve o IP do cliente de forma resistente a spoofing.
 *
 * Contexto: atrás do Cloudflare Tunnel / proxy, o header `x-forwarded-for`
 * é enviado pelo CLIENTE e pode ser forjado livremente (audit 1.5).
 * A ordem de confiança é:
 *   1. `cf-connecting-ip`  — setado pelo Cloudflare com o IP real do cliente
 *   2. `x-real-ip`         — setado por proxies reversos de confiança
 *   3. `x-forwarded-for`   — somente o PRIMEIRO IP (hop do proxy), nunca
 *                            a lista inteira (que o cliente controla)
 * Em last resort: "local" (chave única para dev sem proxy).
 */
export function getClientIp(headers: Headers): string {
  const cf = headers.get("cf-connecting-ip");
  if (cf && isValidIp(cf.trim())) return cf.trim();

  const real = headers.get("x-real-ip");
  if (real && isValidIp(real.trim())) return real.trim();

  const xff = headers.get("x-forwarded-for");
  if (xff) {
    // Pega apenas o primeiro hop; cliente pode enviar lista falsa se quiser,
    // mas rotar chaves entre "1.2.3.4" e "1.2.3.4, 5.6.7.8" não muda o resultado.
    const first = xff.split(",")[0].trim();
    if (isValidIp(first)) return first;
  }

  return "local";
}

/**
 * Detecta se a requisição veio pela internet (túnel/proxy) em vez da máquina local.
 *
 * NÃO confiar no IP do socket: o cloudflared roda NA própria máquina e repassa
 * tudo para 127.0.0.1 — todo tráfego do túnel chega como "IP local".
 *
 * Sinais confiáveis de túnel (definidos pelo edge do Cloudflare, não forjáveis pelo cliente):
 *  - cf-connecting-ip, cf-ray, cf-worker, cdn-loop (o Cloudflare sobrescreve os que o cliente manda)
 *
 * Origin/Referer remotos também denunciam requisição de outro site.
 */
export function isTunnelRequest(request: {
  headers: Headers;
}): boolean {
  const h = request.headers;
  if (
    h.get("cf-connecting-ip") ||
    h.get("cf-ray") ||
    h.get("cf-worker") ||
    h.get("cdn-loop")
  ) {
    return true;
  }

  const remoteUrl = (value: string | null): boolean => {
    if (!value) return false;
    try {
      const host = new URL(value).hostname;
      return host !== "localhost" && host !== "127.0.0.1" && !/^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host);
    } catch {
      return false;
    }
  };

  if (remoteUrl(h.get("origin"))) return true;
  if (remoteUrl(h.get("referer"))) return true;

  return false;
}

function isValidIp(value: string): boolean {
  // IPv4 simples ou IPv6 raqueável (inclui ::1 e_ranges)
  return /^[0-9a-fA-F:.]{3,45}$/.test(value);
}
