import { db } from "@/lib/db";
import { ConflictError, ValidationError } from "@/lib/api-errors";

type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];

/**
 * Regras comuns para lançar um registro de manejo (pesagem, vacina,
 * vermífugo, vitamina) dentro de uma transação:
 * - o animal existe e não foi vendido;
 * - o ciclo existe, é DESTE animal (evita gravar em ciclo de outra fazenda)
 *   e está ativo.
 */
export async function assertCanRecord(tx: Tx, animalId: string, cicloId: string) {
  const animal = await tx.animal.findUnique({ where: { id: animalId } });
  if (!animal) throw new ValidationError("Animal não encontrado");
  if (animal.status === "VENDIDO") throw new ConflictError("Animal já foi vendido");

  const cycle = await tx.animalCycle.findUnique({ where: { id: cicloId } });
  if (!cycle || cycle.animalId !== animalId) {
    throw new ValidationError("Ciclo não encontrado para este animal");
  }
  if (cycle.status !== "ATIVO") throw new ConflictError("Este ciclo já está encerrado");
}

/**
 * Idempotência por clientGeneratedId: se o registro já existe e é do mesmo
 * animal, devolve o existente; se for de outro animal, recusa (não expõe
 * registros alheios).
 */
export function resolveExisting<T extends { animalId: string }>(
  existing: T | null,
  animalId: string
): T | null {
  if (!existing) return null;
  if (existing.animalId !== animalId) {
    throw new ConflictError("Identificador do registro já utilizado");
  }
  return existing;
}
