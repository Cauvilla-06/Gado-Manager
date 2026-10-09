import { db } from "@/lib/db";
import {
  calculateWeightGain,
  calculateWeightGainPercentage,
  calculateAverageWeight,
  calculateMaxWeight,
  calculateMinWeight,
  generateInterpretation,
} from "@/lib/calculations";
import type { IndividualReport } from "@/types";

export async function getIndividualReport(animalId: string, cicloId?: string): Promise<IndividualReport> {
  const animal = await db.animal.findUnique({ where: { id: animalId } });
  if (!animal) throw new Error("Animal não encontrado");

  const cycle = cicloId
    ? await db.animalCycle.findUnique({ where: { id: cicloId } })
    : await db.animalCycle.findFirst({
        where: { animalId, status: "ATIVO" },
        orderBy: { numeroCiclo: "desc" },
      });

  if (!cycle) throw new Error("Ciclo não encontrado");

  // Parallel query: fetch all data for this cycle in a single batch
  const [pesagens, vacinas, vermifugos, vitaminas] = await Promise.all([
    db.weightRecord.findMany({ where: { cicloId: cycle.id }, orderBy: { dataPesagem: "asc" } }),
    db.vaccination.findMany({ where: { cicloId: cycle.id }, orderBy: { dataAplicacao: "asc" } }),
    db.vermifuge.findMany({ where: { cicloId: cycle.id }, orderBy: { dataAplicacao: "asc" } }),
    db.vitamin.findMany({ where: { cicloId: cycle.id }, orderBy: { dataAplicacao: "asc" } }),
  ]);

  const pesos = pesagens.map((p) => p.pesoKg);
  const pesoInicial = pesos.length > 0 ? pesos[0] : null;
  const pesoAtual = pesos.length > 0 ? pesos[pesos.length - 1] : null;
  const ganhoKg =
    pesoInicial !== null && pesoAtual !== null
      ? calculateWeightGain(pesoAtual, pesoInicial)
      : null;
  const ganhoPercentual =
    pesoInicial !== null && pesoAtual !== null
      ? calculateWeightGainPercentage(pesoAtual, pesoInicial)
      : null;

  // Nota: Os tipos IndividualReport usam string para datas (formato API JSON).
  // Prisma retorna Date objects, que são serializados para string pelo JSON.stringify.
  // Usamos tipo flexível aqui porque o JSON.stringify do Next.js converte Dates para strings.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const report: any = {
    animal,
    cicloAtual: cycle,
    pesoAtual,
    pesoInicial,
    ganhoKg,
    ganhoPercentual,
    maiorPeso: calculateMaxWeight(pesos),
    menorPeso: calculateMinWeight(pesos),
    mediaPeso: calculateAverageWeight(pesos),
    totalPesagens: pesagens.length,
    totalVacinas: vacinas.length,
    totalVermifugos: vermifugos.length,
    totalVitaminas: vitaminas.length,
    pesagens,
    vacinas,
    vermifugos,
    vitaminas,
    interpretacao: generateInterpretation(pesoAtual, pesoInicial),
    dataGeracao: new Date().toISOString(),
  };
  return report;
}

