import { NextRequest, NextResponse } from "next/server";
import { verifyJWT } from "@/lib/jwt";

// Headers de identidade que SÓ o proxy pode definir. Qualquer valor vindo do
// cliente é descartado, para nenhuma rota confiar num x-user-id forjado.
const TRUSTED_HEADERS = [
  "x-user-id",
  "x-user-name",
  "x-user-email",
  "x-token-version",
  "x-selected-farm-id",
];

function stripTrustedHeaders(request: NextRequest): Headers {
  const headers = new Headers(request.headers);
  for (const name of TRUSTED_HEADERS) headers.delete(name);
  return headers;
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const headers = stripTrustedHeaders(request);

  // Skip auth for public routes
  if (
    pathname === "/login" ||
    pathname === "/register" ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/config") ||
    pathname === "/api/health"
  ) {
    return NextResponse.next({ request: { headers } });
  }

  // Read session token from cookies OR Authorization header (mobile app)
  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;
  const token = bearerToken || request.cookies.get("session-token")?.value;

  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Não autenticado" },
        { status: 401 }
      );
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Verify the JWT
  const user = await verifyJWT(token);

  if (!user?.id) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Sessão inválida" },
        { status: 401 }
      );
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Set user info on REQUEST headers so route handlers can read them
  // (nome/e-mail podem ter acentos: headers HTTP só aceitam ASCII)
  headers.set("x-user-id", user.id);
  headers.set("x-user-name", encodeURIComponent(user.name ?? ""));
  headers.set("x-user-email", encodeURIComponent(user.email ?? ""));
  headers.set("x-token-version", String(user.tokenVersion ?? 0));

  // Pass selected farm cookie as header
  const selectedFarmId = request.cookies.get("selected-farm-id")?.value;
  if (selectedFarmId) {
    headers.set("x-selected-farm-id", selectedFarmId);
  }

  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: [
    "/((?!login|register|api/auth|_next/static|_next/image|favicon.ico).*)",
  ],
};
