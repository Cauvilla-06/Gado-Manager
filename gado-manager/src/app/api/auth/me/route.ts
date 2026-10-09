import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/jwt";
import { db } from "@/lib/db";

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

    const found = await db.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, name: true, email: true, tokenVersion: true },
    });

    if (!found) {
      return NextResponse.json({ user: null, reason: "user-not-found" });
    }

    // Sessão encerrada em "sair de todos os dispositivos"
    if (found.tokenVersion !== (decoded.tokenVersion ?? 0)) {
      return NextResponse.json({ user: null, reason: "revoked" });
    }

    const user = { id: found.id, name: found.name, email: found.email };

    const selectedFarmId = cookieStore.get("selected-farm-id")?.value;

    let membership;
    if (selectedFarmId) {
      membership = await db.farmMembership.findFirst({
        where: { userId: user.id, farmId: selectedFarmId },
        include: { farm: true },
      });
    }
    if (!membership) {
      membership = await db.farmMembership.findFirst({
        where: { userId: user.id },
        include: { farm: true },
        orderBy: { criadoEm: "asc" },
      });
    }

    return NextResponse.json({
      user,
      farm: membership
        ? { id: membership.farm.id, name: membership.farm.name, code: membership.farm.code }
        : null,
      role: membership?.role || null,
    });
  } catch (e) {
    console.error("Error in /api/auth/me:", e);
    return NextResponse.json({ user: null, reason: "server-error" });
  }
}