export async function getGeneralReport(farmId: string, filters?: {
  status?: string;
  periodDays?: number;
}) {
  const where: Record<string, unknown> = { farmId };

  if (filters?.status && filters.status !== "all") {
    where.status = filters.status;
  }

  // If periodDays is specified, filter by animals updated within that period
  // Clamp explosivo (audit 2.2): sem limite, datas estouram e quebram a query
  if (filters?.periodDays && filters.periodDays > 0) {
    const periodDays = Math.min(Math.floor(filters.periodDays), 3650); // máx 10 anos
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - periodDays);
    where.atualizadoEm = { gte: cutoff };
  }

  // Batch query: get all animals with their active cycles in ONE query
  const animalsWithCycles = await db.animal.findMany({
    where,
    orderBy: { atualizadoEm: "desc" },
    include: {
      ciclos: {
        where: { status: "ATIVO" },
        orderBy: { numeroCiclo: "desc" },
        take: 1,
        select: {
          id: true,
          numeroCiclo: true,
          animalId: true,
        },
      },
    },
  });

  // Collect all active cycle IDs in one batch
  const activeCycleIds = animalsWithCycles
    .map((a) => a.ciclos[0]?.id)
    .filter((id): id is string => id !== undefined);

  if (activeCycleIds.length === 0) {
    return {
      totalAnimais: 0,
      pesoInicialMedio: 0,
      pesoAtualMedio: 0,
      ganhoMedio: 0,
      maiorGanho: 0,
      menorGanho: 0,
      animais: [],
    };
  }

  // Batch query: fetch ALL weights, vaccines, vermifuges, vitamins for all active cycles at once
  const [allPesagens, allVacinas, allVermifugos, allVitaminas] = await Promise.all([
    db.weightRecord.findMany({
      where: { cicloId: { in: activeCycleIds } },
      orderBy: { dataPesagem: "asc" },
    }),
    db.vaccination.findMany({
      where: { cicloId: { in: activeCycleIds } },
      orderBy: { dataAplicacao: "asc" },
    }),
    db.vermifuge.findMany({
      where: { cicloId: { in: activeCycleIds } },
      orderBy: { dataAplicacao: "asc" },
    }),
    db.vitamin.findMany({
      where: { cicloId: { in: activeCycleIds } },
      orderBy: { dataAplicacao: "asc" },
    }),
  ]);

  // Build lookup maps for O(1) access per cycle
  const pesagensByCycle = new Map<string, typeof allPesagens>();
  const vacinasByCycle = new Map<string, typeof allVacinas>();
  const vermifugosByCycle = new Map<string, typeof allVermifugos>();
  const vitaminasByCycle = new Map<string, typeof allVitaminas>();

  for (const p of allPesagens) {
    const arr = pesagensByCycle.get(p.cicloId);
    if (arr) arr.push(p); else pesagensByCycle.set(p.cicloId, [p]);
  }
  for (const v of allVacinas) {
    const arr = vacinasByCycle.get(v.cicloId);
    if (arr) arr.push(v); else vacinasByCycle.set(v.cicloId, [v]);
  }
  for (const v of allVermifugos) {
    const arr = vermifugosByCycle.get(v.cicloId);
    if (arr) arr.push(v); else vermifugosByCycle.set(v.cicloId, [v]);
  }
  for (const v of allVitaminas) {
    const arr = vitaminasByCycle.get(v.cicloId);
    if (arr) arr.push(v); else vitaminasByCycle.set(v.cicloId, [v]);
  }

  // Now assemble results locally — no more DB queries
  const stats = animalsWithCycles.map((animal) => {
    const cycle = animal.ciclos[0];
    if (!cycle) return null;

    const pesagens = pesagensByCycle.get(cycle.id) || [];
    const pesos = pesagens.map((p) => p.pesoKg);
    const pesoInicial = pesos.length > 0 ? pesos[0] : null;
    const pesoAtual = pesos.length > 0 ? pesos[pesos.length - 1] : null;
    const ganhoKg =
      pesoInicial !== null && pesoAtual !== null
        ? calculateWeightGain(pesoAtual, pesoInicial)
        : null;
    const ganhoPercentual =
      pesoInicial !== null && pesoAtual !== null
        ? calculateWeightGainPercentage(pesoAtual, pesoInicial)
        : null;

    const vacinasCycle = vacinasByCycle.get(cycle.id) || [];
    const vermifugosCycle = vermifugosByCycle.get(cycle.id) || [];
    const vitaminasCycle = vitaminasByCycle.get(cycle.id) || [];

    return {
      animal,
      cycle,
      pesoInicial,
      pesoAtual,
      ganhoKg,
      ganhoPercentual,
      totalPesagens: pesagens.length,
      totalVacinas: vacinasCycle.length,
      totalVermifugos: vermifugosCycle.length,
      totalVitaminas: vitaminasCycle.length,
      pesagensDetalhes: pesagens.map((p) => ({
        id: p.id,
        pesoKg: p.pesoKg,
        dataPesagem: p.dataPesagem.toISOString(),
      })),
      vacinas: vacinasCycle.map((v) => ({
        id: v.id,
        nome: v.nomeVacina,
        dataAplicacao: v.dataAplicacao.toISOString(),
        dataProximaDose: v.dataProximaDose?.toISOString() ?? null,
        lote: v.lote ?? null,
      })),
      vermifugos: vermifugosCycle.map((v) => ({
        id: v.id,
        nome: v.nomeVermifugo,
        dose: v.dose ?? null,
        dataAplicacao: v.dataAplicacao.toISOString(),
        dataProximaDose: v.dataProximaDose?.toISOString() ?? null,
      })),
      vitaminas: vitaminasCycle.map((v) => ({
        id: v.id,
        nome: v.nomeVitamina,
        dose: v.dose ?? null,
        dataAplicacao: v.dataAplicacao.toISOString(),
        dataProximaDose: v.dataProximaDose?.toISOString() ?? null,
      })),
    };
  });

  const validStats = stats.filter(Boolean);

  return {
    totalAnimais: validStats.length,
    pesoInicialMedio:
      validStats.length > 0
        ? calculateAverageWeight(
            validStats
              .filter((s) => s!.pesoInicial !== null)
              .map((s) => s!.pesoInicial!)
          )
        : 0,
    pesoAtualMedio:
      validStats.length > 0
        ? calculateAverageWeight(
            validStats
              .filter((s) => s!.pesoAtual !== null)
              .map((s) => s!.pesoAtual!)
          )
        : 0,
    ganhoMedio:
      validStats.length > 0
        ? calculateAverageWeight(
            validStats
              .filter((s) => s!.ganhoKg !== null)
              .map((s) => s!.ganhoKg!)
          )
        : 0,
    maiorGanho:
      validStats.length > 0
        ? Math.max(
            ...validStats
              .filter((s) => s!.ganhoKg !== null)
              .map((s) => s!.ganhoKg!)
          )
        : 0,
    menorGanho:
      validStats.length > 0
        ? Math.min(
            ...validStats
              .filter((s) => s!.ganhoKg !== null)
              .map((s) => s!.ganhoKg!)
          )
        : 0,
    animais: validStats,
  };
}
