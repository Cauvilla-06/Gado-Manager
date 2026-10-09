import { db } from "@/lib/db";
import { vaccinationSchema } from "@/lib/validations";
import { assertCanRecord, resolveExisting } from "@/services/record-guards";
import { z } from "zod";

type VaccinationInput = z.infer<typeof vaccinationSchema>;

export async function createVaccination(data: VaccinationInput) {
  const validated = vaccinationSchema.parse(data);

  // Idempotency: check before transaction
  if (validated.clientGeneratedId) {
    const existing = await db.vaccination.findUnique({
      where: { clientGeneratedId: validated.clientGeneratedId },
    });
    const reused = resolveExisting(existing, validated.animalId);
    if (reused) return reused;
  }

  // Atomic: validate + create + update timestamp
  return db.$transaction(async (tx) => {
    await assertCanRecord(tx, validated.animalId, validated.cicloId);

    const [record] = await Promise.all([
      tx.vaccination.create({
        data: {
          animalId: validated.animalId,
          cicloId: validated.cicloId,
          criadoPorId: validated.criadoPorId,
          nomeVacina: validated.nomeVacina,
          dataAplicacao: new Date(validated.dataAplicacao),
          dataProximaDose: validated.dataProximaDose
            ? new Date(validated.dataProximaDose)
            : null,
          lote: validated.lote,
          observacao: validated.observacao,
          origem: validated.origem,
          clientGeneratedId: validated.clientGeneratedId,
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

export async function getVaccinationsByAnimal(animalId: string, cicloId?: string) {
  const where: Record<string, string> = { animalId };
  if (cicloId) where.cicloId = cicloId;

  return db.vaccination.findMany({
    where,
    orderBy: { dataAplicacao: "asc" },
  });
}

export async function getVaccinationsByCycle(cicloId: string) {
  return db.vaccination.findMany({
    where: { cicloId },
    orderBy: { dataAplicacao: "asc" },
  });
}
