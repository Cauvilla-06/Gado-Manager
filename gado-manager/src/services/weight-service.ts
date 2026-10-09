import { db } from "@/lib/db";
import { weightRecordSchema } from "@/lib/validations";
import { ConflictError, ValidationError } from "@/lib/api-errors";
import { z } from "zod";

type WeightInput = z.infer<typeof weightRecordSchema>;

export async function createWeightRecord(data: WeightInput) {
  const validated = weightRecordSchema.parse(data);

  // Idempotency: check clientGeneratedId before transaction
  if (validated.clientGeneratedId) {
    const existing = await db.weightRecord.findUnique({
      where: { clientGeneratedId: validated.clientGeneratedId },
    });
    if (existing) return existing;
  }

  // Atomic: validate + create + update timestamp
  return db.$transaction(async (tx) => {
    const animal = await tx.animal.findUnique({ where: { id: validated.animalId } });
    if (!animal) throw new ValidationError("Animal não encontrado");
    if (animal.status === "VENDIDO") throw new ConflictError("Animal já foi vendido");

    const cycle = await tx.animalCycle.findUnique({ where: { id: validated.cicloId } });
    if (!cycle || cycle.animalId !== validated.animalId) throw new ValidationError("Ciclo não encontrado para este animal");
    if (cycle.status !== "ATIVO") throw new ConflictError("Este ciclo já está encerrado");

    const [record] = await Promise.all([
      tx.weightRecord.create({
        data: {
          animalId: validated.animalId,
          cicloId: validated.cicloId,
          pesoKg: validated.pesoKg,
          dataPesagem: new Date(validated.dataPesagem),
          observacao: validated.observacao,
          origem: validated.origem,
          clientGeneratedId: validated.clientGeneratedId,
          sincronizado: true,
        },
      }),
      tx.animal.update({
        where: { id: validated.animalId },
        data: { atualizadoEm: new Date() },
      }),
    ]);

    return record;
  });
}

export async function getWeightsByAnimal(animalId: string, cicloId?: string) {
  const where: Record<string, string> = { animalId };
  if (cicloId) where.cicloId = cicloId;

  return db.weightRecord.findMany({
    where,
    orderBy: { dataPesagem: "asc" },
  });
}

export async function getWeightsByCycle(cicloId: string) {
  return db.weightRecord.findMany({
    where: { cicloId },
    orderBy: { dataPesagem: "asc" },
  });
}
