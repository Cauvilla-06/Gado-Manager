import { db } from "@/lib/db";
import { syncPayloadSchema } from "@/lib/validations";
import type { SyncPayload, SyncResult } from "@/types";

/**
 * Resolve múltiplos animais por número em batch.
 * Reduz N queries para 1 query.
 */
async function findAnimalsByNumeros(
  numeros: string[],
  farmId: string
): Promise<Map<string, { id: string }>> {
  const uniqueNumeros = [...new Set(numeros)];
  const animals = await db.animal.findMany({
    where: {
      numeroIdentificacao: { in: uniqueNumeros },
      farmId,
    },
    select: { id: true, numeroIdentificacao: true },
  });

  const map = new Map<string, { id: string }>();
  for (const animal of animals) {
    map.set(animal.numeroIdentificacao, { id: animal.id });
  }
  return map;
}

/**
 * Resolve múltiplos ciclos ativos em batch.
 * Reduz N queries para 1 query.
 */
async function resolveCicloIds(
  animalIds: string[]
): Promise<Map<string, string>> {
  const uniqueIds = [...new Set(animalIds)];
  const cycles = await db.animalCycle.findMany({
    where: {
      animalId: { in: uniqueIds },
      status: "ATIVO",
    },
    orderBy: { numeroCiclo: "desc" },
    select: { animalId: true, id: true },
  });

  // Pegar apenas o ciclo mais recente por animal
  const map = new Map<string, string>();
  for (const cycle of cycles) {
    if (!map.has(cycle.animalId)) {
      map.set(cycle.animalId, cycle.id);
    }
  }
  return map;
}

/**
 * Verificar duplicatas em batch por clientGeneratedId.
 */
async function findDuplicates(
  clientIds: string[],
  model: "weightRecord" | "vaccination" | "vermifuge" | "vitamin"
): Promise<Set<string>> {
  const uniqueIds = [...new Set(clientIds)];
  if (uniqueIds.length === 0) return new Set();

  const dbModel = db[model] as unknown as {
    findMany: (args: {
      where: { clientGeneratedId: { in: string[] } };
      select: { clientGeneratedId: true };
    }) => Promise<Array<{ clientGeneratedId: string | null }>>;
  };
  const existing = await dbModel.findMany({
    where: { clientGeneratedId: { in: uniqueIds } },
    select: { clientGeneratedId: true },
  });

  return new Set(existing.map((e) => e.clientGeneratedId).filter((id): id is string => id !== null));
}

/**
 * Processa um batch de registros de forma otimizada.
 * Usa queries em batch para evitar N+1.
 */
async function processBatch<T extends { clientGeneratedId: string; animalNumero: string; cicloId?: string }>(
  records: T[],
  farmId: string,
  model: "weightRecord" | "vaccination" | "vermifuge" | "vitamin",
  errorPrefix: string,
  result: SyncResult,
  createManyFn: (data: { animalId: string; cicloId: string; records: T[] }) => Promise<number>
): Promise<void> {
  if (records.length === 0) return;

  // 1. Buscar duplicatas em batch
  const duplicates = await findDuplicates(
    records.map((r) => r.clientGeneratedId),
    model
  );

  const validRecords = records.filter((r) => {
    if (duplicates.has(r.clientGeneratedId)) {
      result.duplicados++;
      return false;
    }
    return true;
  });

  if (validRecords.length === 0) return;

  // 2. Buscar animais em batch
  const animalMap = await findAnimalsByNumeros(
    validRecords.map((r) => r.animalNumero),
    farmId
  );

  // 3. Agrupar por animalId para resolver ciclos em batch
  const animalIds = new Set<string>();
  for (const record of validRecords) {
    const animal = animalMap.get(record.animalNumero);
    if (!animal) {
      result.erros.push(`${errorPrefix} Animal nº ${record.animalNumero} não encontrado`);
      continue;
    }
    animalIds.add(animal.id);
  }

  // 4. Resolver ciclos em batch
  const cicloMap = await resolveCicloIds([...animalIds]);

  // 5. Processar registros válidos
  const recordsByAnimal = new Map<string, T[]>();
  for (const record of validRecords) {
    const animal = animalMap.get(record.animalNumero);
    if (!animal) continue;

    const cicloId = record.cicloId || cicloMap.get(animal.id);
    if (!cicloId) {
      result.erros.push(`${errorPrefix} Nenhum ciclo ativo para animal nº ${record.animalNumero}`);
      continue;
    }

    const key = `${animal.id}:${cicloId}`;
    if (!recordsByAnimal.has(key)) {
      recordsByAnimal.set(key, []);
    }
    recordsByAnimal.get(key)!.push(record);
  }

  // 6. Criar registros em batch
  for (const [key, batch] of recordsByAnimal) {
    const [animalId, cicloId] = key.split(":");
    try {
      const count = await createManyFn({ animalId, cicloId, records: batch });
      switch (model) {
        case "weightRecord":
          result.pesagensProcessadas += count;
          break;
        case "vaccination":
          result.vacinasProcessadas += count;
          break;
        case "vermifuge":
          result.vermifugosProcessados += count;
          break;
        case "vitamin":
          result.vitaminasProcessadas += count;
          break;
      }
    } catch (err) {
      result.erros.push(
        `${errorPrefix} Erro ao criar ${batch.length} registros: ${err instanceof Error ? err.message : "Erro desconhecido"}`
      );
    }
  }
}

