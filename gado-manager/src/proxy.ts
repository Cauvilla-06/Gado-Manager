import { NextRequest, NextResponse } from "next/server";
import { verifyJWT } from "@/lib/jwt";

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Skip auth for public routes
  if (
    pathname === "/login" ||
    pathname === "/register" ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/config") ||
    pathname === "/api/health"
  ) {
    return NextResponse.next();
  }

  // Read session token from cookies OR Authorization header (mobile app)
  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;
  const token =
    bearerToken ||
    request.cookies.get("session-token")?.value ||
    request.cookies.get("next-auth.session-token")?.value ||
    request.cookies.get("__Secure-next-auth.session-token")?.value;

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
  const headers = new Headers(request.headers);
  headers.set("x-user-id", user.id);
  headers.set("x-user-name", user.name);
  headers.set("x-user-email", user.email);

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
