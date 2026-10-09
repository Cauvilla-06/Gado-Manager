import { db } from "@/lib/db";
import { animalSchema } from "@/lib/validations";
import { ConflictError } from "@/lib/api-errors";
import { z } from "zod";

const includeWithRelations = {
  ciclos: {
    orderBy: { numeroCiclo: "desc" as const },
    include: {
      pesagens: {
        orderBy: { dataPesagem: "asc" as const },
        include: {
          criadoPor: { select: { id: true, name: true } },
        },
      },
      vacinas: {
        orderBy: { dataAplicacao: "asc" as const },
        include: {
          criadoPor: { select: { id: true, name: true } },
        },
      },
      vermifugos: {
        orderBy: { dataAplicacao: "asc" as const },
        include: {
          criadoPor: { select: { id: true, name: true } },
        },
      },
      vitaminas: {
        orderBy: { dataAplicacao: "asc" as const },
        include: {
          criadoPor: { select: { id: true, name: true } },
        },
      },
    },
  },
};

export async function getAllAnimals(farmId: string, status?: string) {
  const where: Record<string, unknown> = { farmId };
  if (status && status !== "all") {
    where.status = status;
  }
  const animals = await db.animal.findMany({
    where,
    orderBy: { atualizadoEm: "desc" },
    include: includeWithRelations,
  });
  return animals;
}

/**
 * Lightweight version for dashboard/list views.
 * Only fetches the active cycle's first and last weight,
 * plus counts for vaccines, vermifuges, and vitamins.
 */
export async function getAllAnimalsSummary(farmId: string, status?: string) {
  const where: Record<string, unknown> = { farmId };
  if (status && status !== "all") {
    where.status = status;
  }
  const animals = await db.animal.findMany({
    where,
    orderBy: { atualizadoEm: "desc" },
    select: {
      id: true,
      numeroIdentificacao: true,
      status: true,
      ciclos: {
        where: { status: "ATIVO" },
        select: {
          numeroCiclo: true,
          pesagens: {
            orderBy: { dataPesagem: "asc" as const },
            select: {
              pesoKg: true,
              dataPesagem: true,
            },
          },
          _count: {
            select: {
              vacinas: true,
              vermifugos: true,
              vitaminas: true,
            },
          },
        },
        take: 1,
      },
    },
  });
  return animals;
}

export async function getAnimalById(id: string, farmId?: string) {
  const where: Record<string, string> = { id };
  if (farmId) where.farmId = farmId;

  const animal = await db.animal.findFirst({
    where,
    include: includeWithRelations,
  });
  return animal;
}

export async function getAnimalByNumero(numero: string, farmId: string) {
  const animal = await db.animal.findFirst({
    where: { numeroIdentificacao: numero, farmId },
    include: includeWithRelations,
  });
  return animal;
}

export async function createAnimal(
  data: z.infer<typeof animalSchema>,
  farmId: string
) {
  const validated = animalSchema.parse(data);

  // Use atomic transaction: check duplicate + create animal + create cycle + link cycle
  return db.$transaction(async (tx) => {
    // Check if an active animal with same number exists in this farm
    const existing = await tx.animal.findFirst({
      where: {
        numeroIdentificacao: validated.numeroIdentificacao,
        farmId,
        status: "ATIVO",
      },
    });

    if (existing) {
      throw new ConflictError(
        `Já existe um animal ativo com o número ${validated.numeroIdentificacao}`
      );
    }

    const animal = await tx.animal.create({
      data: {
        numeroIdentificacao: validated.numeroIdentificacao,
        status: "ATIVO",
        farmId,
      },
    });

    // Create first cycle
    const cycle = await tx.animalCycle.create({
      data: {
        animalId: animal.id,
        numeroCiclo: 1,
        status: "ATIVO",
      },
    });

    // Link cycle to animal
    const updated = await tx.animal.update({
      where: { id: animal.id },
      data: { cicloAtualId: cycle.id },
    });

    return { animal: updated, cycle };
  });
}

/**
 * Exclui um animal (com todos os ciclos/registros, via cascade).
 * Valida que o animal pertence à fazenda antes de excluir.
 */
export async function deleteAnimal(id: string, farmId: string) {
  const animal = await db.animal.findFirst({
    where: { id, farmId },
    select: { id: true },
  });
  if (!animal) {
    throw new ConflictError("Animal não encontrado nesta fazenda");
  }
  await db.animal.delete({ where: { id } });
}