export async function processSync(
  rawPayload: unknown,
  farmId: string
): Promise<SyncResult> {
  const validated = syncPayloadSchema.parse(rawPayload) as SyncPayload;
  const result: SyncResult = {
    pesagensProcessadas: 0,
    vacinasProcessadas: 0,
    vermifugosProcessados: 0,
    vitaminasProcessadas: 0,
    duplicados: 0,
    erros: [],
  };

  // Processar pesagens em batch
  await processBatch(
    validated.pesagens,
    farmId,
    "weightRecord",
    "[Pesagem]",
    result,
    async ({ animalId, cicloId, records }) => {
      const data = records.map((r) => ({
        animalId,
        cicloId,
        pesoKg: r.pesoKg,
        dataPesagem: new Date(r.dataPesagem),
        observacao: r.observacao,
        origem: "ANDROID" as const,
        clientGeneratedId: r.clientGeneratedId,
        sincronizado: true,
      }));

      const created = await db.weightRecord.createMany({ data });
      return created.count;
    }
  );

  // Processar vacinas em batch
  await processBatch(
    validated.vacinas,
    farmId,
    "vaccination",
    "[Vacina]",
    result,
    async ({ animalId, cicloId, records }) => {
      const data = records.map((r) => ({
        animalId,
        cicloId,
        nomeVacina: r.nomeVacina,
        dataAplicacao: new Date(r.dataAplicacao),
        dataProximaDose: r.dataProximaDose ? new Date(r.dataProximaDose) : null,
        lote: r.lote,
        observacao: r.observacao,
        origem: "ANDROID" as const,
        clientGeneratedId: r.clientGeneratedId,
      }));

      const created = await db.vaccination.createMany({ data });
      return created.count;
    }
  );

  // Processar vermífugos em batch
  await processBatch(
    validated.vermifugos ?? [],
    farmId,
    "vermifuge",
    "[Vermífugo]",
    result,
    async ({ animalId, cicloId, records }) => {
      const data = records.map((r) => ({
        animalId,
        cicloId,
        nomeVermifugo: r.nomeVermifugo,
        dose: r.dose,
        dataAplicacao: new Date(r.dataAplicacao),
        dataProximaDose: r.dataProximaDose ? new Date(r.dataProximaDose) : null,
        observacao: r.observacao,
        origem: "ANDROID" as const,
        clientGeneratedId: r.clientGeneratedId,
      }));

      const created = await db.vermifuge.createMany({ data });
      return created.count;
    }
  );

  // Processar vitaminas em batch
  await processBatch(
    validated.vitaminas ?? [],
    farmId,
    "vitamin",
    "[Vitamina]",
    result,
    async ({ animalId, cicloId, records }) => {
      const data = records.map((r) => ({
        animalId,
        cicloId,
        nomeVitamina: r.nomeVitamina,
        dose: r.dose,
        dataAplicacao: new Date(r.dataAplicacao),
        dataProximaDose: r.dataProximaDose ? new Date(r.dataProximaDose) : null,
        observacao: r.observacao,
        origem: "ANDROID" as const,
        clientGeneratedId: r.clientGeneratedId,
      }));

      const created = await db.vitamin.createMany({ data });
      return created.count;
    }
  );

  return result;
}
