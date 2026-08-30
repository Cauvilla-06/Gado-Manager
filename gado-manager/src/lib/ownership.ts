import { db } from "@/lib/db";

/**
 * Verifica se um animal pertence à fazenda especificada.
 * Previne acesso cruzado entre fazendas (IDOR).
 */
export async function animalBelongsToFarm(
  animalId: string,
  farmId: string
): Promise<boolean> {
  const animal = await db.animal.findUnique({
    where: { id: animalId },
    select: { farmId: true },
  });

  return animal?.farmId === farmId;
}

/**
 * Verifica se um ciclo pertence ao animal especificado.
 */
export async function cycleBelongsToAnimal(
  cicloId: string,
  animalId: string
): Promise<boolean> {
  const cycle = await db.animalCycle.findUnique({
    where: { id: cicloId },
    select: { animalId: true },
  });

  return cycle?.animalId === animalId;
}

/**
 * Verifica se o usuário tem permissão de escrita na fazenda.
 * OWNER e ADMIN podem escrever. MEMBER só lê.
 */
export async function userCanWriteToFarm(
  userId: string,
  farmId: string
): Promise<boolean> {
  const membership = await db.farmMembership.findFirst({
    where: { userId, farmId },
    select: { role: true },
  });

  if (!membership) return false;

  return ["OWNER", "ADMIN"].includes(membership.role);
}

/**
 * Verifica se o usuário é dono da fazenda.
 */
export async function userIsFarmOwner(
  userId: string,
  farmId: string
): Promise<boolean> {
  const membership = await db.farmMembership.findFirst({
    where: { userId, farmId },
    select: { role: true },
  });

  return membership?.role === "OWNER";
}

/**
 * Erro customizado para falha de ownership.
 */
export class OwnershipError extends Error {
  constructor(resource: string) {
    super(`${resource} não pertence a esta fazenda`);
    this.name = "OwnershipError";
  }
}