/**
 * Cria vários animais de uma vez (usado pelo bot de cadastro).
 * Cada animal é criado em transação própria: duplicados são pulados (não
 * abortam o lote) e o resultado reporta criados/duplicados individualmente.
 */
export async function createAnimalsBatch(
  numeros: string[],
  farmId: string
): Promise<{
  criados: Array<{ numeroIdentificacao: string; id: string }>;
  duplicados: string[];
  erros: Array<{ numeroIdentificacao: string; erro: string }>;
}> {
  const criados: Array<{ numeroIdentificacao: string; id: string }> = [];
  const duplicados: string[] = [];
  const erros: Array<{ numeroIdentificacao: string; erro: string }> = [];

  for (const numero of numeros) {
    try {
      const validated = animalSchema.parse({ numeroIdentificacao: numero });
      const result = await db.$transaction(async (tx) => {
        const existing = await tx.animal.findFirst({
          where: {
            numeroIdentificacao: validated.numeroIdentificacao,
            farmId,
            status: "ATIVO",
          },
        });
        if (existing) return null;

        const animal = await tx.animal.create({
          data: {
            numeroIdentificacao: validated.numeroIdentificacao,
            status: "ATIVO",
            farmId,
          },
        });

        const cycle = await tx.animalCycle.create({
          data: {
            animalId: animal.id,
            numeroCiclo: 1,
            status: "ATIVO",
          },
        });

        return tx.animal.update({
          where: { id: animal.id },
          data: { cicloAtualId: cycle.id },
        });
      });

      if (result === null) {
        duplicados.push(validated.numeroIdentificacao);
      } else {
        criados.push({
          numeroIdentificacao: validated.numeroIdentificacao,
          id: result.id,
        });
      }
    } catch (err) {
      // Outro cadastro simultâneo criou o mesmo número (índice único de ativos)
      if (err && typeof err === "object" && "code" in err && err.code === "P2002") {
        duplicados.push(numero);
        continue;
      }
      erros.push({
        numeroIdentificacao: numero,
        erro:
          err && typeof err === "object" && "issues" in err
            ? "Número inválido"
            : "Erro ao cadastrar",
      });
      if (!(err && typeof err === "object" && "issues" in err)) {
        console.error("createAnimalsBatch error:", err);
      }
    }
  }

  return { criados, duplicados, erros };
}

/**
 * Exclui vários animais de uma vez (usado pelo bot de exclusão).
 * Valida ownership por fazenda e retorna o que foi excluído/não encontrado.
 */
export async function deleteAnimalsBatch(
  animalIds: string[],
  farmId: string
): Promise<{
  excluidos: string[];
  naoEncontrados: string[];
}> {
  // Garante que só deletamos animais da fazenda informada (IDOR-safe).
  const animais = await db.animal.findMany({
    where: { id: { in: animalIds }, farmId },
    select: { id: true },
  });
  const validIds = new Set(animais.map((a) => a.id));
  const naoEncontrados = animalIds.filter((id) => !validIds.has(id));

  if (validIds.size > 0) {
    await db.animal.deleteMany({
      where: { id: { in: [...validIds] }, farmId },
    });
  }

  return { excluidos: [...validIds], naoEncontrados };
}

export async function searchAnimals(
  query: string,
  farmId: string,
  filters?: { status?: string }
) {
  const where: Record<string, unknown> = { farmId };

  if (query) {
    where.numeroIdentificacao = { contains: query };
  }

  if (filters?.status && filters.status !== "all") {
    where.status = filters.status;
  }

  return db.animal.findMany({
    where,
    orderBy: { atualizadoEm: "desc" },
    include: includeWithRelations,
  });
}

/**
 * Lightweight search version for list views.
 */
export async function searchAnimalsSummary(
  query: string,
  farmId: string,
  filters?: { status?: string }
) {
  const where: Record<string, unknown> = { farmId };

  if (query) {
    where.numeroIdentificacao = { contains: query };
  }

  if (filters?.status && filters.status !== "all") {
    where.status = filters.status;
  }

  return db.animal.findMany({
    where,
    orderBy: { atualizadoEm: "desc" },
    select: {
      id: true,
      numeroIdentificacao: true,
      status: true,
      ciclos: {
        where: { status: "ATIVO" },
        select: {
          numeroCiclo: true,
          pesagens: {
            orderBy: { dataPesagem: "asc" as const },
            select: {
              pesoKg: true,
              dataPesagem: true,
            },
          },
          _count: {
            select: {
              vacinas: true,
              vermifugos: true,
              vitaminas: true,
            },
          },
        },
        take: 1,
      },
    },
  });
}
