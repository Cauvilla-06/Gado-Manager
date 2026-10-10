import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/jwt";
import { db } from "@/lib/db";

/**
 * GET /api/auth/me — sessão completa do site em UMA chamada:
 * usuário, fazenda ativa + nível, lista de fazendas e nº de pedidos pendentes.
 * (Antes o menu fazia /me + /api/farms + /api/farms/join em cascata.)
 */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("session-token")?.value;

    if (!token) {
      return NextResponse.json({ user: null, reason: "no-token" });
    }

    const decoded = await verifyJWT(token);
    if (!decoded?.id) {
      return NextResponse.json({ user: null, reason: "invalid-jwt" });
    }

    // Usuário e fazendas em paralelo (cada consulta ao Turso é uma ida à internet)
    const [found, memberships] = await Promise.all([
      db.user.findUnique({
        where: { id: decoded.id },
        select: { id: true, name: true, email: true, tokenVersion: true },
      }),
      db.farmMembership.findMany({
        where: { userId: decoded.id },
        orderBy: { criadoEm: "asc" },
        select: {
          role: true,
          farm: {
            select: {
              id: true,
              name: true,
              code: true,
              _count: { select: { animals: true } },
            },
          },
        },
      }),
    ]);

    if (!found) {
      return NextResponse.json({ user: null, reason: "user-not-found" });
    }

    // Sessão encerrada em "sair de todos os dispositivos"
    if (found.tokenVersion !== (decoded.tokenVersion ?? 0)) {
      return NextResponse.json({ user: null, reason: "revoked" });
    }

    const user = { id: found.id, name: found.name, email: found.email };
    const farms = memberships.map((m) => ({
      id: m.farm.id,
      name: m.farm.name,
      code: m.farm.code,
      role: m.role,
      animalCount: m.farm._count.animals,
    }));

    // Mesma regra do getCurrentFarm: fazenda do cookie, senão a primeira.
    const selectedFarmId = cookieStore.get("selected-farm-id")?.value;
    const selected = farms.find((f) => f.id === selectedFarmId);
    const current = selected ?? farms[0] ?? null;

    const managedFarmIds = farms
      .filter((f) => f.role === "OWNER" || f.role === "ADMIN")
      .map((f) => f.id);
    const pendingRequests =
      managedFarmIds.length > 0
        ? await db.farmRequest.count({
            where: { farmId: { in: managedFarmIds }, status: "PENDENTE" },
          })
        : 0;

    const response = NextResponse.json({
      user,
      farm: current ? { id: current.id, name: current.name, code: current.code } : null,
      role: current?.role ?? null,
      farms,
      pendingRequests,
    });

    // Cookie apontando para fazenda da qual o usuário saiu/foi removido:
    // corrige para a fazenda mostrada, assim site e API concordam.
    if (selectedFarmId && !selected && current) {
      response.cookies.set("selected-farm-id", current.id, {
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
        sameSite: "lax",
      });
    }

    return response;
  } catch (e) {
    console.error("Error in /api/auth/me:", e);
    return NextResponse.json({ user: null, reason: "server-error" });
  }
}
