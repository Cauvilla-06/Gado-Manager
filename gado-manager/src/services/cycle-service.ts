import { db } from "@/lib/db";

export async function getCyclesByAnimal(animalId: string) {
  return db.animalCycle.findMany({
    where: { animalId },
    orderBy: { numeroCiclo: "desc" },
    include: {
      pesagens: { orderBy: { dataPesagem: "asc" } },
      vacinas: { orderBy: { dataAplicacao: "asc" } },
    },
  });
}

export async function getActiveCycle(animalId: string) {
  return db.animalCycle.findFirst({
    where: { animalId, status: "ATIVO" },
    orderBy: { numeroCiclo: "desc" },
  });
}

export async function sellAnimal(animalId: string) {
  return db.$transaction(async (tx) => {
    const animal = await tx.animal.findUnique({ where: { id: animalId } });
    if (!animal) throw new Error("Animal não encontrado");
    if (animal.status === "VENDIDO") throw new Error("Animal já foi vendido");

    const activeCycle = await tx.animalCycle.findFirst({
      where: { animalId, status: "ATIVO" },
    });
    if (!activeCycle) throw new Error("Nenhum ciclo ativo encontrado para este animal");

    // Close current cycle and update animal status atomically
    const [updated] = await Promise.all([
      tx.animal.update({
        where: { id: animalId },
        data: { status: "VENDIDO", cicloAtualId: null },
      }),
      tx.animalCycle.update({
        where: { id: activeCycle.id },
        data: { status: "ENCERRADO", dataFim: new Date() },
      }),
    ]);

    return updated;
  });
}

export async function startNewCycle(animalId: string, observacoes?: string) {
  // Use a single atomic transaction for all operations
  return db.$transaction(async (tx) => {
    const animal = await tx.animal.findUnique({ where: { id: animalId } });
    if (!animal) throw new Error("Animal não encontrado");

    // Close any active cycle + get last cycle number in parallel
    const [activeCycle, lastCycle] = await Promise.all([
      tx.animalCycle.findFirst({ where: { animalId, status: "ATIVO" } }),
      tx.animalCycle.findFirst({ where: { animalId }, orderBy: { numeroCiclo: "desc" } }),
    ]);

    // Close active cycle if exists
    if (activeCycle) {
      await tx.animalCycle.update({
        where: { id: activeCycle.id },
        data: { status: "ENCERRADO", dataFim: new Date() },
      });
    }

    const nextNumber = (lastCycle?.numeroCiclo ?? 0) + 1;

    // Create new cycle
    const cycle = await tx.animalCycle.create({
      data: {
        animalId,
        numeroCiclo: nextNumber,
        status: "ATIVO",
        observacoes,
      },
    });

    // Update animal with new cycle (reinstate if VENDIDO)
    await tx.animal.update({
      where: { id: animalId },
      data: {
        ...(animal.status === "VENDIDO" ? { status: "ATIVO" } : {}),
        cicloAtualId: cycle.id,
      },
    });

    return cycle;
  });
}
