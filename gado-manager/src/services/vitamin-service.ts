import { db } from "@/lib/db";
import { ValidationError } from "@/lib/api-errors";

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

export async function createVitamin(data: {
  animalId: string;
  cicloId: string;
  criadoPorId?: string;
  nomeVitamina: string;
  dose?: string;
  dataAplicacao: string;
  dataProximaDose?: string;
  observacao?: string;
}) {
  if (!data.nomeVitamina) {
    throw new ValidationError("Nome da vitamina é obrigatório");
  }
  if (!data.dataAplicacao) {
    throw new ValidationError("Data de aplicação é obrigatória");
  }

  return db.vitamin.create({
    data: {
      animalId: data.animalId,
      cicloId: data.cicloId,
      criadoPorId: data.criadoPorId,
      nomeVitamina: data.nomeVitamina,
      dose: data.dose,
      dataAplicacao: new Date(data.dataAplicacao),
      dataProximaDose: data.dataProximaDose
        ? new Date(data.dataProximaDose)
        : undefined,
      observacao: data.observacao,
    },
  });
}
