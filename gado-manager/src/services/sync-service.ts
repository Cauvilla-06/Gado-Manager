import { z } from "zod";
import { db } from "@/lib/db";
import {
  syncPayloadSchema,
  syncWeightSchema,
  syncVaccinationSchema,
  syncVermifugeSchema,
  syncVitaminSchema,
} from "@/lib/validations";
import type { SyncResult } from "@/types";

type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];

type SyncModel = "weightRecord" | "vaccination" | "vermifuge" | "vitamin";

interface BaseSyncRecord {
  clientGeneratedId: string;
  animalNumero: string;
  cicloId?: string;
}

interface SyncTypeConfig<T extends BaseSyncRecord> {
  label: string;
  model: SyncModel;
  schema: z.ZodType<T>;
  counter: keyof Pick<
    SyncResult,
    "pesagensProcessadas" | "vacinasProcessadas" | "vermifugosProcessados" | "vitaminasProcessadas"
  >;
  createMany: (
    tx: Tx,
    rows: Array<{ record: T; animalId: string; cicloId: string; userId: string }>
  ) => Promise<number>;
}

const optionalDate = (v?: string) => (v ? new Date(v) : null);

const WEIGHTS: SyncTypeConfig<z.infer<typeof syncWeightSchema>> = {
  label: "[Pesagem]",
  model: "weightRecord",
  schema: syncWeightSchema,
  counter: "pesagensProcessadas",
  createMany: async (tx, rows) =>
    (
      await tx.weightRecord.createMany({
        data: rows.map(({ record, animalId, cicloId, userId }) => ({
          animalId,
          cicloId,
          criadoPorId: userId,
          pesoKg: record.pesoKg,
          dataPesagem: new Date(record.dataPesagem),
          observacao: record.observacao,
          origem: "ANDROID",
          clientGeneratedId: record.clientGeneratedId,
          sincronizado: true,
        })),
      })
    ).count,
};

const VACCINES: SyncTypeConfig<z.infer<typeof syncVaccinationSchema>> = {
  label: "[Vacina]",
  model: "vaccination",
  schema: syncVaccinationSchema,
  counter: "vacinasProcessadas",
  createMany: async (tx, rows) =>
    (
      await tx.vaccination.createMany({
        data: rows.map(({ record, animalId, cicloId, userId }) => ({
          animalId,
          cicloId,
          criadoPorId: userId,
          nomeVacina: record.nomeVacina,
          dataAplicacao: new Date(record.dataAplicacao),
          dataProximaDose: optionalDate(record.dataProximaDose),
          lote: record.lote,
          observacao: record.observacao,
          origem: "ANDROID",
          clientGeneratedId: record.clientGeneratedId,
        })),
      })
    ).count,
};

const VERMIFUGES: SyncTypeConfig<z.infer<typeof syncVermifugeSchema>> = {
  label: "[Vermífugo]",
  model: "vermifuge",
  schema: syncVermifugeSchema,
  counter: "vermifugosProcessados",
  createMany: async (tx, rows) =>
    (
      await tx.vermifuge.createMany({
        data: rows.map(({ record, animalId, cicloId, userId }) => ({
          animalId,
          cicloId,
          criadoPorId: userId,
          nomeVermifugo: record.nomeVermifugo,
          dose: record.dose,
          dataAplicacao: new Date(record.dataAplicacao),
          dataProximaDose: optionalDate(record.dataProximaDose),
          observacao: record.observacao,
          origem: "ANDROID",
          clientGeneratedId: record.clientGeneratedId,
        })),
      })
    ).count,
};

const VITAMINS: SyncTypeConfig<z.infer<typeof syncVitaminSchema>> = {
  label: "[Vitamina]",
  model: "vitamin",
  schema: syncVitaminSchema,
  counter: "vitaminasProcessadas",
  createMany: async (tx, rows) =>
    (
      await tx.vitamin.createMany({
        data: rows.map(({ record, animalId, cicloId, userId }) => ({
          animalId,
          cicloId,
          criadoPorId: userId,
          nomeVitamina: record.nomeVitamina,
          dose: record.dose,
          dataAplicacao: new Date(record.dataAplicacao),
          dataProximaDose: optionalDate(record.dataProximaDose),
          observacao: record.observacao,
          origem: "ANDROID",
          clientGeneratedId: record.clientGeneratedId,
        })),
      })
    ).count,
};

