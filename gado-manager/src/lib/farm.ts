import { headers } from "next/headers";
import { db } from "@/lib/db";
import { AppError, UnauthorizedError } from "@/lib/api-errors";

/**
 * Get the current user's active farm.
 * The middleware decodes the JWT and passes userId via x-user-id header.
 */
export async function getCurrentFarm() {
  try {
    const h = await headers();
    const userId = h.get("x-user-id");

    if (!userId) {
      return { user: null, farm: null, membership: null };
    }

    // Usuário e vínculo com a fazenda em PARALELO: no Turso cada consulta é
    // uma ida à internet, então duas em sequência dobravam o tempo.
    const selectedFarmId = h.get("x-selected-farm-id");
    const [found, membership] = await Promise.all([
      db.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true, tokenVersion: true },
      }),
      selectedFarmId
        ? // Fazenda escolhida no cookie: só vale se o usuário for membro dela
          db.farmMembership.findFirst({
            where: { userId, farmId: selectedFarmId },
            include: { farm: true },
          })
        : // Sem escolha: primeira fazenda do usuário
          db.farmMembership.findFirst({
            where: { userId },
            include: { farm: true },
            orderBy: { criadoEm: "asc" },
          }),
    ]);

    // Token emitido antes de um "sair de todos os dispositivos" não vale mais
    const tokenVersion = Number(h.get("x-token-version") ?? "0");
    if (!found || found.tokenVersion !== tokenVersion) {
      return { user: null, farm: null, membership: null };
    }

    const user = { id: found.id, name: found.name, email: found.email };

    if (!membership) {
      return { user, farm: null, membership: null };
    }

    // Validar se o usuário tem permissão de leitura na farm
    const validRoles = ["OWNER", "ADMIN", "MEMBER"];
    if (!validRoles.includes(membership.role)) {
      return { user, farm: null, membership: null };
    }

    return {
      user,
      farm: membership.farm,
      membership,
    };
  } catch (error) {
    console.error("getCurrentFarm error:", error);
    return { user: null, farm: null, membership: null };
  }
}

/**
 * Get all farms the user belongs to.
 */
export async function getUserFarms(userId: string) {
  const memberships = await db.farmMembership.findMany({
    where: { userId },
    include: { farm: true },
    orderBy: { criadoEm: "asc" },
  });

  return memberships.map((m) => ({
    farm: m.farm,
    role: m.role,
  }));
}

/**
 * Verifica se o usuário tem acesso de escrita na farm.
 */
export async function canWriteToFarm(userId: string, farmId: string): Promise<boolean> {
  const membership = await db.farmMembership.findFirst({
    where: { userId, farmId },
  });

  if (!membership) return false;

  const writeRoles = ["OWNER", "ADMIN"];
  return writeRoles.includes(membership.role);
}

/**
 * Verifica se o usuário é owner da farm.
 */
export async function isFarmOwner(userId: string, farmId: string): Promise<boolean> {
  const membership = await db.farmMembership.findFirst({
    where: { userId, farmId },
  });

  return membership?.role === "OWNER";
}

/**
 * Para rotas de API: exige usuário autenticado (401) e fazenda ativa (404).
 * Lança AppError — use dentro de apiHandler.
 */
export async function requireFarm() {
  const { user, farm, membership } = await getCurrentFarm();
  if (!user) {
    throw new UnauthorizedError("Sessão expirada. Faça login novamente.");
  }
  if (!farm || !membership) {
    throw new AppError("Nenhuma fazenda encontrada", 404, "NOT_FOUND");
  }
  return { user, farm, membership };
}

/** Para rotas de API que só precisam do usuário autenticado (401). */
export async function requireUser() {
  const { user } = await getCurrentFarm();
  if (!user) {
    throw new UnauthorizedError("Sessão expirada. Faça login novamente.");
  }
  return user;
}
