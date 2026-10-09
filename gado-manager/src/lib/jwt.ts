// Valor de exemplo do .env.example — público no repositório, nunca pode ser usado
const EXAMPLE_SECRET = "mude_este_secret_em_producao";
const MIN_SECRET_LENGTH = 32;

function getSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error(
      "NEXTAUTH_SECRET não está configurado. Defina a variável de ambiente NEXTAUTH_SECRET."
    );
  }
  // Com um segredo conhecido/curto, qualquer um consegue forjar tokens de login
  if (secret === EXAMPLE_SECRET || secret.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `NEXTAUTH_SECRET inseguro: use um valor aleatório com pelo menos ${MIN_SECRET_LENGTH} caracteres. ` +
        `Gere um com: node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`
    );
  }
  return secret;
}

const encoder = new TextEncoder();

function base64url(input: string | Uint8Array): string {
  const bytes =
    typeof input === "string" ? encoder.encode(input) : input;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlDecode(str: string): ArrayBuffer {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer as ArrayBuffer;
}

async function getKey(): Promise<CryptoKey> {
  const secret = getSecret();
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: { name: "SHA-256" } },
    false,
    ["sign", "verify"]
  );
}

export interface JWTUser {
  id: string;
  name: string;
  email: string;
  /** Versão do token (User.tokenVersion). Tokens antigos, sem o campo, valem como 0. */
  tokenVersion?: number;
}

export async function signJWT(payload: JWTUser): Promise<string> {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64url(
    JSON.stringify({
      id: payload.id,
      name: payload.name,
      email: payload.email,
      tv: payload.tokenVersion ?? 0,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
    })
  );
  const key = await getKey();
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`${header}.${body}`)
  );
  return `${header}.${body}.${base64url(new Uint8Array(signature))}`;
}

export async function verifyJWT(token: string): Promise<JWTUser | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, body, sigStr] = parts;

    const key = await getKey();
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      base64urlDecode(sigStr),
      encoder.encode(`${header}.${body}`)
    );
    if (!valid) return null;

    const payload = JSON.parse(
      new TextDecoder().decode(base64urlDecode(body))
    );
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;

    return {
      id: payload.id,
      name: payload.name,
      email: payload.email,
      tokenVersion: typeof payload.tv === "number" ? payload.tv : 0,
    };
  } catch {
    return null;
  }
}