/**
 * Resolve animais por número dentro da fazenda.
 * Se existir mais de um com o mesmo número (ex.: um vendido e um ativo),
 * o ATIVO tem prioridade.
 */
async function findAnimalsByNumeros(
  numeros: string[],
  farmId: string
): Promise<Map<string, { id: string; status: string }>> {
  const animals = await db.animal.findMany({
    where: { numeroIdentificacao: { in: [...new Set(numeros)] }, farmId },
    select: { id: true, numeroIdentificacao: true, status: true },
  });

  const map = new Map<string, { id: string; status: string }>();
  for (const animal of animals) {
    const current = map.get(animal.numeroIdentificacao);
    if (!current || (current.status !== "ATIVO" && animal.status === "ATIVO")) {
      map.set(animal.numeroIdentificacao, { id: animal.id, status: animal.status });
    }
  }
  return map;
}

/** Ciclos ATIVOS dos animais informados: animalId → cicloId mais recente. */
async function findActiveCycles(animalIds: string[]): Promise<Map<string, string>> {
  const cycles = await db.animalCycle.findMany({
    where: { animalId: { in: [...new Set(animalIds)] }, status: "ATIVO" },
    orderBy: { numeroCiclo: "desc" },
    select: { animalId: true, id: true },
  });

  const map = new Map<string, string>();
  for (const cycle of cycles) {
    if (!map.has(cycle.animalId)) map.set(cycle.animalId, cycle.id);
  }
  return map;
}

/** Ciclos informados explicitamente pelo app: cicloId → dono e status. */
async function findCyclesById(
  cicloIds: string[]
): Promise<Map<string, { animalId: string; status: string }>> {
  if (cicloIds.length === 0) return new Map();
  const cycles = await db.animalCycle.findMany({
    where: { id: { in: [...new Set(cicloIds)] } },
    select: { id: true, animalId: true, status: true },
  });
  return new Map(cycles.map((c) => [c.id, { animalId: c.animalId, status: c.status }]));
}

async function findExistingClientIds(clientIds: string[], model: SyncModel): Promise<Set<string>> {
  if (clientIds.length === 0) return new Set();

  const dbModel = db[model] as unknown as {
    findMany: (args: {
      where: { clientGeneratedId: { in: string[] } };
      select: { clientGeneratedId: true };
    }) => Promise<Array<{ clientGeneratedId: string | null }>>;
  };
  const existing = await dbModel.findMany({
    where: { clientGeneratedId: { in: clientIds } },
    select: { clientGeneratedId: true },
  });

  return new Set(existing.map((e) => e.clientGeneratedId).filter((id): id is string => id !== null));
}

/** Pega o clientGeneratedId de um item cru (mesmo inválido) para devolver ao app. */
function rawClientId(item: unknown): string | null {
  if (item && typeof item === "object" && "clientGeneratedId" in item) {
    const id = (item as { clientGeneratedId: unknown }).clientGeneratedId;
    if (typeof id === "string" && id.length <= 100) return id;
  }
  return null;
}

function rawAnimalNumero(item: unknown): string {
  if (item && typeof item === "object" && "animalNumero" in item) {
    const n = (item as { animalNumero: unknown }).animalNumero;
    if (typeof n === "string") return n.slice(0, 50);
  }
  return "?";
}

