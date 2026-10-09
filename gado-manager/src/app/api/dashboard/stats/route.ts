import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireFarm } from "@/lib/farm";
import { apiHandler } from "@/lib/api-errors";

export const GET = apiHandler(async () => {
  const { farm } = await requireFarm();

  // Use a single query to aggregate everything we need
  const [stats, animalsSummary] = await Promise.all([
    // Aggregate counts in a single query
    db.animal.groupBy({
      by: ["status"],
      where: { farmId: farm.id },
      _count: { id: true },
    }),
    // Get animals with only the data needed for the dashboard list
    db.animal.findMany({
      where: { farmId: farm.id },
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
          },
          take: 1,
        },
      },
    }),
  ]);

  // Compute stats from the grouped result
  let totalAtivos = 0;
  let totalVendidos = 0;
  for (const group of stats) {
    if (group.status === "ATIVO") totalAtivos = group._count.id;
    else if (group.status === "VENDIDO") totalVendidos = group._count.id;
  }

  // Compute per-animal summary on the server side
  const animalItems = animalsSummary.map((animal) => {
    const activeCycle = animal.ciclos[0];
    const pesagens = activeCycle?.pesagens || [];

    let pesoAtual: number | null = null;
    let pesoInicial: number | null = null;
    let ultimaPesagem: string | null = null;

    if (pesagens.length > 0) {
      pesoInicial = pesagens[0].pesoKg;
      pesoAtual = pesagens[pesagens.length - 1].pesoKg;
      ultimaPesagem = pesagens[pesagens.length - 1].dataPesagem.toISOString();
    }

    const ganhoKg =
      pesoInicial !== null && pesoAtual !== null
        ? Number((pesoAtual - pesoInicial).toFixed(2))
        : null;
    const ganhoPercentual =
      pesoInicial !== null && pesoAtual !== null && pesoInicial > 0
        ? Number((((pesoAtual - pesoInicial) / pesoInicial) * 100).toFixed(2))
        : null;

    return {
      id: animal.id,
      numeroIdentificacao: animal.numeroIdentificacao,
      status: animal.status,
      pesoAtual,
      pesoInicial,
      ganhoKg,
      ganhoPercentual,
      ultimaPesagem,
      cicloAtual: activeCycle?.numeroCiclo || null,
    };
  });

  return NextResponse.json({
    stats: {
      totalAtivos,
      totalVendidos,
      totalAnimais: totalAtivos + totalVendidos,
    },
    animals: animalItems,
  });
});
