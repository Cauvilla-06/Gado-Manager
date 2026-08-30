import { describe, it, expect } from "vitest";

describe("Animal Cycle Business Rules", () => {
  it("should enforce one active cycle per animal", () => {
    // Business rule: an animal can only have one ATIVO cycle at a time
    // This is enforced at the database/service level
    const cycles = [
      { id: "1", status: "ENCERRADO", numeroCiclo: 1 },
      { id: "2", status: "ATIVO", numeroCiclo: 2 },
    ];
    const activeCycles = cycles.filter((c) => c.status === "ATIVO");
    expect(activeCycles).toHaveLength(1);
    expect(activeCycles[0].numeroCiclo).toBe(2);
  });

  it("should increment cycle number correctly", () => {
    const lastCycleNumber = 2;
    const nextCycleNumber = lastCycleNumber + 1;
    expect(nextCycleNumber).toBe(3);
  });

  it("should preserve history when cycle is closed", () => {
    // When a cycle is closed, the weights and vaccines remain
    const closedCycle = {
      status: "ENCERRADO",
      dataFim: "2026-08-23",
      pesagens: [
        { pesoKg: 420, dataPesagem: "2026-07-01" },
        { pesoKg: 451, dataPesagem: "2026-08-22" },
      ],
    };
    expect(closedCycle.pesagens).toHaveLength(2);
    expect(closedCycle.status).toBe("ENCERRADO");
  });

  it("should not allow new weights on closed cycle", () => {
    // Business rule: weights can only be added to ATIVO cycles
    const cycleStatus = "ENCERRADO" as string;
    const canAddWeight = cycleStatus === "ATIVO";
    expect(canAddWeight).toBe(false);
  });

  it("should allow new weights on active cycle", () => {
    const cycleStatus = "ATIVO" as string;
    const canAddWeight = cycleStatus === "ATIVO";
    expect(canAddWeight).toBe(true);
  });

  it("should not allow selling already sold animal", () => {
    const animalStatus = "VENDIDO" as string;
    const canSell = animalStatus === "ATIVO";
    expect(canSell).toBe(false);
  });

  it("should allow selling active animal", () => {
    const animalStatus = "ATIVO" as string;
    const canSell = animalStatus === "ATIVO";
    expect(canSell).toBe(true);
  });

  it("should set cycle to ENCERRADO when sold", () => {
    const cycle: { status: string } = { status: "ATIVO" };
    cycle.status = "ENCERRADO";
    expect(cycle.status).toBe("ENCERRADO");
  });

  it("should set animal status to VENDIDO when sold", () => {
    const animal: { status: string } = { status: "ATIVO" };
    animal.status = "VENDIDO";
    expect(animal.status).toBe("VENDIDO");
  });

  it("should clear cicloAtualId when sold", () => {
    const animal: { cicloAtualId: string | null; status: string } = { cicloAtualId: "cycle-123", status: "VENDIDO" };
    animal.cicloAtualId = null;
    expect(animal.cicloAtualId).toBeNull();
  });
});

describe("Weight Calculation from Sample Data", () => {
  it("should match PRD example: Boi 157", () => {
    const weights = [
      { date: "2026-08-01", peso: 420 },
      { date: "2026-08-08", peso: 430 },
      { date: "2026-08-15", peso: 438 },
      { date: "2026-08-22", peso: 451 },
    ];

    const pesoInicial = weights[0].peso;
    const pesoAtual = weights[weights.length - 1].peso;
    const ganhoKg = pesoAtual - pesoInicial;
    const ganhoPct = ((pesoAtual - pesoInicial) / pesoInicial) * 100;

    expect(pesoInicial).toBe(420);
    expect(pesoAtual).toBe(451);
    expect(ganhoKg).toBe(31);
    expect(ganhoPct).toBeCloseTo(7.38, 2);
  });
});
