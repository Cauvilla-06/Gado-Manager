import { db } from "@/lib/db";
import { vitaminSchema } from "@/lib/validations";
import { assertCanRecord } from "@/services/record-guards";
import { z } from "zod";

type VitaminInput = z.input<typeof vitaminSchema>;

export async function getVitaminsByAnimal(animalId: string, cicloId?: string) {
  const where: Record<string, string> = { animalId };
  if (cicloId) where.cicloId = cicloId;

  return db.vitamin.findMany({
    where,
    orderBy: { dataAplicacao: "desc" },
    include: {
      criadoPor: { select: { id: true, name: true } },
    },
  });
}

export async function createVitamin(data: VitaminInput) {
  const validated = vitaminSchema.parse(data);

  // Atomic: validate + create + update timestamp
  return db.$transaction(async (tx) => {
    await assertCanRecord(tx, validated.animalId, validated.cicloId);

    const [record] = await Promise.all([
      tx.vitamin.create({
        data: {
          animalId: validated.animalId,
          cicloId: validated.cicloId,
          criadoPorId: validated.criadoPorId,
          nomeVitamina: validated.nomeVitamina,
          dose: validated.dose,
          dataAplicacao: new Date(validated.dataAplicacao),
          dataProximaDose: validated.dataProximaDose
            ? new Date(validated.dataProximaDose)
            : undefined,
          observacao: validated.observacao,
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
