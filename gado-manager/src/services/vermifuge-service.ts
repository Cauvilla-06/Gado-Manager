import { db } from "@/lib/db";
import { vermifugeSchema } from "@/lib/validations";
import { assertCanRecord } from "@/services/record-guards";
import { z } from "zod";

type VermifugeInput = z.input<typeof vermifugeSchema>;

export async function getVermifugesByAnimal(animalId: string, cicloId?: string) {
  const where: Record<string, string> = { animalId };
  if (cicloId) where.cicloId = cicloId;

  return db.vermifuge.findMany({
    where,
    orderBy: { dataAplicacao: "desc" },
    include: {
      criadoPor: { select: { id: true, name: true } },
    },
  });
}

export async function createVermifuge(data: VermifugeInput) {
  const validated = vermifugeSchema.parse(data);

  // Atomic: validate + create + update timestamp
  return db.$transaction(async (tx) => {
    await assertCanRecord(tx, validated.animalId, validated.cicloId);

    const [record] = await Promise.all([
      tx.vermifuge.create({
        data: {
          animalId: validated.animalId,
          cicloId: validated.cicloId,
          criadoPorId: validated.criadoPorId,
          nomeVermifugo: validated.nomeVermifugo,
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
