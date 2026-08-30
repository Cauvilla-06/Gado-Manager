import { db } from "@/lib/db";

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

export async function createVermifuge(data: {
  animalId: string;
  cicloId: string;
  criadoPorId?: string;
  nomeVermifugo: string;
  dose?: string;
  dataAplicacao: string;
  dataProximaDose?: string;
  observacao?: string;
}) {
  if (!data.nomeVermifugo) {
    throw new Error("Nome do vermífugo é obrigatório");
  }
  if (!data.dataAplicacao) {
    throw new Error("Data de aplicação é obrigatória");
  }

  return db.vermifuge.create({
    data: {
      animalId: data.animalId,
      cicloId: data.cicloId,
      criadoPorId: data.criadoPorId,
      nomeVermifugo: data.nomeVermifugo,
      dose: data.dose,
      dataAplicacao: new Date(data.dataAplicacao),
      dataProximaDose: data.dataProximaDose
        ? new Date(data.dataProximaDose)
        : undefined,
      observacao: data.observacao,
    },
  });
}
