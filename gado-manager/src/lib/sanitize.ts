/**
 * Sanitização de entrada (audit 3.1 — XSS armazenado).
 *
 * Estratégia:-validação no banco continua (React faz escaping no render),
 * mas removemos ativamente construtos de script/template/SQL da entrada,
 * porque o dado cru viaja para exportações (PDF/CSV/XLSX), apps nativos
 * (Android/Flutter) e outros consumidores fora do React.
 */

const DANGEROUS_PATTERNS: Array<{ re: RegExp; replacement: string }> = [
  // Tags HTML/script completas: <script>...</script>, <img ... onerror=...>
  { re: /<[^>]*>/g, replacement: "" },
  // Handlers de evento soltos: onerror=, onload=, javascript:, vbscript:
  { re: /\b(on\w+\s*=|javascript\s*:|vbscript\s*:|data\s*:\s*text\/html)/gi, replacement: "" },
  // Templating engines: {{...}}, ${...}, <%...%>
  { re: /\{\{[^}]*\}\}|\$\{[^}]*\}|<%[^%]*%>/g, replacement: "" },
  // Comentários/keywords clássicos de SQLi para campos de texto livre
  { re: /(--\s*$|\/\*[\s\S]*?\*\/|\bDROP\s+TABLE\b|\bDELETE\s+FROM\b|\bINSERT\s+INTO\b|\bUPDATE\s+\w+\s+SET\b)/gi, replacement: " " },
];

/**
 * Remove caracteres perigosos de texto livre de usuário.
 * Retorna null se o resultado ficar vazio (campo inválido).
 */
export function sanitizeText(input: unknown, maxLength: number): string | null {
  if (typeof input !== "string") return null;
  let out = input.normalize("NFKC");

  for (const { re, replacement } of DANGEROUS_PATTERNS) {
    out = out.replace(re, replacement);
  }

  // Remover caracteres de controle (exceto newline/tab)
  out = out.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  out = out.replace(/\s+/g, " ").trim();

  if (!out) return null;
  return out.slice(0, maxLength);
}

/**
 * Sanitiza o número de identificação do animal:
 * mantém apenas caracteres seguros (letras, números, - _ / . espaços).
 * Ex: "<script>alert(1)</script>" -> "alert1" (e o front valida tamanho).
 */
export function sanitizeIdentificacao(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const out = input
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}\-_/. ]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 50);
  if (!out) return null;
  return out;
}
