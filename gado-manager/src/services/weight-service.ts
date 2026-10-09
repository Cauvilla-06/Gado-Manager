import { db } from "@/lib/db";
import { weightRecordSchema } from "@/lib/validations";
import { assertCanRecord, resolveExisting } from "@/services/record-guards";
import { z } from "zod";

type WeightInput = z.infer<typeof weightRecordSchema>;

export async function createWeightRecord(data: WeightInput) {
  const validated = weightRecordSchema.parse(data);

  // Idempotency: check clientGeneratedId before transaction
  if (validated.clientGeneratedId) {
    const existing = await db.weightRecord.findUnique({
      where: { clientGeneratedId: validated.clientGeneratedId },
    });
    const reused = resolveExisting(existing, validated.animalId);
    if (reused) return reused;
  }

  // Atomic: validate + create + update timestamp
  return db.$transaction(async (tx) => {
    await assertCanRecord(tx, validated.animalId, validated.cicloId);

    const [record] = await Promise.all([
      tx.weightRecord.create({
        data: {
          animalId: validated.animalId,
          cicloId: validated.cicloId,
          criadoPorId: validated.criadoPorId,
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