async function processType<T extends BaseSyncRecord>(
  items: unknown[],
  config: SyncTypeConfig<T>,
  farmId: string,
  userId: string,
  result: SyncResult
): Promise<void> {
  if (items.length === 0) return;

  // O formato "Animal nº X " nas mensagens é mantido para versões antigas
  // do app, que usam esse texto para decidir o que manter pendente.
  const reject = (clientId: string | null, numero: string, motivo: string) => {
    result.erros.push(`${config.label} Animal nº ${numero} : ${motivo}`);
    if (clientId) result.rejeitados.push(clientId);
  };

  // 1. Validação individual (um registro ruim não derruba o lote)
  const valid: T[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const parsed = config.schema.safeParse(item);
    if (!parsed.success) {
      reject(rawClientId(item), rawAnimalNumero(item), parsed.error.issues[0]?.message ?? "Dados inválidos");
      continue;
    }
    // Mesmo clientGeneratedId repetido no próprio lote: conta como duplicado
    if (seen.has(parsed.data.clientGeneratedId)) {
      result.duplicados++;
      continue;
    }
    seen.add(parsed.data.clientGeneratedId);
    valid.push(parsed.data);
  }
  if (valid.length === 0) return;

  // 2. Idempotência: o que já existe no servidor é ignorado
  const existing = await findExistingClientIds(
    valid.map((r) => r.clientGeneratedId),
    config.model
  );
  const fresh = valid.filter((r) => {
    if (existing.has(r.clientGeneratedId)) {
      result.duplicados++;
      return false;
    }
    return true;
  });
  if (fresh.length === 0) return;

  // 3. Resolver animal (dentro da fazenda) e ciclo
  const animalMap = await findAnimalsByNumeros(fresh.map((r) => r.animalNumero), farmId);
  const activeCycles = await findActiveCycles([...animalMap.values()].map((a) => a.id));
  const explicitCycles = await findCyclesById(
    fresh.map((r) => r.cicloId).filter((id): id is string => !!id)
  );

  const groups = new Map<string, Array<{ record: T; animalId: string; cicloId: string; userId: string }>>();
  for (const record of fresh) {
    const animal = animalMap.get(record.animalNumero);
    if (!animal) {
      reject(record.clientGeneratedId, record.animalNumero, "não encontrado nesta fazenda");
      continue;
    }
    if (animal.status !== "ATIVO") {
      reject(record.clientGeneratedId, record.animalNumero, "não está ativo (vendido ou inativo)");
      continue;
    }

    let cicloId: string | undefined;
    if (record.cicloId) {
      // Ciclo informado pelo app precisa ser DESTE animal e estar ativo
      const cycle = explicitCycles.get(record.cicloId);
      if (!cycle || cycle.animalId !== animal.id) {
        reject(record.clientGeneratedId, record.animalNumero, "ciclo não pertence a este animal");
        continue;
      }
      if (cycle.status !== "ATIVO") {
        reject(record.clientGeneratedId, record.animalNumero, "ciclo já encerrado");
        continue;
      }
      cicloId = record.cicloId;
    } else {
      cicloId = activeCycles.get(animal.id);
    }
    if (!cicloId) {
      reject(record.clientGeneratedId, record.animalNumero, "nenhum ciclo ativo");
      continue;
    }

    const key = `${animal.id}:${cicloId}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push({ record, animalId: animal.id, cicloId, userId });
  }

  // 4. Gravar por animal/ciclo, atualizando o "atualizadoEm" do animal junto
  for (const rows of groups.values()) {
    try {
      const count = await db.$transaction(async (tx) => {
        const created = await config.createMany(tx, rows);
        await tx.animal.update({
          where: { id: rows[0].animalId },
          data: { atualizadoEm: new Date() },
        });
        return created;
      });
      result[config.counter] += count;
    } catch (err) {
      console.error(`Sync ${config.label} erro ao gravar:`, err);
      for (const { record } of rows) {
        reject(record.clientGeneratedId, record.animalNumero, "erro ao gravar, tente novamente");
      }
    }
  }
}

export async function processSync(
  rawPayload: unknown,
  farmId: string,
  userId: string
): Promise<SyncResult> {
  const payload = syncPayloadSchema.parse(rawPayload);
  const result: SyncResult = {
    pesagensProcessadas: 0,
    vacinasProcessadas: 0,
    vermifugosProcessados: 0,
    vitaminasProcessadas: 0,
    duplicados: 0,
    erros: [],
    rejeitados: [],
  };

  await processType(payload.pesagens, WEIGHTS, farmId, userId, result);
  await processType(payload.vacinas, VACCINES, farmId, userId, result);
  await processType(payload.vermifugos, VERMIFUGES, farmId, userId, result);
  await processType(payload.vitaminas, VITAMINS, farmId, userId, result);

  return result;
}
